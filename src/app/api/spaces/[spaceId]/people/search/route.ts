import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { searchSpaceRelatives } from "@/lib/onboarding";
import { Role } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    // Any active member can search within their space
    await requireSpaceRole(spaceId, Role.MEMBER);

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const relatives = await searchSpaceRelatives(spaceId, query);

    return NextResponse.json({ relatives });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to search relatives" },
      { status: err.status || 500 }
    );
  }
}
