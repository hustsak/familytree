import { ref, onValue, set, update, remove, type Unsubscribe } from "firebase/database";
import { getRTDB, isFirebaseConfigured } from "./config";
import type { TreePerson, TreeRelationship } from "../tree-layout";

export interface FirebaseTreeData {
  space: {
    id: string;
    name: string;
  };
  people: TreePerson[];
  relationships: TreeRelationship[];
}

/**
 * Subscribes to real-time changes in the family tree for a given space.
 * When any user adds, edits, or removes a relative, this listener fires instantly with the new data.
 */
export function subscribeToTree(
  spaceId: string,
  onData: (data: FirebaseTreeData) => void,
  onError?: (error: Error) => void
): Unsubscribe | null {
  const db = getRTDB();
  if (!db) return null;

  const spaceRef = ref(db, `spaces/${spaceId}`);

  return onValue(
    spaceRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      const val = snapshot.val();
      const peopleRecord = val.people || {};
      const relationshipsRecord = val.relationships || {};

      const peopleList: TreePerson[] = Object.values(peopleRecord);
      const relationshipsList: TreeRelationship[] = Object.values(relationshipsRecord);

      onData({
        space: {
          id: spaceId,
          name:
            !val.space?.name ||
            val.space.name === "មែកធាងគ្រួសារ ទៀង (Tieng Family Heritage)" ||
            val.space.name === "ពង្សាវតារគ្រួសារ (Family Heritage)"
              ? "កូនចៅត្រកូល ទៀង"
              : val.space.name,
        },
        people: peopleList,
        relationships: relationshipsList,
      });
    },
    (error) => {
      console.error("Firebase Realtime Database listener error:", error);
      onError?.(error);
    }
  );
}

/**
 * Updates an existing person's details in Realtime Database.
 */
export async function updatePersonInRTDB(
  spaceId: string,
  personId: string,
  updates: Partial<TreePerson>
): Promise<void> {
  const db = getRTDB();
  if (!db) return;

  const personRef = ref(db, `spaces/${spaceId}/people/${personId}`);
  await update(personRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Adds a new person and their associated relationships to the tree in Realtime Database.
 */
export async function addPersonToRTDB(
  spaceId: string,
  person: TreePerson,
  newRelationships: TreeRelationship[]
): Promise<void> {
  const db = getRTDB();
  if (!db) return;

  const updates: Record<string, unknown> = {};
  updates[`spaces/${spaceId}/people/${person.id}`] = person;

  for (const rel of newRelationships) {
    updates[`spaces/${spaceId}/relationships/${rel.id}`] = rel;
  }

  const rootRef = ref(db);
  await update(rootRef, updates);
}

/**
 * Deletes a person and all relationships connected to them from Realtime Database.
 */
export async function deletePersonFromRTDB(
  spaceId: string,
  personId: string,
  existingRelationships: TreeRelationship[]
): Promise<void> {
  const db = getRTDB();
  if (!db) return;

  const updates: Record<string, null> = {};
  updates[`spaces/${spaceId}/people/${personId}`] = null;

  for (const rel of existingRelationships) {
    if (rel.personId === personId || rel.relatedPersonId === personId) {
      updates[`spaces/${spaceId}/relationships/${rel.id}`] = null;
    }
  }

  const rootRef = ref(db);
  await update(rootRef, updates);
}

/**
 * Adds or updates a relationship in Realtime Database.
 */
export async function setRelationshipInRTDB(
  spaceId: string,
  rel: TreeRelationship
): Promise<void> {
  const db = getRTDB();
  if (!db) return;

  const relRef = ref(db, `spaces/${spaceId}/relationships/${rel.id}`);
  await set(relRef, rel);
}

/**
 * Deletes a relationship from Realtime Database.
 */
export async function deleteRelationshipInRTDB(
  spaceId: string,
  relId: string
): Promise<void> {
  const db = getRTDB();
  if (!db) return;

  const relRef = ref(db, `spaces/${spaceId}/relationships/${relId}`);
  await remove(relRef);
}
