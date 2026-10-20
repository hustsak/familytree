import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Role, MemberStatus } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  language: string;
}

export class AuthorizationError extends Error {
  public status: number;

  constructor(message: string, status: number = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

/**
 * Retrieves the current authenticated user from Supabase session,
 * and ensures the corresponding record exists in PostgreSQL via Prisma.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return null;
    }

    const email = authUser.email ?? "";
    const fullName =
      (authUser.user_metadata?.full_name as string) ||
      (authUser.user_metadata?.name as string) ||
      email.split("@")[0] ||
      "Family Relative";

    const avatarUrl = (authUser.user_metadata?.avatar_url as string) || null;

    // Sync user record to PostgreSQL database
    const dbUser = await prisma.user.upsert({
      where: { id: authUser.id },
      update: {
        email,
        fullName,
        avatarUrl,
      },
      create: {
        id: authUser.id,
        email,
        fullName,
        avatarUrl,
        language: "en",
      },
    });

    return {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.fullName,
      avatarUrl: dbUser.avatarUrl,
      language: dbUser.language,
    };
  } catch (err) {
    console.error("Error in getCurrentUser:", err);
    return null;
  }
}

/**
 * Asserts that a user is authenticated. Throws 401 AuthorizationError if not.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Authentication required. Please sign in.", 401);
  }
  return user;
}

/**
 * Retrieves space membership for a specific user and private family space.
 */
export async function getSpaceMembership(spaceId: string, userId: string) {
  return await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId,
        userId,
      },
    },
    include: {
      space: true,
      person: true,
    },
  });
}

/**
 * Strictly verifies that the authenticated user belongs to the family space
 * and meets the minimum role requirement (OWNER > ADMIN > MEMBER).
 */
export async function requireSpaceRole(
  spaceId: string,
  minRole: Role = Role.MEMBER
): Promise<{ user: AuthenticatedUser; membership: NonNullable<Awaited<ReturnType<typeof getSpaceMembership>>> }> {
  const user = await requireAuth();

  const membership = await getSpaceMembership(spaceId, user.id);
  if (!membership || membership.status !== MemberStatus.ACTIVE) {
    throw new AuthorizationError(
      "Access denied: You are not an active member of this private family space.",
      403
    );
  }

  const userRoleLevel = ROLE_HIERARCHY[membership.role];
  const requiredRoleLevel = ROLE_HIERARCHY[minRole];

  if (userRoleLevel < requiredRoleLevel) {
    throw new AuthorizationError(
      `Access denied: Required role '${minRole}', but your role is '${membership.role}'.`,
      403
    );
  }

  return { user, membership };
}

/**
 * Writes an immutable audit trail entry for genealogical and administrative actions.
 */
export async function recordAuditLog(params: {
  spaceId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  return await prisma.auditLog.create({
    data: {
      spaceId: params.spaceId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
    },
  });
}
