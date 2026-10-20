import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { listConnectionRequests } from "@/lib/approvals";
import { Role, RequestStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const { user } = await requireSpaceRole(spaceId, Role.ADMIN);

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as RequestStatus | null;

    const requests = await listConnectionRequests(
      spaceId,
      user.id,
      statusParam || undefined
    );

    return NextResponse.json({ requests });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load connection requests" },
      { status: err.status || 500 }
    );
  }
}
