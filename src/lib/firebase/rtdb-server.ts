import fs from "fs";
import path from "path";
import { doc, getDoc, updateDoc, setDoc, deleteField } from "firebase/firestore";
import { getFirestoreDb } from "./config";
import { resolveFirebaseSpaceId, DEFAULT_TIENG_SPACE_ID } from "./rtdb";
import type { TreePerson, TreeRelationship } from "../tree-layout";

export { DEFAULT_TIENG_SPACE_ID };

interface RTDBSpaceNode {
  space?: {
    id: string;
    name: string;
    slug?: string;
    description?: string;
  };
  people?: Record<string, TreePerson>;
  relationships?: Record<string, TreeRelationship>;
}

function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => (v === undefined ? null : v))
  );
}

function readBundledExport(): Record<string, RTDBSpaceNode> {
  try {
    const filePath = path.join(process.cwd(), "firebase-rtdb-export.json");
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return raw.spaces || {};
    }
  } catch (err) {
    console.warn("Could not read bundled firebase-rtdb-export.json:", err);
  }
  return {};
}

export async function fetchSpaceFromRTDB(spaceId?: string): Promise<{
  space: { id: string; name: string };
  people: TreePerson[];
  relationships: TreeRelationship[];
}> {
  const targetId = resolveFirebaseSpaceId(spaceId);
  const db = getFirestoreDb();

  if (db) {
    try {
      const spaceRef = doc(db, "spaces", targetId);
      const snap = await getDoc(spaceRef);
      if (snap.exists()) {
        const val = snap.data() as RTDBSpaceNode;
        const people = Object.values(val.people || {}).filter(Boolean);
        const relationships = Object.values(val.relationships || {}).filter(Boolean);
        const rawName = val.space?.name;
        const name =
          !rawName ||
          rawName === "មែកធាងគ្រួសារ ទៀង (Tieng Family Heritage)" ||
          rawName === "ពង្សាវតារគ្រួសារ (Family Heritage)"
            ? "កូនចៅត្រកូល ទៀង"
            : rawName;

        if (people.length > 0) {
          return {
            space: { id: targetId, name },
            people,
            relationships,
          };
        }
      }
    } catch (err) {
      console.warn("Firestore server fetch notice:", err);
    }
  }

  const bundled = readBundledExport();
  const node = bundled[targetId] || Object.values(bundled)[0];
  if (node) {
    return {
      space: {
        id: node.space?.id || targetId,
        name: "កូនចៅត្រកូល ទៀង",
      },
      people: Object.values(node.people || {}),
      relationships: Object.values(node.relationships || {}),
    };
  }

  return {
    space: { id: targetId, name: "កូនចៅត្រកូល ទៀង" },
    people: [],
    relationships: [],
  };
}

export async function savePersonToRTDBRest(
  spaceId: string,
  person: TreePerson,
  relationships: TreeRelationship[]
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const targetId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetId);
  const nowIso = new Date().toISOString();

  const cleanPerson = sanitizeForFirestore({
    ...person,
    createdAt: (person as unknown as { createdAt?: string }).createdAt || nowIso,
    updatedAt: nowIso,
  });

  const updates: Record<string, unknown> = {
    [`people.${person.id}`]: cleanPerson,
  };

  for (const rel of relationships) {
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
    for (const rel of relationships) {
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

export async function patchPersonInRTDBRest(
  spaceId: string,
  personId: string,
  updates: Partial<TreePerson>
): Promise<TreePerson | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const targetId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetId);
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

  try {
    const snap = await getDoc(spaceRef);
    if (snap.exists()) {
      const val = snap.data() as RTDBSpaceNode;
      return val.people?.[personId] || null;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function removePersonFromRTDBRest(
  spaceId: string,
  personId: string
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const targetId = resolveFirebaseSpaceId(spaceId);
  const spaceRef = doc(db, "spaces", targetId);
  const current = await fetchSpaceFromRTDB(targetId);

  const updates: Record<string, unknown> = {
    [`people.${personId}`]: deleteField(),
  };

  for (const rel of current.relationships) {
    if (rel.personId === personId || rel.relatedPersonId === personId) {
      updates[`relationships.${rel.id}`] = deleteField();
    }
  }

  await updateDoc(spaceRef, updates);
}
