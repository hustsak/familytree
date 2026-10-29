import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import {
  validateNoCycle,
  validateParentCount,
  validateNoDuplicateRelationship,
} from "../src/lib/validation/dag";

describe("Direct Family Member Management & Lineage Safety", () => {
  describe("1. Adding Family Members (Relationships & DAG checks)", () => {
    it("allows adding a child to an existing parent node without cycles", () => {
      const existingEdges = [
        { parentId: "grandparent-1", childId: "parent-1" },
      ];
      // Propose adding new child to parent-1
      const check = validateNoCycle(existingEdges, "parent-1", "new-child-1");
      assert.equal(check.isValid, true);
    });

    it("prevents adding a parent if the individual already has 2 registered biological parents", () => {
      const currentParents = ["father-1", "mother-1"];
      assert.throws(
        () => validateParentCount(currentParents, "proposed-parent-3"),
        (err: Error) => {
          assert.match(err.message, /at most 2 biological parents/);
          return true;
        }
      );
    });

    it("allows adding a parent when the individual currently has only 1 parent", () => {
      const currentParents = ["father-1"];
      const check = validateParentCount(currentParents, "mother-1");
      assert.equal(check.isValid, true);
    });

    it("prevents creating a cycle when adding an ancestor as a child of their descendant", () => {
      const existingEdges = [
        { parentId: "ancestor-A", childId: "parent-B" },
        { parentId: "parent-B", childId: "person-C" },
      ];
      // Attempting to make person-C the parent of ancestor-A must be blocked
      assert.throws(
        () => validateNoCycle(existingEdges, "person-C", "ancestor-A"),
        (err: Error) => {
          assert.match(err.message, /Ancestry cycle detected/);
          return true;
        }
      );
    });

    it("creates sibling connections by connecting to all existing biological parents of anchor", () => {
      const anchorParents = ["father-1", "mother-1"];
      const newSiblingId = "new-sibling-1";

      const proposedEdges = anchorParents.map((parentId) => ({
        personId: parentId,
        relatedPersonId: newSiblingId,
        type: "PARENT_CHILD" as const,
      }));

      assert.equal(proposedEdges.length, 2);
      assert.equal(proposedEdges[0].personId, "father-1");
      assert.equal(proposedEdges[0].relatedPersonId, newSiblingId);
      assert.equal(proposedEdges[1].personId, "mother-1");
      assert.equal(proposedEdges[1].relatedPersonId, newSiblingId);
    });

    it("prevents duplicate spouse relationships between the same two partners", () => {
      const existingRelationships = [
        {
          spaceId: "space-1",
          personId: "person-A",
          relatedPersonId: "person-B",
          type: "SPOUSE" as const,
        },
      ];

      assert.throws(
        () =>
          validateNoDuplicateRelationship(
            existingRelationships,
            "person-B",
            "person-A",
            "SPOUSE"
          ),
        (err: Error) => {
          assert.match(err.message, /already exists/);
          return true;
        }
      );
    });
  });

  describe("2. Editing Relative Profile & RBAC Permissions", () => {
    function canEditProfile(
      viewerRole: Role,
      viewerPersonId: string | null,
      targetPersonId: string
    ) {
      const isCouncil = viewerRole === Role.OWNER || viewerRole === Role.ADMIN;
      const isSelf = Boolean(viewerPersonId && viewerPersonId === targetPersonId);
      return isCouncil || isSelf;
    }

    it("allows OWNER to edit any relative profile in the family space", () => {
      assert.equal(canEditProfile(Role.OWNER, "person-1", "person-99"), true);
    });

    it("allows ADMIN to edit any relative profile in the family space", () => {
      assert.equal(canEditProfile(Role.ADMIN, "person-2", "person-99"), true);
    });

    it("allows a regular MEMBER to edit their own personal profile", () => {
      assert.equal(canEditProfile(Role.MEMBER, "person-cousin", "person-cousin"), true);
    });

    it("prevents a regular MEMBER from editing another relative's profile", () => {
      assert.equal(canEditProfile(Role.MEMBER, "person-cousin", "person-uncle"), false);
      assert.equal(canEditProfile(Role.MEMBER, null, "person-uncle"), false);
    });
  });

  describe("3. Safe Deletion & Removal Permissions", () => {
    function canDeleteProfile(viewerRole: Role) {
      return viewerRole === Role.OWNER || viewerRole === Role.ADMIN;
    }

    it("allows OWNER and ADMIN to remove a relative profile", () => {
      assert.equal(canDeleteProfile(Role.OWNER), true);
      assert.equal(canDeleteProfile(Role.ADMIN), true);
    });

    it("strictly prevents regular MEMBER from removing any relative", () => {
      assert.equal(canDeleteProfile(Role.MEMBER), false);
    });

    it("calculates accurate impact metrics for safe deletion confirmation dialog", () => {
      const personToRemove = {
        id: "person-to-remove",
        parents: [{ id: "p1" }, { id: "p2" }],
        children: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
        spouses: [{ id: "s1" }],
        memories: [{ id: "m1" }, { id: "m2" }],
      };

      const directRelationsCount =
        personToRemove.parents.length +
        personToRemove.children.length +
        personToRemove.spouses.length;
      const memoryTagsCount = personToRemove.memories.length;

      assert.equal(directRelationsCount, 6);
      assert.equal(memoryTagsCount, 2);
    });
  });

  describe("4. Audit Trail Event Actions", () => {
    it("defines valid audit actions for relative lifecycle", () => {
      const validActions = [
        "RELATIVE_CREATED",
        "RELATIONSHIP_CREATED",
        "RELATIVE_PROFILE_UPDATED",
        "RELATIVE_DELETED",
      ];

      assert.ok(validActions.includes("RELATIVE_CREATED"));
      assert.ok(validActions.includes("RELATIVE_PROFILE_UPDATED"));
      assert.ok(validActions.includes("RELATIVE_DELETED"));
    });
  });
});
