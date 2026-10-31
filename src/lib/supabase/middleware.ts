import { NextResponse, type NextRequest } from "next/server";
import {
  FAMILY_ACCESS_COOKIE,
  isFamilyAccessCookieValid,
  isLinkPreviewBot,
} from "@/lib/family-gate";

function withPrivacyHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  return res;
}

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Always allow robots.txt and family-auth endpoints
  if (pathname === "/robots.txt" || pathname.startsWith("/api/family-auth")) {
    return withPrivacyHeaders(NextResponse.next({ request }));
  }

  // 2. Handle one-time invite link (?inviteToken=inv_...)
  const inviteToken = searchParams.get("inviteToken");
  if (inviteToken) {
    // Do not burn one-time token when Telegram/Messenger/WhatsApp preview crawler fetches link
    if (isLinkPreviewBot(request.headers.get("user-agent"), request.method)) {
      return withPrivacyHeaders(
        new NextResponse(
          "<!DOCTYPE html><html><head><title>កូនចៅត្រកូល ទៀង</title><meta name=\"robots\" content=\"noindex,nofollow\"/></head><body></body></html>",
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        )
      );
    }

    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("inviteToken");
    const nextTarget =
      (cleanUrl.pathname.startsWith("/login") || cleanUrl.pathname.startsWith("/dashboard")
        ? "/"
        : cleanUrl.pathname) + (cleanUrl.search || "");

    const consumeUrl = request.nextUrl.clone();
    consumeUrl.pathname = "/api/family-auth/consume";
    consumeUrl.search = "";
    consumeUrl.searchParams.set("inviteToken", inviteToken);
    consumeUrl.searchParams.set("next", nextTarget);
    return withPrivacyHeaders(NextResponse.redirect(consumeUrl));
  }

  // 3. Verify family access cookie
  const cookieVal = request.cookies.get(FAMILY_ACCESS_COOKIE)?.value;
  const hasFamilyAccess = isFamilyAccessCookieValid(cookieVal);

  if (!hasFamilyAccess) {
    if (pathname.startsWith("/api/")) {
      return withPrivacyHeaders(
        NextResponse.json(
          { error: "សូមបញ្ចូលលេខកូដសម្ងាត់គ្រួសារជាមុនសិន (Family passcode required)" },
          { status: 401 }
        )
      );
    }

    if (!pathname.startsWith("/login")) {
      const loginUrl = request.nextUrl.clone();
      const targetPath = pathname + (request.nextUrl.search || "");
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      if (targetPath && targetPath !== "/") {
        loginUrl.searchParams.set("redirectedFrom", targetPath);
      }
      return withPrivacyHeaders(NextResponse.redirect(loginUrl));
    }

    return withPrivacyHeaders(NextResponse.next({ request }));
  }

  // 4. Authenticated family member visiting /login or /dashboard -> redirect to /
  if (pathname.startsWith("/login") || pathname.startsWith("/dashboard")) {
    const targetFrom = searchParams.get("redirectedFrom");
    const url = request.nextUrl.clone();
    if (targetFrom && targetFrom.startsWith("/") && !targetFrom.startsWith("/login")) {
      const parsedTarget = new URL(targetFrom, request.url);
      url.pathname = parsedTarget.pathname;
      url.search = parsedTarget.search;
    } else {
      url.pathname = "/";
      url.search = "";
    }
    return withPrivacyHeaders(NextResponse.redirect(url));
  }

  return withPrivacyHeaders(NextResponse.next({ request }));
}
