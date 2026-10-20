import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { createInvitation } from "@/lib/invitations";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";

const createInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  suggestedPersonId: z.string().optional().nullable(),
  suggestedRelation: z.string().optional().nullable(),
  expiresInDays: z.number().min(1).max(30).default(7),
});

// GET /api/spaces/[spaceId]/invitations - List pending and past invitations (Admin only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    await requireSpaceRole(spaceId, Role.ADMIN);

    const invitations = await prisma.invitation.findMany({
      where: { spaceId },
      include: {
        invitedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invitations });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load invitations" },
      { status: err.status || 500 }
    );
  }
}

// POST /api/spaces/[spaceId]/invitations - Generate secure invitation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const { user } = await requireSpaceRole(spaceId, Role.ADMIN);

    const body = await req.json();
    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const invitation = await createInvitation({
      spaceId,
      inviterUserId: user.id,
      email: parsed.data.email,
      role: parsed.data.role as Role,
      suggestedPersonId: parsed.data.suggestedPersonId,
      suggestedRelation: parsed.data.suggestedRelation,
      expiresInDays: parsed.data.expiresInDays,
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${invitation.token}`;

    return NextResponse.json({ invitation, inviteUrl }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to create invitation" },
      { status: err.status || 500 }
    );
  }
}
