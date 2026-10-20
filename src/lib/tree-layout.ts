import { Node, Edge } from "@xyflow/react";

export interface TreePerson {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  birthYear?: number | null;
  deathYear?: number | null;
  isLiving: boolean;
  photoUrl?: string | null;
  biography?: string | null;
  isVerified: boolean;
}

export interface TreeRelationship {
  id: string;
  personId: string;
  relatedPersonId: string;
  type: "PARENT_CHILD" | "SPOUSE" | "ADOPTIVE_PARENT_CHILD";
  status: "CONFIRMED" | "PENDING_APPROVAL" | "FLAGGED_AMBIGUOUS" | "DISPUTED";
}

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
}

export interface FormattedTreeGraph {
  nodes: Node[];
  edges: Edge[];
  generationCounts: Record<number, number>;
}

/**
 * Computes logical hierarchical generations and non-overlapping coordinates
 * for React Flow visualization of a family heritage DAG.
 */
export function computeTreeLayout(
  people: TreePerson[],
  relationships: TreeRelationship[],
  options: LayoutOptions = {}
): FormattedTreeGraph {
  const {
    nodeWidth = 220,
    nodeHeight = 140,
    horizontalSpacing = 60,
    verticalSpacing = 160,
  } = options;

  if (people.length === 0) {
    return { nodes: [], edges: [], generationCounts: {} };
  }

  // 1. Build adjacency maps
  const parentsMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();
  const spousesMap = new Map<string, string[]>();

  for (const person of people) {
    parentsMap.set(person.id, []);
    childrenMap.set(person.id, []);
    spousesMap.set(person.id, []);
  }

  const confirmedRelationships = relationships.filter((r) => r.status === "CONFIRMED");

  for (const rel of confirmedRelationships) {
    if (rel.type === "PARENT_CHILD" || rel.type === "ADOPTIVE_PARENT_CHILD") {
      childrenMap.get(rel.personId)?.push(rel.relatedPersonId);
      parentsMap.get(rel.relatedPersonId)?.push(rel.personId);
    } else if (rel.type === "SPOUSE") {
      const s1 = spousesMap.get(rel.personId);
      const s2 = spousesMap.get(rel.relatedPersonId);
      if (s1 && !s1.includes(rel.relatedPersonId)) s1.push(rel.relatedPersonId);
      if (s2 && !s2.includes(rel.personId)) s2.push(rel.personId);
    }
  }

  // 2. Identify root ancestors (nodes with 0 parents)
  const rootIds = people.filter((p) => (parentsMap.get(p.id) || []).length === 0).map((p) => p.id);

  // 3. Compute topological generation depth via BFS from roots
  const generationMap = new Map<string, number>();

  for (const rootId of rootIds) {
    generationMap.set(rootId, 0);
  }

  // If there are cycles or disconnected components without roots, initialize with 0
  for (const p of people) {
    if (!generationMap.has(p.id)) {
      generationMap.set(p.id, 0);
    }
  }

  // Propagate generations downward (parent -> child is +1 generation)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;

    for (const rel of confirmedRelationships) {
      if (rel.type === "PARENT_CHILD" || rel.type === "ADOPTIVE_PARENT_CHILD") {
        const parentGen = generationMap.get(rel.personId) || 0;
        const currentChildGen = generationMap.get(rel.relatedPersonId) || 0;
        if (currentChildGen < parentGen + 1) {
          generationMap.set(rel.relatedPersonId, parentGen + 1);
          changed = true;
        }
      } else if (rel.type === "SPOUSE") {
        // Spouses share the same generation
        const gen1 = generationMap.get(rel.personId) || 0;
        const gen2 = generationMap.get(rel.relatedPersonId) || 0;
        const maxSpouseGen = Math.max(gen1, gen2);
        if (gen1 !== maxSpouseGen) {
          generationMap.set(rel.personId, maxSpouseGen);
          changed = true;
        }
        if (gen2 !== maxSpouseGen) {
          generationMap.set(rel.relatedPersonId, maxSpouseGen);
          changed = true;
        }
      }
    }
  }

  // 4. Group nodes by generation level
  const generationGroups = new Map<number, string[]>();
  for (const [personId, gen] of generationMap.entries()) {
    if (!generationGroups.has(gen)) {
      generationGroups.set(gen, []);
    }
    generationGroups.get(gen)!.push(personId);
  }

  const generationCounts: Record<number, number> = {};
  for (const [gen, ids] of generationGroups.entries()) {
    generationCounts[gen] = ids.length;
  }

  // 5. Compute (X, Y) positions for each generation
  const positions = new Map<string, { x: number; y: number }>();
  const sortedGenerations = Array.from(generationGroups.keys()).sort((a, b) => a - b);

  for (const gen of sortedGenerations) {
    const personIds = generationGroups.get(gen)!;

    // Order persons in generation so spouses are placed next to each other
    const orderedIds: string[] = [];
    const placed = new Set<string>();

    for (const id of personIds) {
      if (placed.has(id)) continue;
      orderedIds.push(id);
      placed.add(id);

      // Immediately place unplaced spouses adjacent
      const spouses = spousesMap.get(id) || [];
      for (const spouseId of spouses) {
        if (!placed.has(spouseId) && personIds.includes(spouseId)) {
          orderedIds.push(spouseId);
          placed.add(spouseId);
        }
      }
    }

    const totalWidth = orderedIds.length * (nodeWidth + horizontalSpacing) - horizontalSpacing;
    const startX = -totalWidth / 2;

    orderedIds.forEach((id, index) => {
      const x = startX + index * (nodeWidth + horizontalSpacing);
      const y = gen * (nodeHeight + verticalSpacing);
      positions.set(id, { x, y });
    });
  }

  // 6. Generate React Flow Nodes
  const nodes: Node[] = people.map((person) => {
    const pos = positions.get(person.id) || { x: 0, y: 0 };
    const gen = generationMap.get(person.id) || 0;

    return {
      id: person.id,
      type: "heritagePerson",
      position: pos,
      data: {
        person,
        generation: gen,
        parentsCount: (parentsMap.get(person.id) || []).length,
        childrenCount: (childrenMap.get(person.id) || []).length,
        spousesCount: (spousesMap.get(person.id) || []).length,
      },
    };
  });

  // 7. Generate React Flow Edges
  const edges: Edge[] = relationships
    .filter((rel) => rel.status !== "FLAGGED_AMBIGUOUS")
    .map((rel) => {
      const isSpouse = rel.type === "SPOUSE";
      const isDisputed = rel.status === "DISPUTED";
      const isPending = rel.status === "PENDING_APPROVAL";

      let stroke = isSpouse ? "#f43f5e" : "#d4af37";
      let strokeDasharray: string | undefined = isSpouse ? "5,5" : undefined;
      let strokeWidth = 2.2;

      if (isDisputed) {
        stroke = "#f59e0b"; // Amber for disputed connections
        strokeDasharray = "4,4";
        strokeWidth = 2.5;
      } else if (isPending) {
        stroke = "#38bdf8"; // Sky blue for pending approval
        strokeDasharray = "6,3";
        strokeWidth = 2;
      }

      return {
        id: `edge_${rel.id}`,
        source: rel.personId,
        target: rel.relatedPersonId,
        type: isSpouse ? "straight" : "smoothstep",
        animated: isSpouse || isPending || isDisputed,
        style: {
          stroke,
          strokeWidth,
          strokeDasharray,
        },
        data: {
          type: rel.type,
          status: rel.status,
        },
      };
    });

  return { nodes, edges, generationCounts };
}
