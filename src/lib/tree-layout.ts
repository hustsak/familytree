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

export type LayoutMode = "horizontal" | "vertical";

/**
 * Determines layout mode by 1-based generation number:
 * Generations 1–4: "horizontal" (traditional genealogical top-down tree)
 * Generations 5–7: "vertical" (compact vertical stacks or grouped columns)
 */
export function getLayoutMode(generation: number): LayoutMode {
  return generation <= 4 ? "horizontal" : "vertical";
}

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  combineCouples?: boolean;
  maxGenerations?: number; // Exactly 7 generations
  collapsedNodeIds?: Set<string>;
  focusPersonId?: string | null;
  compactSiblingLayout?: boolean;
}

export interface BranchInfo {
  id: string;
  unitId: string;
  name: string;
  generation: number;
  childCount: number;
}

export function getGen3CollapsedNodeIds(
  people: TreePerson[],
  relationships: TreeRelationship[]
): Set<string> {
  return new Set<string>();
}

export interface FormattedTreeGraph {
  nodes: Node[];
  edges: Edge[];
  generationCounts: Record<number, number>;
  generationYPositions?: Record<number, number>;
  generationYMap?: Record<number, number>;
  branches?: BranchInfo[];
  maxGeneration?: number;
}

export interface CoupleUnit {
  id: string;
  primaryPerson: TreePerson;
  spousePerson?: TreePerson | null;
  husband?: TreePerson | null;
  wife?: TreePerson | null;
  additionalSpouses: TreePerson[];
  generation: number; // 0-indexed
  isBiologicalChild: boolean;
  relationshipTypeToParents: "PARENT_CHILD" | "ADOPTIVE_PARENT_CHILD" | "NONE";
  biologicalChildrenCount: number;
  totalChildrenCount: number;
  childrenUnitIds: string[];
  parentUnitIds: string[];
  layoutMode: LayoutMode;
}

/**
 * Computes logical hierarchical generations and non-overlapping coordinates
 * for React Flow visualization of a family heritage DAG.
 * Supports:
 * - Generations 1–4: Horizontal genealogical layout.
 * - Generations 5–7: Vertical subtree layout (compact vertical stacks / columns).
 * - Seven-generation cap.
 * - Couple node grouping with full husband/wife Khmer names and biological child indicators.
 */
