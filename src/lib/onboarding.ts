import { prisma } from "@/lib/prisma";
import { Gender, Role, RelationType, RelationStatus, ConfidenceLevel, RequestStatus } from "@prisma/client";
import { recordAuditLog } from "@/lib/auth";

export interface OnboardingInput {
  spaceId: string;
  userId: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  gender: Gender;
  birthYear?: number | null;
  photoUrl?: string | null;
  biography?: string | null;
  relationToAnchor: "PARENT" | "GRANDPARENT" | "GREAT_GRANDPARENT" | "FOUNDING_ROOT";
  anchorPersonId?: string | null;
  intermediateParentId?: string | null;
  intermediateGrandparentId?: string | null;
}

export interface CandidatePerson {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  birthYear?: number | null;
}

export type OnboardingResult =
  | {
      status: "CONFIRMED";
      personId: string;
      message: string;
    }
  | {
      status: "CLARIFICATION_NEEDED";
      message: string;
      code: "MISSING_INTERMEDIATE" | "MULTIPLE_BRANCHES_FOUND" | "CONFIRM_SINGLE_CANDIDATE";
      candidates?: CandidatePerson[];
      requestId?: string;
    }
  | {
      status: "QUEUED_FOR_APPROVAL";
      requestId: string;
      message: string;
    }
  | {
      status: "DUPLICATE_FLAGGED";
      message: string;
      existingPersonId: string;
    };

/**
 * Searches relatives within a space for anchor selection during onboarding.
 * Scoped strictly to the private space to prevent any data leakage.
 */
