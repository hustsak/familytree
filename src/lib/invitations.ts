import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  Role,
  InvitationStatus,
  MemberStatus,
  Gender,
  RelationType,
  RelationStatus,
  ConfidenceLevel,
  RequestStatus,
} from "@prisma/client";
import { recordAuditLog, AuthorizationError } from "@/lib/auth";

export interface CreateInviteInput {
  spaceId: string;
  inviterUserId: string;
  email: string;
  role: Role;
  suggestedPersonId?: string | null;
  suggestedRelation?: string | null;
  expiresInDays?: number;
}

export class InvitationError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code: string, status: number = 400) {
    super(message);
    this.name = "InvitationError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Validates whether the inviter has sufficient permissions to create an invitation.
 * - OWNER can invite ADMIN or MEMBER.
 * - ADMIN can only invite MEMBER (cannot escalate to OWNER or ADMIN).
 * - MEMBER cannot invite anyone.
 */
export async function assertCanInvite(
  spaceId: string,
  inviterUserId: string,
  targetRole: Role
) {
  const inviterMembership = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId,
        userId: inviterUserId,
      },
    },
  });

  if (!inviterMembership || inviterMembership.status !== MemberStatus.ACTIVE) {
    throw new AuthorizationError(
      "You are not an active member of this private family space.",
      403
    );
  }

  if (inviterMembership.role === Role.MEMBER) {
    throw new AuthorizationError(
      "Only Family Space Owners and Admins can issue invitations.",
      403
    );
  }

  // Prevent role escalation
  if (targetRole === Role.OWNER) {
    throw new InvitationError(
      "Space Ownership cannot be granted via invitation link.",
      "CANNOT_INVITE_OWNER",
      403
    );
  }

  if (inviterMembership.role === Role.ADMIN && targetRole === Role.ADMIN) {
    throw new AuthorizationError(
      "Admins can only invite members. Only the Space Owner can invite new Admins.",
      403
    );
  }

  return inviterMembership;
}

/**
 * Creates a secure, expiring, single-use invitation token.
 */
export async function createInvitation({
  spaceId,
  inviterUserId,
  email,
  role,
  suggestedPersonId,
  suggestedRelation,
  expiresInDays = 7,
}: CreateInviteInput) {
  const normalizedEmail = email.trim().toLowerCase();

  // Validate inviter permission
  await assertCanInvite(spaceId, inviterUserId, role);

  // Check if invited user is already an active member of this space
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      spaceMemberships: {
        where: { spaceId, status: MemberStatus.ACTIVE },
      },
    },
  });

  if (existingUser && existingUser.spaceMemberships.length > 0) {
    throw new InvitationError(
      `User with email ${normalizedEmail} is already an active member of this family space.`,
      "ALREADY_MEMBER",
      409
    );
  }

  // Check if there is already an active pending invitation for this email in this space
  const existingPendingInvite = await prisma.invitation.findFirst({
    where: {
      spaceId,
      email: normalizedEmail,
      status: InvitationStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingPendingInvite) {
    throw new InvitationError(
      `An active invitation already exists for ${normalizedEmail}. Please wait for acceptance or revoke the existing invitation.`,
      "INVITATION_ALREADY_PENDING",
      409
    );
  }

  // Generate high-entropy 256-bit cryptographically secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      spaceId,
      email: normalizedEmail,
      role,
      token,
      suggestedPersonId: suggestedPersonId || null,
      suggestedRelation: suggestedRelation || null,
      status: InvitationStatus.PENDING,
      expiresAt,
      invitedById: inviterUserId,
    },
    include: {
      space: { select: { name: true, slug: true } },
    },
  });

  await recordAuditLog({
    spaceId,
    actorId: inviterUserId,
    action: "INVITATION_CREATED",
    entityType: "Invitation",
    entityId: invitation.id,
    metadata: {
      invitedEmail: normalizedEmail,
      role,
      expiresAt: expiresAt.toISOString(),
      suggestedPersonId,
    },
  });

  return invitation;
}

/**
 * Validates an invitation token for redemption.
 * Checks for token existence, expiry, and single-use status.
 */
export async function validateInvitationToken(token: string) {
  if (!token || typeof token !== "string" || token.length < 32) {
    throw new InvitationError("Invalid invitation token format.", "INVALID_TOKEN", 400);
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      space: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { members: true, people: true } },
        },
      },
      invitedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new InvitationError(
      "Invitation not found or invalid.",
      "INVITATION_NOT_FOUND",
      404
    );
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    throw new InvitationError(
      "This invitation token has already been accepted and cannot be reused.",
      "TOKEN_ALREADY_USED",
      410
    );
  }

  if (invitation.status === InvitationStatus.REVOKED) {
    throw new InvitationError(
      "This invitation has been revoked by a family space administrator.",
      "INVITATION_REVOKED",
      410
    );
  }

  if (invitation.status === InvitationStatus.EXPIRED || invitation.expiresAt < new Date()) {
    // Mark as EXPIRED if not already updated
    if (invitation.status !== InvitationStatus.EXPIRED) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    }
    throw new InvitationError(
      "This invitation has expired. Please request a new invitation from a family admin.",
      "INVITATION_EXPIRED",
      410
    );
  }

  return invitation;
}

export interface AcceptPersonDetails {
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  gender?: Gender;
  birthYear?: number | null;
}

