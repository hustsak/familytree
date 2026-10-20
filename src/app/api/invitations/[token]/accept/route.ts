import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { acceptInvitation } from "@/lib/invitations";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const user = await requireAuth();

    const body = await req.json().catch(() => ({}));
    const result = await acceptInvitation(token, user.id, body.personDetails);

    return NextResponse.json({
      success: true,
      membership: result.membership,
      space: result.space,
      spaceId: result.space.id,
      personId: result.personId,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; code?: string };
    return NextResponse.json(
      { error: err.message, code: err.code || "ACCEPT_FAILED" },
      { status: err.status || 400 }
    );
  }
}
