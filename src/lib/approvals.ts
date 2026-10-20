import { prisma } from "@/lib/prisma";
import {
  Role,
  RequestStatus,
  RelationType,
  RelationStatus,
  ConfidenceLevel,
  MemberStatus,
  Gender,
} from "@prisma/client";
import {
  validateNoCycle,
  validateParentCount,
  validateNoDuplicateRelationship,
  ParentChildEdge,
  RelationshipRecord,
} from "@/lib/validation/dag";
import { recordAuditLog, AuthorizationError } from "@/lib/auth";

export interface ReviewRequestInput {
  spaceId: string;
  reviewerUserId: string;
  requestId: string;
  decision: "APPROVE" | "REJECT" | "REQUEST_CLARIFICATION";
  adminNotes?: string | null;
  resolutionAction?: "CREATE_NEW_PERSON" | "LINK_EXISTING_PERSON";
  existingPersonIdToLink?: string | null;
  explicitParentId?: string | null;
}

export class ApprovalError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code: string, status: number = 400) {
    super(message);
    this.name = "ApprovalError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Validates that reviewer is OWNER or ADMIN of the space.
 */
export async function assertCanReview(spaceId: string, reviewerUserId: string) {
  const membership = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId: reviewerUserId } },
  });

  if (!membership || membership.status !== MemberStatus.ACTIVE) {
    throw new AuthorizationError(
      "You are not an active member of this private family space.",
      403
    );
  }

  if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
    throw new AuthorizationError(
      "Council approval permissions required. Only Owners and Admins can review connection requests.",
      403
    );
  }

  return membership;
}

/**
 * Lists connection requests for a private family space with enriched details.
 */
