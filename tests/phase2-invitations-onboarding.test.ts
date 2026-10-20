import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Phase 2: Token Security & Expiration Validation", () => {
  interface MockInvitation {
    id: string;
    spaceId: string;
    token: string;
    status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
    expiresAt: Date;
    role: "ADMIN" | "MEMBER";
  }

  function validateTokenRules(invite: MockInvitation | null, now: Date = new Date()) {
    if (!invite) {
      throw new Error("INVITATION_NOT_FOUND");
    }
    if (invite.status === "ACCEPTED") {
      throw new Error("TOKEN_ALREADY_USED");
    }
    if (invite.status === "REVOKED") {
      throw new Error("INVITATION_REVOKED");
    }
    if (invite.status === "EXPIRED" || invite.expiresAt < now) {
      throw new Error("INVITATION_EXPIRED");
    }
    return true;
  }

  test("rejects non-existent tokens", () => {
    assert.throws(
      () => validateTokenRules(null),
      (err: Error) => {
        assert.equal(err.message, "INVITATION_NOT_FOUND");
        return true;
      }
    );
  });

  test("rejects expired tokens", () => {
    const expiredInvite: MockInvitation = {
      id: "inv_1",
      spaceId: "space_1",
      token: "abc123token",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute ago
      role: "MEMBER",
    };

    assert.throws(
      () => validateTokenRules(expiredInvite),
      (err: Error) => {
        assert.equal(err.message, "INVITATION_EXPIRED");
        return true;
      }
    );
  });

  test("rejects single-use tokens that were already accepted", () => {
    const usedInvite: MockInvitation = {
      id: "inv_2",
      spaceId: "space_1",
      token: "valid_token_but_claimed",
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      role: "MEMBER",
    };

    assert.throws(
      () => validateTokenRules(usedInvite),
      (err: Error) => {
        assert.equal(err.message, "TOKEN_ALREADY_USED");
        return true;
      }
    );
  });

  test("rejects revoked tokens", () => {
    const revokedInvite: MockInvitation = {
      id: "inv_3",
      spaceId: "space_1",
      token: "valid_token_but_revoked",
      status: "REVOKED",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      role: "MEMBER",
    };

    assert.throws(
      () => validateTokenRules(revokedInvite),
      (err: Error) => {
        assert.equal(err.message, "INVITATION_REVOKED");
        return true;
      }
    );
  });

  test("accepts valid, unexpired, pending token", () => {
    const validInvite: MockInvitation = {
      id: "inv_4",
      spaceId: "space_1",
      token: "secure_random_hex_token_32_bytes",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      role: "MEMBER",
    };

    const result = validateTokenRules(validInvite);
    assert.equal(result, true);
  });
});

describe("Phase 2: Role Escalation Prevention", () => {
  function checkCanInvite(inviterRole: string, targetRole: string) {
    if (inviterRole === "MEMBER") {
      throw new Error("MEMBER_CANNOT_INVITE");
    }
    if (targetRole === "OWNER") {
      throw new Error("CANNOT_INVITE_OWNER");
    }
    if (inviterRole === "ADMIN" && targetRole === "ADMIN") {
      throw new Error("ADMIN_CANNOT_INVITE_ADMIN");
    }
    return true;
  }

  test("prevents members from creating invitations", () => {
    assert.throws(
      () => checkCanInvite("MEMBER", "MEMBER"),
      (err: Error) => {
        assert.equal(err.message, "MEMBER_CANNOT_INVITE");
        return true;
      }
    );
  });

  test("prevents anyone from inviting someone as OWNER", () => {
    assert.throws(
      () => checkCanInvite("OWNER", "OWNER"),
      (err: Error) => {
        assert.equal(err.message, "CANNOT_INVITE_OWNER");
        return true;
      }
    );
    assert.throws(
      () => checkCanInvite("ADMIN", "OWNER"),
      (err: Error) => {
        assert.equal(err.message, "CANNOT_INVITE_OWNER");
        return true;
      }
    );
  });

  test("prevents ADMIN from escalating someone to ADMIN", () => {
    assert.throws(
      () => checkCanInvite("ADMIN", "ADMIN"),
      (err: Error) => {
        assert.equal(err.message, "ADMIN_CANNOT_INVITE_ADMIN");
        return true;
      }
    );
  });

  test("allows OWNER to invite ADMIN or MEMBER, and ADMIN to invite MEMBER", () => {
    assert.equal(checkCanInvite("OWNER", "ADMIN"), true);
    assert.equal(checkCanInvite("OWNER", "MEMBER"), true);
    assert.equal(checkCanInvite("ADMIN", "MEMBER"), true);
  });
});

