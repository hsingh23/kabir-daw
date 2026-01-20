
import React, { createContext, useContext, ReactNode } from 'react';
import { useProjectState } from '../hooks/useProjectState';
import { ProjectState } from '../types';

interface ProjectContextType {
    project: ProjectState;
    /** 
     * Updates the project state using an Immer recipe or partial object.
     * Prevents full state replacement to ensure history integrity.
     */
    updateProject: (recipe: any) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    loadProject: (p: ProjectState) => void;
    commitTransaction: () => void;
    past: ProjectState[];
    future: ProjectState[];
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) throw new Error('useProject must be used within ProjectProvider');
    return context;
};

interface ProjectProviderProps {
    initialProject: ProjectState;
    children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ initialProject, children }) => {
    const state = useProjectState(initialProject);
    
    const value: ProjectContextType = {
        ...state,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
        // Removed setProject alias to reduce cognitive load. 
        // updateProject implies the correct mental model (mutation/merge) vs replacement.
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
