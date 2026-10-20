/**
 * Kinship & Familial Relationship Calculator
 * Calculates exact relationships between any two individuals in a family tree
 * strictly based on database IDs and verified relationships (DAG).
 * Never infers or guesses relationships from surnames or unlinked nodes.
 */

export interface KinshipPerson {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  birthYear?: number | null;
}

export interface KinshipRelationship {
  id: string;
  personId: string; // Parent or Spouse 1
  relatedPersonId: string; // Child or Spouse 2
  type: "PARENT_CHILD" | "SPOUSE" | "ADOPTIVE_PARENT_CHILD";
  status: "CONFIRMED" | "PENDING_APPROVAL" | "FLAGGED_AMBIGUOUS" | "DISPUTED";
}

export interface KinshipResult {
  determined: boolean;
  relationshipNameEn: string;
  relationshipNameKm: string;
  degreeOfSeparation: number;
  generationDifference: number; // Positive if person2 is younger, negative if older
  path: {
    personId: string;
    personName: string;
    roleInStep: string;
  }[];
  explanation: string;
}

interface GraphNode {
  person: KinshipPerson;
  parents: string[];
  children: string[];
  spouses: string[];
}

/**
 * Builds an undirected navigation graph with directional semantic labels
 */
function buildKinshipGraph(
  people: KinshipPerson[],
  relationships: KinshipRelationship[]
): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  for (const person of people) {
    graph.set(person.id, {
      person,
      parents: [],
      children: [],
      spouses: [],
    });
  }

  // Only consider CONFIRMED relationships
  for (const rel of relationships) {
    if (rel.status !== "CONFIRMED") continue;

    const subject = graph.get(rel.personId);
    const target = graph.get(rel.relatedPersonId);

    if (!subject || !target) continue;

    if (rel.type === "PARENT_CHILD" || rel.type === "ADOPTIVE_PARENT_CHILD") {
      subject.children.push(target.person.id);
      target.parents.push(subject.person.id);
    } else if (rel.type === "SPOUSE") {
      if (!subject.spouses.includes(target.person.id)) {
        subject.spouses.push(target.person.id);
      }
      if (!target.spouses.includes(subject.person.id)) {
        target.spouses.push(subject.person.id);
      }
    }
  }

  return graph;
}

/**
 * Calculates the exact kinship relationship between person1 and person2
 */
