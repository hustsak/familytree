import { prisma } from "@/lib/prisma";
import { MemoryType, MemoryStatus, Role } from "@prisma/client";
import { recordAuditLog, AuthorizationError } from "@/lib/auth";
import { getSignedMediaUrl } from "@/lib/storage";

export interface CreateMemoryInput {
  spaceId: string;
  userId: string;
  title: string;
  titleKm?: string | null;
  description?: string | null;
  descriptionKm?: string | null;
  type: MemoryType;
  storagePath?: string | null;
  mediaUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  originalFileName?: string | null;
  eventDate?: Date | null;
  eventYear?: number | null;
  location?: string | null;
  branchTag?: string | null;
  taggedPersonIds?: string[];
}

export interface UpdateMemoryInput {
  title?: string;
  titleKm?: string | null;
  description?: string | null;
  descriptionKm?: string | null;
  type?: MemoryType;
  status?: MemoryStatus;
  eventDate?: Date | null;
  eventYear?: number | null;
  location?: string | null;
  branchTag?: string | null;
  taggedPersonIds?: string[];
}

export interface MemoryFilterOptions {
  type?: MemoryType;
  personId?: string;
  branchTag?: string;
  search?: string;
  year?: number;
}

/**
 * Creates a new family memory or digital archive item with verified relative tags.
 * Strictly verifies that all tagged persons belong to the same family space.
 */
export async function createMemory(input: CreateMemoryInput) {
  // Verify tagged persons belong to this family space (prevents IDOR / cross-space leakage)
  if (input.taggedPersonIds && input.taggedPersonIds.length > 0) {
    const verifiedPeople = await prisma.person.findMany({
      where: {
        spaceId: input.spaceId,
        id: { in: input.taggedPersonIds },
      },
      select: { id: true },
    });

    if (verifiedPeople.length !== input.taggedPersonIds.length) {
      throw new Error(
        "One or more tagged relatives do not exist within this private family space."
      );
    }
  }

  const memory = await prisma.$transaction(async (tx) => {
    const mem = await tx.memory.create({
      data: {
        spaceId: input.spaceId,
        createdById: input.userId,
        title: input.title.trim(),
        titleKm: input.titleKm?.trim() || null,
        description: input.description?.trim() || null,
        descriptionKm: input.descriptionKm?.trim() || null,
        type: input.type,
        status: MemoryStatus.PUBLISHED,
        storagePath: input.storagePath || null,
        mediaUrl: input.mediaUrl || null,
        fileSize: input.fileSize || null,
        mimeType: input.mimeType || null,
        originalFileName: input.originalFileName || null,
        eventDate: input.eventDate || null,
        eventYear: input.eventYear || null,
        location: input.location?.trim() || null,
        branchTag: input.branchTag?.trim() || null,
      },
    });

    if (input.taggedPersonIds && input.taggedPersonIds.length > 0) {
      await tx.memoryPersonTag.createMany({
        data: input.taggedPersonIds.map((personId) => ({
          memoryId: mem.id,
          personId,
        })),
      });
    }

    return mem;
  });

  await recordAuditLog({
    spaceId: input.spaceId,
    actorId: input.userId,
    action: "MEMORY_CREATED",
    entityType: "Memory",
    entityId: memory.id,
    metadata: {
      title: input.title,
      type: input.type,
      taggedCount: input.taggedPersonIds?.length || 0,
    },
  });

  return memory;
}

/**
 * Updates an existing memory.
 * Enforces ownership: only the author or space OWNER/ADMIN can modify.
 */
