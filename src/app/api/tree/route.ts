import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSpaceFromRTDB } from "@/lib/firebase/rtdb-server";

export async function GET(req: NextRequest) {
  const cookieLinkedId = req.cookies.get("family_linked_person_id")?.value || null;

  try {
    // 1. Find primary family space in PostgreSQL
    const space = await prisma.familySpace.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true, description: true },
    });

    if (space) {
      const people = await prisma.person.findMany({
        where: { spaceId: space.id },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

      const relationships = await prisma.relationship.findMany({
        where: { spaceId: space.id },
      });

      if (people.length > 0) {
        const validLinkedId =
          cookieLinkedId && people.some((p) => p.id === cookieLinkedId)
            ? cookieLinkedId
            : null;

        const normalizedSpaceName =
          !space.name ||
          space.name === "មែកធាងគ្រួសារ ទៀង (Tieng Family Heritage)" ||
          space.name === "ពង្សាវតារគ្រួសារ (Family Heritage)"
            ? "កូនចៅត្រកូល ទៀង"
            : space.name;

        return NextResponse.json({
          space: { id: space.id, name: normalizedSpaceName },
          people,
          relationships,
          userRole: "OWNER",
          linkedPersonId: validLinkedId,
        });
      }
    }
  } catch (error: unknown) {
    console.warn("GET /api/tree DB unavailable, using Firebase RTDB:", error);
  }

  // 2. Fallback to Firebase Realtime Database / bundled export (for Vercel serverless)
  const rtdbData = await fetchSpaceFromRTDB();
  const validLinkedId =
    cookieLinkedId && rtdbData.people.some((p) => p.id === cookieLinkedId)
      ? cookieLinkedId
      : null;

  return NextResponse.json({
    space: rtdbData.space,
    people: rtdbData.people,
    relationships: rtdbData.relationships,
    userRole: "OWNER",
    linkedPersonId: validLinkedId,
  });
}
