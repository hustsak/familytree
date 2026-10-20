import { Role } from "@prisma/client";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

// In-memory sliding window rate limiter
const rateLimitStore = new Map<string, { timestamps: number[] }>();

/**
 * Checks in-memory sliding window rate limit for sensitive actions.
 * Cleans up expired entries automatically.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = rateLimitStore.get(key) || { timestamps: [] };
  // Filter out timestamps outside current window
  const activeTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (activeTimestamps.length >= maxRequests) {
    const oldest = activeTimestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  activeTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: activeTimestamps });

  // Cleanup store if it grows too large
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.timestamps.length === 0 || v.timestamps[v.timestamps.length - 1] < windowStart) {
        rateLimitStore.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: maxRequests - activeTimestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Resets the rate limit for a given key (useful for test suites).
 */
export function resetRateLimit(key?: string) {
  if (key) {
    rateLimitStore.delete(key);
  } else {
    rateLimitStore.clear();
  }
}

/**
 * CSRF origin validation for state-changing requests (POST, PATCH, DELETE, PUT).
 * Checks that the origin or referer matches the expected host.
 */
export function verifyCsrfOrigin(originHeader?: string | null, refererHeader?: string | null): boolean {
  const allowedHost = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(allowedHost).origin;
  } catch {
    allowedOrigin = "http://localhost:3000";
  }

  if (originHeader) {
    return originHeader.startsWith(allowedOrigin) || originHeader.includes("localhost") || originHeader.includes("127.0.0.1");
  }

  if (refererHeader) {
    return refererHeader.startsWith(allowedOrigin) || refererHeader.includes("localhost") || refererHeader.includes("127.0.0.1");
  }

  // If running in development without headers, permit
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

export interface PersonDataMaskable {
  id: string;
  spaceId: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  gender: string;
  birthYear?: number | null;
  birthDate?: Date | string | null;
  birthPlace?: string | null;
  deathYear?: number | null;
  deathDate?: Date | string | null;
  deathPlace?: string | null;
  isLiving: boolean;
  isRestricted?: boolean;
  isVerified?: boolean;
  photoUrl?: string | null;
  biography?: string | null;
  createdById?: string | null;
}

/**
 * Privacy controls for living relatives:
 * If a relative is living (`isLiving: true`) and restricted (`isRestricted: true`),
 * non-admin members who are not linked to this person receive masked sensitive fields
 * (exact birth date, birth place, and sensitive biography).
 */
export function sanitizePersonForViewer<T extends PersonDataMaskable>(
  person: T,
  viewerRole: Role,
  viewerPersonId?: string | null,
  viewerUserId?: string | null
): T {
  const isCouncil = viewerRole === Role.OWNER || viewerRole === Role.ADMIN;
  const isSelf = viewerPersonId && viewerPersonId === person.id;
  const isCreator = viewerUserId && person.createdById === viewerUserId;

  // Council members, the individual themselves, or the record creator have full access
  if (isCouncil || isSelf || isCreator) {
    return person;
  }

  // If person is living and restricted, apply privacy masking
  if (person.isLiving && person.isRestricted) {
    return {
      ...person,
      birthDate: null,
      birthPlace: null,
      deathPlace: null,
      biography: person.biography
        ? "[Sensitive details restricted for living relative privacy]"
        : null,
    };
  }

  return person;
}

/**
 * Sanitizes input string to prevent script injection while preserving international text (Khmer, UTF-8).
 */
export function sanitizeInputString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}
