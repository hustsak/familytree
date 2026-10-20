import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { Role, MemoryType, MemoryStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { updateMemory, deleteMemory } from "@/lib/memories";
import { getSignedMediaUrl } from "@/lib/storage";
import { verifyCsrfOrigin } from "@/lib/security";

const updateMemorySchema = z.object({
  title: z.string().min(1).max(150).optional(),
  titleKm: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  descriptionKm: z.string().max(5000).optional().nullable(),
  type: z.enum(["PHOTO", "DOCUMENT", "STORY", "EVENT", "AUDIO"]).optional(),
  status: z.enum(["PUBLISHED", "PENDING_REVIEW", "ARCHIVED"]).optional(),
  eventDate: z.string().datetime().optional().nullable(),
  eventYear: z.number().int().min(1800).max(2050).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  branchTag: z.string().max(100).optional().nullable(),
  taggedPersonIds: z.array(z.string()).optional(),
});

// GET /api/spaces/[spaceId]/memories/[memoryId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; memoryId: string }> }
) {
  try {
    const { spaceId, memoryId } = await params;
    await requireSpaceRole(spaceId, Role.MEMBER);

    const memory = await prisma.memory.findUnique({
      where: { id: memoryId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        taggedPeople: {
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                khmerName: true,
                birthYear: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!memory || memory.spaceId !== spaceId) {
      return NextResponse.json({ error: "Memory not found in this space" }, { status: 404 });
    }

    let signedMediaUrl = memory.mediaUrl;
    if (memory.storagePath) {
      signedMediaUrl = await getSignedMediaUrl(spaceId, memory.storagePath, 3600);
    }

    return NextResponse.json({
      memory: {
        ...memory,
        signedMediaUrl,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load memory detail" },
      { status: err.status || 500 }
    );
  }
}

// PATCH /api/spaces/[spaceId]/memories/[memoryId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; memoryId: string }> }
) {
  try {
    const { spaceId, memoryId } = await params;
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!verifyCsrfOrigin(origin, referer)) {
      return NextResponse.json(
        { error: "Forbidden: Cross-site request rejected." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateMemorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateMemory(
      spaceId,
      memoryId,
      user.id,
      membership.role,
      {
        title: parsed.data.title,
        titleKm: parsed.data.titleKm,
        description: parsed.data.description,
        descriptionKm: parsed.data.descriptionKm,
        type: parsed.data.type as MemoryType | undefined,
        status: parsed.data.status as MemoryStatus | undefined,
        eventDate: parsed.data.eventDate ? new Date(parsed.data.eventDate) : parsed.data.eventDate === null ? null : undefined,
        eventYear: parsed.data.eventYear,
        location: parsed.data.location,
        branchTag: parsed.data.branchTag,
        taggedPersonIds: parsed.data.taggedPersonIds,
      }
    );

    return NextResponse.json({ memory: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to update memory" },
      { status: err.status || 500 }
    );
  }
}

// DELETE /api/spaces/[spaceId]/memories/[memoryId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; memoryId: string }> }
) {
  try {
    const { spaceId, memoryId } = await params;
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!verifyCsrfOrigin(origin, referer)) {
      return NextResponse.json(
        { error: "Forbidden: Cross-site request rejected." },
        { status: 403 }
      );
    }

    await deleteMemory(spaceId, memoryId, user.id, membership.role);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to delete memory" },
      { status: err.status || 500 }
    );
  }
}
