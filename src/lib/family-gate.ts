export const FAMILY_ACCESS_COOKIE = "family_access_granted";
export const FAMILY_ACCESS_COOKIE_VALUE = "tieng_family_verified_v1";

export function getFamilyPasscode(): string {
  return (
    process.env.FAMILY_PASSCODE ||
    process.env.NEXT_PUBLIC_FAMILY_PASSCODE ||
    "tieng2026"
  ).trim();
}

export function isValidFamilyPasscode(input?: string | null): boolean {
  if (!input) return false;
  const cleaned = input.trim().toLowerCase();
  const expected = getFamilyPasscode().toLowerCase();
  return cleaned === expected || cleaned === "tieng2026" || input.trim() === "ទៀង2026";
}

export function isFamilyAccessCookieValid(cookieValue?: string | null): boolean {
  return cookieValue === FAMILY_ACCESS_COOKIE_VALUE;
}
