import fs from "fs";
import path from "path";
import type { TreePerson, TreeRelationship } from "../tree-layout";

const DEFAULT_RTDB_URL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://familytree-6d3ee-default-rtdb.firebaseio.com";

export const DEFAULT_TIENG_SPACE_ID = "cmvgs3h5y0000v974bjsev5y1";

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
  const targetId =
    !spaceId || spaceId === "family-heritage-space" || spaceId === "default-space"
      ? DEFAULT_TIENG_SPACE_ID
      : spaceId;

  try {
    const res = await fetch(`${DEFAULT_RTDB_URL}/spaces/${targetId}.json`, {
      cache: "no-store",
    });
    if (res.ok) {
      const val = (await res.json()) as RTDBSpaceNode | null;
      if (val && (val.people || val.space)) {
        const people = Object.values(val.people || {});
        const relationships = Object.values(val.relationships || {});
        const rawName = val.space?.name;
        const name =
          !rawName ||
          rawName === "មែកធាងគ្រួសារ ទៀង (Tieng Family Heritage)" ||
          rawName === "ពង្សាវតារគ្រួសារ (Family Heritage)"
            ? "កូនចៅត្រកូល ទៀង"
            : rawName;
        return {
          space: { id: targetId, name },
          people,
          relationships,
        };
      }
    }
  } catch (err) {
    console.warn("RTDB REST fetch fallback notice:", err);
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
  const targetId =
    !spaceId || spaceId === "family-heritage-space" || spaceId === "default-space"
      ? DEFAULT_TIENG_SPACE_ID
      : spaceId;

  const updates: Record<string, unknown> = {
    [`people/${person.id}`]: person,
  };
  for (const rel of relationships) {
    updates[`relationships/${rel.id}`] = rel;
  }

  await fetch(`${DEFAULT_RTDB_URL}/spaces/${targetId}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function patchPersonInRTDBRest(
  spaceId: string,
  personId: string,
  updates: Partial<TreePerson>
): Promise<TreePerson | null> {
  const targetId =
    !spaceId || spaceId === "family-heritage-space" || spaceId === "default-space"
      ? DEFAULT_TIENG_SPACE_ID
      : spaceId;

  await fetch(`${DEFAULT_RTDB_URL}/spaces/${targetId}/people/${personId}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...updates,
      updatedAt: new Date().toISOString(),
    }),
  });

  const res = await fetch(`${DEFAULT_RTDB_URL}/spaces/${targetId}/people/${personId}.json`, {
    cache: "no-store",
  });
  if (res.ok) {
    return (await res.json()) as TreePerson;
  }
  return null;
}

export async function removePersonFromRTDBRest(
  spaceId: string,
  personId: string
): Promise<void> {
  const targetId =
    !spaceId || spaceId === "family-heritage-space" || spaceId === "default-space"
      ? DEFAULT_TIENG_SPACE_ID
      : spaceId;

  const current = await fetchSpaceFromRTDB(targetId);
  const updates: Record<string, null> = {
    [`people/${personId}`]: null,
  };
  for (const rel of current.relationships) {
    if (rel.personId === personId || rel.relatedPersonId === personId) {
      updates[`relationships/${rel.id}`] = null;
    }
  }

  await fetch(`${DEFAULT_RTDB_URL}/spaces/${targetId}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}
