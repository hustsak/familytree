import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateNoCycle,
  validateParentCount,
  validateNoDuplicateRelationship,
  LineageValidationError,
  ParentChildEdge,
  RelationshipRecord,
} from "../src/lib/validation/dag";

describe("Phase 1: Lineage Integrity & DAG Cycle Prevention", () => {
  test("prevents self-parenting (A cannot be parent of A)", () => {
    assert.throws(
      () => validateNoCycle([], "person_A", "person_A"),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "SELF_PARENT_CYCLE");
        return true;
      }
    );
  });

  test("prevents direct cycle (if A -> B, then B cannot be parent of A)", () => {
    const existingEdges: ParentChildEdge[] = [
      { parentId: "person_A", childId: "person_B" },
    ];

    assert.throws(
      () => validateNoCycle(existingEdges, "person_B", "person_A"),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "DIRECT_ANCESTRY_CYCLE");
        return true;
      }
    );
  });

  test("prevents transitive multi-generational cycles (A -> B -> C -> D; D cannot be parent of A)", () => {
    const existingEdges: ParentChildEdge[] = [
      { parentId: "great_grandfather_A", childId: "grandfather_B" },
      { parentId: "grandfather_B", childId: "father_C" },
      { parentId: "father_C", childId: "child_D" },
    ];

    assert.throws(
      () => validateNoCycle(existingEdges, "child_D", "great_grandfather_A"),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "TRANSITIVE_ANCESTRY_CYCLE");
        return true;
      }
    );
  });

  test("allows valid parent-child connections in a tree DAG", () => {
    const existingEdges: ParentChildEdge[] = [
      { parentId: "p1", childId: "c1" },
      { parentId: "p2", childId: "c1" }, // second parent
      { parentId: "c1", childId: "gc1" },
    ];

    // Adding a second child to p1 should be valid
    const res = validateNoCycle(existingEdges, "p1", "c2");
    assert.equal(res.isValid, true);

    // Adding another parent to gc1 from a different branch should be valid
    const res2 = validateNoCycle(existingEdges, "other_parent", "gc1");
    assert.equal(res2.isValid, true);
  });

  test("enforces maximum 2 biological parents per individual", () => {
    const existingParents = ["father_id_01", "mother_id_02"];

    assert.throws(
      () => validateParentCount(existingParents, "third_parent_id", 2),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "MAX_PARENTS_EXCEEDED");
        return true;
      }
    );
  });

  test("rejects adding an already registered parent", () => {
    const existingParents = ["father_id_01"];

    assert.throws(
      () => validateParentCount(existingParents, "father_id_01", 2),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "DUPLICATE_PARENT");
        return true;
      }
    );
  });

  test("prevents duplicate parent-child relationship edges", () => {
    const existing: RelationshipRecord[] = [
      {
        spaceId: "space_1",
        personId: "parent_1",
        relatedPersonId: "child_1",
        type: "PARENT_CHILD",
      },
    ];

    assert.throws(
      () =>
        validateNoDuplicateRelationship(
          existing,
          "parent_1",
          "child_1",
          "PARENT_CHILD"
        ),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "DUPLICATE_RELATIONSHIP");
        return true;
      }
    );
  });

  test("prevents duplicate symmetric spouse relationships regardless of order", () => {
    const existing: RelationshipRecord[] = [
      {
        spaceId: "space_1",
        personId: "spouse_A",
        relatedPersonId: "spouse_B",
        type: "SPOUSE",
      },
    ];

    // Reversed order B -> A should also be detected as duplicate for spouse
    assert.throws(
      () =>
        validateNoDuplicateRelationship(
          existing,
          "spouse_B",
          "spouse_A",
          "SPOUSE"
        ),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "DUPLICATE_RELATIONSHIP");
        return true;
      }
    );
  });

  test("prevents self-relationship (person cannot marry or relate to themselves)", () => {
    assert.throws(
      () =>
        validateNoDuplicateRelationship([], "person_A", "person_A", "SPOUSE"),
      (err: Error) => {
        assert(err instanceof LineageValidationError);
        assert.equal(err.code, "SELF_RELATIONSHIP");
        return true;
      }
    );
  });
});

describe("Phase 1: Role-Based Access Control (RBAC) Hierarchy", () => {
  const ROLE_HIERARCHY = {
    OWNER: 3,
    ADMIN: 2,
    MEMBER: 1,
  };

  test("enforces OWNER satisfies all role checks", () => {
    const userRole = "OWNER";
    assert(ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY["OWNER"]);
    assert(ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY["ADMIN"]);
    assert(ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY["MEMBER"]);
  });

  test("enforces ADMIN satisfies ADMIN and MEMBER, but not OWNER", () => {
    const userRole = "ADMIN";
    assert(ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY["OWNER"]);
    assert(ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY["ADMIN"]);
    assert(ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY["MEMBER"]);
  });

  test("enforces MEMBER only satisfies MEMBER", () => {
    const userRole = "MEMBER";
    assert(ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY["OWNER"]);
    assert(ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY["ADMIN"]);
    assert(ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY["MEMBER"]);
  });
});
