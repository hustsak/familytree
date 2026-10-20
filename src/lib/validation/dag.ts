/**
 * Family Tree Lineage Validation & Cycle Prevention (DAG)
 * Strictly operates on Database IDs.
 * Enforces biological/genealogical constraints:
 * - No self-relationships
 * - No ancestry cycles (Directed Acyclic Graph)
 * - Maximum 2 biological parents per individual
 * - No duplicate relationships between identical node pairs
 */

export interface ParentChildEdge {
  parentId: string;
  childId: string;
}

export interface RelationshipRecord {
  id?: string;
  spaceId: string;
  personId: string;
  relatedPersonId: string;
  type: "PARENT_CHILD" | "SPOUSE" | "ADOPTIVE_PARENT_CHILD";
}

export class LineageValidationError extends Error {
  public code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "LineageValidationError";
    this.code = code;
  }
}

/**
 * Validates that adding a parent -> child edge will not create an ancestry cycle.
 * Traverses descendants of proposedChildId using BFS. If proposedParentId is encountered,
 * a cycle is detected and LineageValidationError is thrown.
 */
export function validateNoCycle(
  existingEdges: ParentChildEdge[],
  proposedParentId: string,
  proposedChildId: string
): { isValid: boolean; cyclePath?: string[] } {
  if (!proposedParentId || !proposedChildId) {
    throw new LineageValidationError(
      "Both parent ID and child ID must be provided",
      "INVALID_IDENTIFIERS"
    );
  }

  if (proposedParentId === proposedChildId) {
    throw new LineageValidationError(
      "An individual cannot be their own parent or ancestor (self-referential loop)",
      "SELF_PARENT_CYCLE"
    );
  }

  // Build adjacency list: node -> array of its children
  const adjacency = new Map<string, string[]>();
  for (const edge of existingEdges) {
    if (!adjacency.has(edge.parentId)) {
      adjacency.set(edge.parentId, []);
    }
    adjacency.get(edge.parentId)!.push(edge.childId);
  }

  // Also verify if the reverse edge exists (child is already parent of parent)
  const directChildrenOfChild = adjacency.get(proposedChildId) || [];
  if (directChildrenOfChild.includes(proposedParentId)) {
    throw new LineageValidationError(
      `Direct cycle detected: Person '${proposedChildId}' is already recorded as a parent of '${proposedParentId}'`,
      "DIRECT_ANCESTRY_CYCLE"
    );
  }

  // BFS search starting from proposedChildId to see if proposedParentId can be reached
  const queue: { nodeId: string; path: string[] }[] = [
    { nodeId: proposedChildId, path: [proposedChildId] },
  ];
  const visited = new Set<string>([proposedChildId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = adjacency.get(current.nodeId) || [];

    for (const childId of children) {
      if (childId === proposedParentId) {
        const cycle = [proposedParentId, ...current.path, childId];
        throw new LineageValidationError(
          `Ancestry cycle detected: Connecting parent '${proposedParentId}' to child '${proposedChildId}' creates an impossible loop: ${cycle.join(" -> ")}`,
          "TRANSITIVE_ANCESTRY_CYCLE"
        );
      }

      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push({
          nodeId: childId,
          path: [...current.path, childId],
        });
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates that an individual does not exceed the maximum allowed biological parents (2).
 */
export function validateParentCount(
  existingParentIds: string[],
  proposedParentId: string,
  maxAllowed: number = 2
): { isValid: boolean } {
  if (existingParentIds.includes(proposedParentId)) {
    throw new LineageValidationError(
      `Person '${proposedParentId}' is already registered as a parent`,
      "DUPLICATE_PARENT"
    );
  }

  if (existingParentIds.length >= maxAllowed) {
    throw new LineageValidationError(
      `An individual can have at most ${maxAllowed} biological parents. Current registered parents: ${existingParentIds.length}`,
      "MAX_PARENTS_EXCEEDED"
    );
  }

  return { isValid: true };
}

/**
 * Validates that a relationship does not already exist between the two person IDs in the same space.
 */
export function validateNoDuplicateRelationship(
  existingRelationships: RelationshipRecord[],
  personId: string,
  relatedPersonId: string,
  type: "PARENT_CHILD" | "SPOUSE" | "ADOPTIVE_PARENT_CHILD"
): { isValid: boolean } {
  if (personId === relatedPersonId) {
    throw new LineageValidationError(
      "A relationship cannot connect an individual to themselves",
      "SELF_RELATIONSHIP"
    );
  }

  const duplicate = existingRelationships.some((rel) => {
    if (rel.type !== type) return false;

    if (type === "SPOUSE") {
      // Spouse relation is symmetric between personId and relatedPersonId
      return (
        (rel.personId === personId && rel.relatedPersonId === relatedPersonId) ||
        (rel.personId === relatedPersonId && rel.relatedPersonId === personId)
      );
    } else {
      // Parent-child is directional: personId = parent, relatedPersonId = child
      return rel.personId === personId && rel.relatedPersonId === relatedPersonId;
    }
  });

  if (duplicate) {
    throw new LineageValidationError(
      `A ${type} relationship already exists between Person '${personId}' and Person '${relatedPersonId}'`,
      "DUPLICATE_RELATIONSHIP"
    );
  }

  return { isValid: true };
}
