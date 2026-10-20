import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateNoCycle,
  validateParentCount,
  LineageValidationError,
  ParentChildEdge,
} from "../src/lib/validation/dag";

describe("Phase 3: Council Review Authorization & State Transitions", () => {
  function verifyReviewerRole(role: string) {
    if (role !== "OWNER" && role !== "ADMIN") {
      throw new Error("COUNCIL_APPROVAL_FORBIDDEN");
    }
    return true;
  }

  function transitionRequestState(
    currentStatus: "PENDING" | "CLARIFICATION_NEEDED" | "APPROVED" | "REJECTED",
    decision: "APPROVE" | "REJECT" | "REQUEST_CLARIFICATION"
  ) {
    if (currentStatus === "APPROVED") {
      throw new Error("ALREADY_APPROVED");
    }
    if (currentStatus === "REJECTED" && decision === "REJECT") {
      throw new Error("ALREADY_REJECTED");
    }

    switch (decision) {
      case "APPROVE":
        return "APPROVED";
      case "REJECT":
        return "REJECTED";
      case "REQUEST_CLARIFICATION":
        return "CLARIFICATION_NEEDED";
    }
  }

  test("rejects review attempts by non-council members", () => {
    assert.throws(
      () => verifyReviewerRole("MEMBER"),
      (err: Error) => {
        assert.equal(err.message, "COUNCIL_APPROVAL_FORBIDDEN");
        return true;
      }
    );
  });

  test("allows OWNER and ADMIN to perform council reviews", () => {
    assert.equal(verifyReviewerRole("OWNER"), true);
    assert.equal(verifyReviewerRole("ADMIN"), true);
  });

  test("transitions PENDING request to APPROVED, REJECTED, or CLARIFICATION_NEEDED", () => {
    assert.equal(transitionRequestState("PENDING", "APPROVE"), "APPROVED");
    assert.equal(transitionRequestState("PENDING", "REJECT"), "REJECTED");
    assert.equal(transitionRequestState("PENDING", "REQUEST_CLARIFICATION"), "CLARIFICATION_NEEDED");
  });

  test("prevents repeated approvals on already approved requests", () => {
    assert.throws(
      () => transitionRequestState("APPROVED", "APPROVE"),
      (err: Error) => {
        assert.equal(err.message, "ALREADY_APPROVED");
        return true;
      }
    );
  });
});

describe("Phase 3: Lineage Safety & Cycle Prevention on Council Approval", () => {
  test("prevents council from approving a connection that introduces an ancestry cycle", () => {
    // Current lineage: G -> P -> C
    const existingEdges: ParentChildEdge[] = [
      { parentId: "great_grandparent_1", childId: "parent_1" },
      { parentId: "parent_1", childId: "child_1" },
    ];

    // Council attempts to approve making child_1 parent of great_grandparent_1
    assert.throws(
      () => validateNoCycle(existingEdges, "child_1", "great_grandparent_1"),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "TRANSITIVE_ANCESTRY_CYCLE");
        return true;
      }
    );
  });

  test("prevents council from approving a 3rd biological parent", () => {
    const existingParents = ["biological_father_id", "biological_mother_id"];

    assert.throws(
      () => validateParentCount(existingParents, "proposed_third_parent_id", 2),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "MAX_PARENTS_EXCEEDED");
        return true;
      }
    );
  });

  test("requires explicit intermediate parent when approving multi-generation branch", () => {
    function resolveParentForApproval(relationType: string, anchorId: string, explicitParentId?: string) {
      if (explicitParentId) {
        return explicitParentId;
      }
      if (relationType === "PARENT") {
        return anchorId;
      }
      throw new Error("EXPLICIT_PARENT_REQUIRED");
    }

    // Direct parent can use anchor directly
    assert.equal(resolveParentForApproval("PARENT", "father_id"), "father_id");

    // Grandparent without explicit intermediate parent must be rejected (never guess)
    assert.throws(
      () => resolveParentForApproval("GRANDPARENT", "grandparent_id"),
      (err: Error) => {
        assert.equal(err.message, "EXPLICIT_PARENT_REQUIRED");
        return true;
      }
    );

    // Grandparent with explicit parent is accepted
    assert.equal(
      resolveParentForApproval("GRANDPARENT", "grandparent_id", "intermediate_father_id"),
      "intermediate_father_id"
    );
  });
});

describe("Phase 3: Duplicate Person Resolution", () => {
  interface MockPersonNode {
    id: string;
    fullName: string;
    linkedUserId?: string | null;
  }

  function resolveDuplicateDecision(
    action: "CREATE_NEW_PERSON" | "LINK_EXISTING_PERSON",
    proposedName: string,
    existingPeople: MockPersonNode[],
    targetExistingId?: string,
    currentUserId?: string
  ) {
    if (action === "LINK_EXISTING_PERSON") {
      if (!targetExistingId) {
        throw new Error("MISSING_TARGET_PERSON");
      }

      const existing = existingPeople.find((p) => p.id === targetExistingId);
      if (!existing) {
        throw new Error("PERSON_NOT_FOUND");
      }

      if (existing.linkedUserId && existing.linkedUserId !== currentUserId) {
        throw new Error("PERSON_ALREADY_LINKED_TO_OTHER_USER");
      }

      return {
        resolvedAction: "LINKED",
        personId: existing.id,
      };
    } else {
      // Confirmed distinct individual with same name
      const newId = `new_person_${Date.now()}`;
      return {
        resolvedAction: "CREATED_DISTINCT",
        personId: newId,
      };
    }
  }

  test("creates a confirmed distinct relative without altering existing homonymous relative", () => {
    const existing: MockPersonNode[] = [
      { id: "person_1", fullName: "Ly Bunthoeun", linkedUserId: "user_older_generation" },
    ];

    const result = resolveDuplicateDecision(
      "CREATE_NEW_PERSON",
      "Ly Bunthoeun",
      existing,
      undefined,
      "user_younger_generation"
    );

    assert.equal(result.resolvedAction, "CREATED_DISTINCT");
    assert(result.personId.startsWith("new_person_"));
  });

  test("links existing person profile when explicitly confirmed by council", () => {
    const existing: MockPersonNode[] = [
      { id: "person_10", fullName: "Serey Vathana", linkedUserId: null },
    ];

    const result = resolveDuplicateDecision(
      "LINK_EXISTING_PERSON",
      "Serey Vathana",
      existing,
      "person_10",
      "user_serey"
    );

    assert.equal(result.resolvedAction, "LINKED");
    assert.equal(result.personId, "person_10");
  });

  test("rejects linking to a person profile already claimed by another user", () => {
    const existing: MockPersonNode[] = [
      { id: "person_20", fullName: "Keo Dara", linkedUserId: "user_already_registered" },
    ];

    assert.throws(
      () =>
        resolveDuplicateDecision(
          "LINK_EXISTING_PERSON",
          "Keo Dara",
          existing,
          "person_20",
          "user_intruder"
        ),
      (err: Error) => {
        assert.equal(err.message, "PERSON_ALREADY_LINKED_TO_OTHER_USER");
        return true;
      }
    );
  });
});
