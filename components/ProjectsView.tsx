
import React, { useEffect, useState } from 'react';
import { getAllProjects, deleteProject, saveProject } from '../services/db';
import { Trash2, Copy, Plus, FileMusic, LayoutTemplate, X, Check } from 'lucide-react';
import { useToast } from './Toast';
import { analytics } from '../services/analytics';
import { TEMPLATES } from '../services/templates';
import { ProjectState } from '../types';

interface ProjectsViewProps {
    currentProjectId: string;
    onLoadProject: (id: string) => void;
    onCreateNewProject: (template?: Partial<ProjectState>) => void;
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ currentProjectId, onLoadProject, onCreateNewProject }) => {
    const { showToast } = useToast();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const p = await getAllProjects();
            // Sort by recently opened? For now default ID sort or name
            setProjects(p.sort((a,b) => (b.lastModified || 0) - (a.lastModified || 0)));
        } catch (e) {
            console.error(e);
            showToast("Failed to load projects", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (confirm('Delete this project? This cannot be undone.')) {
            await deleteProject(id);
            loadProjects();
            showToast("Project deleted", 'info');
        }
    };

    const handleDuplicateProject = async (project: any) => {
        const newId = crypto.randomUUID();
        const newProject = { 
            ...project, 
            id: newId, 
            name: `${project.name} (Copy)`,
        };
        await saveProject(newProject);
        loadProjects();
        showToast("Project duplicated", 'success');
    };

    const handleCreateFromTemplate = (templateKey: string) => {
        onCreateNewProject(TEMPLATES[templateKey]);
        setShowTemplateModal(false);
        loadProjects();
    };

    return (
        <div className="flex flex-col h-full bg-studio-bg text-white overflow-hidden p-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-6 flex items-center gap-2">
                <FileMusic size={24} /> My Projects
            </h2>

            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                     <button 
                        onClick={() => setShowTemplateModal(true)}
                        className="bg-zinc-800/30 border border-zinc-700 border-dashed rounded-xl p-6 flex flex-col items-center justify-center space-y-4 hover:bg-zinc-800/50 hover:border-studio-accent transition-all group min-h-[160px]"
                     >
                        <div className="p-4 rounded-full bg-zinc-800 group-hover:bg-studio-accent group-hover:text-white text-zinc-400 transition-colors">
                            <Plus size={32} />
                        </div>
                        <span className="text-sm font-bold text-zinc-400 group-hover:text-white">New Project</span>
                     </button>

                     {loading ? (
                         Array.from({length: 4}).map((_, i) => (
                             <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl h-[160px] animate-pulse" />
                         ))
                     ) : (
                         projects.map(proj => (
                            <div key={proj.id} className={`bg-zinc-800/50 border rounded-xl p-5 flex flex-col justify-between group hover:bg-zinc-800 hover:shadow-xl transition-all ${currentProjectId === proj.id ? 'border-studio-accent ring-1 ring-studio-accent/20' : 'border-zinc-700'}`}>
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-zinc-100 truncate pr-2">{proj.name || 'Untitled'}</h3>
                                        {proj.id === currentProjectId && <span className="text-[10px] font-bold bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full border border-green-800">ACTIVE</span>}
                                    </div>
                                    <p className="text-xs text-zinc-500 mb-1">{proj.tracks.length} Tracks • {proj.bpm} BPM</p>
                                    <p className="text-[10px] text-zinc-600 font-mono">{proj.id.slice(0,8)}</p>
                                </div>
                                
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-700/50">
                                    <button 
                                        onClick={() => onLoadProject(proj.id)}
                                        disabled={currentProjectId === proj.id}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-transform active:scale-95 ${currentProjectId === proj.id ? 'bg-zinc-700 text-zinc-500 cursor-default' : 'bg-studio-accent hover:bg-red-600 text-white shadow-lg shadow-red-900/20'}`}
                                    >
                                        {currentProjectId === proj.id ? 'Opened' : 'Open Project'}
                                    </button>
                                    <button 
                                        onClick={() => handleDuplicateProject(proj)}
                                        className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-800"
                                        title="Duplicate"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteProject(proj.id)}
                                        className="p-2 rounded-lg bg-zinc-900 hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-colors border border-zinc-800"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                         ))
                     )}
                </div>
            </div>

            {/* Template Modal */}
            {showTemplateModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <LayoutTemplate size={20} className="text-studio-accent" /> Start from Template
                            </h3>
                            <button onClick={() => setShowTemplateModal(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Object.entries(TEMPLATES).map(([key, template]) => (
                                <button 
                                    key={key}
                                    onClick={() => handleCreateFromTemplate(key)}
                                    className="flex flex-col items-start p-5 rounded-xl bg-zinc-800/30 border border-zinc-700 hover:border-studio-accent hover:bg-zinc-800 transition-all text-left group"
                                >
                                    <div className="w-full flex justify-between items-start mb-2">
                                        <span className="font-bold text-white text-lg group-hover:text-studio-accent transition-colors">{template.name}</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mb-4">{template.tracks?.length || 0} Tracks • {template.bpm} BPM</p>
                                    
                                    <div className="flex flex-wrap gap-1 mt-auto">
                                        {template.tracks?.slice(0, 3).map((t, i) => (
                                            <span key={i} className="text-[10px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium">
                                                {t.name}
                                            </span>
                                        ))}
                                        {template.tracks && template.tracks.length > 3 && (
                                            <span className="text-[10px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">+{template.tracks.length - 3} more</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectsView;
