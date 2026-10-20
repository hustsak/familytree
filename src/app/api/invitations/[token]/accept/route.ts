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

    const result = await acceptInvitation(token, user.id);

    return NextResponse.json({
      success: true,
      membership: result.membership,
      space: result.space,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; code?: string };
    return NextResponse.json(
      { error: err.message, code: err.code || "ACCEPT_FAILED" },
      { status: err.status || 400 }
    );
  }
}