export async function updateMemory(
  spaceId: string,
  memoryId: string,
  userId: string,
  userRole: Role,
  input: UpdateMemoryInput
) {
  const existing = await prisma.memory.findUnique({
    where: { id: memoryId },
  });

  if (!existing || existing.spaceId !== spaceId) {
    throw new Error("Memory not found in this space.");
  }

  const isAuthor = existing.createdById === userId;
  const isCouncil = userRole === Role.OWNER || userRole === Role.ADMIN;

  if (!isAuthor && !isCouncil) {
    throw new AuthorizationError(
      "Unauthorized: Only the author or space administrators can edit this memory.",
      403
    );
  }

  // Verify updated tags
  if (input.taggedPersonIds) {
    const verifiedPeople = await prisma.person.findMany({
      where: {
        spaceId,
        id: { in: input.taggedPersonIds },
      },
      select: { id: true },
    });

    if (verifiedPeople.length !== input.taggedPersonIds.length) {
      throw new Error("One or more tagged relatives do not exist in this space.");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const mem = await tx.memory.update({
      where: { id: memoryId },
      data: {
        title: input.title !== undefined ? input.title.trim() : undefined,
        titleKm: input.titleKm !== undefined ? input.titleKm?.trim() || null : undefined,
        description: input.description !== undefined ? input.description?.trim() || null : undefined,
        descriptionKm: input.descriptionKm !== undefined ? input.descriptionKm?.trim() || null : undefined,
        type: input.type,
        status: input.status,
        eventDate: input.eventDate,
        eventYear: input.eventYear,
        location: input.location !== undefined ? input.location?.trim() || null : undefined,
        branchTag: input.branchTag !== undefined ? input.branchTag?.trim() || null : undefined,
      },
    });

    if (input.taggedPersonIds !== undefined) {
      await tx.memoryPersonTag.deleteMany({
        where: { memoryId },
      });

      if (input.taggedPersonIds.length > 0) {
        await tx.memoryPersonTag.createMany({
          data: input.taggedPersonIds.map((personId) => ({
            memoryId,
            personId,
          })),
        });
      }
    }

    return mem;
  });

  await recordAuditLog({
    spaceId,
    actorId: userId,
    action: "MEMORY_UPDATED",
    entityType: "Memory",
    entityId: memoryId,
    metadata: {
      updatedFields: Object.keys(input),
    },
  });

  return updated;
}

/**
 * Deletes a memory and removes associated tags and storage references.
 * Enforces ownership: only author or space OWNER/ADMIN can delete.
 */
export async function deleteMemory(
  spaceId: string,
  memoryId: string,
  userId: string,
  userRole: Role
) {
  const existing = await prisma.memory.findUnique({
    where: { id: memoryId },
  });

  if (!existing || existing.spaceId !== spaceId) {
    throw new Error("Memory not found in this space.");
  }

  const isAuthor = existing.createdById === userId;
  const isCouncil = userRole === Role.OWNER || userRole === Role.ADMIN;

  if (!isAuthor && !isCouncil) {
    throw new AuthorizationError(
      "Unauthorized: Only the author or space administrators can delete this memory.",
      403
    );
  }

  await prisma.memory.delete({
    where: { id: memoryId },
  });

  await recordAuditLog({
    spaceId,
    actorId: userId,
    action: "MEMORY_DELETED",
    entityType: "Memory",
    entityId: memoryId,
    metadata: {
      title: existing.title,
      type: existing.type,
    },
  });

  return { success: true };
}

/**
 * Retrieves memories for a family space with signed URLs and filters.
 */
export async function getSpaceMemories(
  spaceId: string,
  filters: MemoryFilterOptions = {}
) {
  const whereClause: Record<string, unknown> = {
    spaceId,
    status: MemoryStatus.PUBLISHED,
  };

  if (filters.type) {
    whereClause.type = filters.type;
  }

  if (filters.branchTag) {
    whereClause.branchTag = filters.branchTag;
  }

  if (filters.year) {
    whereClause.eventYear = filters.year;
  }

  if (filters.personId) {
    whereClause.taggedPeople = {
      some: {
        personId: filters.personId,
      },
    };
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    whereClause.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { titleKm: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { descriptionKm: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }

  const rawMemories = await prisma.memory.findMany({
    where: whereClause,
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
    orderBy: [{ eventYear: "desc" }, { createdAt: "desc" }],
  });

  // Attach expiring signed URLs for private media
  return await Promise.all(
    rawMemories.map(async (m) => {
      let signedUrl = m.mediaUrl;
      if (m.storagePath) {
        signedUrl = await getSignedMediaUrl(spaceId, m.storagePath, 3600);
      }
      return {
        ...m,
        signedMediaUrl: signedUrl,
      };
    })
  );
}

/**
 * Retrieves chronologically ordered timeline events for a family space.
 */
export async function getSpaceTimeline(spaceId: string) {
  const memories = await getSpaceMemories(spaceId);

  // Filter to memories with dates/years and sort chronologically
  const timelineItems = memories
    .filter((m) => m.eventYear !== null || m.eventDate !== null)
    .sort((a, b) => {
      const yearA = a.eventYear ?? (a.eventDate ? new Date(a.eventDate).getFullYear() : 0);
      const yearB = b.eventYear ?? (b.eventDate ? new Date(b.eventDate).getFullYear() : 0);
      return yearA - yearB;
    });

  return timelineItems;
}
