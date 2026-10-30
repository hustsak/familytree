import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { sanitizePersonForViewer } from "@/lib/security";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    // Fetch actual relatives for this space from PostgreSQL database
    const people = await prisma.person.findMany({
      where: { spaceId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // Apply Phase 5 privacy controls for living relatives
    const sanitizedPeople = people.map((p) =>
      sanitizePersonForViewer(p, membership.role, membership.personId, user.id)
    );

    // Fetch actual confirmed and pending relationships in this space from database
    const relationships = await prisma.relationship.findMany({
      where: { spaceId },
    });

    // Fetch space details for title
    const space = await prisma.familySpace.findUnique({
      where: { id: spaceId },
      select: { id: true, name: true, slug: true, description: true },
    });

    const normalizedSpaceName =
      !space?.name ||
      space.name === "មែកធាងគ្រួសារ ទៀង (Tieng Family Heritage)" ||
      space.name === "ពង្សាវតារគ្រួសារ (Family Heritage)"
        ? "កូនចៅត្រកូល ទៀង"
        : space.name;

    return NextResponse.json({
      space: space ? { id: space.id, name: normalizedSpaceName } : { id: spaceId, name: "កូនចៅត្រកូល ទៀង" },
      people: sanitizedPeople,
      relationships,
      userRole: membership.role,
      linkedPersonId: membership.personId,
    });
  } catch (error: unknown) {
    console.error("GET /api/spaces/[spaceId]/tree error:", error);
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load family tree", people: [], relationships: [] },
      { status: err.status || 500 }
    );
  }
}