export async function listConnectionRequests(
  spaceId: string,
  reviewerUserId: string,
  statusFilter?: RequestStatus
) {
  await assertCanReview(spaceId, reviewerUserId);

  return await prisma.connectionRequest.findMany({
    where: {
      spaceId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Reviews a connection request: APPROVE, REJECT, or REQUEST_CLARIFICATION.
 * When approving:
 * - Prevents cycles and duplicate relationships using DAG validation.
 * - Handles duplicate person resolutions (create distinct person vs link existing).
 * - Never guesses missing relationships.
 * - Records all decisions in AuditLog.
 */
export async function processReviewDecision(input: ReviewRequestInput) {
  const {
    spaceId,
    reviewerUserId,
    requestId,
    decision,
    adminNotes,
    resolutionAction = "CREATE_NEW_PERSON",
    existingPersonIdToLink,
    explicitParentId,
  } = input;

  await assertCanReview(spaceId, reviewerUserId);

  const request = await prisma.connectionRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });

  if (!request || request.spaceId !== spaceId) {
    throw new ApprovalError("Connection request not found in this space.", "NOT_FOUND", 404);
  }

  // Prevent repeated approvals or modifying closed decisions
  if (request.status === RequestStatus.APPROVED) {
    throw new ApprovalError(
      "This request has already been approved and processed.",
      "ALREADY_APPROVED",
      409
    );
  }

  if (request.status === RequestStatus.REJECTED && decision === "REJECT") {
    throw new ApprovalError(
      "This request is already marked as rejected.",
      "ALREADY_REJECTED",
      409
    );
  }

  // Handle REJECT
  if (decision === "REJECT") {
    const updated = await prisma.connectionRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.REJECTED,
        adminNotes: adminNotes || null,
        reviewedById: reviewerUserId,
      },
    });

    await recordAuditLog({
      spaceId,
      actorId: reviewerUserId,
      action: "CONNECTION_REQUEST_REJECTED",
      entityType: "ConnectionRequest",
      entityId: requestId,
      metadata: {
        requesterUserId: request.userId,
        adminNotes,
      },
    });

    return { request: updated, action: "REJECTED" };
  }

  // Handle REQUEST_CLARIFICATION
  if (decision === "REQUEST_CLARIFICATION") {
    const updated = await prisma.connectionRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.CLARIFICATION_NEEDED,
        adminNotes: adminNotes || "Further family clarification requested by council.",
        reviewedById: reviewerUserId,
      },
    });

    await recordAuditLog({
      spaceId,
      actorId: reviewerUserId,
      action: "CONNECTION_CLARIFICATION_REQUESTED",
      entityType: "ConnectionRequest",
      entityId: requestId,
      metadata: {
        requesterUserId: request.userId,
        adminNotes,
      },
    });

    return { request: updated, action: "CLARIFICATION_REQUESTED" };
  }

  // Handle APPROVE
  const proposedData = request.proposedPersonData as {
    firstName?: string;
    lastName?: string;
    khmerName?: string | null;
    gender?: string;
    birthYear?: number | null;
    photoUrl?: string | null;
    biography?: string | null;
  };

  const requesterMembership = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId,
        userId: request.userId,
      },
    },
  });

  if (!requesterMembership) {
    throw new ApprovalError(
      "Requester is no longer a member of this space.",
      "MEMBER_NOT_FOUND",
      400
    );
  }

  if (requesterMembership.personId) {
    throw new ApprovalError(
      "Requester is already linked to a relative record in this tree.",
      "ALREADY_LINKED",
      409
    );
  }

  // Execute in atomic transaction to prevent race-condition duplicates
  const approvalResult = await prisma.$transaction(async (tx) => {
    let targetPersonId: string;

    // Sub-case 1: Resolution is linking to an existing person record
    if (resolutionAction === "LINK_EXISTING_PERSON") {
      if (!existingPersonIdToLink) {
        throw new ApprovalError(
          "Must specify existingPersonIdToLink when resolutionAction is LINK_EXISTING_PERSON.",
          "MISSING_TARGET_PERSON",
          400
        );
      }

      const existingPerson = await tx.person.findUnique({
        where: { id: existingPersonIdToLink },
        include: { spaceMember: true },
      });

      if (!existingPerson || existingPerson.spaceId !== spaceId) {
        throw new ApprovalError(
          "Selected relative does not exist in this space.",
          "PERSON_NOT_FOUND",
          404
        );
      }

      if (existingPerson.spaceMember && existingPerson.spaceMember.userId !== request.userId) {
        throw new ApprovalError(
          `Relative '${existingPerson.firstName} ${existingPerson.lastName}' is already linked to another user account.`,
          "PERSON_ALREADY_LINKED_TO_OTHER_USER",
          409
        );
      }

      targetPersonId = existingPerson.id;

      // Link member to existing person
      await tx.spaceMember.update({
        where: { id: requesterMembership.id },
        data: { personId: targetPersonId },
      });
    } else {
      // Sub-case 2: Resolution is creating a verified new Person
      const cleanFirstName = proposedData.firstName?.trim() || "Relative";
      const cleanLastName = proposedData.lastName?.trim() || "Family";

      const newPerson = await tx.person.create({
        data: {
          spaceId,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          khmerName: proposedData.khmerName || null,
          gender: (proposedData.gender as Gender) || Gender.UNKNOWN,
          birthYear: proposedData.birthYear || null,
          photoUrl: proposedData.photoUrl || null,
          biography: proposedData.biography || null,
          createdById: reviewerUserId,
          isVerified: true,
        },
      });

      targetPersonId = newPerson.id;

      // Determine parent connection
      let resolvedParentId: string | null = null;

      if (explicitParentId) {
        resolvedParentId = explicitParentId;
      } else if (request.relationType === "PARENT") {
        resolvedParentId = request.anchorPersonId;
      } else {
        // Grandparent or Great-Grandparent without explicit parent cannot be guessed
        throw new ApprovalError(
          `Cannot approve multi-generation connection (${request.relationType}) without specifying the direct intermediate parent ID. Never guess lineage relationships.`,
          "EXPLICIT_PARENT_REQUIRED",
          400
        );
      }

      // Validate the parent exists and belongs to the same space
      const parentRecord = await tx.person.findUnique({
        where: { id: resolvedParentId },
      });

      if (!parentRecord || parentRecord.spaceId !== spaceId) {
        throw new ApprovalError(
          "Specified parent relative does not exist in this family space.",
          "PARENT_NOT_FOUND",
          404
        );
      }

      // Fetch all existing relationships in the space for DAG cycle & parent limits
      const spaceRelationships = await tx.relationship.findMany({
        where: { spaceId },
        select: {
          id: true,
          spaceId: true,
          personId: true,
          relatedPersonId: true,
          type: true,
        },
      });

      const parentChildEdges: ParentChildEdge[] = spaceRelationships
        .filter((r) => r.type === RelationType.PARENT_CHILD)
        .map((r) => ({ parentId: r.personId, childId: r.relatedPersonId }));

      const existingEdgesAsRelationshipRecords: RelationshipRecord[] = spaceRelationships.map((r) => ({
        id: r.id,
        spaceId: r.spaceId,
        personId: r.personId,
        relatedPersonId: r.relatedPersonId,
        type: r.type,
      }));

      // 1. Biological parent count validation
      const existingParentsOfChild = parentChildEdges
        .filter((e) => e.childId === targetPersonId)
        .map((e) => e.parentId);

      validateParentCount(existingParentsOfChild, resolvedParentId, 2);

      // 2. DAG cycle prevention (no loops)
      validateNoCycle(parentChildEdges, resolvedParentId, targetPersonId);

      // 3. No duplicate edges
      validateNoDuplicateRelationship(
        existingEdgesAsRelationshipRecords,
        resolvedParentId,
        targetPersonId,
        RelationType.PARENT_CHILD
      );

      // Create confirmed relationship
      await tx.relationship.create({
        data: {
          spaceId,
          personId: resolvedParentId,
          relatedPersonId: targetPersonId,
          type: RelationType.PARENT_CHILD,
          status: RelationStatus.CONFIRMED,
          confidence: ConfidenceLevel.DIRECT,
          notes: adminNotes || `Approved by council via request ${request.id}`,
          createdById: reviewerUserId,
          approvedById: reviewerUserId,
        },
      });

      // Link space member to person
      await tx.spaceMember.update({
        where: { id: requesterMembership.id },
        data: { personId: targetPersonId },
      });
    }

    // Mark request as APPROVED
    const updatedRequest = await tx.connectionRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.APPROVED,
        adminNotes: adminNotes || null,
        reviewedById: reviewerUserId,
      },
    });

    return { request: updatedRequest, personId: targetPersonId };
  });

  await recordAuditLog({
    spaceId,
    actorId: reviewerUserId,
    action: "CONNECTION_REQUEST_APPROVED",
    entityType: "ConnectionRequest",
    entityId: requestId,
    metadata: {
      requesterUserId: request.userId,
      personId: approvalResult.personId,
      resolutionAction,
      adminNotes,
    },
  });

  return { request: approvalResult.request, action: "APPROVED", personId: approvalResult.personId };
}
