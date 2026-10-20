import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, recordAuditLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, MemberStatus } from "@prisma/client";
import { z } from "zod";

const createSpaceSchema = z.object({
  name: z.string().min(2, "Family space name must have at least 2 characters").max(100),
  description: z.string().max(500).optional(),
});

// GET /api/spaces - List family spaces for the current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.spaceMember.findMany({
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
  } catch (error) {
    console.error("GET /api/spaces error:", error);
    return NextResponse.json({ error: "Failed to load family spaces" }, { status: 500 });
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
  } catch (error) {
    console.error("POST /api/spaces error:", error);
    return NextResponse.json({ error: "Failed to create family space" }, { status: 500 });
  }
}