export function computeTreeLayout(
  people: TreePerson[],
  relationships: TreeRelationship[],
  options: LayoutOptions = {}
): FormattedTreeGraph {
  const {
    combineCouples = false,
    maxGenerations = 7,
    collapsedNodeIds = new Set<string>(),
  } = options;

  if (people.length === 0) {
    return { nodes: [], edges: [], generationCounts: {} };
  }

  // 1. Build adjacency maps
  const parentsMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();
  const spousesMap = new Map<string, string[]>();
  const parentRelTypeMap = new Map<string, "PARENT_CHILD" | "ADOPTIVE_PARENT_CHILD">();

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
      parentRelTypeMap.set(`${rel.personId}_${rel.relatedPersonId}`, rel.type);
      parentRelTypeMap.set(rel.relatedPersonId, rel.type);
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

  // Initialize any disconnected individuals
  for (const p of people) {
    if (!generationMap.has(p.id)) {
      generationMap.set(p.id, 0);
    }
  }

  // Propagate generations downward (parent -> child is +1 generation)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 30) {
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

  // Enforce Seven-Generation Limit (0 to maxGenerations - 1)
  const visiblePeople = people.filter((p) => {
    const gen = generationMap.get(p.id) ?? 0;
    return gen < maxGenerations;
  });
  const visiblePersonIds = new Set(visiblePeople.map((p) => p.id));

  // If combineCouples is FALSE: run standard individual layout for backward compatibility & test compliance
  if (!combineCouples) {
    const {
      nodeWidth = 240,
      nodeHeight = 130,
      horizontalSpacing = 65,
      verticalSpacing = 160,
    } = options;

    const generationGroups = new Map<number, string[]>();
    for (const person of visiblePeople) {
      const gen = generationMap.get(person.id) || 0;
      if (!generationGroups.has(gen)) {
        generationGroups.set(gen, []);
      }
      generationGroups.get(gen)!.push(person.id);
    }

    const generationCounts: Record<number, number> = {};
    for (const [gen, ids] of generationGroups.entries()) {
      generationCounts[gen] = ids.length;
    }

    const positions = new Map<string, { x: number; y: number }>();
    const sortedGenerations = Array.from(generationGroups.keys()).sort((a, b) => a - b);

    for (const gen of sortedGenerations) {
      const personIds = generationGroups.get(gen)!;

      const desiredXMap = new Map<string, number>();
      for (const id of personIds) {
        const parents = (parentsMap.get(id) || []).filter((pId) => visiblePersonIds.has(pId));
        const knownParentPositions = parents
          .map((pId) => positions.get(pId))
          .filter((pos): pos is { x: number; y: number } => pos !== undefined);

        if (knownParentPositions.length > 0) {
          const avgX =
            knownParentPositions.reduce((acc, p) => acc + p.x, 0) / knownParentPositions.length;
          desiredXMap.set(id, avgX);
        } else {
          const spouses = (spousesMap.get(id) || []).filter((sId) => visiblePersonIds.has(sId));
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

      const sortedById = [...personIds].sort((a, b) => {
        const xA = desiredXMap.get(a) ?? 0;
        const xB = desiredXMap.get(b) ?? 0;
        return xA - xB;
      });

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

    let minX = Infinity;
    for (const pos of positions.values()) {
      if (pos.x < minX) minX = pos.x;
    }
    const offsetX = minX !== Infinity && minX < 80 ? 80 - minX : 0;
    for (const [id, pos] of positions.entries()) {
      positions.set(id, { x: pos.x + offsetX, y: pos.y + 60 });
    }

    const nodes: Node[] = visiblePeople.map((person) => {
      const pos = positions.get(person.id) || { x: 80, y: 60 };
      const gen = generationMap.get(person.id) || 0;
      const relType = parentRelTypeMap.get(person.id);
      const isBio = relType === "PARENT_CHILD";

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
          layoutMode: getLayoutMode(gen + 1),
          isBiologicalChild: isBio,
          relationshipTypeToParents: relType || "NONE",
          parentsCount: (parentsMap.get(person.id) || []).length,
          childrenCount: (childrenMap.get(person.id) || []).length,
          spousesCount: (spousesMap.get(person.id) || []).length,
        },
      };
    });

    const edges: Edge[] = relationships
      .filter(
        (rel) =>
          rel.status !== "FLAGGED_AMBIGUOUS" &&
          visiblePersonIds.has(rel.personId) &&
          visiblePersonIds.has(rel.relatedPersonId)
      )
      .map((rel) => {
        const isSpouse = rel.type === "SPOUSE";
        const isDisputed = rel.status === "DISPUTED";
        const isPending = rel.status === "PENDING_APPROVAL";
        const posX1 = positions.get(rel.personId)?.x ?? 0;
        const posX2 = positions.get(rel.relatedPersonId)?.x ?? 0;

        let source = rel.personId;
        let target = rel.relatedPersonId;
        let sourceHandle = "child-out";
        let targetHandle = "parent-in";

        if (isSpouse) {
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
          stroke = "#f59e0b";
          strokeDasharray = "4,4";
          strokeWidth = 2.5;
        } else if (isPending) {
          stroke = "#38bdf8";
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
          data: { type: rel.type, status: rel.status },
        };
      });

    return { nodes, edges, generationCounts };
  }

  // =========================================================================
  // COMBINED COUPLES & ADAPTIVE 7-GENERATION LAYOUT
  // Generations 1–4: Horizontal layout with couple cards
  // Generations 5–7: Vertical subtree layout (vertical stacks or compact columns)
  // =========================================================================

  const peopleById = new Map<string, TreePerson>();
  for (const p of visiblePeople) {
    peopleById.set(p.id, p);
  }

  // Pair people into FamilyUnits (couple or single)
  const pairedPersonIds = new Set<string>();
  const units: CoupleUnit[] = [];
  const personToUnitId = new Map<string, string>();

  // Sort people with parents first so the lineage descendant becomes primary
  const sortedPeople = [...visiblePeople].sort((a, b) => {
    const aParents = (parentsMap.get(a.id) || []).length;
    const bParents = (parentsMap.get(b.id) || []).length;
    if (aParents !== bParents) return bParents - aParents;
    return a.id.localeCompare(b.id);
  });

  for (const person of sortedPeople) {
    if (pairedPersonIds.has(person.id)) continue;

    pairedPersonIds.add(person.id);
    const unitId = person.id;
    personToUnitId.set(person.id, unitId);

    const spouses = (spousesMap.get(person.id) || [])
      .filter((sId) => visiblePersonIds.has(sId))
      .map((sId) => peopleById.get(sId)!)
      .filter(Boolean);

    let spousePerson: TreePerson | null = null;
    const additionalSpouses: TreePerson[] = [];

    for (const sp of spouses) {
      if (!pairedPersonIds.has(sp.id) && !spousePerson) {
        spousePerson = sp;
        pairedPersonIds.add(sp.id);
        personToUnitId.set(sp.id, unitId);
      } else {
        additionalSpouses.push(sp);
      }
    }

    let husband: TreePerson | null = null;
    let wife: TreePerson | null = null;

    if (person.gender === "MALE") {
      husband = person;
      wife = spousePerson;
    } else if (person.gender === "FEMALE") {
      wife = person;
      husband = spousePerson;
    } else if (spousePerson?.gender === "MALE") {
      husband = spousePerson;
      wife = person;
    } else {
      husband = person;
      wife = spousePerson;
    }

    const gen = generationMap.get(person.id) || 0;
    const relType = parentRelTypeMap.get(person.id);
    const isBio = relType === "PARENT_CHILD";

    // Biological children count
    const ownChildren = childrenMap.get(person.id) || [];
    const spouseChildren = spousePerson ? childrenMap.get(spousePerson.id) || [] : [];
    const allChildIds = Array.from(new Set([...ownChildren, ...spouseChildren])).filter((cId) =>
      visiblePersonIds.has(cId)
    );

    const bioChildIds = allChildIds.filter((cId) => {
      const t1 = parentRelTypeMap.get(`${person.id}_${cId}`);
      const t2 = spousePerson ? parentRelTypeMap.get(`${spousePerson.id}_${cId}`) : null;
      return t1 === "PARENT_CHILD" || t2 === "PARENT_CHILD" || (!t1 && !t2);
    });

    units.push({
      id: unitId,
      primaryPerson: person,
      spousePerson,
      husband,
      wife,
      additionalSpouses,
      generation: gen,
      isBiologicalChild: isBio,
      relationshipTypeToParents: relType || "NONE",
      biologicalChildrenCount: bioChildIds.length,
      totalChildrenCount: allChildIds.length,
      childrenUnitIds: [],
      parentUnitIds: [],
      layoutMode: getLayoutMode(gen + 1),
    });
  }

  // Connect units hierarchy
  const unitsById = new Map<string, CoupleUnit>();
  for (const u of units) {
    unitsById.set(u.id, u);
  }

  for (const u of units) {
    const p1 = u.primaryPerson.id;
    const p2 = u.spousePerson?.id;
    const childIds = new Set([
      ...(childrenMap.get(p1) || []),
      ...(p2 ? childrenMap.get(p2) || [] : []),
    ]);

    for (const cId of childIds) {
      const childUnitId = personToUnitId.get(cId);
      if (childUnitId && childUnitId !== u.id && !u.childrenUnitIds.includes(childUnitId)) {
        u.childrenUnitIds.push(childUnitId);
        const childUnit = unitsById.get(childUnitId);
        if (childUnit && !childUnit.parentUnitIds.includes(u.id)) {
          childUnit.parentUnitIds.push(u.id);
        }
      }
    }
  }

  // Identify root units (0 parents)
  const rootUnits = units.filter((u) => u.parentUnitIds.length === 0);

  // Layout measurements and constants
  const HORIZ_WIDTH = options.nodeWidth || 210;
  const HORIZ_HEIGHT = 150;
  const VERT_WIDTH = 210;
  const VERT_HEIGHT = 150;
  const HORIZ_GAP = 50;
  const VERT_GAP_SIBLINGS = 30;
  const VERT_LEVEL_GAP = 80;

  // Track coordinates of each unit
  const unitPositions = new Map<string, { x: number; y: number }>();
  const generationYPositions: Record<number, number> = {};

  // Compute generation baseline heights dynamically
  // For Gen 1–4: each generation is 1 tier high
  // For Gen 5–7: generations have vertical stacks, so tier height depends on max siblings
  const genMaxTiers: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };

  for (const u of units) {
    if (u.generation >= 4 && u.childrenUnitIds.length > 0) {
      const childCount = u.childrenUnitIds.length;
      const allLeaf = u.childrenUnitIds.every(
        (cId) => (unitsById.get(cId)?.childrenUnitIds.length || 0) === 0
      );
      if (childCount >= 5 && allLeaf) {
        const tiersNeeded = Math.ceil(childCount / 2);
        const childGen = u.generation + 1;
        if (childGen < 7) {
          genMaxTiers[childGen] = Math.max(genMaxTiers[childGen] || 1, tiersNeeded);
        }
      }
    }
  }

  // Calculate Y coordinate for each generation level
  let currentY = 70;
  for (let g = 0; g < 7; g++) {
    generationYPositions[g] = currentY;
    const mode = getLayoutMode(g + 1);
    const nodeH = mode === "horizontal" ? HORIZ_HEIGHT : VERT_HEIGHT;
    const tiers = genMaxTiers[g] || 1;
    const genHeight = mode === "horizontal" ? nodeH : tiers * (nodeH + VERT_GAP_SIBLINGS);
    currentY += genHeight + (mode === "horizontal" ? 120 : VERT_LEVEL_GAP);
  }

  // Subtree width and layout calculator
  interface SubtreeMetrics {
    width: number;
    height: number;
  }

  const subtreeCache = new Map<string, SubtreeMetrics>();

  function calculateSubtreeMetrics(unitId: string): SubtreeMetrics {
    if (subtreeCache.has(unitId)) return subtreeCache.get(unitId)!;

    const unit = unitsById.get(unitId)!;
    const mode = unit.layoutMode;
    const nodeW = mode === "horizontal" ? HORIZ_WIDTH : VERT_WIDTH;
    const nodeH = mode === "horizontal" ? HORIZ_HEIGHT : VERT_HEIGHT;

    const isCollapsed = collapsedNodeIds.has(unit.primaryPerson.id) ||
      (unit.spousePerson && collapsedNodeIds.has(unit.spousePerson.id));

    if (unit.childrenUnitIds.length === 0 || isCollapsed) {
      const res = { width: nodeW, height: nodeH };
      subtreeCache.set(unitId, res);
      return res;
    }

    const childMetrics = unit.childrenUnitIds.map((cId) => calculateSubtreeMetrics(cId));
    const childrenMode = getLayoutMode(unit.generation + 2);
    const childCount = unit.childrenUnitIds.length;
    const allLeafChildren = unit.childrenUnitIds.every(
      (cId) => (unitsById.get(cId)?.childrenUnitIds.length || 0) === 0
    );
    const useCompactVertical = childrenMode === "vertical" && childCount >= 5 && allLeafChildren;

    if (!useCompactVertical) {
      // Traditional horizontal spread of children subtrees
      const totalChildrenWidth =
        childMetrics.reduce((sum, m) => sum + m.width, 0) +
        Math.max(0, childMetrics.length - 1) * HORIZ_GAP;
      const width = Math.max(nodeW, totalChildrenWidth);
      const maxHeight = Math.max(...childMetrics.map((m) => m.height));
      const res = { width, height: nodeH + 120 + maxHeight };
      subtreeCache.set(unitId, res);
      return res;
    } else {
      // Large group of leaf siblings (>= 5) in Gen 5–7 arranged in compact 2-column grid
      const cols = 2;
      const colWidth = Math.max(...childMetrics.map((m) => m.width));
      const width = Math.max(nodeW, cols * colWidth + 40);
      const rows = Math.ceil(childCount / cols);
      const height = nodeH + rows * (VERT_HEIGHT + VERT_GAP_SIBLINGS) + VERT_LEVEL_GAP;
      const res = { width, height };
      subtreeCache.set(unitId, res);
      return res;
    }
  }

  // Position subtrees recursively
  function layoutSubtree(unitId: string, leftX: number) {
    const unit = unitsById.get(unitId)!;
    const metrics = calculateSubtreeMetrics(unitId);
    const mode = unit.layoutMode;
    const nodeW = mode === "horizontal" ? HORIZ_WIDTH : VERT_WIDTH;
    const nodeY = generationYPositions[unit.generation] || 80;

    const isCollapsed = collapsedNodeIds.has(unit.primaryPerson.id) ||
      (unit.spousePerson && collapsedNodeIds.has(unit.spousePerson.id));

    if (unit.childrenUnitIds.length === 0 || isCollapsed) {
      // Centered in its allocated width
      const x = leftX + (metrics.width - nodeW) / 2;
      unitPositions.set(unitId, { x, y: nodeY });
      return;
    }

    const childrenMode = getLayoutMode(unit.generation + 2);
    const childCount = unit.childrenUnitIds.length;
    const allLeafChildren = unit.childrenUnitIds.every(
      (cId) => (unitsById.get(cId)?.childrenUnitIds.length || 0) === 0
    );
    const useCompactVertical = childrenMode === "vertical" && childCount >= 5 && allLeafChildren;

    if (!useCompactVertical) {
      // Place children horizontally side-by-side with full subtree space
      let childLeft = leftX;
      const childCenters: number[] = [];

      for (const childId of unit.childrenUnitIds) {
        const childMetric = calculateSubtreeMetrics(childId);
        layoutSubtree(childId, childLeft);
        const childPos = unitPositions.get(childId)!;
        const childMode = unitsById.get(childId)!.layoutMode;
        const cWidth = childMode === "horizontal" ? HORIZ_WIDTH : VERT_WIDTH;
        childCenters.push(childPos.x + cWidth / 2);
        childLeft += childMetric.width + HORIZ_GAP;
      }

      // Parent centered above the span of children
      const minChildCenter = Math.min(...childCenters);
      const maxChildCenter = Math.max(...childCenters);
      const parentX = (minChildCenter + maxChildCenter) / 2 - nodeW / 2;

      unitPositions.set(unitId, { x: parentX, y: nodeY });
    } else {
      // Compact 2-column layout for large groups of leaf siblings
      const cols = 2;
      const colWidth = VERT_WIDTH;
      const parentX = leftX + (metrics.width - nodeW) / 2;
      unitPositions.set(unitId, { x: parentX, y: nodeY });

      const childBaseY = generationYPositions[unit.generation + 1] || (nodeY + VERT_HEIGHT + VERT_LEVEL_GAP);

      unit.childrenUnitIds.forEach((childId, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const cX = leftX + col * (colWidth + 40) + (metrics.width - (cols * colWidth + 40)) / 2;
        const cY = childBaseY + row * (VERT_HEIGHT + VERT_GAP_SIBLINGS);
        unitPositions.set(childId, { x: cX, y: cY });
      });
    }
  }

  // Layout all root branches side-by-side
  let currentRootX = 80;
  for (const root of rootUnits) {
    const rootMetrics = calculateSubtreeMetrics(root.id);
    layoutSubtree(root.id, currentRootX);
    currentRootX += rootMetrics.width + HORIZ_GAP * 1.5;
  }

  // Ensure minimum coordinates start cleanly at 80px
  let minX = Infinity;
  for (const pos of unitPositions.values()) {
    if (pos.x < minX) minX = pos.x;
  }
  const shiftX = minX !== Infinity && minX < 80 ? 80 - minX : 0;
  if (shiftX > 0) {
    for (const [uId, pos] of unitPositions.entries()) {
      unitPositions.set(uId, { x: pos.x + shiftX, y: pos.y });
    }
  }

  // Generation counts for summary
  const generationCounts: Record<number, number> = {};
  for (const u of units) {
    generationCounts[u.generation] = (generationCounts[u.generation] || 0) + 1;
  }

  // Generate React Flow Nodes for Couple Units
  const nodes: Node[] = units.map((u) => {
    const pos = unitPositions.get(u.id) || { x: 80, y: 80 };
    const mode = u.layoutMode;
    const w = mode === "horizontal" ? HORIZ_WIDTH : VERT_WIDTH;
    const h = mode === "horizontal" ? HORIZ_HEIGHT : VERT_HEIGHT;

    const isCollapsed = collapsedNodeIds.has(u.primaryPerson.id) ||
      (u.spousePerson && collapsedNodeIds.has(u.spousePerson.id));

    return {
      id: u.id,
      type: "heritageCouple",
      position: pos,
      width: w,
      height: h,
      data: {
        primaryPerson: u.primaryPerson,
        spousePerson: u.spousePerson,
        husband: u.husband,
        wife: u.wife,
        additionalSpousesCount: u.additionalSpouses.length,
        generation: u.generation,
        layoutMode: mode,
        isBiologicalChild: u.isBiologicalChild,
        relationshipTypeToParents: u.relationshipTypeToParents,
        biologicalChildrenCount: u.biologicalChildrenCount,
        totalChildrenCount: u.totalChildrenCount,
        hasChildren: u.childrenUnitIds.length > 0,
        isCollapsed: Boolean(isCollapsed),
        isRootAncestor: u.parentUnitIds.length === 0,
      },
    };
  });

  // Generate React Flow Edges (Orthogonal Parent -> Child connections)
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const parentUnit of units) {
    // If branch is collapsed, skip rendering child edges
    const isCollapsed = collapsedNodeIds.has(parentUnit.primaryPerson.id) ||
      (parentUnit.spousePerson && collapsedNodeIds.has(parentUnit.spousePerson.id));
    if (isCollapsed) continue;

    for (const childUnitId of parentUnit.childrenUnitIds) {
      const edgeId = `edge_${parentUnit.id}_${childUnitId}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);

      const childUnit = unitsById.get(childUnitId);
      const isBio = childUnit?.isBiologicalChild ?? true;

      edges.push({
        id: edgeId,
        source: parentUnit.id,
        target: childUnitId,
        sourceHandle: "child-out",
        targetHandle: "parent-in",
        type: "smoothstep",
        style: {
          stroke: isBio ? "#64748b" : "#3b82f6",
          strokeWidth: 1.5,
          strokeDasharray: isBio ? undefined : "4,4",
        },
        data: {
          type: isBio ? "PARENT_CHILD" : "ADOPTIVE_PARENT_CHILD",
          status: "CONFIRMED",
        },
      });
    }
  }

  return {
    nodes,
    edges,
    generationCounts,
    generationYPositions,
    generationYMap: generationYPositions,
    maxGeneration: 7,
  };
}
