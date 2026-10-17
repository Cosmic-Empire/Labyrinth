import type { Note } from "@/src/lib/notes";

export type PendingNote = Note & { deleted: boolean };
export type RemoteNote = Note & { deleted: boolean };

type StoredNote = Note & { userId: string };
type StoredPendingNote = PendingNote & { userId: string };
type Metadata = { key: string; value: number | boolean };

const DATABASE_NAME = "labyrinth-notes";
const DATABASE_VERSION = 1;
const NOTES_STORE = "notes";
const OUTBOX_STORE = "outbox";
const META_STORE = "metadata";
const LEGACY_KEY = "labyrinth:notes";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available."));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(NOTES_STORE)) db.createObjectStore(NOTES_STORE, { keyPath: ["userId", "id"] });
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: ["userId", "id"] });
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => {
        databasePromise = null;
        reject(request.error ?? new Error("Unable to open IndexedDB."));
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(new Error("IndexedDB upgrade blocked by another tab."));
      };
    });
  }
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function userRange(userId: string) {
  return IDBKeyRange.bound([userId, ""], [userId, "\uffff"]);
}

function validNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === "string" && typeof note.title === "string" &&
    typeof note.content === "string" && typeof note.updatedAt === "number" && Number.isFinite(note.updatedAt);
}

export async function readLocalNotes(userId: string): Promise<Note[]> {
  const db = await openDatabase();
  const transaction = db.transaction(NOTES_STORE, "readonly");
  const rows = await requestResult(transaction.objectStore(NOTES_STORE).getAll(userRange(userId))) as StoredNote[];
  return rows.map((row) => ({ id: row.id, title: row.title, content: row.content, updatedAt: row.updatedAt }));
}

export async function readPendingNotes(userId: string): Promise<PendingNote[]> {
  const db = await openDatabase();
  const transaction = db.transaction(OUTBOX_STORE, "readonly");
  const rows = await requestResult(transaction.objectStore(OUTBOX_STORE).getAll(userRange(userId))) as StoredPendingNote[];
  return rows.map((row) => ({
    id: row.id, title: row.title, content: row.content, updatedAt: row.updatedAt, deleted: row.deleted,
  })).sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function readServerClockOffset(userId: string): Promise<number> {
  const db = await openDatabase();
  const tx = db.transaction(META_STORE, "readonly");
  const metadata = await requestResult(tx.objectStore(META_STORE).get(`server-clock:${userId}`)) as Metadata | undefined;
  return typeof metadata?.value === "number" ? metadata.value : 0;
}

export async function hasMigratedLegacyNotes(userId: string): Promise<boolean> {
  const db = await openDatabase();
  const tx = db.transaction(META_STORE, "readonly");
  const metadata = await requestResult(tx.objectStore(META_STORE).get(`legacy-migrated:${userId}`)) as Metadata | undefined;
  return Boolean(metadata?.value);
}

export async function writeServerClockOffset(userId: string, offset: number): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put({ key: `server-clock:${userId}`, value: offset } satisfies Metadata);
  await transactionDone(tx);
}

export async function migrateLegacyNotes(userId: string, offset: number): Promise<number> {
  const db = await openDatabase();
  const tx = db.transaction([NOTES_STORE, OUTBOX_STORE, META_STORE], "readwrite");
  const meta = tx.objectStore(META_STORE);
  const markerKey = `legacy-migrated:${userId}`;
  const markerRequest = meta.get(markerKey);
  let imported = 0;
  let hasLegacyData = false;

  markerRequest.onsuccess = () => {
    if (markerRequest.result) return;
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Legacy local notes have an invalid format.");
      hasLegacyData = true;
      for (const item of parsed) {
        if (!validNote(item)) continue;
        const note = { ...item, updatedAt: Math.max(item.updatedAt + offset, 0) };
        tx.objectStore(NOTES_STORE).put({ ...note, userId } satisfies StoredNote);
        tx.objectStore(OUTBOX_STORE).put({ ...note, userId, deleted: false } satisfies StoredPendingNote);
        imported += 1;
      }
    }
    meta.put({ key: markerKey, value: true } satisfies Metadata);
  };

  await transactionDone(tx);
  if (hasLegacyData) window.localStorage.removeItem(LEGACY_KEY);
  return imported;
}

