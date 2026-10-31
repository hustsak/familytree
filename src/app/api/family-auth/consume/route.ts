import { NextRequest, NextResponse } from "next/server";
import {
  FAMILY_ACCESS_COOKIE,
  FAMILY_ACCESS_COOKIE_VALUE,
  isLinkPreviewBot,
} from "@/lib/family-gate";
import { consumeOneTimeInviteToken } from "@/lib/firebase/invite-tokens";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const inviteToken = searchParams.get("inviteToken") || "";
  const nextPath = searchParams.get("next") || "/";
  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  // Do not consume one-time token if requested by a chat link-preview bot
  const ua = req.headers.get("user-agent");
  if (isLinkPreviewBot(ua, req.method)) {
    return new NextResponse(
      "<!DOCTYPE html><html><head><title>កូនចៅត្រកូល ទៀង</title><meta name=\"robots\" content=\"noindex,nofollow\"/></head><body></body></html>",
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const isValidAndUnused = await consumeOneTimeInviteToken(inviteToken);

  if (isValidAndUnused) {
    const targetUrl = new URL(safeNext, req.url);
    const res = NextResponse.redirect(targetUrl);
    res.cookies.set(FAMILY_ACCESS_COOKIE, FAMILY_ACCESS_COOKIE_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days for this first recipient's browser
    });
    return res;
  }

  // Token was already used by the first recipient (or invalid) -> require passcode!
  const loginUrl = new URL("/login", req.url);
  if (safeNext && safeNext !== "/") {
    loginUrl.searchParams.set("redirectedFrom", safeNext);
  }
  loginUrl.searchParams.set("reason", "link_used");
  return NextResponse.redirect(loginUrl);
}
