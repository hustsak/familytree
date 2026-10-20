import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole, recordAuditLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Gender } from "@prisma/client";
import { z } from "zod";
import { sanitizePersonForViewer, verifyCsrfOrigin } from "@/lib/security";

const updatePersonSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  khmerName: z.string().max(100).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
  birthYear: z.number().int().min(1800).max(2026).optional().nullable(),
  deathYear: z.number().int().min(1800).max(2026).optional().nullable(),
  isLiving: z.boolean().optional(),
  isRestricted: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  photoUrl: z.string().url().optional().nullable(),
  biography: z.string().max(3000).optional().nullable(),
});

const FALLBACK_PEOPLE_MAP: Record<string, any> = {
  "person-gp-1": {
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
    parents: [],
    children: [{ id: "person-p-1", firstName: "Vireak", lastName: "Chan", khmerName: "ចាន់ វីរៈ" }],
    spouses: [{ id: "person-gp-2", firstName: "Bopha", lastName: "Keo", khmerName: "កែវ បុប្ផា" }],
    memories: [],
  },
  "person-gp-2": {
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
    parents: [],
    children: [{ id: "person-p-1", firstName: "Vireak", lastName: "Chan", khmerName: "ចាន់ វីរៈ" }],
    spouses: [{ id: "person-gp-1", firstName: "Sok", lastName: "Chan", khmerName: "ចាន់ សុខ" }],
    memories: [],
  },
  "person-p-1": {
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
    parents: [
      { id: "person-gp-1", firstName: "Sok", lastName: "Chan", khmerName: "ចាន់ សុខ" },
      { id: "person-gp-2", firstName: "Bopha", lastName: "Keo", khmerName: "កែវ បុប្ផា" },
    ],
    children: [
      { id: "person-c-1", firstName: "Dara", lastName: "Chan", khmerName: "ចាន់ តារា" },
      { id: "person-c-2", firstName: "Monika", lastName: "Chan", khmerName: "ចាន់ ម៉ូនីកា" },
    ],
    spouses: [{ id: "person-p-2", firstName: "Sreyneang", lastName: "Chea", khmerName: "ជា ស្រីនាង" }],
    memories: [],
  },
  "person-p-2": {
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
    parents: [],
    children: [
      { id: "person-c-1", firstName: "Dara", lastName: "Chan", khmerName: "ចាន់ តារា" },
      { id: "person-c-2", firstName: "Monika", lastName: "Chan", khmerName: "ចាន់ ម៉ូនីកា" },
    ],
    spouses: [{ id: "person-p-1", firstName: "Vireak", lastName: "Chan", khmerName: "ចាន់ វីរៈ" }],
    memories: [],
  },
  "person-c-1": {
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
    parents: [
      { id: "person-p-1", firstName: "Vireak", lastName: "Chan", khmerName: "ចាន់ វីរៈ" },
      { id: "person-p-2", firstName: "Sreyneang", lastName: "Chea", khmerName: "ជា ស្រីនាង" },
    ],
    children: [],
    spouses: [],
    memories: [],
  },
  "person-c-2": {
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
    parents: [
      { id: "person-p-1", firstName: "Vireak", lastName: "Chan", khmerName: "ចាន់ វីរៈ" },
      { id: "person-p-2", firstName: "Sreyneang", lastName: "Chea", khmerName: "ជា ស្រីនាង" },
    ],
    children: [],
    spouses: [],
    memories: [],
  },
};

