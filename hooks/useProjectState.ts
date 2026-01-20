
import { useState, useCallback } from 'react';
import { ProjectState } from '../types';

export const useProjectState = (initialProject: ProjectState) => {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [past, setPast] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);

  const updateProject = useCallback((value: React.SetStateAction<ProjectState>) => {
      setProject(current => {
          const next = typeof value === 'function' ? (value as (prev: ProjectState) => ProjectState)(current) : value;
          if (next !== current) {
              setPast(prev => [...prev.slice(-19), current]);
              setFuture([]);
          }
          return next;
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

  return { project, setProject, updateProject, undo, redo, past, future, loadProject };
};
