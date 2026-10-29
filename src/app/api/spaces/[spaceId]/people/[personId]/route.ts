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
  birthYear: z.number().int().min(1000).max(new Date().getFullYear() + 10).optional().nullable(),
  deathYear: z.number().int().min(1000).max(new Date().getFullYear() + 10).optional().nullable(),
  isLiving: z.boolean().optional(),
  isRestricted: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  photoUrl: z.string().max(2000).optional().nullable(),
  biography: z.string().max(3000).optional().nullable(),
});

// GET /api/spaces/[spaceId]/people/[personId] - Fetch relative profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; personId: string }> }
) {
  try {
    const { spaceId, personId } = await params;
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

    const isCouncil = membership.role === Role.OWNER || membership.role === Role.ADMIN;
    // In collaborative family mode, all space members/cousins can fill and update profile information.
    // Administrative attributes (like verification badges) remain guarded below.

    const body = await req.json();
    if (body && typeof body.birthYear === "string") {
      const parsedNum = parseInt(body.birthYear.replace(/[^\d]/g, ""), 10);
      body.birthYear = !isNaN(parsedNum) ? parsedNum : null;
    }
    if (body && typeof body.deathYear === "string") {
      const parsedNum = parseInt(body.deathYear.replace(/[^\d]/g, ""), 10);
      body.deathYear = !isNaN(parsedNum) ? parsedNum : null;
    }
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

    return NextResponse.json({
      success: true,
      message: "ព័ត៌មានសមាជិកគ្រួសារត្រូវបានកែប្រែដោយជោគជ័យ (Relative updated successfully)",
      person: updated,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to update relative profile" },
      { status: err.status || 500 }
    );
  }
}

// DELETE /api/spaces/[spaceId]/people/[personId] - Remove relative from tree safely
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; personId: string }> }
) {
  try {
    const { spaceId, personId } = await params;
    // Only Council (OWNER or ADMIN) can remove relatives
    const { user } = await requireSpaceRole(spaceId, Role.ADMIN);

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
      include: {
        relationshipsAsSubject: true,
        relationshipsAsTarget: true,
        taggedMemories: true,
        spaceMember: true,
      },
    });

    if (!person || person.spaceId !== spaceId) {
      return NextResponse.json(
        { error: "Person not found in this space" },
        { status: 404 }
      );
    }

    const relCount =
      person.relationshipsAsSubject.length + person.relationshipsAsTarget.length;
    const memoryTagCount = person.taggedMemories.length;

    // Unlink any pending invitations referencing this person
    await prisma.invitation.updateMany({
      where: { spaceId, suggestedPersonId: personId },
      data: { suggestedPersonId: null },
    });

    // Delete person record (cascades relationships and memory tags, sets space_member.personId to null)
    await prisma.person.delete({
      where: { id: personId },
    });

    // Record audit trail
    await recordAuditLog({
      spaceId,
      actorId: user.id,
      action: "RELATIVE_DELETED",
      entityType: "Person",
      entityId: personId,
      metadata: {
        deletedPersonName: `${person.firstName} ${person.lastName}`,
        khmerName: person.khmerName,
        removedRelationshipsCount: relCount,
        untaggedMemoriesCount: memoryTagCount,
        unlinkedUser: person.spaceMember ? person.spaceMember.userId : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "សមាជិកគ្រួសារត្រូវបានលុបចេញពីពង្សាវតារដោយជោគជ័យ (Relative removed from family tree)",
      deletedPerson: {
        id: person.id,
        name: `${person.firstName} ${person.lastName}`,
        khmerName: person.khmerName,
        removedRelationshipsCount: relCount,
        untaggedMemoriesCount: memoryTagCount,
      },
    });
  } catch (error: unknown) {
    console.error("DELETE /api/spaces/[spaceId]/people/[personId] error:", error);
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to remove relative" },
      { status: err.status || 500 }
    );
  }
}