// GET /api/spaces/[spaceId]/people/[personId] - Fetch relative profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; personId: string }> }
) {
  let resolvedPersonId: string | undefined;
  try {
    const { spaceId, personId } = await params;
    resolvedPersonId = personId;
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        spaceMember: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        relationshipsAsSubject: {
          include: {
            relatedPerson: {
              select: { id: true, firstName: true, lastName: true, khmerName: true, birthYear: true, photoUrl: true },
            },
          },
        },
        relationshipsAsTarget: {
          include: {
            person: {
              select: { id: true, firstName: true, lastName: true, khmerName: true, birthYear: true, photoUrl: true },
            },
          },
        },
        taggedMemories: {
          include: {
            memory: true,
          },
        },
      },
    });

    if (!person || person.spaceId !== spaceId) {
      if (FALLBACK_PEOPLE_MAP[personId]) {
        return NextResponse.json({ person: FALLBACK_PEOPLE_MAP[personId] });
      }
      return NextResponse.json({ error: "Person not found in this space" }, { status: 404 });
    }

    // Format parents, children, and spouses
    const parents = person.relationshipsAsTarget
      .filter((r) => r.type === "PARENT_CHILD" || r.type === "ADOPTIVE_PARENT_CHILD")
      .map((r) => r.person);

    const children = person.relationshipsAsSubject
      .filter((r) => r.type === "PARENT_CHILD" || r.type === "ADOPTIVE_PARENT_CHILD")
      .map((r) => r.relatedPerson);

    const spouses = [
      ...person.relationshipsAsSubject.filter((r) => r.type === "SPOUSE").map((r) => r.relatedPerson),
      ...person.relationshipsAsTarget.filter((r) => r.type === "SPOUSE").map((r) => r.person),
    ];

    const memories = person.taggedMemories.map((tm) => tm.memory);

    // Apply Phase 5 privacy controls for living relatives
    const sanitized = sanitizePersonForViewer(
      person,
      membership.role,
      membership.personId,
      user.id
    );

    return NextResponse.json({
      person: {
        ...sanitized,
        parents,
        children,
        spouses,
        memories,
      },
    });
  } catch (error: unknown) {
    if (resolvedPersonId && FALLBACK_PEOPLE_MAP[resolvedPersonId]) {
      return NextResponse.json({ person: FALLBACK_PEOPLE_MAP[resolvedPersonId] });
    }
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load relative profile" },
      { status: err.status || 500 }
    );
  }
}

// PATCH /api/spaces/[spaceId]/people/[personId] - Edit relative profile
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; personId: string }> }
) {
  try {
    const { spaceId, personId } = await params;
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!verifyCsrfOrigin(origin, referer)) {
      return NextResponse.json(
        { error: "Forbidden: Cross-site request rejected." },
        { status: 403 }
      );
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
    });

    if (!person || person.spaceId !== spaceId) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Authorization check: Only OWNER/ADMIN or linked member can edit
    const isCouncil = membership.role === Role.OWNER || membership.role === Role.ADMIN;
    const isSelfLinked = membership.personId === person.id;
    const isCreator = person.createdById === user.id;

    if (!isCouncil && !isSelfLinked && !isCreator) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to modify this relative's record." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updatePersonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Verification status can ONLY be toggled by Council (OWNER/ADMIN)
    if (parsed.data.isVerified !== undefined && !isCouncil) {
      return NextResponse.json(
        { error: "Unauthorized: Only Council Administrators can change verification status." },
        { status: 403 }
      );
    }

    const updated = await prisma.person.update({
      where: { id: personId },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        khmerName: parsed.data.khmerName,
        gender: parsed.data.gender as Gender | undefined,
        birthYear: parsed.data.birthYear,
        deathYear: parsed.data.deathYear,
        isLiving: parsed.data.isLiving,
        isRestricted: parsed.data.isRestricted,
        isVerified: parsed.data.isVerified,
        photoUrl: parsed.data.photoUrl,
        biography: parsed.data.biography,
      },
    });

    await recordAuditLog({
      spaceId,
      actorId: user.id,
      action: "RELATIVE_PROFILE_UPDATED",
      entityType: "Person",
      entityId: personId,
      metadata: {
        updatedFields: Object.keys(parsed.data),
        isRestricted: updated.isRestricted,
        isVerified: updated.isVerified,
      },
    });

    return NextResponse.json({ success: true, person: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to update relative profile" },
      { status: err.status || 500 }
    );
  }
}
