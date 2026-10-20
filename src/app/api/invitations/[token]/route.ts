import { NextRequest, NextResponse } from "next/server";
import { validateInvitationToken } from "@/lib/invitations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invitation = await validateInvitationToken(token);

    let suggestedPerson: { id: string; name: string; khmerName?: string | null } | null = null;
    if (invitation.suggestedPersonId) {
      const person = await (await import("@/lib/prisma")).prisma.person.findFirst({
        where: { id: invitation.suggestedPersonId, spaceId: invitation.spaceId },
        select: { id: true, firstName: true, lastName: true, khmerName: true },
      });
      if (person) {
        suggestedPerson = {
          id: person.id,
          name: `${person.firstName} ${person.lastName}`,
          khmerName: person.khmerName,
        };
      }
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        space: {
          id: invitation.space.id,
          name: invitation.space.name,
          description: invitation.space.description,
        },
        inviterName: invitation.invitedBy.fullName,
        suggestedPerson,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; code?: string };
    return NextResponse.json(
      { valid: false, error: err.message, code: err.code || "INVALID_INVITATION" },
      { status: err.status || 400 }
    );
  }
}
