import { describe, it } from "node:test";
import assert from "node:assert";
import { computeTreeLayout, TreePerson, TreeRelationship } from "../src/lib/tree-layout";

describe("Priorities: One-Tap Onboarding & Visual Family Tree", () => {
  it("formats visual tree edges distinguishing CONFIRMED, DISPUTED, and PENDING relationships", () => {
    const people: TreePerson[] = [
      {
        id: "p1",
        firstName: "Sok",
        lastName: "Chan",
        gender: "MALE",
        isLiving: true,
        isVerified: true,
      },
      {
        id: "p2",
        firstName: "Bopha",
        lastName: "Keo",
        gender: "FEMALE",
        isLiving: true,
        isVerified: true,
      },
      {
        id: "p3",
        firstName: "Vireak",
        lastName: "Chan",
        gender: "MALE",
        isLiving: true,
        isVerified: false,
      },
      {
        id: "p4",
        firstName: "Dara",
        lastName: "Chan",
        gender: "MALE",
        isLiving: true,
        isVerified: false,
      },
    ];

    const relationships: TreeRelationship[] = [
      {
        id: "r1",
        personId: "p1",
        relatedPersonId: "p2",
        type: "SPOUSE",
        status: "CONFIRMED",
      },
      {
        id: "r2",
        personId: "p1",
        relatedPersonId: "p3",
        type: "PARENT_CHILD",
        status: "CONFIRMED",
      },
      {
        id: "r3",
        personId: "p1",
        relatedPersonId: "p4",
        type: "PARENT_CHILD",
        status: "PENDING_APPROVAL",
      },
      {
        id: "r4",
        personId: "p2",
        relatedPersonId: "p4",
        type: "PARENT_CHILD",
        status: "DISPUTED",
      },
    ];

    const layout = computeTreeLayout(people, relationships);

    // Verify nodes layout
    assert.strictEqual(layout.nodes.length, 4);
    assert.strictEqual(layout.edges.length, 4);

    // Verify confirmed spouse edge: rose dashed
    const spouseEdge = layout.edges.find((e) => e.id === "edge_r1");
    assert.ok(spouseEdge);
    assert.strictEqual(spouseEdge.style?.stroke, "#f43f5e");
    assert.strictEqual(spouseEdge.style?.strokeDasharray, "5,5");

    // Verify confirmed parent-child edge: gold solid
    const confirmedEdge = layout.edges.find((e) => e.id === "edge_r2");
    assert.ok(confirmedEdge);
    assert.strictEqual(confirmedEdge.style?.stroke, "#d4af37");
    assert.strictEqual(confirmedEdge.style?.strokeDasharray, undefined);

    // Verify pending edge: sky blue dashed
    const pendingEdge = layout.edges.find((e) => e.id === "edge_r3");
    assert.ok(pendingEdge);
    assert.strictEqual(pendingEdge.style?.stroke, "#38bdf8");
    assert.strictEqual(pendingEdge.style?.strokeDasharray, "6,3");

    // Verify disputed edge: amber dashed
    const disputedEdge = layout.edges.find((e) => e.id === "edge_r4");
    assert.ok(disputedEdge);
    assert.strictEqual(disputedEdge.style?.stroke, "#f59e0b");
    assert.strictEqual(disputedEdge.style?.strokeDasharray, "4,4");
  });

  it("arranges multi-generation nodes without X-coordinate overlap", () => {
    const people: TreePerson[] = [
      { id: "g1", firstName: "Grandpa", lastName: "Chan", gender: "MALE", isLiving: false, isVerified: true },
      { id: "g2", firstName: "Grandma", lastName: "Keo", gender: "FEMALE", isLiving: false, isVerified: true },
      { id: "p1", firstName: "Father", lastName: "Chan", gender: "MALE", isLiving: true, isVerified: true },
      { id: "p2", firstName: "Mother", lastName: "Nuon", gender: "FEMALE", isLiving: true, isVerified: true },
      { id: "c1", firstName: "Child1", lastName: "Chan", gender: "MALE", isLiving: true, isVerified: true },
      { id: "c2", firstName: "Child2", lastName: "Chan", gender: "FEMALE", isLiving: true, isVerified: true },
    ];

    const relationships: TreeRelationship[] = [
      { id: "rel1", personId: "g1", relatedPersonId: "g2", type: "SPOUSE", status: "CONFIRMED" },
      { id: "rel2", personId: "g1", relatedPersonId: "p1", type: "PARENT_CHILD", status: "CONFIRMED" },
      { id: "rel3", personId: "p1", relatedPersonId: "p2", type: "SPOUSE", status: "CONFIRMED" },
      { id: "rel4", personId: "p1", relatedPersonId: "c1", type: "PARENT_CHILD", status: "CONFIRMED" },
      { id: "rel5", personId: "p1", relatedPersonId: "c2", type: "PARENT_CHILD", status: "CONFIRMED" },
    ];

    const layout = computeTreeLayout(people, relationships);
    assert.strictEqual(layout.nodes.length, 6);

    // Group nodes by Y coordinate (generation)
    const byGen = new Map<number, number[]>();
    for (const node of layout.nodes) {
      const xPositions = byGen.get(node.position.y) || [];
      xPositions.push(node.position.x);
      byGen.set(node.position.y, xPositions);
    }

    // Ensure no two nodes at the same generation share the same X coordinate
    for (const [, xPositions] of byGen) {
      const uniqueX = new Set(xPositions);
      assert.strictEqual(uniqueX.size, xPositions.length, "Nodes in same generation must have distinct X coordinates");
    }
  });

  it("handles empty tree state gracefully without throwing", () => {
    const layout = computeTreeLayout([], []);
    assert.deepStrictEqual(layout.nodes, []);
    assert.deepStrictEqual(layout.edges, []);
    assert.deepStrictEqual(layout.generationCounts, {});
  });
});
