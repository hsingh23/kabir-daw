
import React, { useEffect, useState, useRef } from 'react';
import { getAllAssetsMetadata, saveAudioBlob, saveAssetMetadata, deleteAudioBlob, getAudioBlob, getAllProjects, deleteProject, saveProject } from '../services/db';
import { AssetMetadata, ProjectState } from '../types';
import { Trash2, Play, Pause, AlertCircle, FileAudio, FolderOpen, Plus, FileMusic, Search, Globe, Upload, Edit2, Check, X, Copy, GripHorizontal, LayoutTemplate, Music, Download } from 'lucide-react';
import { audio } from '../services/audio';
import { useToast } from './Toast';
import { TEMPLATES } from '../services/templates';
import { analytics } from '../services/analytics';

interface LibraryProps {
  onLoadProject?: (id: string) => void;
  onCreateNewProject?: (template?: Partial<ProjectState>) => void;
  onAddAsset?: (asset: AssetMetadata) => void;
  onAssetsChange?: () => void;
  currentProjectId?: string;
  variant?: 'full' | 'sidebar';
}

const INSTRUMENTS = ['Drums', 'Bass', 'Guitar', 'Keys', 'Synth', 'Vocals', 'FX', 'Orchestral', 'Percussion', 'Other'];

const Library: React.FC<LibraryProps> = ({ onLoadProject, onCreateNewProject, onAddAsset, onAssetsChange, currentProjectId, variant = 'full' }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'projects' | 'assets'>('assets');
  
  // Projects State
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Assets State
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInstrument, setFilterInstrument] = useState('');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant === 'sidebar') setActiveTab('assets');
  }, [variant]);

  useEffect(() => {
    if (activeTab === 'assets') loadAssets();
    if (activeTab === 'projects') loadProjects();
  }, [activeTab]);

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const metas = await getAllAssetsMetadata();
      setAssets(metas.sort((a, b) => b.dateAdded - a.dateAdded));
    } catch (e) {
      console.error(e);
      showToast("Failed to load assets", 'error');
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
          showToast("Failed to load projects", 'error');
      } finally {
          setLoadingProjects(false);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setLoadingAssets(true);
          const files: File[] = Array.from(e.target.files);
          
          for (const file of files) {
              try {
                  const key = crypto.randomUUID();
                  await saveAudioBlob(key, file);
                  
                  const meta: AssetMetadata = {
                      id: key,
                      name: file.name.replace(/\.[^/.]+$/, ""),
                      type: 'oneshot',
                      instrument: 'Other',
                      tags: [],
                      duration: 0,
                      dateAdded: Date.now(),
                      fileType: file.type
                  };
                  await saveAssetMetadata(meta);
              } catch (err: any) {
                  console.error(`Failed to upload ${file.name}`, err);
              }
          }
          await loadAssets();
          if (onAssetsChange) onAssetsChange();
          e.target.value = ''; 
          setLoadingAssets(false);
      }
  };

  const handlePreview = async (asset: AssetMetadata) => {
    audio.resumeContext(); 
    
    if (previewing === asset.id) {
        audio.stop();
        setPreviewing(null);
        return;
    }
    
    try {
        const blob = await getAudioBlob(asset.id);
        if (blob) {
            audio.stop(); 
            const buffer = await audio.loadAudio(asset.id, blob);
            const source = audio.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(audio.ctx.destination);
            if (asset.type === 'loop') source.loop = true;
            
            source.start();
            setPreviewing(asset.id);
            if (!source.loop) {
                source.onended = () => setPreviewing(null);
            }
        }
    } catch (e) {
        console.error("Preview failed", e);
    }
  };

  const filteredAssets = assets.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchInst = filterInstrument ? a.instrument === filterInstrument : true;
      return matchSearch && matchInst;
  });

  const handleCreateFromTemplate = (templateKey: string) => {
      if (onCreateNewProject) {
          onCreateNewProject(TEMPLATES[templateKey]);
          setShowTemplateModal(false);
          loadProjects();
          analytics.track('project_created', { template: templateKey });
      }
  };

  return (
    <div className={`flex flex-col h-full bg-[#181818] text-[#ccc] overflow-hidden relative text-xs ${variant === 'sidebar' ? 'border-r border-black' : ''}`}>
        {/* Header Tabs */}
        {variant === 'full' && (
            <div className="p-2 bg-[#252525] border-b border-black flex items-center justify-between shrink-0">
                <div className="flex bg-black/50 rounded p-0.5 border border-white/10 mx-auto md:mx-0">
                    <button 
                        onClick={() => setActiveTab('projects')} 
                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center space-x-2 ${activeTab === 'projects' ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <span>Projects</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('assets')} 
                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center space-x-2 ${activeTab === 'assets' ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <span>Loops</span>
                    </button>
                </div>
            </div>
        )}
        
        {variant === 'sidebar' && (
             <div className="p-2 bg-[#2a2a2a] border-b border-black shrink-0 flex justify-between items-center">
                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">
                     Loop Browser
                 </span>
                 <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white" title="Import Audio">
                     <Download size={14} />
                 </button>
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="audio/*" className="hidden" />
             </div>
        )}
        
        {/* Projects Tab */}
        {activeTab === 'projects' && variant !== 'sidebar' && (
            <div className="flex-1 overflow-y-auto p-4 bg-[#1c1c1c]">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                     <button 
                        onClick={() => setShowTemplateModal(true)}
                        className="bg-zinc-800/30 border border-zinc-700 border-dashed rounded-xl p-6 flex flex-col items-center justify-center space-y-2 hover:bg-zinc-800/50 hover:border-zinc-500 transition-all group min-h-[140px]"
                     >
                        <div className="p-3 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
                            <Plus size={24} className="text-zinc-400 group-hover:text-white" />
                        </div>
                        <span className="text-sm font-bold text-zinc-400 group-hover:text-white">New Project</span>
                     </button>

                     {projects.map(proj => (
                        <div key={proj.id} className={`bg-[#252525] border rounded-lg p-4 flex flex-col justify-between group hover:bg-[#2a2a2a] transition-colors ${currentProjectId === proj.id ? 'border-blue-500/50' : 'border-black'}`}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                                        <FileMusic size={20} className="text-zinc-400" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <h3 className="text-sm font-bold text-zinc-200 truncate">{proj.name || 'Untitled'}</h3>
                                        <p className="text-[10px] text-zinc-500">{proj.tracks.length} Tracks • {proj.bpm} BPM</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 pt-2 border-t border-white/5">
                                <button 
                                    onClick={() => onLoadProject && onLoadProject(proj.id)}
                                    disabled={currentProjectId === proj.id}
                                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${currentProjectId === proj.id ? 'bg-transparent text-blue-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                                >
                                    {currentProjectId === proj.id ? 'Open' : 'Open'}
                                </button>
                            </div>
                        </div>
                     ))}
                </div>
            </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
            <div className="flex flex-col flex-1 overflow-hidden">
                <div className="p-2 bg-[#252525] border-b border-black space-y-2 shrink-0">
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#111] border border-zinc-800 rounded pl-7 pr-2 py-1 text-[11px] text-white focus:outline-none focus:border-zinc-600"
                        />
                    </div>

                    <div className="flex flex-wrap gap-1">
                        <button 
                            onClick={() => setFilterInstrument('')}
                            className={`px-2 py-0.5 text-[10px] border border-transparent rounded ${filterInstrument === '' ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800 text-zinc-500'}`}
                        >
                            All
                        </button>
                        {INSTRUMENTS.slice(0, 5).map(i => (
                            <button 
                                key={i}
                                onClick={() => setFilterInstrument(i === filterInstrument ? '' : i)}
                                className={`px-2 py-0.5 text-[10px] border border-transparent rounded ${filterInstrument === i ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800 text-zinc-500'}`}
                            >
                                {i}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#1c1c1c] pb-safe custom-scrollbar">
                    {loadingAssets ? (
                        <div className="space-y-1 p-2">
                            <div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse" />
                            <div className="h-4 bg-zinc-800 rounded w-1/2 animate-pulse" />
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-600 space-y-2">
                            <p className="text-xs">No loops found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-800">
                            {filteredAssets.map((asset, i) => (
                                <div 
                                    key={asset.id} 
                                    draggable={true}
                                    onDragStart={(e) => {
                                        audio.resumeContext();
                                        e.dataTransfer.setData('application/x-pocketstudio-asset-id', asset.id);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className={`group hover:bg-[#2a2a2a] flex items-center px-3 py-1.5 cursor-grab active:cursor-grabbing select-none ${i % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#1c1c1c]'}`}
                                >
                                    <button 
                                        onClick={() => handlePreview(asset)}
                                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors mr-2 ${previewing === asset.id ? 'bg-blue-500 text-white' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        {previewing === asset.id ? <Pause size={10} /> : <Play size={10} />}
                                    </button>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-[11px] text-zinc-300 truncate">{asset.name}</span>
                                            <span className="text-[9px] text-zinc-600 font-mono ml-2 shrink-0">{asset.bpm ? `${asset.bpm} bpm` : ''}</span>
                                        </div>
                                    </div>

                                    {onAddAsset && (
                                        <button 
                                            onClick={() => onAddAsset(asset)}
                                            className="ml-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                                        >
                                            <Plus size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default Library;