describe("Phase 2: Multi-Generation Lineage Matching & Ambiguity Handling", () => {
  interface PersonNode {
    id: string;
    firstName: string;
    lastName: string;
    birthYear?: number;
  }

  interface Edge {
    parentId: string;
    childId: string;
  }

  function resolveGrandparentAnchor(
    grandparentId: string,
    existingEdges: Edge[],
    allPeople: PersonNode[],
    intermediateParentId?: string
  ) {
    // Look up recorded children of grandparent
    const childIds = existingEdges
      .filter((e) => e.parentId === grandparentId)
      .map((e) => e.childId);

    const candidateParents = allPeople.filter((p) => childIds.includes(p.id));

    // Case 1: Incomplete ancestry (0 children)
    if (candidateParents.length === 0) {
      return {
        status: "CLARIFICATION_NEEDED",
        code: "MISSING_INTERMEDIATE",
        message: "Grandparent has 0 children in tree.",
      };
    }

    // Case 2: Multiple branches found without selection
    if (candidateParents.length > 1 && !intermediateParentId) {
      return {
        status: "CLARIFICATION_NEEDED",
        code: "MULTIPLE_BRANCHES_FOUND",
        candidates: candidateParents,
        message: "Grandparent has multiple children. Please specify your parent.",
      };
    }

    // Case 3: Multiple branches with valid selection
    if (intermediateParentId) {
      const isChild = candidateParents.some((p) => p.id === intermediateParentId);
      if (!isChild) {
        throw new Error("INVALID_PARENT_BRANCH");
      }
      return {
        status: "CONFIRMED",
        resolvedParentId: intermediateParentId,
      };
    }

    // Case 4: Exactly 1 child, user must confirm
    return {
      status: "CLARIFICATION_NEEDED",
      code: "CONFIRM_SINGLE_CANDIDATE",
      candidates: candidateParents,
    };
  }

  test("detects incomplete ancestry when grandparent has no intermediate children", () => {
    const grandparent: PersonNode = { id: "gp_1", firstName: "Ly", lastName: "Sok" };
    const edges: Edge[] = []; // No children registered under gp_1

    const result = resolveGrandparentAnchor("gp_1", edges, [grandparent]);
    assert.equal(result.status, "CLARIFICATION_NEEDED");
    assert.equal(result.code, "MISSING_INTERMEDIATE");
  });

  test("detects ambiguous branch when grandparent has multiple children and none specified", () => {
    const gp: PersonNode = { id: "gp_1", firstName: "Ly", lastName: "Sok" };
    const child1: PersonNode = { id: "c_1", firstName: "Ly", lastName: "Vannak" };
    const child2: PersonNode = { id: "c_2", firstName: "Ly", lastName: "Chanthou" };

    const edges: Edge[] = [
      { parentId: "gp_1", childId: "c_1" },
      { parentId: "gp_1", childId: "c_2" },
    ];

    const result = resolveGrandparentAnchor("gp_1", edges, [gp, child1, child2]);
    assert.equal(result.status, "CLARIFICATION_NEEDED");
    assert.equal(result.code, "MULTIPLE_BRANCHES_FOUND");
    assert.equal(result.candidates?.length, 2);
  });

  test("confirms unambiguous branch when intermediate parent ID is provided and verified", () => {
    const gp: PersonNode = { id: "gp_1", firstName: "Ly", lastName: "Sok" };
    const child1: PersonNode = { id: "c_1", firstName: "Ly", lastName: "Vannak" };
    const child2: PersonNode = { id: "c_2", firstName: "Ly", lastName: "Chanthou" };

    const edges: Edge[] = [
      { parentId: "gp_1", childId: "c_1" },
      { parentId: "gp_1", childId: "c_2" },
    ];

    const result = resolveGrandparentAnchor("gp_1", edges, [gp, child1, child2], "c_2");
    assert.equal(result.status, "CONFIRMED");
    assert.equal(result.resolvedParentId, "c_2");
  });

  test("rejects invalid intermediate parent that does not belong to the grandparent", () => {
    const gp: PersonNode = { id: "gp_1", firstName: "Ly", lastName: "Sok" };
    const child1: PersonNode = { id: "c_1", firstName: "Ly", lastName: "Vannak" };
    const unrelated: PersonNode = { id: "other_1", firstName: "Unrelated", lastName: "Person" };

    const edges: Edge[] = [{ parentId: "gp_1", childId: "c_1" }];

    assert.throws(
      () => resolveGrandparentAnchor("gp_1", edges, [gp, child1, unrelated], "other_1"),
      (err: Error) => {
        assert.equal(err.message, "INVALID_PARENT_BRANCH");
        return true;
      }
    );
  });
});

describe("Phase 2: Duplicate Relative Detection", () => {
  interface PersonRecord {
    id: string;
    firstName: string;
    lastName: string;
    birthYear?: number;
  }

  function detectDuplicate(
    existing: PersonRecord[],
    newPerson: { firstName: string; lastName: string; birthYear?: number }
  ) {
    const match = existing.find(
      (p) =>
        p.firstName.trim().toLowerCase() === newPerson.firstName.trim().toLowerCase() &&
        p.lastName.trim().toLowerCase() === newPerson.lastName.trim().toLowerCase() &&
        (!newPerson.birthYear || !p.birthYear || p.birthYear === newPerson.birthYear)
    );

    if (match) {
      return { isDuplicate: true, matchedId: match.id };
    }
    return { isDuplicate: false };
  }

  test("flags duplicate person with identical names (case-insensitive)", () => {
    const existing: PersonRecord[] = [
      { id: "person_101", firstName: "Bopha", lastName: "Keo", birthYear: 1990 },
    ];

    const check = detectDuplicate(existing, {
      firstName: "bopha",
      lastName: "KEO",
      birthYear: 1990,
    });

    assert.equal(check.isDuplicate, true);
    assert.equal(check.matchedId, "person_101");
  });

  test("permits distinct relatives with different names", () => {
    const existing: PersonRecord[] = [
      { id: "person_101", firstName: "Bopha", lastName: "Keo", birthYear: 1990 },
    ];

    const check = detectDuplicate(existing, {
      firstName: "Dara",
      lastName: "Keo",
      birthYear: 1995,
    });

    assert.equal(check.isDuplicate, false);
  });
});