export function calculateKinship(
  person1Id: string,
  person2Id: string,
  people: KinshipPerson[],
  relationships: KinshipRelationship[]
): KinshipResult {
  const graph = buildKinshipGraph(people, relationships);

  const node1 = graph.get(person1Id);
  const node2 = graph.get(person2Id);

  if (!node1 || !node2) {
    return {
      determined: false,
      relationshipNameEn: "Unknown Relative",
      relationshipNameKm: "មិនអាចកំណត់បាន",
      degreeOfSeparation: -1,
      generationDifference: 0,
      path: [],
      explanation: "One or both selected relatives do not exist in this private family space.",
    };
  }

  // 1. Self Check
  if (person1Id === person2Id) {
    return {
      determined: true,
      relationshipNameEn: "Self",
      relationshipNameKm: "ខ្លួនឯង",
      degreeOfSeparation: 0,
      generationDifference: 0,
      path: [
        {
          personId: node1.person.id,
          personName: `${node1.person.firstName} ${node1.person.lastName}`,
          roleInStep: "Self",
        },
      ],
      explanation: `${node1.person.firstName} is the same individual.`,
    };
  }

  // 2. Direct Spouse Check
  if (node1.spouses.includes(person2Id)) {
    const isWife = node2.person.gender === "FEMALE";
    const isHusband = node2.person.gender === "MALE";
    return {
      determined: true,
      relationshipNameEn: isWife ? "Wife" : isHusband ? "Husband" : "Spouse",
      relationshipNameKm: isWife ? "ភរិយា / ប្រពន្ធ" : isHusband ? "ស្វាមី / ប្ដី" : "ប្ដីប្រពន្ធ",
      degreeOfSeparation: 1,
      generationDifference: 0,
      path: [
        {
          personId: node1.person.id,
          personName: `${node1.person.firstName} ${node1.person.lastName}`,
          roleInStep: "Spouse",
        },
        {
          personId: node2.person.id,
          personName: `${node2.person.firstName} ${node2.person.lastName}`,
          roleInStep: isWife ? "Wife" : isHusband ? "Husband" : "Spouse",
        },
      ],
      explanation: `${node2.person.firstName} is the spouse of ${node1.person.firstName}.`,
    };
  }

  // 3. Shortest Path BFS Search to find relationship
  interface QueueItem {
    id: string;
    path: { id: string; step: "PARENT" | "CHILD" | "SPOUSE" }[];
    genDiff: number;
  }

  const queue: QueueItem[] = [{ id: person1Id, path: [], genDiff: 0 }];
  const visited = new Set<string>([person1Id]);
  let foundPath: QueueItem | null = null;

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.id === person2Id) {
      foundPath = current;
      break;
    }

    const currNode = graph.get(current.id);
    if (!currNode) continue;

    // Explore parents (moving up +1 generation relative to child)
    for (const parentId of currNode.parents) {
      if (!visited.has(parentId)) {
        visited.add(parentId);
        queue.push({
          id: parentId,
          path: [...current.path, { id: parentId, step: "PARENT" }],
          genDiff: current.genDiff - 1,
        });
      }
    }

    // Explore children (moving down -1 generation)
    for (const childId of currNode.children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push({
          id: childId,
          path: [...current.path, { id: childId, step: "CHILD" }],
          genDiff: current.genDiff + 1,
        });
      }
    }

    // Explore spouses (same generation)
    for (const spouseId of currNode.spouses) {
      if (!visited.has(spouseId)) {
        visited.add(spouseId);
        queue.push({
          id: spouseId,
          path: [...current.path, { id: spouseId, step: "SPOUSE" }],
          genDiff: current.genDiff,
        });
      }
    }
  }

  if (!foundPath) {
    return {
      determined: false,
      relationshipNameEn: "No Direct Path",
      relationshipNameKm: "គ្មានផ្លូវតភ្ជាប់",
      degreeOfSeparation: -1,
      generationDifference: 0,
      path: [],
      explanation: `No verified blood or marriage relationship connects ${node1.person.firstName} and ${node2.person.firstName} in this space.`,
    };
  }

  // Analyze path to assign precise kinship nomenclature
  const steps = foundPath.path.map((p) => p.step);
  const genDiff = foundPath.genDiff;
  const p2Gender = node2.person.gender;
  const isFemale = p2Gender === "FEMALE";
  const isMale = p2Gender === "MALE";

  let relEn = "Relative";
  let relKm = "សាច់ញាតិ";

  // Check direct lineage (pure PARENT or pure CHILD)
  const allParent = steps.every((s) => s === "PARENT");
  const allChild = steps.every((s) => s === "CHILD");

  if (allParent) {
    if (steps.length === 1) {
      relEn = isFemale ? "Mother" : isMale ? "Father" : "Parent";
      relKm = isFemale ? "ម្តាយ" : isMale ? "ឪពុក" : "ឪពុកម្តាយ";
    } else if (steps.length === 2) {
      relEn = isFemale ? "Grandmother" : isMale ? "Grandfather" : "Grandparent";
      relKm = isFemale ? "ជីដូន (យាយ)" : isMale ? "ជីតា (តា)" : "ជីដូនជីតា";
    } else if (steps.length === 3) {
      relEn = isFemale ? "Great-Grandmother" : isMale ? "Great-Grandfather" : "Great-Grandparent";
      relKm = isFemale ? "អ្នកទួតស្រី" : isMale ? "អ្នកទួតប្រុស" : "អ្នកទួត";
    } else {
      relEn = `${steps.length - 2}x Great-Grandparent`;
      relKm = `បុព្វបុរស ${steps.length} ជំនាន់`;
    }
  } else if (allChild) {
    if (steps.length === 1) {
      relEn = isFemale ? "Daughter" : isMale ? "Son" : "Child";
      relKm = isFemale ? "កូនស្រី" : isMale ? "កូនប្រុស" : "កូន";
    } else if (steps.length === 2) {
      relEn = isFemale ? "Granddaughter" : isMale ? "Grandson" : "Grandchild";
      relKm = isFemale ? "ចៅស្រី" : isMale ? "ចៅប្រុស" : "ចៅ";
    } else if (steps.length === 3) {
      relEn = isFemale ? "Great-Granddaughter" : isMale ? "Great-Grandson" : "Great-Grandchild";
      relKm = isFemale ? "ចៅទួតស្រី" : isMale ? "ចៅទួតប្រុស" : "ចៅទួត";
    } else {
      relEn = `${steps.length - 2}x Great-Grandchild`;
      relKm = `កូនចៅជំនាន់ទី ${steps.length}`;
    }
  } else if (steps.length === 2 && steps[0] === "PARENT" && steps[1] === "CHILD") {
    // Sibling: Up to parent, down to child
    relEn = isFemale ? "Sister" : isMale ? "Brother" : "Sibling";
    relKm = isFemale ? "បងប្អូនស្រី" : isMale ? "បងប្អូនប្រុស" : "បងប្អូនបង្កើត";
  } else if (steps.length === 3 && steps[0] === "PARENT" && steps[1] === "PARENT" && steps[2] === "CHILD") {
    // Aunt / Uncle: Up 2 (to grandparent), down 1 (parent's sibling)
    relEn = isFemale ? "Aunt" : isMale ? "Uncle" : "Aunt/Uncle";
    relKm = isFemale ? "មីង / អ៊ំស្រី" : isMale ? "ពូ / មា / អ៊ំប្រុស" : "មីងពូ";
  } else if (steps.length === 3 && steps[0] === "PARENT" && steps[1] === "CHILD" && steps[2] === "CHILD") {
    // Niece / Nephew: Up 1, down 2 (sibling's child)
    relEn = isFemale ? "Niece" : isMale ? "Nephew" : "Niece/Nephew";
    relKm = isFemale ? "ក្មួយស្រី" : isMale ? "ក្មួយប្រុស" : "ក្មួយ";
  } else if (
    steps.length === 4 &&
    steps[0] === "PARENT" &&
    steps[1] === "PARENT" &&
    steps[2] === "CHILD" &&
    steps[3] === "CHILD"
  ) {
    // First Cousin: Up to grandparents, down to cousin
    relEn = "First Cousin";
    relKm = "បងប្អូនជីដូនមួយ";
  } else if (
    steps.length === 6 &&
    steps[0] === "PARENT" &&
    steps[1] === "PARENT" &&
    steps[2] === "PARENT" &&
    steps[3] === "CHILD" &&
    steps[4] === "CHILD" &&
    steps[5] === "CHILD"
  ) {
    // Second Cousin: Up 3 to great-grandparent, down 3
    relEn = "Second Cousin";
    relKm = "បងប្អូនជីទួតមួយ";
  } else if (steps.includes("SPOUSE")) {
    if (genDiff === 0) {
      relEn = isFemale ? "Sister-in-Law" : isMale ? "Brother-in-Law" : "In-Law";
      relKm = isFemale ? "បងថ្លៃស្រី / ប្អូនថ្លៃស្រី" : isMale ? "បងថ្លៃប្រុស / ប្អូនថ្លៃប្រុស" : "បងប្អូនថ្លៃ";
    } else if (genDiff === 1) {
      relEn = isFemale ? "Daughter-in-Law" : isMale ? "Son-in-Law" : "Child-in-Law";
      relKm = isFemale ? "កូនប្រសារស្រី" : isMale ? "កូនប្រសារប្រុស" : "កូនប្រសារ";
    } else if (genDiff === -1) {
      relEn = isFemale ? "Mother-in-Law" : isMale ? "Father-in-Law" : "Parent-in-Law";
      relKm = isFemale ? "ម្តាយក្មេក" : isMale ? "ឪពុកក្មេក" : "ឪពុកម្តាយក្មេក";
    }
  } else if (genDiff > 0) {
    relEn = `${Math.abs(genDiff)} Generations Descendant`;
    relKm = `កូនចៅជំនាន់ក្រោយ (${Math.abs(genDiff)} ជំនាន់)`;
  } else if (genDiff < 0) {
    relEn = `${Math.abs(genDiff)} Generations Ancestor`;
    relKm = `បុព្វការីជន (${Math.abs(genDiff)} ជំនាន់មុន)`;
  }

  // Construct visual readable path
  const fullPathDetails = [
    {
      personId: node1.person.id,
      personName: `${node1.person.firstName} ${node1.person.lastName}`,
      roleInStep: "Start Person",
    },
  ];

  for (const step of foundPath.path) {
    const stepNode = graph.get(step.id);
    if (stepNode) {
      fullPathDetails.push({
        personId: stepNode.person.id,
        personName: `${stepNode.person.firstName} ${stepNode.person.lastName}`,
        roleInStep: step.step,
      });
    }
  }

  return {
    determined: true,
    relationshipNameEn: relEn,
    relationshipNameKm: relKm,
    degreeOfSeparation: steps.length,
    generationDifference: genDiff,
    path: fullPathDetails,
    explanation: `${node2.person.firstName} ${node2.person.lastName} is the ${relEn} of ${node1.person.firstName} ${node1.person.lastName} (${steps.length} degrees of separation).`,
  };
}
