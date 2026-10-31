import { NextResponse, type NextRequest } from "next/server";
import {
  FAMILY_ACCESS_COOKIE,
  FAMILY_ACCESS_COOKIE_VALUE,
  isFamilyAccessCookieValid,
  isValidFamilyPasscode,
} from "@/lib/family-gate";

function withPrivacyHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  return res;
}

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Always allow robots.txt
  if (pathname === "/robots.txt") {
    return withPrivacyHeaders(NextResponse.next({ request }));
  }

  // 2. Check if a shared invite link includes ?familyKey=...
  const familyKeyParam = searchParams.get("familyKey");
  if (familyKeyParam && isValidFamilyPasscode(familyKeyParam)) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("familyKey");
    if (cleanUrl.pathname.startsWith("/login") || cleanUrl.pathname.startsWith("/dashboard")) {
      cleanUrl.pathname = "/";
    }
    const redirectRes = NextResponse.redirect(cleanUrl);
    redirectRes.cookies.set(FAMILY_ACCESS_COOKIE, FAMILY_ACCESS_COOKIE_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return withPrivacyHeaders(redirectRes);
  }

  // 3. Allow the family passcode authentication endpoint
  if (pathname.startsWith("/api/family-auth")) {
    return withPrivacyHeaders(NextResponse.next({ request }));
  }

  // 4. Verify family access cookie
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

  // 5. Authenticated family member visiting /login or /dashboard -> redirect to /
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
