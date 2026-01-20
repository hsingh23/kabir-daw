
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../services/db';
import { ProjectState } from '../../types';

// Mock IDB
const mockDB = {
  get: vi.fn(),
  put: vi.fn(),
  getAll: vi.fn(),
  getAllKeys: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
          delete: vi.fn()
      })),
      done: Promise.resolve()
  })),
  objectStoreNames: { contains: vi.fn(() => true) }
};

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB))
}));

describe('DB Service', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('saves a project', async () => {
        const project: ProjectState = { id: 'p1', name: 'Test' } as any;
        mockDB.put.mockResolvedValue('p1');
        
        const result = await db.saveProject(project);
        
        expect(mockDB.put).toHaveBeenCalledWith('projects', project);
        expect(result).toBe('p1');
    });

    it('gets a project', async () => {
        const project = { id: 'p1', name: 'Test' };
        mockDB.get.mockResolvedValue(project);
        
        const result = await db.getProject('p1');
        
        expect(mockDB.get).toHaveBeenCalledWith('projects', 'p1');
        expect(result).toEqual(project);
    });

    it('saves audio blob', async () => {
        const blob = new Blob(['test']);
        mockDB.put.mockResolvedValue('k1');
        
        await db.saveAudioBlob('k1', blob);
        
        expect(mockDB.put).toHaveBeenCalledWith('assets', blob, 'k1');
    });

    it('gets all projects', async () => {
        const projects = [{ id: 'p1' }, { id: 'p2' }];
        mockDB.getAll.mockResolvedValue(projects);
        
        const result = await db.getAllProjects();
        expect(result).toHaveLength(2);
        expect(mockDB.getAll).toHaveBeenCalledWith('projects');
    });

    it('deletes audio blob transactions correctly', async () => {
        const mockStore = { delete: vi.fn() };
        const mockTx = {
            objectStore: vi.fn(() => mockStore),
            done: Promise.resolve()
        };
        mockDB.transaction.mockReturnValue(mockTx);

        await db.deleteAudioBlob('k1');

        expect(mockDB.transaction).toHaveBeenCalledWith(['assets', 'asset_metadata'], 'readwrite');
        expect(mockTx.objectStore).toHaveBeenCalledWith('assets');
        expect(mockTx.objectStore).toHaveBeenCalledWith('asset_metadata');
        expect(mockStore.delete).toHaveBeenCalledWith('k1');
    });
});
