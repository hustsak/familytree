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
 * Arranges generations from top to bottom:
 * Grandparents (Gen 0) -> Parents & Siblings (Gen 1) -> Cousins & Children (Gen 2).
 */
export function computeTreeLayout(
  people: TreePerson[],
  relationships: TreeRelationship[],
  options: LayoutOptions = {}
): FormattedTreeGraph {
  const {
    nodeWidth = 240,
    nodeHeight = 130,
    horizontalSpacing = 65,
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

  // If there are disconnected components without roots, initialize with 0
  for (const p of people) {
    if (!generationMap.has(p.id)) {
      generationMap.set(p.id, 0);
    }
  }

  // Propagate generations downward (parent -> child is +1 generation)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 25) {
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
        // Spouses share the same generation level
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
  // Uses parental barycenter to cluster siblings and cousins under their respective parents
  const positions = new Map<string, { x: number; y: number }>();
  const sortedGenerations = Array.from(generationGroups.keys()).sort((a, b) => a - b);

  for (const gen of sortedGenerations) {
    const personIds = generationGroups.get(gen)!;

    // Calculate desired X position based on parents in the generation above
    const desiredXMap = new Map<string, number>();
    for (const id of personIds) {
      const parents = parentsMap.get(id) || [];
      const knownParentPositions = parents
        .map((pId) => positions.get(pId))
        .filter((pos): pos is { x: number; y: number } => pos !== undefined);

      if (knownParentPositions.length > 0) {
        const avgX =
          knownParentPositions.reduce((acc, p) => acc + p.x, 0) / knownParentPositions.length;
        desiredXMap.set(id, avgX);
      } else {
        // For spouses with no known parents, adopt spouse's desired X if available
        const spouses = spousesMap.get(id) || [];
        const spouseWithPos = spouses
          .map((sId) => positions.get(sId))
          .find((pos): pos is { x: number; y: number } => pos !== undefined);

        if (spouseWithPos) {
          desiredXMap.set(id, spouseWithPos.x + nodeWidth + horizontalSpacing);
        } else {
          desiredXMap.set(id, 0);
        }
      }
    }

    // Sort persons in generation by desiredX to minimize crossing
    const sortedById = [...personIds].sort((a, b) => {
      const xA = desiredXMap.get(a) ?? 0;
      const xB = desiredXMap.get(b) ?? 0;
      return xA - xB;
    });

    // Pair unplaced spouses directly adjacent
    const orderedIds: string[] = [];
    const placed = new Set<string>();

    for (const id of sortedById) {
      if (placed.has(id)) continue;
      orderedIds.push(id);
      placed.add(id);

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

  // Shift all coordinates so minimum X is at 80px and minimum Y is at 60px
  let minX = Infinity;
  for (const pos of positions.values()) {
    if (pos.x < minX) minX = pos.x;
  }
  const offsetX = minX !== Infinity && minX < 80 ? 80 - minX : 0;
  for (const [id, pos] of positions.entries()) {
    positions.set(id, { x: pos.x + offsetX, y: pos.y + 60 });
  }

  // 6. Generate React Flow Nodes (Each person appears strictly ONCE)
  const nodes: Node[] = people.map((person) => {
    const pos = positions.get(person.id) || { x: 80, y: 60 };
    const gen = generationMap.get(person.id) || 0;

    return {
      id: person.id,
      type: "heritagePerson",
      position: pos,
      width: nodeWidth,
      height: nodeHeight,
      initialWidth: nodeWidth,
      initialHeight: nodeHeight,
      data: {
        person,
        generation: gen,
        parentsCount: (parentsMap.get(person.id) || []).length,
        childrenCount: (childrenMap.get(person.id) || []).length,
        spousesCount: (spousesMap.get(person.id) || []).length,
      },
    };
  });

  // 7. Generate React Flow Edges with explicit handle connections
  const edges: Edge[] = relationships
    .filter((rel) => rel.status !== "FLAGGED_AMBIGUOUS")
    .map((rel) => {
      const isSpouse = rel.type === "SPOUSE";
      const isDisputed = rel.status === "DISPUTED";
      const isPending = rel.status === "PENDING_APPROVAL";

      let source = rel.personId;
      let target = rel.relatedPersonId;
      let sourceHandle = "child-out";
      let targetHandle = "parent-in";

      if (isSpouse) {
        // Find X positions of both spouses to connect side-by-side horizontally
        const posX1 = positions.get(rel.personId)?.x ?? 0;
        const posX2 = positions.get(rel.relatedPersonId)?.x ?? 0;

        if (posX1 <= posX2) {
          source = rel.personId;
          sourceHandle = "spouse-out";
          target = rel.relatedPersonId;
          targetHandle = "spouse-in";
        } else {
          source = rel.relatedPersonId;
          sourceHandle = "spouse-out";
          target = rel.personId;
          targetHandle = "spouse-in";
        }
      }

      let stroke = isSpouse ? "#f43f5e" : "#d4af37";
      let strokeDasharray: string | undefined = isSpouse ? "5,5" : undefined;
      let strokeWidth = 2.5;

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
        source,
        target,
        sourceHandle,
        targetHandle,
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
