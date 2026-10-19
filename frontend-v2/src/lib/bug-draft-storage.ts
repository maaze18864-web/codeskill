export const BUG_DRAFT_KEY = "bugDraft";

interface StoredBugDraftImage {
  id: number;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

const DATABASE_NAME = "codeskill-bug-drafts";
const DATABASE_VERSION = 1;
const STORE_NAME = "images";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open bug draft storage."));
  });
}

export async function saveBugDraftImages(files: File[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    files.forEach((file, index) => {
      const record: StoredBugDraftImage = {
        id: index,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        blob: file,
      };
      store.put(record);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not save bug draft images."));
    transaction.onabort = () => reject(transaction.error || new Error("Saving bug draft images was interrupted."));
  }).finally(() => database.close());
}

export async function readBugDraftImages(): Promise<File[]> {
  const database = await openDatabase();
  const records = await new Promise<StoredBugDraftImage[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as StoredBugDraftImage[]).sort((a, b) => a.id - b.id));
    request.onerror = () => reject(request.error || new Error("Could not restore bug draft images."));
  }).finally(() => database.close());
  return records.map((record) => new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  }));
}

export async function clearBugDraftImages(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not clear bug draft images."));
    transaction.onabort = () => reject(transaction.error || new Error("Clearing bug draft images was interrupted."));
  }).finally(() => database.close());
}
