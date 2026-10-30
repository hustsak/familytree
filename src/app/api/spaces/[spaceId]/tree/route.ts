import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { sanitizePersonForViewer } from "@/lib/security";
import { fetchSpaceFromRTDB } from "@/lib/firebase/rtdb-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  try {
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    // Fetch actual relatives for this space from PostgreSQL database
    const people = await prisma.person.findMany({
      where: { spaceId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    if (people.length === 0) {
      const rtdbData = await fetchSpaceFromRTDB(spaceId);
      if (rtdbData.people.length > 0) {
        return NextResponse.json({
          space: rtdbData.space,
          people: rtdbData.people,
          relationships: rtdbData.relationships,
          userRole: membership.role,
          linkedPersonId: membership.personId,
        });
      }
    }

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
    console.warn("GET /api/spaces/[spaceId]/tree DB unavailable, falling back to Firebase RTDB:", error);
    const rtdbData = await fetchSpaceFromRTDB(spaceId);
    const cookieLinkedId = req.cookies.get("family_linked_person_id")?.value || null;
    return NextResponse.json({
      space: rtdbData.space,
      people: rtdbData.people,
      relationships: rtdbData.relationships,
      userRole: "OWNER",
      linkedPersonId: cookieLinkedId,
    });
  }
}
