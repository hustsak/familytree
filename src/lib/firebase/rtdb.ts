import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteField,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "./config";
import type { TreePerson, TreeRelationship } from "../tree-layout";

export const DEFAULT_TIENG_SPACE_ID = "cmvgs3h5y0000v974bjsev5y1";

export function resolveFirebaseSpaceId(spaceId?: string | null): string {
  if (
    !spaceId ||
    spaceId === "family-heritage-space" ||
    spaceId === "default-space"
  ) {
    return DEFAULT_TIENG_SPACE_ID;
  }
  return spaceId;
}

function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => (v === undefined ? null : v))
  );
}

export interface FirebaseTreeData {
  space: {
    id: string;
    name: string;
  };
  people: TreePerson[];
  relationships: TreeRelationship[];
}

/**
 * Subscribes to real-time changes in the family tree for a given space using Cloud Firestore.
 * When any user adds, edits, or removes a relative, this listener fires instantly with the new data.
 */
export function subscribeToTree(
  spaceId: string,
  onData: (data: FirebaseTreeData) => void,
  onError?: (error: Error) => void
): Unsubscribe | null {
  const db = getFirestoreDb();
  if (!db) return null;

  const targetSpaceId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetSpaceId);

  return onSnapshot(
    spaceRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      const val = snapshot.data();
      const peopleRecord = (val.people || {}) as Record<string, TreePerson>;
      const relationshipsRecord = (val.relationships || {}) as Record<
        string,
        TreeRelationship
      >;

      const peopleList: TreePerson[] = Object.values(peopleRecord).filter(Boolean);
      const relationshipsList: TreeRelationship[] =
        Object.values(relationshipsRecord).filter(Boolean);

      const rawName = val.space?.name;
      const normalizedName =
        !rawName ||
        rawName === "មែកធាងគ្រួសារ ទៀង (Tieng Family Heritage)" ||
        rawName === "ពង្សាវតារគ្រួសារ (Family Heritage)"
          ? "កូនចៅត្រកូល ទៀង"
          : rawName;

      onData({
        space: {
          id: targetSpaceId,
          name: normalizedName,
        },
        people: peopleList,
        relationships: relationshipsList,
      });
    },
    (error) => {
      console.error("Firebase Firestore real-time listener error:", error);
      onError?.(error);
    }
  );
}

/**
 * Updates an existing person's details in Cloud Firestore in real time.
 */
export async function updatePersonInRTDB(
  spaceId: string,
  personId: string,
  updates: Partial<TreePerson>
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const targetSpaceId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetSpaceId);
  const cleanUpdates = sanitizeForFirestore({
    ...updates,
    id: personId,
    updatedAt: new Date().toISOString(),
  });

  const fieldUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cleanUpdates)) {
    fieldUpdates[`people.${personId}.${key}`] = value;
  }

  try {
    await updateDoc(spaceRef, fieldUpdates);
  } catch {
    await setDoc(
      spaceRef,
      { people: { [personId]: cleanUpdates } },
      { merge: true }
    );
  }
}

/**
 * Adds a new person and their associated relationships to the tree in Cloud Firestore in real time.
 */
export async function addPersonToRTDB(
  spaceId: string,
  person: TreePerson,
  newRelationships: TreeRelationship[]
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const targetSpaceId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetSpaceId);
  const nowIso = new Date().toISOString();

  const cleanPerson = sanitizeForFirestore({
    ...person,
    createdAt: (person as unknown as { createdAt?: string }).createdAt || nowIso,
    updatedAt: nowIso,
  });

  const updates: Record<string, unknown> = {
    [`people.${person.id}`]: cleanPerson,
  };

  for (const rel of newRelationships) {
    updates[`relationships.${rel.id}`] = sanitizeForFirestore({
      ...rel,
      status: rel.status || "CONFIRMED",
      createdAt: (rel as unknown as { createdAt?: string }).createdAt || nowIso,
      updatedAt: nowIso,
    });
  }

  try {
    await updateDoc(spaceRef, updates);
  } catch {
    const relMap: Record<string, unknown> = {};
    for (const rel of newRelationships) {
      relMap[rel.id] = sanitizeForFirestore(rel);
    }
    await setDoc(
      spaceRef,
      {
        people: { [person.id]: cleanPerson },
        relationships: relMap,
      },
      { merge: true }
    );
  }
}

/**
 * Deletes a person and all relationships connected to them from Cloud Firestore in real time.
 */
export async function deletePersonFromRTDB(
  spaceId: string,
  personId: string,
  existingRelationships: TreeRelationship[]
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const targetSpaceId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetSpaceId);

  const updates: Record<string, unknown> = {
    [`people.${personId}`]: deleteField(),
  };

  for (const rel of existingRelationships) {
    if (rel.personId === personId || rel.relatedPersonId === personId) {
      updates[`relationships.${rel.id}`] = deleteField();
    }
  }

  await updateDoc(spaceRef, updates);
}

/**
 * Adds or updates a relationship in Cloud Firestore.
 */
export async function setRelationshipInRTDB(
  spaceId: string,
  rel: TreeRelationship
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const targetSpaceId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetSpaceId);
  await updateDoc(spaceRef, {
    [`relationships.${rel.id}`]: sanitizeForFirestore(rel),
  });
}

/**
 * Deletes a relationship from Cloud Firestore.
 */
export async function deleteRelationshipInRTDB(
  spaceId: string,
  relId: string
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const targetSpaceId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetSpaceId);
  await updateDoc(spaceRef, {
    [`relationships.${relId}`]: deleteField(),
  });
}
