import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole, recordAuditLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Gender } from "@prisma/client";
import { z } from "zod";

const updatePersonSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  khmerName: z.string().max(100).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
  birthYear: z.number().int().min(1800).max(2026).optional().nullable(),
  deathYear: z.number().int().min(1800).max(2026).optional().nullable(),
  isLiving: z.boolean().optional(),
  photoUrl: z.string().url().optional().nullable(),
  biography: z.string().max(3000).optional().nullable(),
});

// GET /api/spaces/[spaceId]/people/[personId] - Fetch relative profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; personId: string }> }
) {
  try {
    const { spaceId, personId } = await params;
    await requireSpaceRole(spaceId, Role.MEMBER);

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
      },
    });

    if (!person || person.spaceId !== spaceId) {
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

    return NextResponse.json({
      person: {
        ...person,
        parents,
        children,
        spouses,
      },
    });
  } catch (error: unknown) {
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

    const updated = await prisma.person.update({
      where: { id: personId },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        khmerName: parsed.data.khmerName,
        gender: parsed.data.gender as Gender,
        birthYear: parsed.data.birthYear,
        deathYear: parsed.data.deathYear,
        isLiving: parsed.data.isLiving,
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
