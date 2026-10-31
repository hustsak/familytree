import { NextResponse } from "next/server";
import { createOneTimeInviteToken } from "@/lib/firebase/invite-tokens";

export async function POST() {
  try {
    const inviteToken = await createOneTimeInviteToken();
    return NextResponse.json({ inviteToken });
  } catch (err) {
    console.error("Failed to create one-time invite token:", err);
    return NextResponse.json(
      { error: "Failed to create invite link" },
      { status: 500 }
    );
  }
}
