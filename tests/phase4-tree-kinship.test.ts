import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateKinship,
  KinshipPerson,
  KinshipRelationship,
} from "../src/lib/kinship";
import {
  computeTreeLayout,
  TreePerson,
  TreeRelationship,
} from "../src/lib/tree-layout";

describe("Phase 4: Kinship & Familial Relationship Calculator", () => {
  const people: KinshipPerson[] = [
    { id: "p_great_gp", firstName: "Ly", lastName: "Sok", gender: "MALE", birthYear: 1910 },
    { id: "p_gp_father", firstName: "Ly", lastName: "Vannak", gender: "MALE", birthYear: 1935 },
    { id: "p_gp_mother", firstName: "Keo", lastName: "Bopha", gender: "FEMALE", birthYear: 1938 },
    { id: "p_father", firstName: "Ly", lastName: "Bunthoeun", gender: "MALE", birthYear: 1962 },
    { id: "p_mother", firstName: "Chan", lastName: "Sophea", gender: "FEMALE", birthYear: 1965 },
    { id: "p_uncle", firstName: "Ly", lastName: "Rith", gender: "MALE", birthYear: 1968 },
    { id: "p_self", firstName: "Ly", lastName: "Serey", gender: "MALE", birthYear: 1990 },
    { id: "p_sister", firstName: "Ly", lastName: "Kalyan", gender: "FEMALE", birthYear: 1993 },
    { id: "p_cousin", firstName: "Ly", lastName: "Dara", gender: "MALE", birthYear: 1992 },
    { id: "p_child", firstName: "Ly", lastName: "Nika", gender: "FEMALE", birthYear: 2018 },
    { id: "p_unrelated", firstName: "Chea", lastName: "Vuthy", gender: "MALE", birthYear: 1991 },
  ];

  const relationships: KinshipRelationship[] = [
    // Great-grandparent -> Grandfather
    { id: "r1", personId: "p_great_gp", relatedPersonId: "p_gp_father", type: "PARENT_CHILD", status: "CONFIRMED" },
    // Grandparents spouse
    { id: "r2", personId: "p_gp_father", relatedPersonId: "p_gp_mother", type: "SPOUSE", status: "CONFIRMED" },
    // Grandparents -> Father & Uncle
    { id: "r3", personId: "p_gp_father", relatedPersonId: "p_father", type: "PARENT_CHILD", status: "CONFIRMED" },
    { id: "r4", personId: "p_gp_father", relatedPersonId: "p_uncle", type: "PARENT_CHILD", status: "CONFIRMED" },
    // Parents spouse
    { id: "r5", personId: "p_father", relatedPersonId: "p_mother", type: "SPOUSE", status: "CONFIRMED" },
    // Parents -> Self & Sister
    { id: "r6", personId: "p_father", relatedPersonId: "p_self", type: "PARENT_CHILD", status: "CONFIRMED" },
    { id: "r7", personId: "p_father", relatedPersonId: "p_sister", type: "PARENT_CHILD", status: "CONFIRMED" },
    // Uncle -> Cousin
    { id: "r8", personId: "p_uncle", relatedPersonId: "p_cousin", type: "PARENT_CHILD", status: "CONFIRMED" },
    // Self -> Child
    { id: "r9", personId: "p_self", relatedPersonId: "p_child", type: "PARENT_CHILD", status: "CONFIRMED" },
  ];

  test("calculates self identity correctly", () => {
    const res = calculateKinship("p_self", "p_self", people, relationships);
    assert.equal(res.determined, true);
    assert.equal(res.relationshipNameEn, "Self");
    assert.equal(res.degreeOfSeparation, 0);
  });

  test("calculates direct parent and child correctly", () => {
    const toFather = calculateKinship("p_self", "p_father", people, relationships);
    assert.equal(toFather.determined, true);
    assert.equal(toFather.relationshipNameEn, "Father");
    assert.equal(toFather.degreeOfSeparation, 1);
    assert.equal(toFather.generationDifference, -1);

    const toChild = calculateKinship("p_self", "p_child", people, relationships);
    assert.equal(toChild.determined, true);
    assert.equal(toChild.relationshipNameEn, "Daughter");
    assert.equal(toChild.degreeOfSeparation, 1);
    assert.equal(toChild.generationDifference, 1);
  });

  test("calculates direct spouse correctly", () => {
    const res = calculateKinship("p_father", "p_mother", people, relationships);
    assert.equal(res.determined, true);
    assert.equal(res.relationshipNameEn, "Wife");
    assert.equal(res.degreeOfSeparation, 1);
  });

  test("calculates siblings correctly", () => {
    const res = calculateKinship("p_self", "p_sister", people, relationships);
    assert.equal(res.determined, true);
    assert.equal(res.relationshipNameEn, "Sister");
    assert.equal(res.degreeOfSeparation, 2);
    assert.equal(res.generationDifference, 0);
  });

  test("calculates grandfather and great-grandfather correctly", () => {
    const toGrandfather = calculateKinship("p_self", "p_gp_father", people, relationships);
    assert.equal(toGrandfather.determined, true);
    assert.equal(toGrandfather.relationshipNameEn, "Grandfather");
    assert.equal(toGrandfather.degreeOfSeparation, 2);

    const toGreatGp = calculateKinship("p_self", "p_great_gp", people, relationships);
    assert.equal(toGreatGp.determined, true);
    assert.equal(toGreatGp.relationshipNameEn, "Great-Grandfather");
    assert.equal(toGreatGp.degreeOfSeparation, 3);
  });

  test("calculates uncle and first cousin correctly", () => {
    const toUncle = calculateKinship("p_self", "p_uncle", people, relationships);
    assert.equal(toUncle.determined, true);
    assert.equal(toUncle.relationshipNameEn, "Uncle");
    assert.equal(toUncle.degreeOfSeparation, 3);

    const toCousin = calculateKinship("p_self", "p_cousin", people, relationships);
    assert.equal(toCousin.determined, true);
    assert.equal(toCousin.relationshipNameEn, "First Cousin");
    assert.equal(toCousin.degreeOfSeparation, 4);
    assert.equal(toCousin.generationDifference, 0);
  });

  test("returns determined: false for disconnected unrelated individuals", () => {
    const res = calculateKinship("p_self", "p_unrelated", people, relationships);
    assert.equal(res.determined, false);
    assert.equal(res.relationshipNameEn, "No Direct Path");
    assert.equal(res.degreeOfSeparation, -1);
  });
});

