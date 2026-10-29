import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FALLBACK_LINEAGE_PEOPLE = [
  {
    id: "person-gp-1",
    firstName: "Sok",
    lastName: "Chan",
    khmerName: "ចាន់ សុខ (ជីតា)",
    gender: "MALE",
    birthYear: 1948,
    deathYear: null,
    isLiving: true,
    isVerified: true,
    isRestricted: false,
    photoUrl: null,
    biography: "បុព្វបុរសនិងមេគ្រួសារ",
  },
  {
    id: "person-gp-2",
    firstName: "Bopha",
    lastName: "Keo",
    khmerName: "កែវ បុប្ផា (ជីដូន)",
    gender: "FEMALE",
    birthYear: 1952,
    deathYear: null,
    isLiving: true,
    isVerified: true,
    isRestricted: false,
    photoUrl: null,
    biography: "ជីដូនជាទីគោរពស្រឡាញ់នៃគ្រួសារ",
  },
  {
    id: "person-p-1",
    firstName: "Vireak",
    lastName: "Chan",
    khmerName: "ចាន់ វីរៈ (ឪពុក)",
    gender: "MALE",
    birthYear: 1975,
    deathYear: null,
    isLiving: true,
    isVerified: true,
    isRestricted: false,
    photoUrl: null,
    biography: "កូនប្រុសច្បង និងជាសសរទ្រូងគ្រួសារ",
  },
  {
    id: "person-p-2",
    firstName: "Sreyneang",
    lastName: "Chea",
    khmerName: "ជា ស្រីនាង (ម្តាយ)",
    gender: "FEMALE",
    birthYear: 1978,
    deathYear: null,
    isLiving: true,
    isVerified: true,
    isRestricted: false,
    photoUrl: null,
    biography: "ម្តាយជាទីស្រឡាញ់",
  },
  {
    id: "person-c-1",
    firstName: "Dara",
    lastName: "Chan",
    khmerName: "ចាន់ តារា (កូន)",
    gender: "MALE",
    birthYear: 2002,
    deathYear: null,
    isLiving: true,
    isVerified: true,
    isRestricted: false,
    photoUrl: null,
    biography: "ជំនាន់កូនចៅបន្តវេន",
  },
  {
    id: "person-c-2",
    firstName: "Monika",
    lastName: "Chan",
    khmerName: "ចាន់ ម៉ូនីកា (កូន)",
    gender: "FEMALE",
    birthYear: 2005,
    deathYear: null,
    isLiving: true,
    isVerified: true,
    isRestricted: false,
    photoUrl: null,
    biography: "ជំនាន់កូនចៅបន្តវេន",
  },
];

const FALLBACK_LINEAGE_RELATIONSHIPS = [
  {
    id: "rel-1",
    personId: "person-gp-1",
    relatedPersonId: "person-gp-2",
    type: "SPOUSE",
    status: "CONFIRMED",
    isDisputed: false,
  },
  {
    id: "rel-2",
    personId: "person-gp-1",
    relatedPersonId: "person-p-1",
    type: "PARENT_CHILD",
    status: "CONFIRMED",
    isDisputed: false,
  },
  {
    id: "rel-3",
    personId: "person-gp-2",
    relatedPersonId: "person-p-1",
    type: "PARENT_CHILD",
    status: "CONFIRMED",
    isDisputed: false,
  },
  {
    id: "rel-4",
    personId: "person-p-1",
    relatedPersonId: "person-p-2",
    type: "SPOUSE",
    status: "CONFIRMED",
    isDisputed: false,
  },
  {
    id: "rel-5",
    personId: "person-p-1",
    relatedPersonId: "person-c-1",
    type: "PARENT_CHILD",
    status: "CONFIRMED",
    isDisputed: false,
  },
  {
    id: "rel-6",
    personId: "person-p-2",
    relatedPersonId: "person-c-1",
    type: "PARENT_CHILD",
    status: "CONFIRMED",
    isDisputed: false,
  },
  {
    id: "rel-7",
    personId: "person-p-1",
    relatedPersonId: "person-c-2",
    type: "PARENT_CHILD",
    status: "CONFIRMED",
    isDisputed: false,
  },
  {
    id: "rel-8",
    personId: "person-p-2",
    relatedPersonId: "person-c-2",
    type: "PARENT_CHILD",
    status: "CONFIRMED",
    isDisputed: false,
  },
];

export async function GET(req: NextRequest) {
  try {
    // 1. Find primary family space
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

      const cookieLinkedId = req.cookies.get("family_linked_person_id")?.value;
      const validLinkedId =
        cookieLinkedId && people.some((p) => p.id === cookieLinkedId)
          ? cookieLinkedId
          : null;

      return NextResponse.json({
        space: { id: space.id, name: space.name },
        people,
        relationships,
        userRole: "OWNER",
        linkedPersonId: validLinkedId,
      });
    }

    // 2. Return fallback if no space exists yet
    return NextResponse.json({
      space: { id: "default-space", name: "ពង្សាវតារគ្រួសារ (Family Heritage)" },
      people: FALLBACK_LINEAGE_PEOPLE,
      relationships: FALLBACK_LINEAGE_RELATIONSHIPS,
      userRole: "OWNER",
      linkedPersonId: "person-p-1",
    });
  } catch (error: unknown) {
    console.warn("GET /api/tree error, using fallback lineage:", error);
    return NextResponse.json({
      space: { id: "default-space", name: "ពង្សាវតារគ្រួសារ (Family Heritage)" },
      people: FALLBACK_LINEAGE_PEOPLE,
      relationships: FALLBACK_LINEAGE_RELATIONSHIPS,
      userRole: "OWNER",
      linkedPersonId: "person-p-1",
    });
  }
}
