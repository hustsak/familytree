import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Role } from "@prisma/client";

interface MockMemory {
  id: string;
  spaceId: string;
  createdById: string;
  title: string;
  titleKm?: string | null;
  description?: string | null;
  type: string;
  eventYear?: number | null;
  branchTag?: string | null;
  taggedPersonIds: string[];
}

describe("Phase 6: Family Memories & Digital Archive Logic", () => {
  const sampleMemories: MockMemory[] = [
    {
      id: "mem-1",
      spaceId: "space-1",
      createdById: "user-author",
      title: "Paternal Ancestor Wedding in Battambang",
      titleKm: "ពិធីមង្គលការនៅបាត់ដំបង",
      description: "Historical ceremony of great-grandparents",
      type: "PHOTO",
      eventYear: 1952,
      branchTag: "Paternal",
      taggedPersonIds: ["person-greatgrandpa", "person-greatgrandma"],
    },
    {
      id: "mem-2",
      spaceId: "space-1",
      createdById: "user-author",
      title: "Village Relocation Certificate",
      titleKm: "លិខិតផ្លាស់ប្តូរទីលំនៅ",
      description: "Official archival document from local commune",
      type: "DOCUMENT",
      eventYear: 1979,
      branchTag: "Maternal",
      taggedPersonIds: ["person-grandpa"],
    },
    {
      id: "mem-3",
      spaceId: "space-1",
      createdById: "user-other",
      title: "Family Reunion in Phnom Penh",
      titleKm: "ជួបជុំគ្រួសារនៅភ្នំពេញ",
      description: "Gathering of grandchildren and great-grandchildren",
      type: "EVENT",
      eventYear: 2015,
      branchTag: "Paternal",
      taggedPersonIds: ["person-cousin", "person-grandpa"],
    },
  ];

  describe("1. Archive Filtering & Search", () => {
    it("filters memories by type (e.g. PHOTO vs DOCUMENT)", () => {
      const photos = sampleMemories.filter((m) => m.type === "PHOTO");
      assert.equal(photos.length, 1);
      assert.equal(photos[0].id, "mem-1");

      const documents = sampleMemories.filter((m) => m.type === "DOCUMENT");
      assert.equal(documents.length, 1);
      assert.equal(documents[0].id, "mem-2");
    });

    it("filters memories by branch tag", () => {
      const maternal = sampleMemories.filter((m) => m.branchTag === "Maternal");
      assert.equal(maternal.length, 1);
      assert.equal(maternal[0].id, "mem-2");
    });

    it("filters memories by tagged relative ID", () => {
      const grandpaMemories = sampleMemories.filter((m) =>
        m.taggedPersonIds.includes("person-grandpa")
      );
      assert.equal(grandpaMemories.length, 2);
    });

    it("searches across English and Khmer titles and descriptions", () => {
      const q = "បាត់ដំបង"; // Battambang in Khmer
      const matched = sampleMemories.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.titleKm && m.titleKm.includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q))
      );
      assert.equal(matched.length, 1);
      assert.equal(matched[0].id, "mem-1");
    });
  });

  describe("2. Chronological Timeline Ordering", () => {
    it("sorts historical memory events in ascending chronological order", () => {
      const sorted = [...sampleMemories].sort(
        (a, b) => (a.eventYear || 0) - (b.eventYear || 0)
      );

      assert.equal(sorted[0].eventYear, 1952);
      assert.equal(sorted[1].eventYear, 1979);
      assert.equal(sorted[2].eventYear, 2015);
    });
  });

  describe("3. Memory Permissions & Council Moderation", () => {
    function canEditOrDelete(
      memory: MockMemory,
      requestingUserId: string,
      requestingUserRole: Role
    ): boolean {
      const isAuthor = memory.createdById === requestingUserId;
      const isCouncil =
        requestingUserRole === Role.OWNER || requestingUserRole === Role.ADMIN;
      return isAuthor || isCouncil;
    }

    it("allows memory author to edit or delete their own contribution", () => {
      const allowed = canEditOrDelete(sampleMemories[0], "user-author", Role.MEMBER);
      assert.equal(allowed, true);
    });

    it("allows space OWNER and ADMIN to moderate any memory", () => {
      const ownerAllowed = canEditOrDelete(sampleMemories[0], "admin-user", Role.OWNER);
      assert.equal(ownerAllowed, true);

      const adminAllowed = canEditOrDelete(sampleMemories[0], "admin-user", Role.ADMIN);
      assert.equal(adminAllowed, true);
    });

    it("rejects non-author MEMBER from modifying or deleting others' memories", () => {
      const memberAllowed = canEditOrDelete(
        sampleMemories[0],
        "unrelated-member",
        Role.MEMBER
      );
      assert.equal(memberAllowed, false);
    });
  });

  describe("4. Cross-Space Person Tagging Prevention", () => {
    function validateTaggedPeopleInSpace(
      spacePeopleIds: string[],
      candidateTaggedIds: string[]
    ): { valid: boolean; rejectedIds: string[] } {
      const rejected = candidateTaggedIds.filter(
        (id) => !spacePeopleIds.includes(id)
      );
      return { valid: rejected.length === 0, rejectedIds: rejected };
    }

    it("validates that all tagged relatives exist within the same family space", () => {
      const spacePeople = ["person-1", "person-2", "person-3"];
      const validTags = ["person-1", "person-2"];
      const checkValid = validateTaggedPeopleInSpace(spacePeople, validTags);
      assert.equal(checkValid.valid, true);

      const invalidTags = ["person-1", "external-alien-person-99"];
      const checkInvalid = validateTaggedPeopleInSpace(spacePeople, invalidTags);
      assert.equal(checkInvalid.valid, false);
      assert.deepEqual(checkInvalid.rejectedIds, ["external-alien-person-99"]);
    });
  });
});
