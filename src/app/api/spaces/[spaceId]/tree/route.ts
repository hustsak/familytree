import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { sanitizePersonForViewer } from "@/lib/security";
import { fetchSpaceFromRTDB } from "@/lib/firebase/rtdb-server";
import type { TreePerson, TreeRelationship } from "@/lib/tree-layout";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const cookieLinkedId = req.cookies.get("family_linked_person_id")?.value || null;

  // 1. Fetch live Cloud Firestore data first (real-time source of truth)
  const rtdbData = await fetchSpaceFromRTDB(spaceId);
  if (rtdbData.people.length > 0) {
    return NextResponse.json({
      space: rtdbData.space,
      people: rtdbData.people,
      relationships: rtdbData.relationships,
      userRole: "OWNER",
      linkedPersonId: cookieLinkedId,
    });
  }

  try {
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    const people = await prisma.person.findMany({
      where: { spaceId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const sanitizedPeople = people.map((p) =>
      sanitizePersonForViewer(p, membership.role, membership.personId, user.id)
    );

    const relationships = await prisma.relationship.findMany({
      where: { spaceId },
    });

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
      people: sanitizedPeople as unknown as TreePerson[],
      relationships: relationships as unknown as TreeRelationship[],
      userRole: membership.role,
      linkedPersonId: membership.personId || cookieLinkedId,
    });
  } catch (error: unknown) {
    console.warn("GET /api/spaces/[spaceId]/tree DB fallback:", error);
    return NextResponse.json({
      space: rtdbData.space,
      people: rtdbData.people,
      relationships: rtdbData.relationships,
      userRole: "OWNER",
      linkedPersonId: cookieLinkedId,
    });
  }
}
