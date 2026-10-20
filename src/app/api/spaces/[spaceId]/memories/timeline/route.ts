import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getSpaceTimeline } from "@/lib/memories";

// GET /api/spaces/[spaceId]/memories/timeline
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    await requireSpaceRole(spaceId, Role.MEMBER);

    const timeline = await getSpaceTimeline(spaceId);
    return NextResponse.json({ timeline });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load family timeline" },
      { status: err.status || 500 }
    );
  }
}
