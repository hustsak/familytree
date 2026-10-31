import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { getFirestoreDb } from "./config";
import { DEFAULT_TIENG_SPACE_ID } from "./rtdb";

interface InviteTokenRecord {
  used: boolean;
  createdAt: string;
  usedAt?: string | null;
}

const memoryTokenStore = new Map<string, InviteTokenRecord>();

export async function createOneTimeInviteToken(): Promise<string> {
  const token = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const record: InviteTokenRecord = {
    used: false,
    createdAt: new Date().toISOString(),
    usedAt: null,
  };

  memoryTokenStore.set(token, record);

  const db = getFirestoreDb();
  if (db) {
    const spaceRef = doc(db, "spaces", DEFAULT_TIENG_SPACE_ID);
    try {
      await updateDoc(spaceRef, {
        [`inviteTokens.${token}`]: record,
      });
    } catch {
      await setDoc(
        spaceRef,
        { inviteTokens: { [token]: record } },
        { merge: true }
      );
    }
  }

  return token;
}

export async function consumeOneTimeInviteToken(token: string): Promise<boolean> {
  if (!token || !token.startsWith("inv_")) return false;

  const db = getFirestoreDb();
  if (db) {
    try {
      const spaceRef = doc(db, "spaces", DEFAULT_TIENG_SPACE_ID);
      const snap = await getDoc(spaceRef);
      if (snap.exists()) {
        const data = snap.data() as {
          inviteTokens?: Record<string, InviteTokenRecord>;
        };
        const existing = data.inviteTokens?.[token];
        if (!existing || existing.used === true) {
          return false;
        }

        await updateDoc(spaceRef, {
          [`inviteTokens.${token}.used`]: true,
          [`inviteTokens.${token}.usedAt`]: new Date().toISOString(),
        });
        memoryTokenStore.set(token, {
          ...existing,
          used: true,
          usedAt: new Date().toISOString(),
        });
        return true;
      }
    } catch (err) {
      console.warn("Firestore invite token check notice:", err);
    }
  }

  const mem = memoryTokenStore.get(token);
  if (!mem || mem.used) {
    return false;
  }
  mem.used = true;
  mem.usedAt = new Date().toISOString();
  memoryTokenStore.set(token, mem);
  return true;
}
