import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeTreeLayout,
  getLayoutMode,
  TreePerson,
  TreeRelationship,
} from "../src/lib/tree-layout";

describe("7-Generation Adaptive Khmer Family Tree Layout", () => {
  test("getLayoutMode returns horizontal for Gen 1–4 and vertical for Gen 5–7", () => {
    assert.strictEqual(getLayoutMode(1), "horizontal");
    assert.strictEqual(getLayoutMode(2), "horizontal");
    assert.strictEqual(getLayoutMode(3), "horizontal");
    assert.strictEqual(getLayoutMode(4), "horizontal");
    assert.strictEqual(getLayoutMode(5), "vertical");
    assert.strictEqual(getLayoutMode(6), "vertical");
    assert.strictEqual(getLayoutMode(7), "vertical");
  });

  test("generates 7 continuous generations and excludes Generation 8+", () => {
    const people: TreePerson[] = [];
    const relationships: TreeRelationship[] = [];

    // Create 8 continuous generations (Gen 1 to Gen 8)
    for (let g = 1; g <= 8; g++) {
      const husbandId = `h_gen_${g}`;
      const wifeId = `w_gen_${g}`;

      people.push({
        id: husbandId,
        firstName: `Husband${g}`,
        lastName: "Ly",
        khmerName: `លី ប្តី${g}`,
        gender: "MALE",
        birthYear: 1900 + g * 15,
        isLiving: g >= 5,
        isVerified: true,
      });

      people.push({
        id: wifeId,
        firstName: `Wife${g}`,
        lastName: "Keo",
        khmerName: `កែវ ប្រពន្ធ${g}`,
        gender: "FEMALE",
        birthYear: 1902 + g * 15,
        isLiving: g >= 5,
        isVerified: true,
      });

      // Spouse edge
      relationships.push({
        id: `rel_sp_${g}`,
        personId: husbandId,
        relatedPersonId: wifeId,
        type: "SPOUSE",
        status: "CONFIRMED",
      });

      // Parent-child edge from previous generation
      if (g > 1) {
        relationships.push({
          id: `rel_pc_${g}`,
          personId: `h_gen_${g - 1}`,
          relatedPersonId: husbandId,
          type: "PARENT_CHILD",
          status: "CONFIRMED",
        });
      }
    }

    const layout = computeTreeLayout(people, relationships, {
      combineCouples: true,
      maxGenerations: 7,
    });

    // Verify exactly 7 couple nodes (Gen 1 to 7) and Gen 8 is excluded
    assert.strictEqual(layout.nodes.length, 7, "Must cap at 7 generations");
    const nodeIds = layout.nodes.map((n) => n.id);
    assert.ok(nodeIds.includes("h_gen_1"), "Gen 1 is included");
    assert.ok(nodeIds.includes("h_gen_7"), "Gen 7 is included");
    assert.strictEqual(nodeIds.includes("h_gen_8"), false, "Gen 8+ must be excluded from active view");

    // Verify layout modes on nodes
    const gen1Node = layout.nodes.find((n) => n.id === "h_gen_1")!;
    assert.strictEqual((gen1Node.data as any).layoutMode, "horizontal");

    const gen4Node = layout.nodes.find((n) => n.id === "h_gen_4")!;
    assert.strictEqual((gen4Node.data as any).layoutMode, "horizontal");

    const gen5Node = layout.nodes.find((n) => n.id === "h_gen_5")!;
    assert.strictEqual((gen5Node.data as any).layoutMode, "vertical");

    const gen7Node = layout.nodes.find((n) => n.id === "h_gen_7")!;
    assert.strictEqual((gen7Node.data as any).layoutMode, "vertical");
  });

  test("couple nodes show both husband and wife full names, bio child badge, and children count", () => {
    const people: TreePerson[] = [
      {
        id: "p_father",
        firstName: "Bunthoeun",
        lastName: "Ly",
        khmerName: "លី ប៊ុនធឿន",
        gender: "MALE",
        birthYear: 1940,
        isLiving: false,
        isVerified: true,
      },
      {
        id: "p_mother",
        firstName: "Sophea",
        lastName: "Chan",
        khmerName: "ចាន់ សុភា",
        gender: "FEMALE",
        birthYear: 1945,
        isLiving: true,
        isVerified: true,
      },
      {
        id: "p_child1",
        firstName: "Vireak",
        lastName: "Ly",
        khmerName: "លី វីរៈ",
        gender: "MALE",
        birthYear: 1970,
        isLiving: true,
        isVerified: true,
      },
      {
        id: "p_child2_adopted",
        firstName: "Dara",
        lastName: "Keo",
        khmerName: "កែវ ដារ៉ា",
        gender: "MALE",
        birthYear: 1975,
        isLiving: true,
        isVerified: true,
      },
    ];

    const relationships: TreeRelationship[] = [
      { id: "r_sp", personId: "p_father", relatedPersonId: "p_mother", type: "SPOUSE", status: "CONFIRMED" },
      { id: "r_bio", personId: "p_father", relatedPersonId: "p_child1", type: "PARENT_CHILD", status: "CONFIRMED" },
      { id: "r_adopt", personId: "p_father", relatedPersonId: "p_child2_adopted", type: "ADOPTIVE_PARENT_CHILD", status: "CONFIRMED" },
    ];

    const layout = computeTreeLayout(people, relationships, {
      combineCouples: true,
    });

    // Parent couple unit
    const parentUnit = layout.nodes.find((n) => n.id === "p_father")!;
    assert.ok(parentUnit);
    const parentData = parentUnit.data as any;
    assert.strictEqual(parentData.husband.khmerName, "លី ប៊ុនធឿន");
    assert.strictEqual(parentData.wife.khmerName, "ចាន់ សុភា");
    assert.strictEqual(parentData.isRootAncestor, true);
    assert.strictEqual(parentData.biologicalChildrenCount, 1, "Exactly 1 biological child");
    assert.strictEqual(parentData.totalChildrenCount, 2, "2 total children (1 bio + 1 adopted)");

    // Biological child unit
    const bioChildUnit = layout.nodes.find((n) => n.id === "p_child1")!;
    assert.ok(bioChildUnit);
    const bioChildData = bioChildUnit.data as any;
    assert.strictEqual(bioChildData.isBiologicalChild, true, "Marked as biological child");
    assert.strictEqual(bioChildData.relationshipTypeToParents, "PARENT_CHILD");

    // Adoptive child unit
    const adoptChildUnit = layout.nodes.find((n) => n.id === "p_child2_adopted")!;
    assert.ok(adoptChildUnit);
    const adoptChildData = adoptChildUnit.data as any;
    assert.strictEqual(adoptChildData.isBiologicalChild, false, "Adopted is not marked as biological child");
    assert.strictEqual(adoptChildData.relationshipTypeToParents, "ADOPTIVE_PARENT_CHILD");
  });

  test("switches large sibling groups in Gen 5 into compact vertical stacks", () => {
    const people: TreePerson[] = [];
    const relationships: TreeRelationship[] = [];

    // Ancestors: Gen 1 -> Gen 2 -> Gen 3 -> Gen 4
    for (let g = 1; g <= 3; g++) {
      people.push({
        id: `anc_gen${g}`,
        firstName: `Ancestor${g}`,
        lastName: "Ly",
        gender: "MALE",
        birthYear: 1880 + g * 20,
        isLiving: false,
        isVerified: true,
      });
      if (g > 1) {
        relationships.push({
          id: `anc_rel_${g}`,
          personId: `anc_gen${g - 1}`,
          relatedPersonId: `anc_gen${g}`,
          type: "PARENT_CHILD",
          status: "CONFIRMED",
        });
      }
    }

    // Gen 4 Parent
    people.push({
      id: "parent_gen4",
      firstName: "Vannak",
      lastName: "Ly",
      khmerName: "លី វណ្ណៈ",
      gender: "MALE",
      birthYear: 1950,
      isLiving: true,
      isVerified: true,
    });
    relationships.push({
      id: "rel_to_gen4",
      personId: "anc_gen3",
      relatedPersonId: "parent_gen4",
      type: "PARENT_CHILD",
      status: "CONFIRMED",
    });

    // 8 children in Gen 5
    for (let i = 1; i <= 8; i++) {
      const childId = `c_gen5_${i}`;
      people.push({
        id: childId,
        firstName: `Child${i}`,
        lastName: "Ly",
        khmerName: `លី កូនទី${i}`,
        gender: "MALE",
        birthYear: 1975 + i * 2,
        isLiving: true,
        isVerified: true,
      });

      relationships.push({
        id: `rel_${i}`,
        personId: "parent_gen4",
        relatedPersonId: childId,
        type: "PARENT_CHILD",
        status: "CONFIRMED",
      });
    }

    const layout = computeTreeLayout(people, relationships, {
      combineCouples: true,
    });

    assert.strictEqual(layout.nodes.length, 12);

    // Verify parent is Gen 4 (0-indexed: gen 0)
    const parentNode = layout.nodes.find((n) => n.id === "parent_gen4")!;
    assert.ok(parentNode);

    // Verify Gen 5 children are arranged in vertical stack with distinct Y coordinates
    const childrenNodes = layout.nodes.filter((n) => n.id.startsWith("c_gen5_"));
    assert.strictEqual(childrenNodes.length, 8);

    const yCoords = childrenNodes.map((n) => n.position.y);
    const uniqueYCoords = new Set(yCoords);

    // With 8 children in Gen 5, vertical layout stacks rows so there are multiple distinct Y tiers
    assert.ok(uniqueYCoords.size >= 4, "Children must be arranged vertically with at least 4 rows");

    // Verify total width is compact (not stretched 8 * 240 = 1920px)
    const minX = Math.min(...childrenNodes.map((n) => n.position.x));
    const maxX = Math.max(...childrenNodes.map((n) => n.position.x + (n.width as number || 180)));
    const totalSpanX = maxX - minX;
    assert.ok(totalSpanX <= 600, `Total horizontal span (${totalSpanX}px) must be compact under 600px`);
  });
});
