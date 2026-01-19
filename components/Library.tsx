
import React, { useEffect, useState } from 'react';
import { getAllAssetKeys, deleteAudioBlob, getAudioBlob, getAllProjects, deleteProject } from '../services/db';
import { Trash2, Play, AlertCircle, FileAudio, FolderOpen, Plus, FileMusic } from 'lucide-react';
import { audio } from '../services/audio';

interface LibraryProps {
  onLoadProject?: (id: string) => void;
  onCreateNewProject?: () => void;
  currentProjectId?: string;
}

const Library: React.FC<LibraryProps> = ({ onLoadProject, onCreateNewProject, currentProjectId }) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'assets'>('projects');
  
  // Assets State
  const [assetKeys, setAssetKeys] = useState<string[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);

  // Projects State
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (activeTab === 'assets') loadAssets();
    if (activeTab === 'projects') loadProjects();
  }, [activeTab]);

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const k = await getAllAssetKeys();
      setAssetKeys(k);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadProjects = async () => {
      setLoadingProjects(true);
      try {
          const p = await getAllProjects();
          setProjects(p);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingProjects(false);
      }
  };

  const handleDeleteAsset = async (key: string) => {
    if (confirm('Delete this audio file permanently?')) {
      await deleteAudioBlob(key);
      loadAssets();
    }
  };

  const handleDeleteProject = async (id: string) => {
      if (confirm('Delete this project? This cannot be undone.')) {
          await deleteProject(id);
          loadProjects();
      }
  };

  const handlePreview = async (key: string) => {
    audio.resumeContext(); 
    
    if (previewing === key) {
        audio.stop();
        setPreviewing(null);
        return;
    }
    
    try {
        const blob = await getAudioBlob(key);
        if (blob) {
            audio.stop(); 
            const buffer = await audio.loadAudio(key, blob);
            const source = audio.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(audio.ctx.destination);
            source.start();
            setPreviewing(key);
            source.onended = () => setPreviewing(null);
        }
    } catch (e) {
        console.error("Preview failed", e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-studio-bg text-white p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light tracking-widest uppercase text-zinc-400">Library</h2>
            
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                <button 
                    onClick={() => setActiveTab('projects')} 
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-2 ${activeTab === 'projects' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <FolderOpen size={14} /> <span>Projects</span>
                </button>
                <button 
                    onClick={() => setActiveTab('assets')} 
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-2 ${activeTab === 'assets' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <FileAudio size={14} /> <span>Assets</span>
                </button>
            </div>
        </div>
        
        {activeTab === 'projects' && (
            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                     {/* New Project Card */}
                     <button 
                        onClick={() => { if(onCreateNewProject) onCreateNewProject(); loadProjects(); }}
                        className="bg-zinc-800/30 border border-zinc-700 border-dashed rounded-lg p-6 flex flex-col items-center justify-center space-y-2 hover:bg-zinc-800/50 hover:border-zinc-500 transition-all group"
                     >
                        <div className="p-3 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
                            <Plus size={24} className="text-zinc-400 group-hover:text-white" />
                        </div>
                        <span className="text-sm font-bold text-zinc-400 group-hover:text-white">New Project</span>
                     </button>

                     {loadingProjects ? (
                         <div className="col-span-full flex justify-center py-10 text-zinc-500">Loading projects...</div>
                     ) : projects.length === 0 ? (
                         null
                     ) : (
                         projects.map(proj => (
                            <div key={proj.id} className={`bg-zinc-800/50 border rounded-lg p-4 flex flex-col justify-between group hover:bg-zinc-800 transition-colors ${currentProjectId === proj.id ? 'border-studio-accent/50 ring-1 ring-studio-accent/20' : 'border-zinc-700'}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                                            <FileMusic size={20} className="text-zinc-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-zinc-200 truncate w-32 md:w-40">{proj.id === 'default-project' ? 'Demo Project' : `Project ${proj.id.slice(0,4)}...`}</h3>
                                            <p className="text-[10px] text-zinc-500">{proj.tracks.length} Tracks • {proj.bpm} BPM</p>
                                        </div>
                                    </div>
                                    {proj.id === currentProjectId && <span className="text-[10px] font-bold bg-studio-accent/20 text-studio-accent px-2 py-0.5 rounded-full">OPEN</span>}
                                </div>
                                
                                <div className="flex items-center space-x-2 pt-2 border-t border-zinc-700/50">
                                    <button 
                                        onClick={() => onLoadProject && onLoadProject(proj.id)}
                                        disabled={currentProjectId === proj.id}
                                        className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${currentProjectId === proj.id ? 'bg-zinc-700/50 text-zinc-500 cursor-default' : 'bg-studio-accent text-white hover:bg-red-600'}`}
                                    >
                                        {currentProjectId === proj.id ? 'Loaded' : 'Open'}
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteProject(proj.id)}
                                        className="p-1.5 rounded hover:bg-red-900/30 text-zinc-500 hover:text-red-500 transition-colors"
                                        title="Delete Project"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                         ))
                     )}
                </div>
            </div>
        )}

        {activeTab === 'assets' && (
             loadingAssets ? (
                 <div className="flex flex-col items-center justify-center flex-1 text-zinc-500">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                     <p>Loading library...</p>
                 </div>
             ) : assetKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-zinc-600 space-y-4">
                    <AlertCircle size={48} />
                    <p>No audio assets found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-20">
                    {assetKeys.map(key => (
                        <div key={key} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 flex items-center justify-between group hover:bg-zinc-800 transition-colors">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="w-10 h-10 rounded bg-zinc-900 flex items-center justify-center shrink-0">
                                    <FileAudio size={20} className="text-zinc-500" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-mono text-zinc-400 truncate w-32 md:w-48" title={key}>{key}</span>
                                    <span className="text-[10px] text-zinc-600">Local Audio</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => handlePreview(key)}
                                    className={`p-2 rounded-full hover:bg-zinc-700 transition-colors ${previewing === key ? 'text-studio-accent' : 'text-zinc-400'}`}
                                >
                                    <Play size={16} fill={previewing === key ? "currentColor" : "none"} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteAsset(key)}
                                    className="p-2 rounded-full hover:bg-red-900/30 text-zinc-600 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )
        )}
    </div>
  );
};

export default Library;
