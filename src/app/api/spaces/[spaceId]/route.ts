import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const { membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    const space = await prisma.familySpace.findUnique({
      where: { id: spaceId },
      include: {
        _count: {
          select: {
            members: true,
            people: true,
            relationships: true,
          },
        },
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Family space not found" }, { status: 404 });
    }

    return NextResponse.json({
      space: {
        ...space,
        userRole: membership.role,
        linkedPersonId: membership.personId,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to fetch space" }, { status });
  }
}
