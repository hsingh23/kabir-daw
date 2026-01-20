
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AssetMetadata, ProjectState } from '../types';

const DB_NAME = 'PocketStudioDB';
const DB_VERSION = 2;

interface PocketStudioDB extends DBSchema {
  assets: {
    key: string;
    value: Blob;
  };
  asset_metadata: {
    key: string;
    value: AssetMetadata;
  };
  projects: {
    key: string;
    value: ProjectState;
  };
}

let dbPromise: Promise<IDBPDatabase<PocketStudioDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<PocketStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets');
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('asset_metadata')) {
          db.createObjectStore('asset_metadata', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const saveAudioBlob = async (key: string, blob: Blob): Promise<string> => {
  const db = await getDB();
  return db.put('assets', blob, key);
};

export const saveAssetMetadata = async (metadata: AssetMetadata): Promise<string> => {
  const db = await getDB();
  return db.put('asset_metadata', metadata);
};

export const getAudioBlob = async (key: string): Promise<Blob | undefined> => {
  const db = await getDB();
  return db.get('assets', key);
};

export const deleteAudioBlob = async (key: string): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(['assets', 'asset_metadata'], 'readwrite');
  await Promise.all([
    tx.objectStore('assets').delete(key),
    tx.objectStore('asset_metadata').delete(key),
    tx.done,
  ]);
};

export const getAllAssetKeys = async (): Promise<string[]> => {
  const db = await getDB();
  return db.getAllKeys('assets');
};

export const getAllAssetsMetadata = async (): Promise<AssetMetadata[]> => {
  const db = await getDB();
  return db.getAll('asset_metadata');
};

export const saveProject = async (project: ProjectState): Promise<string> => {
  // Sanitize project to ensure no non-clonable data enters DB
  // (In basic usage mostly fine, but safe practice)
  const db = await getDB();
  return db.put('projects', project);
};

export const getProject = async (id: string): Promise<ProjectState | undefined> => {
  const db = await getDB();
  return db.get('projects', id);
};

export const getAllProjects = async (): Promise<ProjectState[]> => {
  const db = await getDB();
  return db.getAll('projects');
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await getDB();
  return db.delete('projects', id);
};
