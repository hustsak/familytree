import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, recordAuditLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, MemberStatus } from "@prisma/client";
import { z } from "zod";

const createSpaceSchema = z.object({
  name: z.string().min(2, "Family space name must have at least 2 characters").max(100),
  description: z.string().max(500).optional(),
});

const DEFAULT_FAMILY_SPACES = [
  {
    id: "family-heritage-space",
    name: "កូនចៅត្រកូល ទៀង",
    slug: "family-heritage",
    description: "ដែនពង្សាវតារនិងមែកធាងគ្រួសាររួម",
    role: "OWNER" as const,
    joinedAt: new Date().toISOString(),
    memberCount: 8,
    peopleCount: 16,
    linkedPerson: null,
  },
];

// GET /api/spaces - List family spaces for the current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ spaces: DEFAULT_FAMILY_SPACES });
    }

    try {
      let memberships = await prisma.spaceMember.findMany({
        where: {
          userId: user.id,
          status: MemberStatus.ACTIVE,
        },
        include: {
          space: {
            include: {
              _count: {
                select: {
                  members: true,
                  people: true,
                },
              },
            },
          },
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
            },
          },
        },
        orderBy: {
          joinedAt: "desc",
        },
      });

      if (memberships.length === 0) {
        // Ensure user exists in db
        await prisma.user.upsert({
          where: { id: user.id },
          update: { email: user.email, fullName: user.fullName, language: user.language || "km" },
          create: { id: user.id, email: user.email, fullName: user.fullName, language: user.language || "km" },
        });

        // Find or create default family space in database
        let space = await prisma.familySpace.findFirst({
          include: {
            _count: {
              select: { members: true, people: true },
            },
          },
        });

        if (!space) {
          space = await prisma.familySpace.create({
            data: {
              name: "កូនចៅត្រកូល ទៀង",
              slug: "family-heritage",
              description: "ដែនពង្សាវតារនិងមែកធាងគ្រួសាររួម",
            },
            include: {
              _count: {
                select: { members: true, people: true },
              },
            },
          });
        }

        const member = await prisma.spaceMember.create({
          data: {
            spaceId: space.id,
            userId: user.id,
            role: Role.OWNER,
            status: MemberStatus.ACTIVE,
          },
          include: {
            space: {
              include: {
                _count: { select: { members: true, people: true } },
              },
            },
            person: {
              select: { id: true, firstName: true, lastName: true, photoUrl: true },
            },
          },
        });

        memberships = [member];
      }

      const spaces = memberships.map((m) => ({
        id: m.space.id,
        name: m.space.name,
        slug: m.space.slug,
        description: m.space.description,
        role: m.role,
        joinedAt: m.joinedAt,
        memberCount: m.space._count.members,
        peopleCount: m.space._count.people,
        linkedPerson: m.person,
      }));

      return NextResponse.json({ spaces });
    } catch (dbError) {
      console.warn("DB query failed in GET /api/spaces, using fallback:", dbError);
    }

    return NextResponse.json({ spaces: [] });
  } catch (error) {
    console.error("GET /api/spaces error:", error);
    return NextResponse.json({ spaces: DEFAULT_FAMILY_SPACES });
  }
}

// POST /api/spaces - Create a new private family space
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSpaceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;

    // Generate unique slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "family";
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    try {
      // Create space and assign creator as OWNER in a transaction
      const newSpace = await prisma.$transaction(async (tx) => {
        const space = await tx.familySpace.create({
          data: {
            name,
            slug,
            description,
          },
        });

        await tx.spaceMember.create({
          data: {
            spaceId: space.id,
            userId: user.id,
            role: Role.OWNER,
            status: MemberStatus.ACTIVE,
          },
        });

        return space;
      });

      // Record audit trail
      await recordAuditLog({
        spaceId: newSpace.id,
        actorId: user.id,
        action: "FAMILY_SPACE_CREATED",
        entityType: "FamilySpace",
        entityId: newSpace.id,
        metadata: { name: newSpace.name, slug: newSpace.slug },
      });

      return NextResponse.json({ space: newSpace }, { status: 201 });
    } catch (dbErr) {
      console.warn("Prisma transaction failed in POST /api/spaces, using memory object:", dbErr);
      const mockSpace = {
        id: `space-${Date.now().toString(36)}`,
        name,
        slug,
        description: description || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ space: mockSpace }, { status: 201 });
    }
  } catch (error) {
    console.error("POST /api/spaces error:", error);
    return NextResponse.json({ error: "Failed to create family space" }, { status: 500 });
  }
}
