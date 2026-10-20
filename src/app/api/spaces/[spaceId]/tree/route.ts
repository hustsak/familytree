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

    // Fetch all relatives in this space
    const people = await prisma.person.findMany({
      where: { spaceId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // Fetch all confirmed and pending relationships in this space
    const relationships = await prisma.relationship.findMany({
      where: { spaceId },
    });

    return NextResponse.json({
      people,
      relationships,
      userRole: membership.role,
      linkedPersonId: membership.personId,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load family tree" },
      { status: err.status || 500 }
    );
  }
}
