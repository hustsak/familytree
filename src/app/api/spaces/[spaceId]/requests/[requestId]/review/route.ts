import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { processReviewDecision } from "@/lib/approvals";
import { Role } from "@prisma/client";
import { z } from "zod";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CLARIFICATION"]),
  adminNotes: z.string().max(1000).optional().nullable(),
  resolutionAction: z.enum(["CREATE_NEW_PERSON", "LINK_EXISTING_PERSON"]).optional(),
  existingPersonIdToLink: z.string().optional().nullable(),
  explicitParentId: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; requestId: string }> }
) {
  try {
    const { spaceId, requestId } = await params;
    const { user } = await requireSpaceRole(spaceId, Role.ADMIN);

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await processReviewDecision({
      spaceId,
      reviewerUserId: user.id,
      requestId,
      decision: parsed.data.decision,
      adminNotes: parsed.data.adminNotes,
      resolutionAction: parsed.data.resolutionAction,
      existingPersonIdToLink: parsed.data.existingPersonIdToLink,
      explicitParentId: parsed.data.explicitParentId,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to process review decision" },
      { status: err.status || 500 }
    );
  }
}
