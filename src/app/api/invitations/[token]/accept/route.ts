import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { acceptInvitation } from "@/lib/invitations";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));

    // Find authenticated user or persistent cookie user, or generate family member ID
    const user = await getCurrentUser();
    let userId = user?.id;

    if (!userId || userId === "direct-family-user") {
      const cookieUserId = req.cookies.get("family_user_id")?.value;
      if (cookieUserId) {
        userId = cookieUserId;
      } else {
        userId = "member-" + crypto.randomUUID();
      }
    }

    const result = await acceptInvitation(token, userId, body.personDetails);

    const response = NextResponse.json({
      success: true,
      membership: result.membership,
      space: result.space,
      spaceId: result.space.id,
      personId: result.personId,
    });

    // Save persistent family member cookie for 1 year so login is never required
    response.cookies.set("family_user_id", userId, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; code?: string };
    return NextResponse.json(
      { error: err.message, code: err.code || "ACCEPT_FAILED" },
      { status: err.status || 400 }
    );
  }
}