describe("Phase 4: Hierarchical Tree Layout & Non-Overlapping Coordinates", () => {
  test("places multi-generation lineage at strictly ascending Y coordinates", () => {
    const treePeople: TreePerson[] = [
      { id: "1", firstName: "Root", lastName: "Ancestor", gender: "MALE", isLiving: false, isVerified: true },
      { id: "2", firstName: "Child", lastName: "Person", gender: "MALE", isLiving: true, isVerified: true },
      { id: "3", firstName: "Grandchild", lastName: "Person", gender: "FEMALE", isLiving: true, isVerified: true },
    ];

    const treeRels: TreeRelationship[] = [
      { id: "e1", personId: "1", relatedPersonId: "2", type: "PARENT_CHILD", status: "CONFIRMED" },
      { id: "e2", personId: "2", relatedPersonId: "3", type: "PARENT_CHILD", status: "CONFIRMED" },
    ];

    const layout = computeTreeLayout(treePeople, treeRels);

    const node1 = layout.nodes.find((n) => n.id === "1")!;
    const node2 = layout.nodes.find((n) => n.id === "2")!;
    const node3 = layout.nodes.find((n) => n.id === "3")!;

    assert(node1.position.y < node2.position.y);
    assert(node2.position.y < node3.position.y);
  });

  test("places spouses on the exact same generation level with distinct X positions", () => {
    const treePeople: TreePerson[] = [
      { id: "husband", firstName: "Bunthoeun", lastName: "Ly", gender: "MALE", isLiving: true, isVerified: true },
      { id: "wife", firstName: "Sophea", lastName: "Chan", gender: "FEMALE", isLiving: true, isVerified: true },
    ];

    const treeRels: TreeRelationship[] = [
      { id: "spouse_e", personId: "husband", relatedPersonId: "wife", type: "SPOUSE", status: "CONFIRMED" },
    ];

    const layout = computeTreeLayout(treePeople, treeRels);

    const husbandNode = layout.nodes.find((n) => n.id === "husband")!;
    const wifeNode = layout.nodes.find((n) => n.id === "wife")!;

    // Same Y generation level
    assert.equal(husbandNode.position.y, wifeNode.position.y);
    // Distinct non-overlapping X coordinates
    assert.notEqual(husbandNode.position.x, wifeNode.position.x);
    assert(Math.abs(husbandNode.position.x - wifeNode.position.x) >= 200);
  });

  test("handles large tree with 20+ nodes without overlapping positions on the same generation", () => {
    const peopleList: TreePerson[] = [];
    const relsList: TreeRelationship[] = [];

    // Root
    peopleList.push({ id: "root", firstName: "Root", lastName: "Ly", gender: "MALE", isLiving: false, isVerified: true });

    // 10 children
    for (let i = 1; i <= 10; i++) {
      const childId = `c_${i}`;
      peopleList.push({ id: childId, firstName: `Child${i}`, lastName: "Ly", gender: "MALE", isLiving: true, isVerified: true });
      relsList.push({ id: `r_${i}`, personId: "root", relatedPersonId: childId, type: "PARENT_CHILD", status: "CONFIRMED" });
    }

    const layout = computeTreeLayout(peopleList, relsList);
    assert.equal(layout.nodes.length, 11);

    // Verify all 10 children have identical Y and distinct X positions
    const childNodes = layout.nodes.filter((n) => n.id.startsWith("c_"));
    const xPositions = childNodes.map((n) => n.position.x);
    const uniqueX = new Set(xPositions);

    assert.equal(uniqueX.size, 10, "All 10 children must have unique X positions");
    childNodes.forEach((n) => {
      assert.equal(n.position.y, childNodes[0].position.y, "All children must be on the same Y tier");
    });
  });
});
