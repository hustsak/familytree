import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole, recordAuditLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, RelationStatus } from "@prisma/client";
import { z } from "zod";
import { verifyCsrfOrigin } from "@/lib/security";

const disputeSchema = z.object({
  reason: z.string().min(5).max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; relationshipId: string }> }
) {
  try {
    const { spaceId, relationshipId } = await params;
    const { user } = await requireSpaceRole(spaceId, Role.MEMBER);

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
      include: { person: true, relatedPerson: true },
    });

    if (!rel || rel.spaceId !== spaceId) {
      return NextResponse.json(
        { error: "Relationship not found in this space" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = disputeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await prisma.relationship.update({
      where: { id: relationshipId },
      data: {
        status: RelationStatus.DISPUTED,
        notes: `[DISPUTE by ${user.fullName} (${user.email})]: ${parsed.data.reason}`,
      },
    });

    await recordAuditLog({
      spaceId,
      actorId: user.id,
      action: "RELATIONSHIP_DISPUTED",
      entityType: "Relationship",
      entityId: relationshipId,
      metadata: {
        reason: parsed.data.reason,
        personId: rel.personId,
        relatedPersonId: rel.relatedPersonId,
      },
    });

    return NextResponse.json({ relationship: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to flag relationship as disputed" },
      { status: err.status || 500 }
    );
  }
}
