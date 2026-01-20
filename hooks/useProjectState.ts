
import { useState, useCallback } from 'react';
import { produce, Draft } from 'immer';
import { ProjectState } from '../types';

export const useProjectState = (initialProject: ProjectState) => {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [past, setPast] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);

  // Update without committing to history (for high-frequency events like drag)
  // Uses Immer 'produce' to allow mutable-style logic while keeping React state immutable
  const updateProject = useCallback((recipe: ((draft: Draft<ProjectState>) => void) | Partial<ProjectState>) => {
      setProject(current => {
          if (typeof recipe === 'function') {
              return produce(current, recipe as (draft: Draft<ProjectState>) => void);
          }
          // Handle partial object update
          return produce(current, (draft) => {
              Object.assign(draft, recipe);
          });
      });
  }, []);

  // Commit current state to history
  // Removed structuredClone because Immer ensures the 'current' state is already a safe, immutable snapshot.
  const commitTransaction = useCallback(() => {
      setProject(current => {
          setPast(prev => {
              // Keep history limited to 20 items
              const newPast = [...prev, current];
              if (newPast.length > 20) return newPast.slice(newPast.length - 20);
              return newPast;
          });
          setFuture([]);
          return current;
      });
  }, []);

  const undo = useCallback(() => {
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      setFuture(prev => [project, ...prev]);
      setProject(previous);
      setPast(newPast);
  }, [past, project]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);
      setPast(prev => [...prev, project]);
      setProject(next);
      setFuture(newFuture);
  }, [future, project]);

  // Direct setter for loading full project without history push (e.g. initial load)
  const loadProject = useCallback((newProject: ProjectState) => {
      setProject(newProject);
      setPast([]);
      setFuture([]);
  }, []);

  return { project, setProject: updateProject, updateProject, undo, redo, past, future, loadProject, commitTransaction };
};
