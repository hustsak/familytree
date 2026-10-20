import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole, recordAuditLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, RelationStatus } from "@prisma/client";
import { z } from "zod";
import { verifyCsrfOrigin } from "@/lib/security";

const verifySchema = z.object({
  resolutionNotes: z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; relationshipId: string }> }
) {
  try {
    const { spaceId, relationshipId } = await params;
    // Only Council (OWNER or ADMIN) can verify or resolve disputes
    const { user } = await requireSpaceRole(spaceId, Role.ADMIN);

    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!verifyCsrfOrigin(origin, referer)) {
      return NextResponse.json(
        { error: "Forbidden: Cross-site request rejected." },
        { status: 403 }
      );
    }

    const rel = await prisma.relationship.findUnique({
      where: { id: relationshipId },
    });

    if (!rel || rel.spaceId !== spaceId) {
      return NextResponse.json(
        { error: "Relationship not found in this space" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);

    const updated = await prisma.relationship.update({
      where: { id: relationshipId },
      data: {
        status: RelationStatus.CONFIRMED,
        approvedById: user.id,
        notes: parsed.success && parsed.data.resolutionNotes
          ? `[RESOLVED by Council]: ${parsed.data.resolutionNotes}`
          : "[VERIFIED by Council]",
      },
    });

    await recordAuditLog({
      spaceId,
      actorId: user.id,
      action: "RELATIONSHIP_VERIFIED",
      entityType: "Relationship",
      entityId: relationshipId,
      metadata: {
        previousStatus: rel.status,
        resolution: parsed.success ? parsed.data.resolutionNotes : null,
      },
    });

    return NextResponse.json({ relationship: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to verify relationship" },
      { status: err.status || 500 }
    );
  }
}