export async function searchSpaceRelatives(
  spaceId: string,
  query: string,
  limit: number = 20
): Promise<CandidatePerson[]> {
  const trimmed = query.trim();

  return await prisma.person.findMany({
    where: {
      spaceId,
      ...(trimmed
        ? {
            OR: [
              { firstName: { contains: trimmed, mode: "insensitive" } },
              { lastName: { contains: trimmed, mode: "insensitive" } },
              { khmerName: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      khmerName: true,
      birthYear: true,
    },
    take: limit,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/**
 * Executes family member onboarding and automatic lineage matching.
 * Never guesses relationships. Requires clarification or admin review on ambiguity.
 */
export async function processFamilyOnboarding(
  input: OnboardingInput
): Promise<OnboardingResult> {
  const {
    spaceId,
    userId,
    firstName,
    lastName,
    khmerName,
    gender,
    birthYear,
    photoUrl,
    biography,
    relationToAnchor,
    anchorPersonId,
    intermediateParentId,
  } = input;

  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();

  if (!cleanFirstName || !cleanLastName) {
    throw new Error("First name and last name are required for family registration.");
  }

  // Verify active space membership
  const membership = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
    include: { space: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("User is not an active member of this private family space.");
  }

  if (membership.personId) {
    throw new Error("Your user profile is already linked to a relative in this family tree.");
  }

  // 1. Duplicate Person Check
  const potentialDuplicate = await prisma.person.findFirst({
    where: {
      spaceId,
      firstName: { equals: cleanFirstName, mode: "insensitive" },
      lastName: { equals: cleanLastName, mode: "insensitive" },
      ...(birthYear ? { birthYear } : {}),
    },
  });

  if (potentialDuplicate) {
    // Queue for approval rather than silently duplicating
    const req = await prisma.connectionRequest.create({
      data: {
        spaceId,
        userId,
        anchorPersonId: anchorPersonId || potentialDuplicate.id,
        relationType: relationToAnchor,
        status: RequestStatus.PENDING,
        proposedPersonData: {
          firstName: cleanFirstName,
          lastName: cleanLastName,
          khmerName,
          gender,
          birthYear,
          photoUrl,
          biography,
          duplicateWarning: `Potential duplicate of Person ID: ${potentialDuplicate.id}`,
        },
      },
    });

    await recordAuditLog({
      spaceId,
      actorId: userId,
      action: "DUPLICATE_PERSON_FLAGGED",
      entityType: "ConnectionRequest",
      entityId: req.id,
      metadata: {
        existingPersonId: potentialDuplicate.id,
        name: `${cleanFirstName} ${cleanLastName}`,
      },
    });

    return {
      status: "DUPLICATE_FLAGGED",
      message: `A relative named '${cleanFirstName} ${cleanLastName}' is already registered in this family space. To preserve lineage accuracy, your connection has been submitted to the family council for verification.`,
      existingPersonId: potentialDuplicate.id,
    };
  }

  // 2. Founding Root Ancestor
  const spacePersonCount = await prisma.person.count({ where: { spaceId } });

  if (relationToAnchor === "FOUNDING_ROOT" || spacePersonCount === 0) {
    if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
      throw new Error("Only space administrators can register the founding ancestor of the lineage.");
    }

    const newPerson = await prisma.person.create({
      data: {
        spaceId,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        khmerName: khmerName || null,
        gender,
        birthYear: birthYear || null,
        photoUrl: photoUrl || null,
        biography: biography || null,
        createdById: userId,
        isVerified: true,
      },
    });

    await prisma.spaceMember.update({
      where: { id: membership.id },
      data: { personId: newPerson.id },
    });

    await recordAuditLog({
      spaceId,
      actorId: userId,
      action: "FOUNDING_ANCESTOR_REGISTERED",
      entityType: "Person",
      entityId: newPerson.id,
      metadata: { name: `${cleanFirstName} ${cleanLastName}` },
    });

    return {
      status: "CONFIRMED",
      personId: newPerson.id,
      message: "Founding ancestor successfully established as the root of the family tree.",
    };
  }

  // Require an anchor person if not founding root
  if (!anchorPersonId) {
    throw new Error("Please select an existing relative as your ancestral anchor.");
  }

  const anchor = await prisma.person.findUnique({
    where: { id: anchorPersonId },
  });

  if (!anchor || anchor.spaceId !== spaceId) {
    throw new Error("Selected ancestral anchor was not found in this family space.");
  }

  // 3. Anchor = PARENT (Direct Parent-Child)
  if (relationToAnchor === "PARENT") {
    // Unambiguous direct connection
    const newPerson = await prisma.person.create({
      data: {
        spaceId,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        khmerName: khmerName || null,
        gender,
        birthYear: birthYear || null,
        photoUrl: photoUrl || null,
        biography: biography || null,
        createdById: userId,
        isVerified: true,
      },
    });

    // Create PARENT_CHILD relationship
    await prisma.relationship.create({
      data: {
        spaceId,
        personId: anchor.id, // Parent
        relatedPersonId: newPerson.id, // Child
        type: RelationType.PARENT_CHILD,
        status: RelationStatus.CONFIRMED,
        confidence: ConfidenceLevel.DIRECT,
        createdById: userId,
      },
    });

    // Link user membership to this person
    await prisma.spaceMember.update({
      where: { id: membership.id },
      data: { personId: newPerson.id },
    });

    await recordAuditLog({
      spaceId,
      actorId: userId,
      action: "RELATIVE_ONBOARDED_PARENT_CHILD",
      entityType: "Person",
      entityId: newPerson.id,
      metadata: {
        parentId: anchor.id,
        parentName: `${anchor.firstName} ${anchor.lastName}`,
      },
    });

    return {
      status: "CONFIRMED",
      personId: newPerson.id,
      message: `Successfully connected as the child of ${anchor.firstName} ${anchor.lastName}.`,
    };
  }

  // 4. Anchor = GRANDPARENT
  if (relationToAnchor === "GRANDPARENT") {
    // Find all children of this grandparent (potential parents generation)
    const childrenOfGrandparent = await prisma.relationship.findMany({
      where: {
        spaceId,
        personId: anchor.id,
        type: RelationType.PARENT_CHILD,
        status: RelationStatus.CONFIRMED,
      },
      include: {
        relatedPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            khmerName: true,
            birthYear: true,
          },
        },
      },
    });

    const candidateParents = childrenOfGrandparent.map((r) => r.relatedPerson);

    // Case 4A: Incomplete ancestry (grandparent has 0 registered children)
    if (candidateParents.length === 0) {
      const req = await prisma.connectionRequest.create({
        data: {
          spaceId,
          userId,
          anchorPersonId: anchor.id,
          relationType: "GRANDPARENT",
          status: RequestStatus.CLARIFICATION_NEEDED,
          proposedPersonData: {
            firstName: cleanFirstName,
            lastName: cleanLastName,
            khmerName,
            gender,
            birthYear,
            photoUrl,
            biography,
            issue: "INCOMPLETE_ANCESTRY_NO_INTERMEDIATE_PARENT",
          },
        },
      });

      return {
        status: "CLARIFICATION_NEEDED",
        code: "MISSING_INTERMEDIATE",
        requestId: req.id,
        message: `Grandparent '${anchor.firstName} ${anchor.lastName}' does not currently have any children recorded in the tree. To maintain lineage accuracy without guessing, please specify your parent's details or submit to council review.`,
      };
    }

    // Case 4B: Multiple candidate parents found (aunts/uncles exist)
    if (candidateParents.length > 1 && !intermediateParentId) {
      return {
        status: "CLARIFICATION_NEEDED",
        code: "MULTIPLE_BRANCHES_FOUND",
        candidates: candidateParents,
        message: `Grandparent '${anchor.firstName} ${anchor.lastName}' has ${candidateParents.length} children recorded in this tree. Please clarify which one is your parent.`,
      };
    }

    // Case 4C: Intermediate parent specified or single child confirmation
    const targetParentId = intermediateParentId;

    if (!targetParentId && candidateParents.length === 1) {
      // Single child exists, but user must explicitly confirm
      return {
        status: "CLARIFICATION_NEEDED",
        code: "CONFIRM_SINGLE_CANDIDATE",
        candidates: candidateParents,
        message: `Grandparent '${anchor.firstName} ${anchor.lastName}' has one recorded child: '${candidateParents[0].firstName} ${candidateParents[0].lastName}'. Please confirm if this is your parent.`,
      };
    }

    // Validate that intermediateParentId is indeed a verified child of the grandparent
    const isValidParent = candidateParents.some((p) => p.id === targetParentId);
    if (!isValidParent) {
      throw new Error("The selected parent is not a registered child of the chosen grandparent.");
    }

    // Create the new person and establish the parent-child relationship
    const newPerson = await prisma.person.create({
      data: {
        spaceId,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        khmerName: khmerName || null,
        gender,
        birthYear: birthYear || null,
        photoUrl: photoUrl || null,
        biography: biography || null,
        createdById: userId,
        isVerified: true,
      },
    });

    await prisma.relationship.create({
      data: {
        spaceId,
        personId: targetParentId!,
        relatedPersonId: newPerson.id,
        type: RelationType.PARENT_CHILD,
        status: RelationStatus.CONFIRMED,
        confidence: ConfidenceLevel.INFERRED,
        notes: `Inferred branch through grandparent ${anchor.id}`,
        createdById: userId,
      },
    });

    await prisma.spaceMember.update({
      where: { id: membership.id },
      data: { personId: newPerson.id },
    });

    await recordAuditLog({
      spaceId,
      actorId: userId,
      action: "RELATIVE_ONBOARDED_GRANDPARENT_BRANCH",
      entityType: "Person",
      entityId: newPerson.id,
      metadata: {
        grandparentId: anchor.id,
        parentId: targetParentId,
      },
    });

    return {
      status: "CONFIRMED",
      personId: newPerson.id,
      message: `Successfully connected through grandparent ${anchor.firstName} ${anchor.lastName}.`,
    };
  }

  // 5. Anchor = GREAT_GRANDPARENT
  if (relationToAnchor === "GREAT_GRANDPARENT") {
    // 2-generation gap requires explicit intermediate grandparent and parent, or queue for admin approval
    if (!intermediateParentId) {
      const req = await prisma.connectionRequest.create({
        data: {
          spaceId,
          userId,
          anchorPersonId: anchor.id,
          relationType: "GREAT_GRANDPARENT",
          status: RequestStatus.PENDING,
          proposedPersonData: {
            firstName: cleanFirstName,
            lastName: cleanLastName,
            khmerName,
            gender,
            birthYear,
            photoUrl,
            biography,
            issue: "TWO_GENERATION_GAP_REQUIRES_COUNCIL_APPROVAL",
          },
        },
      });

      return {
        status: "QUEUED_FOR_APPROVAL",
        requestId: req.id,
        message: `Connecting across 3 generations to great-grandparent '${anchor.firstName} ${anchor.lastName}' requires family council verification. Your request has been queued for review.`,
      };
    }

    // If intermediate parent is provided, connect to parent
    const newPerson = await prisma.person.create({
      data: {
        spaceId,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        khmerName: khmerName || null,
        gender,
        birthYear: birthYear || null,
        photoUrl: photoUrl || null,
        biography: biography || null,
        createdById: userId,
        isVerified: true,
      },
    });

    await prisma.relationship.create({
      data: {
        spaceId,
        personId: intermediateParentId,
        relatedPersonId: newPerson.id,
        type: RelationType.PARENT_CHILD,
        status: RelationStatus.CONFIRMED,
        confidence: ConfidenceLevel.INFERRED,
        notes: `Connected via Great-Grandparent branch ${anchor.id}`,
        createdById: userId,
      },
    });

    await prisma.spaceMember.update({
      where: { id: membership.id },
      data: { personId: newPerson.id },
    });

    return {
      status: "CONFIRMED",
      personId: newPerson.id,
      message: `Successfully connected through great-grandparent lineage.`,
    };
  }

  throw new Error("Unsupported anchor relationship type.");
}