/**
 * Accepts an invitation and establishes membership in the private family space.
 * If person details are provided:
 * - If an obvious parent branch is set on the invitation (suggestedPersonId), connects directly as CONFIRMED.
 * - If uncertain, creates the person and queues a ConnectionRequest for family admin approval.
 * Enforces single-use token invalidation and audit logging inside an atomic transaction.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
  personDetails?: AcceptPersonDetails
) {
  const invitation = await validateInvitationToken(token);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthorizationError("User profile does not exist.", 401);
  }

  // Execute in atomic transaction to prevent race conditions or double redemption
  const result = await prisma.$transaction(async (tx) => {
    // Re-check invitation status within transaction lock
    const currentInvite = await tx.invitation.findUnique({
      where: { id: invitation.id },
    });

    if (!currentInvite || currentInvite.status !== InvitationStatus.PENDING) {
      throw new InvitationError(
        "Invitation is no longer available or was already redeemed.",
        "TOKEN_ALREADY_USED",
        410
      );
    }

    // Mark invitation as ACCEPTED (single-use token consumed)
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED },
    });

    // Upsert membership (in case a pending membership existed)
    let membership = await tx.spaceMember.upsert({
      where: {
        spaceId_userId: {
          spaceId: invitation.spaceId,
          userId: user.id,
        },
      },
      update: {
        role: invitation.role,
        status: MemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
      create: {
        spaceId: invitation.spaceId,
        userId: user.id,
        role: invitation.role,
        status: MemberStatus.ACTIVE,
      },
    });

    let personId: string | undefined = membership.personId || undefined;

    // If real name details are provided, immediately weave person into the tree
    if (personDetails && personDetails.firstName?.trim() && personDetails.lastName?.trim()) {
      const cleanFirstName = personDetails.firstName.trim();
      const cleanLastName = personDetails.lastName.trim();
      const cleanKhmerName = personDetails.khmerName?.trim() || null;

      // Update user full name if empty or generic
      if (!user.fullName || user.fullName === "Family Relative") {
        await tx.user.update({
          where: { id: user.id },
          data: { fullName: `${cleanFirstName} ${cleanLastName}` },
        });
      }

      if (!membership.personId) {
        // If invitation has a suggestedPersonId (preset parent / obvious branch)
        if (invitation.suggestedPersonId) {
          const anchor = await tx.person.findFirst({
            where: { id: invitation.suggestedPersonId, spaceId: invitation.spaceId },
          });

          if (anchor) {
            // Create confirmed relative node
            const newPerson = await tx.person.create({
              data: {
                spaceId: invitation.spaceId,
                firstName: cleanFirstName,
                lastName: cleanLastName,
                khmerName: cleanKhmerName,
                gender: personDetails.gender || Gender.UNKNOWN,
                birthYear: personDetails.birthYear || null,
                isLiving: true,
                isVerified: true,
                createdById: user.id,
              },
            });

            personId = newPerson.id;

            // Direct verified parent-child relationship
            await tx.relationship.create({
              data: {
                spaceId: invitation.spaceId,
                personId: anchor.id,
                relatedPersonId: newPerson.id,
                type: RelationType.PARENT_CHILD,
                status: RelationStatus.CONFIRMED,
                confidence: ConfidenceLevel.DIRECT,
                createdById: user.id,
              },
            });

            // Link person to space membership
            membership = await tx.spaceMember.update({
              where: { id: membership.id },
              data: { personId: newPerson.id },
            });
          }
        }

        // If no preset anchor on invitation: create person and queue for admin approval
        if (!personId) {
          const newPerson = await tx.person.create({
            data: {
              spaceId: invitation.spaceId,
              firstName: cleanFirstName,
              lastName: cleanLastName,
              khmerName: cleanKhmerName,
              gender: personDetails.gender || Gender.UNKNOWN,
              birthYear: personDetails.birthYear || null,
              isLiving: true,
              isVerified: false,
              createdById: user.id,
            },
          });

          personId = newPerson.id;

          // Link person to space membership
          membership = await tx.spaceMember.update({
            where: { id: membership.id },
            data: { personId: newPerson.id },
          });

          // Queue connection request for admin/council to approve exact parent
          await tx.connectionRequest.create({
            data: {
              spaceId: invitation.spaceId,
              userId: user.id,
              proposedPersonData: {
                personId: newPerson.id,
                firstName: cleanFirstName,
                lastName: cleanLastName,
                khmerName: cleanKhmerName,
              },
              anchorPersonId: newPerson.id,
              relationType: "NEW_RELATIVE_APPROVAL",
              status: RequestStatus.PENDING,
              adminNotes: "Joined via private invitation without preset parent. Awaiting family admin branch approval.",
            },
          });
        }
      }
    }

    return { membership, space: invitation.space, personId };
  });

  await recordAuditLog({
    spaceId: invitation.spaceId,
    actorId: user.id,
    action: "INVITATION_ACCEPTED",
    entityType: "SpaceMember",
    entityId: result.membership.id,
    metadata: {
      invitationId: invitation.id,
      assignedRole: invitation.role,
      userEmail: user.email,
    },
  });

  return result;
}

/**
 * Revokes a pending invitation (Admin/Owner action).
 */
export async function revokeInvitation(
  spaceId: string,
  inviterUserId: string,
  invitationId: string
) {
  const membership = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId,
        userId: inviterUserId,
      },
    },
  });

  if (!membership || (membership.role !== Role.OWNER && membership.role !== Role.ADMIN)) {
    throw new AuthorizationError("Only space administrators can revoke invitations.", 403);
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation || invitation.spaceId !== spaceId) {
    throw new InvitationError("Invitation not found in this space.", "NOT_FOUND", 404);
  }

  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: InvitationStatus.REVOKED },
  });

  await recordAuditLog({
    spaceId,
    actorId: inviterUserId,
    action: "INVITATION_REVOKED",
    entityType: "Invitation",
    entityId: invitationId,
    metadata: {
      revokedEmail: invitation.email,
    },
  });

  return updated;
}
