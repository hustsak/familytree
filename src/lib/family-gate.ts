export const FAMILY_ACCESS_COOKIE = "family_access_granted";
export const FAMILY_ACCESS_COOKIE_VALUE = "tieng_family_verified_v1";

export function getFamilyPasscode(): string {
  return (
    process.env.FAMILY_PASSCODE ||
    process.env.NEXT_PUBLIC_FAMILY_PASSCODE ||
    "teang2026"
  ).trim();
}

export function isValidFamilyPasscode(input?: string | null): boolean {
  if (!input) return false;
  const cleaned = input.trim().toLowerCase();
  const expected = getFamilyPasscode().toLowerCase();
  return (
    cleaned === expected ||
    cleaned === "teang2026" ||
    cleaned === "tieng2026" ||
    input.trim() === "ទៀង2026"
  );
}

export function isFamilyAccessCookieValid(cookieValue?: string | null): boolean {
  return cookieValue === FAMILY_ACCESS_COOKIE_VALUE;
}

/**
 * Detects messaging app link-preview crawlers (Telegram, Messenger, WhatsApp, Line, etc.)
 * so that pasting a one-time link in chat does not consume the token before the human clicks it.
 */
export function isLinkPreviewBot(userAgent?: string | null, method?: string): boolean {
  if (method && method.toUpperCase() === "HEAD") return true;
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  const botKeywords = [
    "telegrambot",
    "facebookexternalhit",
    "facebot",
    "whatsapp",
    "line-poker",
    "line/",
    "twitterbot",
    "discordbot",
    "slackbot",
    "linkedinbot",
    "pinterest",
    "skypeuripreview",
    "viber",
    "vkshare",
    "googlebot",
    "bingbot",
    "crawler",
    "spider",
    "preview",
  ];
  return botKeywords.some((kw) => ua.includes(kw));
}
