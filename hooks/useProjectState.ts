
import { useState, useCallback } from 'react';
import { ProjectState } from '../types';

export const useProjectState = (initialProject: ProjectState) => {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [past, setPast] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);

  // Update without committing to history (for high-frequency events like drag)
  const updateProject = useCallback((value: React.SetStateAction<ProjectState>) => {
      setProject(current => {
          const next = typeof value === 'function' ? (value as (prev: ProjectState) => ProjectState)(current) : value;
          return next;
      });
  }, []);

  // Commit current state to history with deep clone to prevent mutation bugs
  // IMPORTANT: Call this AFTER an action is complete (e.g. onPointerUp)
  const commitTransaction = useCallback(() => {
      setProject(current => {
          try {
              // Deep clone the current state before pushing to history
              const snapshot = structuredClone(current);
              setPast(prev => [...prev.slice(-19), snapshot]);
              setFuture([]);
          } catch (e) {
              console.error("Failed to clone state for history", e);
              // Fallback if structuredClone fails (unlikely in modern envs)
              setPast(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(current))]);
          }
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
