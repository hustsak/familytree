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

  // Helper to classify a pure (upCount, downCount) lineage into English & Khmer terms
  function classifyBloodLineage(
    upCount: number,
    downCount: number,
    asSpouseInLaw: boolean
  ): { en: string; km: string } {
    if (upCount > 0 && downCount === 0) {
      if (upCount === 1) {
        return {
          en: isFemale ? "Mother" : isMale ? "Father" : "Parent",
          km: isFemale ? "ម្តាយ" : isMale ? "ឪពុក" : "ឪពុកម្តាយ",
        };
      }
      if (upCount === 2) {
        return {
          en: isFemale ? "Grandmother" : isMale ? "Grandfather" : "Grandparent",
          km: isFemale ? "ជីដូន (យាយ)" : isMale ? "ជីតា (តា)" : "ជីដូនជីតា",
        };
      }
      if (upCount === 3) {
        return {
          en: isFemale ? "Great-Grandmother" : isMale ? "Great-Grandfather" : "Great-Grandparent",
          km: isFemale ? "ទួតស្រី" : isMale ? "ទួតប្រុស" : "ទួត",
        };
      }
      if (upCount === 4) {
        return {
          en: isFemale ? "2x Great-Grandmother" : isMale ? "2x Great-Grandfather" : "2x Great-Grandparent",
          km: isFemale ? "លួតស្រី" : isMale ? "លួតប្រុស" : "លួត",
        };
      }
      return {
        en: `${upCount - 2}x Great-Grandparent`,
        km: `បុព្វបុរស ${upCount} ជំនាន់`,
      };
    }

    if (upCount === 0 && downCount > 0) {
      if (downCount === 1) {
        if (asSpouseInLaw) {
          return {
            en: isFemale ? "Daughter-in-Law" : isMale ? "Son-in-Law" : "Child-in-Law",
            km: isFemale ? "កូនប្រសារស្រី" : isMale ? "កូនប្រសារប្រុស" : "កូនប្រសារ",
          };
        }
        return {
          en: isFemale ? "Daughter" : isMale ? "Son" : "Child",
          km: isFemale ? "កូនស្រី" : isMale ? "កូនប្រុស" : "កូន",
        };
      }
      if (downCount === 2) {
        if (asSpouseInLaw) {
          return {
            en: isFemale ? "Granddaughter-in-Law" : isMale ? "Grandson-in-Law" : "Grandchild-in-Law",
            km: isFemale ? "ចៅប្រសារស្រី" : isMale ? "ចៅប្រសារប្រុស" : "ចៅប្រសារ",
          };
        }
        return {
          en: isFemale ? "Granddaughter" : isMale ? "Grandson" : "Grandchild",
          km: isFemale ? "ចៅស្រី" : isMale ? "ចៅប្រុស" : "ចៅ",
        };
      }
      if (downCount === 3) {
        if (asSpouseInLaw) {
          return {
            en: isFemale ? "Great-Granddaughter-in-Law" : isMale ? "Great-Grandson-in-Law" : "Great-Grandchild-in-Law",
            km: isFemale ? "ចៅទួតប្រសារស្រី" : isMale ? "ចៅទួតប្រសារប្រុស" : "ចៅទួតប្រសារ",
          };
        }
        return {
          en: isFemale ? "Great-Granddaughter" : isMale ? "Great-Grandson" : "Great-Grandchild",
          km: isFemale ? "ចៅទួតស្រី" : isMale ? "ចៅទួតប្រុស" : "ចៅទួត",
        };
      }
      return {
        en: `${downCount - 2}x Great-Grandchild`,
        km: `កូនចៅជំនាន់ទី ${downCount}`,
      };
    }

    // Collateral relatives (upCount > 0 && downCount > 0)
    if (upCount === 1 && downCount === 1) {
      if (asSpouseInLaw) {
        return {
          en: isFemale ? "Sister-in-Law" : isMale ? "Brother-in-Law" : "Sibling-in-Law",
          km: isFemale ? "បងថ្លៃស្រី / ប្អូនថ្លៃស្រី" : isMale ? "បងថ្លៃប្រុស / ប្អូនថ្លៃប្រុស" : "បងប្អូនថ្លៃ",
        };
      }
      return {
        en: isFemale ? "Sister" : isMale ? "Brother" : "Sibling",
        km: isFemale ? "បងប្អូនស្រី" : isMale ? "បងប្អូនប្រុស" : "បងប្អូនបង្កើត",
      };
    }

    if (upCount === 2 && downCount === 1) {
      // Aunt / Uncle (including Aunt/Uncle by marriage when asSpouseInLaw is true)
      return {
        en: isFemale ? "Aunt" : isMale ? "Uncle" : "Aunt/Uncle",
        km: isFemale ? "មីង / អ៊ំស្រី" : isMale ? "ពូ / មា / អ៊ំប្រុស" : "មីងពូ",
      };
    }

    if (upCount === 3 && downCount === 1) {
      // Great-Aunt / Great-Uncle (grandparent's sibling or their spouse)
      return {
        en: isFemale ? "Great-Aunt" : isMale ? "Great-Uncle" : "Great-Aunt/Uncle",
        km: isFemale ? "ជីដូន (យាយ)" : isMale ? "ជីតា (តា)" : "ជីដូនជីតា",
      };
    }

    if (upCount === 1 && downCount === 2) {
      // Niece / Nephew
      if (asSpouseInLaw) {
        return {
          en: isFemale ? "Niece-in-Law" : isMale ? "Nephew-in-Law" : "Niece/Nephew-in-Law",
          km: isFemale ? "ក្មួយប្រសារស្រី" : isMale ? "ក្មួយប្រសារប្រុស" : "ក្មួយប្រសារ",
        };
      }
      return {
        en: isFemale ? "Niece" : isMale ? "Nephew" : "Niece/Nephew",
        km: isFemale ? "ក្មួយស្រី" : isMale ? "ក្មួយប្រុស" : "ក្មួយ",
      };
    }

    if (upCount === 1 && downCount === 3) {
      // Grand-Niece / Grand-Nephew (sibling's grandchild)
      return {
        en: isFemale ? "Grand-Niece" : isMale ? "Grand-Nephew" : "Grand-Niece/Nephew",
        km: isFemale ? "ចៅស្រី" : isMale ? "ចៅប្រុស" : "ចៅ",
      };
    }

    if (upCount === 2 && downCount === 2) {
      // First Cousin
      return {
        en: asSpouseInLaw ? "First Cousin-in-Law" : "First Cousin",
        km: asSpouseInLaw ? "បងប្អូនជីដូនមួយ (សាច់ថ្លៃ)" : "បងប្អូនជីដូនមួយ",
      };
    }

    if (upCount === 3 && downCount === 2) {
      // Parent's First Cousin (First Cousin Once Removed - older generation)
      return {
        en: isFemale ? "Aunt (Parent's Cousin)" : isMale ? "Uncle (Parent's Cousin)" : "Parent's Cousin",
        km: isFemale ? "មីង / អ៊ំស្រី" : isMale ? "ពូ / មា / អ៊ំប្រុស" : "មីងពូ",
      };
    }

    if (upCount === 2 && downCount === 3) {
      // First Cousin's Child (First Cousin Once Removed - younger generation)
      return {
        en: isFemale ? "Niece (Cousin's Daughter)" : isMale ? "Nephew (Cousin's Son)" : "Cousin's Child",
        km: isFemale ? "ក្មួយស្រី" : isMale ? "ក្មួយប្រុស" : "ក្មួយ",
      };
    }

    if (upCount === 3 && downCount === 3) {
      return {
        en: "Second Cousin",
        km: "បងប្អូនជីទួតមួយ",
      };
    }

    const netGen = downCount - upCount;
    if (netGen === 0) {
      return {
        en: "Extended Cousin",
        km: "បងប្អូនសាច់ឆ្ងាយ",
      };
    }
    if (netGen === -1) {
      return {
        en: isFemale ? "Extended Aunt" : isMale ? "Extended Uncle" : "Extended Aunt/Uncle",
        km: isFemale ? "មីង / អ៊ំស្រី" : isMale ? "ពូ / មា / អ៊ំប្រុស" : "មីងពូ",
      };
    }
    if (netGen === 1) {
      return {
        en: isFemale ? "Extended Niece" : isMale ? "Extended Nephew" : "Extended Niece/Nephew",
        km: isFemale ? "ក្មួយស្រី" : isMale ? "ក្មួយប្រុស" : "ក្មួយ",
      };
    }
    if (netGen < -1) {
      return {
        en: `${Math.abs(netGen)} Generations Elder Relative`,
        km: isFemale ? "ជីដូន (យាយ)" : isMale ? "ជីតា (តា)" : `សាច់ញាតិជំនាន់មុន (${Math.abs(netGen)} ជំនាន់)`,
      };
    }
    return {
      en: `${netGen} Generations Younger Relative`,
      km: isFemale ? "ចៅស្រី" : isMale ? "ចៅប្រុស" : `កូនចៅជំនាន់ក្រោយ (${netGen} ជំនាន់)`,
    };
  }

  // Case A: Starts with SPOUSE (relatives of person1's own spouse)
  if (steps[0] === "SPOUSE") {
    const rest = steps.slice(1).filter((s) => s !== "SPOUSE");
    const upCount = rest.filter((s) => s === "PARENT").length;
    const downCount = rest.filter((s) => s === "CHILD").length;
    const isStandardUpDown =
      rest.slice(0, upCount).every((s) => s === "PARENT") &&
      rest.slice(upCount).every((s) => s === "CHILD");

    if (isStandardUpDown) {
      if (upCount === 1 && downCount === 0) {
        relEn = isFemale ? "Mother-in-Law" : isMale ? "Father-in-Law" : "Parent-in-Law";
        relKm = isFemale ? "ម្តាយក្មេក" : isMale ? "ឪពុកក្មេក" : "ឪពុកម្តាយក្មេក";
      } else if (upCount === 2 && downCount === 0) {
        relEn = isFemale ? "Grandmother-in-Law" : isMale ? "Grandfather-in-Law" : "Grandparent-in-Law";
        relKm = isFemale ? "ជីដូនក្មេក (យាយ)" : isMale ? "ជីតាក្មេក (តា)" : "ជីដូនជីតាក្មេក";
      } else if (upCount === 1 && downCount === 1) {
        relEn = isFemale ? "Sister-in-Law" : isMale ? "Brother-in-Law" : "Sibling-in-Law";
        relKm = isFemale ? "បងថ្លៃស្រី / ប្អូនថ្លៃស្រី" : isMale ? "បងថ្លៃប្រុស / ប្អូនថ្លៃប្រុស" : "បងប្អូនថ្លៃ";
      } else {
        const classified = classifyBloodLineage(upCount, downCount, true);
        relEn = classified.en;
        relKm = classified.km;
      }
    }
  } else {
    // Case B: Starts with PARENT or CHILD (blood lineage, optionally ending with or crossing SPOUSE)
    const endsWithSpouse = steps[steps.length - 1] === "SPOUSE";
    const coreSteps = steps.filter((s) => s !== "SPOUSE");
    let upCount = 0;
    while (upCount < coreSteps.length && coreSteps[upCount] === "PARENT") {
      upCount++;
    }
    const downSteps = coreSteps.slice(upCount);
    const isStandardUpDown = downSteps.every((s) => s === "CHILD");
    const downCount = downSteps.length;

    if (isStandardUpDown && (upCount > 0 || downCount > 0)) {
      const classified = classifyBloodLineage(upCount, downCount, endsWithSpouse);
      relEn = classified.en;
      relKm = classified.km;
    } else if (genDiff > 0) {
      relEn = `${Math.abs(genDiff)} Generations Descendant`;
      relKm = `កូនចៅជំនាន់ក្រោយ (${Math.abs(genDiff)} ជំនាន់)`;
    } else if (genDiff < 0) {
      relEn = `${Math.abs(genDiff)} Generations Ancestor`;
      relKm = `បុព្វការីជន (${Math.abs(genDiff)} ជំនាន់មុន)`;
    }
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
