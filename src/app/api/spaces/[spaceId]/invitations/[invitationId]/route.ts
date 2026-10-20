import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { revokeInvitation } from "@/lib/invitations";
import { Role } from "@prisma/client";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; invitationId: string }> }
) {
  try {
    const { spaceId, invitationId } = await params;
    const { user } = await requireSpaceRole(spaceId, Role.ADMIN);

    const revoked = await revokeInvitation(spaceId, user.id, invitationId);

    return NextResponse.json({ success: true, invitation: revoked });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to revoke invitation" },
      { status: err.status || 500 }
    );
  }
}
