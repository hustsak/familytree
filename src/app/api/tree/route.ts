import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSpaceFromRTDB } from "@/lib/firebase/rtdb-server";
import type { TreePerson, TreeRelationship } from "@/lib/tree-layout";

export async function GET(req: NextRequest) {
  const cookieLinkedId = req.cookies.get("family_linked_person_id")?.value || null;

  // 1. Always fetch live Cloud Firestore state so real-time cloud updates are reflected
  const rtdbData = await fetchSpaceFromRTDB();
  const mergedPeopleMap = new Map<string, TreePerson>();
  const mergedRelsMap = new Map<string, TreeRelationship>();

  for (const p of rtdbData.people) {
    if (p && p.id) mergedPeopleMap.set(p.id, p);
  }
  for (const r of rtdbData.relationships) {
    if (r && r.id) mergedRelsMap.set(r.id, r);
  }

  let spaceId = rtdbData.space.id;
  let spaceName = rtdbData.space.name || "កូនចៅត្រកូល ទៀង";

  try {
    const space = await prisma.familySpace.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true, description: true },
    });

    if (space) {
      spaceId = space.id;
      if (
        space.name &&
        space.name !== "មែកធាងគ្រួសារ ទៀង (Tieng Family Heritage)" &&
        space.name !== "ពង្សាវតារគ្រួសារ (Family Heritage)"
      ) {
        spaceName = space.name;
      }

      // If Firestore had data, prefer Firestore as the real-time source of truth;
      // otherwise populate from local PostgreSQL
      if (mergedPeopleMap.size === 0) {
        const dbPeople = await prisma.person.findMany({
          where: { spaceId: space.id },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });
        const dbRels = await prisma.relationship.findMany({
          where: { spaceId: space.id },
        });
        for (const p of dbPeople) {
          mergedPeopleMap.set(p.id, p as unknown as TreePerson);
        }
        for (const r of dbRels) {
          mergedRelsMap.set(r.id, r as unknown as TreeRelationship);
        }
      }
    }
  } catch (error: unknown) {
    console.warn("GET /api/tree DB unavailable, using Cloud Firestore:", error);
  }

  const finalPeople = Array.from(mergedPeopleMap.values());
  const finalRelationships = Array.from(mergedRelsMap.values());

  const validLinkedId =
    cookieLinkedId && finalPeople.some((p) => p.id === cookieLinkedId)
      ? cookieLinkedId
      : null;

  return NextResponse.json({
    space: { id: spaceId, name: spaceName },
    people: finalPeople,
    relationships: finalRelationships,
    userRole: "OWNER",
    linkedPersonId: validLinkedId,
  });
}
