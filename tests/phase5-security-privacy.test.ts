import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { Role } from "@prisma/client";
import {
  checkRateLimit,
  resetRateLimit,
  verifyCsrfOrigin,
  sanitizePersonForViewer,
  sanitizeInputString,
  PersonDataMaskable,
} from "../src/lib/security";
import {
  validateFileContent,
  generatePrivateStoragePath,
  verifySignedMediaToken,
} from "../src/lib/storage";

describe("Phase 5: Security, Authorization & Privacy Controls", () => {
  describe("1. Living Relative Privacy Masking", () => {
    const livingRestrictedPerson: PersonDataMaskable = {
      id: "person-living-1",
      spaceId: "space-alpha",
      firstName: "Dara",
      lastName: "Sok",
      khmerName: "ដារ៉ា សុខ",
      gender: "MALE",
      birthYear: 1995,
      birthDate: new Date("1995-04-12T00:00:00Z"),
      birthPlace: "Phnom Penh, Cambodia",
      isLiving: true,
      isRestricted: true,
      biography: "Sensitive medical history and private living address in Tuol Kork.",
      createdById: "creator-user-1",
    };

    const deceasedPerson: PersonDataMaskable = {
      id: "person-deceased-1",
      spaceId: "space-alpha",
      firstName: "Bopha",
      lastName: "Sok",
      gender: "FEMALE",
      birthYear: 1930,
      birthDate: new Date("1930-01-01T00:00:00Z"),
      birthPlace: "Siem Reap",
      deathYear: 2010,
      deathPlace: "Siem Reap",
      isLiving: false,
      isRestricted: true,
      biography: "Honored matriarch and village teacher.",
      createdById: "creator-user-1",
    };

    it("masks exact birth date, birth place, and biography for standard MEMBER viewers", () => {
      const sanitized = sanitizePersonForViewer(
        livingRestrictedPerson,
        Role.MEMBER,
        "other-person-id", // viewer is not linked to this person
        "other-user-id"    // viewer is not the creator
      );

      assert.equal(sanitized.birthDate, null);
      assert.equal(sanitized.birthPlace, null);
      assert.equal(sanitized.deathPlace, null);
      assert.match(sanitized.biography || "", /restricted for living relative privacy/i);
      // Public genealogical names and birth year are retained for lineage connection
      assert.equal(sanitized.firstName, "Dara");
      assert.equal(sanitized.birthYear, 1995);
    });

    it("does NOT mask sensitive details when viewed by space OWNER or ADMIN", () => {
      const viewedByOwner = sanitizePersonForViewer(
        livingRestrictedPerson,
        Role.OWNER,
        "other-person-id",
        "other-user-id"
      );
      assert.ok(viewedByOwner.birthDate !== null);
      assert.equal(viewedByOwner.birthPlace, "Phnom Penh, Cambodia");
      assert.match(viewedByOwner.biography || "", /Tuol Kork/);

      const viewedByAdmin = sanitizePersonForViewer(
        livingRestrictedPerson,
        Role.ADMIN,
        "other-person-id",
        "other-user-id"
      );
      assert.equal(viewedByAdmin.birthPlace, "Phnom Penh, Cambodia");
    });

    it("does NOT mask sensitive details when viewed by the linked individual themselves", () => {
      const viewedBySelf = sanitizePersonForViewer(
        livingRestrictedPerson,
        Role.MEMBER,
        "person-living-1", // viewer IS linked to this person
        "unrelated-user"
      );
      assert.equal(viewedBySelf.birthPlace, "Phnom Penh, Cambodia");
      assert.match(viewedBySelf.biography || "", /Tuol Kork/);
    });

    it("does not mask deceased relatives even if restricted flag was set", () => {
      const sanitized = sanitizePersonForViewer(
        deceasedPerson,
        Role.MEMBER,
        "other-person-id",
        "other-user-id"
      );
      assert.equal(sanitized.birthPlace, "Siem Reap");
      assert.equal(sanitized.deathPlace, "Siem Reap");
      assert.equal(sanitized.biography, "Honored matriarch and village teacher.");
    });
  });

  describe("2. Rate Limiting Protection", () => {
    it("allows requests under the quota and blocks requests exceeding limit", () => {
      const testKey = "rate-limit-test-key";
      resetRateLimit(testKey);

      // Quota: 3 requests per 5000ms
      const r1 = checkRateLimit(testKey, 3, 5000);
      assert.equal(r1.allowed, true);
      assert.equal(r1.remaining, 2);

      const r2 = checkRateLimit(testKey, 3, 5000);
      assert.equal(r2.allowed, true);
      assert.equal(r2.remaining, 1);

      const r3 = checkRateLimit(testKey, 3, 5000);
      assert.equal(r3.allowed, true);
      assert.equal(r3.remaining, 0);

      // 4th request must be rejected
      const r4 = checkRateLimit(testKey, 3, 5000);
      assert.equal(r4.allowed, false);
      assert.equal(r4.remaining, 0);
      assert.ok(r4.resetMs > 0);

      resetRateLimit(testKey);
    });
  });

  describe("3. CSRF & Input Sanitization", () => {
    it("validates allowed origin matching host", () => {
      assert.equal(verifyCsrfOrigin("http://localhost:3000", null), true);
      assert.equal(verifyCsrfOrigin("http://127.0.0.1:3000", null), true);
    });

    it("sanitizes dangerous HTML and script tags from input strings", () => {
      const malicious = "Sok <script>alert('xss')</script><b>Dara</b>";
      const sanitized = sanitizeInputString(malicious);
      assert.equal(sanitized, "Sok Dara");
    });
  });

  describe("4. Media Upload Validation & Magic Bytes", () => {
    it("validates authentic JPEG header bytes (FF D8 FF)", () => {
      const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const res = validateFileContent(validJpegBuffer, "image/jpeg", validJpegBuffer.length);
      assert.equal(res.valid, true);
      assert.equal(res.detectedMime, "image/jpeg");
    });

    it("validates authentic PNG header bytes (89 50 4E 47...)", () => {
      const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const res = validateFileContent(validPngBuffer, "image/png", validPngBuffer.length);
      assert.equal(res.valid, true);
      assert.equal(res.detectedMime, "image/png");
    });

    it("validates authentic PDF header bytes (%PDF)", () => {
      const validPdfBuffer = Buffer.from("%PDF-1.4 header contents here");
      const res = validateFileContent(validPdfBuffer, "application/pdf", validPdfBuffer.length);
      assert.equal(res.valid, true);
      assert.equal(res.detectedMime, "application/pdf");
    });

    it("rejects disguised/corrupted file spoofing an image MIME type", () => {
      // Binary file disguised as an image
      const disguisedBuffer = Buffer.from("MZ\\x90\\x00\\x03This is an executable");
      const res = validateFileContent(disguisedBuffer, "image/jpeg", disguisedBuffer.length);
      assert.equal(res.valid, false);
      assert.match(res.error || "", /signature/i);
    });

    it("rejects files exceeding the 15MB limit", () => {
      const fakeBuffer = Buffer.alloc(10);
      const oversizedBytes = 16 * 1024 * 1024; // 16MB
      const res = validateFileContent(fakeBuffer, "image/jpeg", oversizedBytes);
      assert.equal(res.valid, false);
      assert.match(res.error || "", /exceeds the 15MB limit/i);
    });

    it("generates isolated private storage paths scoped to the space", () => {
      const path = generatePrivateStoragePath("space-123", "Ancestral Photo.PNG");
      assert.ok(path.startsWith("spaces/space-123/memories/"));
      assert.ok(path.endsWith(".png"));
    });
  });

  describe("5. Expiring Signed Media Access", () => {
    it("validates valid unexpired signed token and rejects expired/tampered tokens", () => {
      const spaceId = "space-vault-1";
      const storagePath = "spaces/space-vault-1/memories/doc.pdf";
      const futureExpiry = Date.now() + 60 * 1000; // 1 minute in future
      const pastExpiry = Date.now() - 1000; // expired 1s ago

      // Generate expected HMAC
      const secret = process.env.SESSION_SECRET || "heritage-secure-family-vault-signing-key";
      const validHmac = crypto
        .createHmac("sha256", secret)
        .update(`${spaceId}:${storagePath}:${futureExpiry}`)
        .digest("hex");

      const isValid = verifySignedMediaToken(spaceId, storagePath, futureExpiry, validHmac);
      assert.equal(isValid, true);

      // Expired token check
      const expiredHmac = crypto
        .createHmac("sha256", secret)
        .update(`${spaceId}:${storagePath}:${pastExpiry}`)
        .digest("hex");
      const isExpiredValid = verifySignedMediaToken(spaceId, storagePath, pastExpiry, expiredHmac);
      assert.equal(isExpiredValid, false);

      // Tampered path check
      const isTamperedValid = verifySignedMediaToken("other-space", storagePath, futureExpiry, validHmac);
      assert.equal(isTamperedValid, false);
    });
  });
});