export async function queueNote(userId: string, note: PendingNote): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([NOTES_STORE, OUTBOX_STORE], "readwrite");
  const key: [string, string] = [userId, note.id];
  const cache = tx.objectStore(NOTES_STORE);
  const outbox = tx.objectStore(OUTBOX_STORE);
  const existingRequest = outbox.get(key);
  const currentRequest = cache.get(key);
  let existingRead = false;
  let currentRead = false;
  let wroteNote = false;

  const saveLatest = () => {
    if (!existingRead || !currentRead) return;
    const existing = existingRequest.result as StoredPendingNote | undefined;
    const current = currentRequest.result as StoredNote | undefined;
    if (existing && existing.updatedAt > note.updatedAt) return;
    if (current && current.updatedAt > note.updatedAt) return;
    outbox.put({ ...note, userId } satisfies StoredPendingNote);
    if (note.deleted) {
      cache.delete(key);
    } else {
      cache.put({ id: note.id, title: note.title, content: note.content, updatedAt: note.updatedAt, userId } satisfies StoredNote);
    }
    wroteNote = true;
  };
  existingRequest.onsuccess = () => { existingRead = true; saveLatest(); };
  currentRequest.onsuccess = () => { currentRead = true; saveLatest(); };
  await transactionDone(tx);
  if (!wroteNote) throw new Error("A newer local edit is already stored; the older update was not queued.");
}

export async function acknowledgeNote(
  userId: string,
  pending: PendingNote,
  saved: RemoteNote,
): Promise<boolean> {
  const db = await openDatabase();
  const tx = db.transaction([NOTES_STORE, OUTBOX_STORE], "readwrite");
  const cache = tx.objectStore(NOTES_STORE);
  const outbox = tx.objectStore(OUTBOX_STORE);
  const key: [string, string] = [userId, pending.id];
  const pendingRequest = outbox.get(key);
  const localRequest = cache.get(key);
  let pendingRead = false;
  let localRead = false;
  let ack = false;

  const finish = () => {
    if (!pendingRead || !localRead) return;
    const currentPending = pendingRequest.result as StoredPendingNote | undefined;
    const local = localRequest.result as StoredNote | undefined;
    if (!currentPending || currentPending.updatedAt !== pending.updatedAt || currentPending.deleted !== pending.deleted) return;
    if (!pending.deleted && local && local.updatedAt > pending.updatedAt) return;

    outbox.delete(key);
    if (saved.deleted) cache.delete(key);
    else cache.put({
      id: saved.id, title: saved.title, content: saved.content, updatedAt: saved.updatedAt, userId,
    } satisfies StoredNote);
    ack = true;
  };
  pendingRequest.onsuccess = () => { pendingRead = true; finish(); };
  localRequest.onsuccess = () => { localRead = true; finish(); };
  await transactionDone(tx);
  return ack;
}

export async function reconcileLocalNotes(userId: string, remoteNotes: RemoteNote[]): Promise<Note[]> {
  const db = await openDatabase();
  const tx = db.transaction([NOTES_STORE, OUTBOX_STORE], "readwrite");
  const cache = tx.objectStore(NOTES_STORE);
  const outbox = tx.objectStore(OUTBOX_STORE);
  const [locals, pendings] = await Promise.all([
    requestResult(cache.getAll(userRange(userId))) as Promise<StoredNote[]>,
    requestResult(outbox.getAll(userRange(userId))) as Promise<StoredPendingNote[]>,
  ]);
  const pendingById = new Map(pendings.map((row) => [row.id, row]));
  const remoteById = new Map(remoteNotes.map((row) => [row.id, row]));
  const merged = new Map<string, Note>();

  for (const remote of remoteNotes) {
    if (!remote.deleted && !pendingById.has(remote.id)) {
      merged.set(remote.id, { id: remote.id, title: remote.title, content: remote.content, updatedAt: remote.updatedAt });
    }
  }
  for (const local of locals) {
    const pending = pendingById.get(local.id);
    if (pending && !pending.deleted && !remoteById.has(local.id)) {
      merged.set(local.id, { id: local.id, title: local.title, content: local.content, updatedAt: local.updatedAt });
    }
  }
  for (const pending of pendings) {
    if (!pending.deleted && !remoteById.has(pending.id)) {
      merged.set(pending.id, { id: pending.id, title: pending.title, content: pending.content, updatedAt: pending.updatedAt });
    }
  }

  const cursor = cache.openCursor(userRange(userId));
  cursor.onsuccess = () => {
    const record = cursor.result;
    if (record) {
      record.delete();
      record.continue();
    } else {
      for (const note of merged.values()) cache.put({ ...note, userId } satisfies StoredNote);
    }
  };
  await transactionDone(tx);
  return [...merged.values()];
}
