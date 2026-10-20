import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { Role, MemoryType } from "@prisma/client";
import { z } from "zod";
import { createMemory, getSpaceMemories } from "@/lib/memories";
import { checkRateLimit, verifyCsrfOrigin } from "@/lib/security";

const createMemorySchema = z.object({
  title: z.string().min(1).max(150),
  titleKm: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  descriptionKm: z.string().max(5000).optional().nullable(),
  type: z.enum(["PHOTO", "DOCUMENT", "STORY", "EVENT", "AUDIO"]).default("PHOTO"),
  storagePath: z.string().optional().nullable(),
  mediaUrl: z.string().url().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  originalFileName: z.string().optional().nullable(),
  eventDate: z.string().datetime().optional().nullable(),
  eventYear: z.number().int().min(1800).max(2050).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  branchTag: z.string().max(100).optional().nullable(),
  taggedPersonIds: z.array(z.string()).optional(),
});

// GET /api/spaces/[spaceId]/memories - List memories with filters & search
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    await requireSpaceRole(spaceId, Role.MEMBER);

    const url = new URL(req.url);
    const type = url.searchParams.get("type") as MemoryType | null;
    const personId = url.searchParams.get("personId") || undefined;
    const branchTag = url.searchParams.get("branchTag") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const yearStr = url.searchParams.get("year");
    const year = yearStr ? parseInt(yearStr, 10) : undefined;

    const memories = await getSpaceMemories(spaceId, {
      type: type || undefined,
      personId,
      branchTag,
      search,
      year: isNaN(Number(year)) ? undefined : year,
    });

    return NextResponse.json({ memories });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to load family memories" },
      { status: err.status || 500 }
    );
  }
}

// POST /api/spaces/[spaceId]/memories - Create memory
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const { user } = await requireSpaceRole(spaceId, Role.MEMBER);

    // Rate limiting: max 30 contributions per minute per user
    const rateCheck = checkRateLimit(`memory:${user.id}`, 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many memory creation requests. Please wait a moment." },
        { status: 429 }
      );
    }

    // CSRF check
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!verifyCsrfOrigin(origin, referer)) {
      return NextResponse.json(
        { error: "Forbidden: Cross-site request rejected." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createMemorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const memory = await createMemory({
      spaceId,
      userId: user.id,
      title: parsed.data.title,
      titleKm: parsed.data.titleKm,
      description: parsed.data.description,
      descriptionKm: parsed.data.descriptionKm,
      type: parsed.data.type as MemoryType,
      storagePath: parsed.data.storagePath,
      mediaUrl: parsed.data.mediaUrl,
      fileSize: parsed.data.fileSize,
      mimeType: parsed.data.mimeType,
      originalFileName: parsed.data.originalFileName,
      eventDate: parsed.data.eventDate ? new Date(parsed.data.eventDate) : null,
      eventYear: parsed.data.eventYear,
      location: parsed.data.location,
      branchTag: parsed.data.branchTag,
      taggedPersonIds: parsed.data.taggedPersonIds,
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to create memory" },
      { status: err.status || 500 }
    );
  }
}
