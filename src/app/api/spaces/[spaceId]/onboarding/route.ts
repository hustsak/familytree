import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { processFamilyOnboarding } from "@/lib/onboarding";
import { Gender } from "@prisma/client";
import { z } from "zod";

const onboardingSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(60),
  lastName: z.string().min(1, "Last name is required").max(60),
  khmerName: z.string().max(100).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  birthYear: z.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  biography: z.string().max(2000).optional().nullable(),
  relationToAnchor: z.enum(["PARENT", "GRANDPARENT", "GREAT_GRANDPARENT", "FOUNDING_ROOT"]),
  anchorPersonId: z.string().optional().nullable(),
  intermediateParentId: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const user = await requireAuth();

    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await processFamilyOnboarding({
      spaceId,
      userId: user.id,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      khmerName: parsed.data.khmerName,
      gender: parsed.data.gender as Gender,
      birthYear: parsed.data.birthYear,
      photoUrl: parsed.data.photoUrl,
      biography: parsed.data.biography,
      relationToAnchor: parsed.data.relationToAnchor,
      anchorPersonId: parsed.data.anchorPersonId,
      intermediateParentId: parsed.data.intermediateParentId,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Failed to process family onboarding" },
      { status: 400 }
    );
  }
}
