import { NextRequest, NextResponse } from "next/server";
import {
  FAMILY_ACCESS_COOKIE,
  FAMILY_ACCESS_COOKIE_VALUE,
  isValidFamilyPasscode,
} from "@/lib/family-gate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const passcode = typeof body?.passcode === "string" ? body.passcode : "";

    if (!isValidFamilyPasscode(passcode)) {
      return NextResponse.json(
        {
          error: "លេខកូដសម្ងាត់គ្រួសារមិនត្រឹមត្រូវទេ (Invalid family passcode)",
        },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      success: true,
      message: "ស្វាគមន៍មកកាន់ កូនចៅត្រកូល ទៀង",
    });

    res.cookies.set(FAMILY_ACCESS_COOKIE, FAMILY_ACCESS_COOKIE_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(FAMILY_ACCESS_COOKIE);
  return res;
}
