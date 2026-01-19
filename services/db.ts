
// Simple Promise wrapper for IndexedDB
import { AssetMetadata } from '../types';

const DB_NAME = 'PocketStudioDB';
const DB_VERSION = 2; // Bumped version for metadata store
const ASSET_STORE = 'assets'; // Stores AudioBlobs
const ASSET_INFO_STORE = 'asset_metadata'; // Stores Metadata
const PROJECT_STORE = 'projects';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE);
      }
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSET_INFO_STORE)) {
        db.createObjectStore(ASSET_INFO_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
};

export const saveAudioBlob = async (key: string, blob: Blob): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, 'readwrite');
    const store = tx.objectStore(ASSET_STORE);
    const req = store.put(blob, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const saveAssetMetadata = async (metadata: AssetMetadata): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_INFO_STORE, 'readwrite');
    const store = tx.objectStore(ASSET_INFO_STORE);
    const req = store.put(metadata);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getAudioBlob = async (key: string): Promise<Blob | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, 'readonly');
    const store = tx.objectStore(ASSET_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const deleteAudioBlob = async (key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ASSET_STORE, ASSET_INFO_STORE], 'readwrite');
    tx.objectStore(ASSET_STORE).delete(key);
    tx.objectStore(ASSET_INFO_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAllAssetKeys = async (): Promise<string[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, 'readonly');
    const store = tx.objectStore(ASSET_STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
};

export const getAllAssetsMetadata = async (): Promise<AssetMetadata[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_INFO_STORE, 'readonly');
    const store = tx.objectStore(ASSET_INFO_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const saveProject = async (project: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE);
    const req = store.put(project);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getProject = async (id: string): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    const store = tx.objectStore(PROJECT_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const getAllProjects = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    const store = tx.objectStore(PROJECT_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};
