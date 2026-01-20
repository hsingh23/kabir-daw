
import React, { useEffect, useState, useRef } from 'react';
import { getAllAssetsMetadata, saveAudioBlob, saveAssetMetadata, deleteAudioBlob, getAudioBlob, getAllProjects, deleteProject, saveProject } from '../services/db';
import { AssetMetadata } from '../types';
import { Trash2, Play, Pause, AlertCircle, FileAudio, FolderOpen, Plus, FileMusic, Search, Globe, Upload, Edit2, Check, X, Copy, GripHorizontal } from 'lucide-react';
import { audio } from '../services/audio';
import { useToast } from './Toast';

interface LibraryProps {
  onLoadProject?: (id: string) => void;
  onCreateNewProject?: () => void;
  onAddAsset?: (asset: AssetMetadata) => void;
  currentProjectId?: string;
  variant?: 'full' | 'sidebar';
}

const INSTRUMENTS = ['Drums', 'Bass', 'Guitar', 'Keys', 'Synth', 'Vocals', 'FX', 'Orchestral', 'Percussion', 'Other'];
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TYPES = ['loop', 'oneshot', 'stem', 'song'];

const Library: React.FC<LibraryProps> = ({ onLoadProject, onCreateNewProject, onAddAsset, currentProjectId, variant = 'full' }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'projects' | 'assets'>('assets');
  
  // Projects State
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Assets State
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInstrument, setFilterInstrument] = useState('');
  const [filterType, setFilterType] = useState('');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isUrlImporting, setIsUrlImporting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Edit Metadata State
  const [editingAsset, setEditingAsset] = useState<AssetMetadata | null>(null);
  const [batchEditIds, setBatchEditIds] = useState<string[]>([]);
  const [batchMetadata, setBatchMetadata] = useState<{group: string, bpm?: number, key: string, type: 'stem' | 'loop' | 'oneshot'}>({
      group: '',
      key: '',
      type: 'stem'
  });

  useEffect(() => {
    // If sidebar, force assets tab
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

  // --- Actions ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setLoadingAssets(true);
          const files = Array.from(e.target.files);
          const newIds: string[] = [];
          
          for (const file of files) {
              try {
                  const key = crypto.randomUUID();
                  await saveAudioBlob(key, file);
                  
                  const meta: AssetMetadata = {
                      id: key,
                      name: file.name.replace(/\.[^/.]+$/, ""),
                      type: files.length > 1 ? 'stem' : 'oneshot',
                      instrument: 'Other',
                      tags: [],
                      duration: 0,
                      dateAdded: Date.now(),
                      fileType: file.type
                  };
                  await saveAssetMetadata(meta);
                  newIds.push(key);
              } catch (err) {
                  console.error(`Failed to upload ${file.name}`, err);
                  showToast(`Failed to load ${file.name}.`, 'error');
              }
          }
          await loadAssets();
          e.target.value = ''; 
          
          if (newIds.length > 0) {
              showToast(`Imported ${newIds.length} file(s)`, 'success');
          }

          if (newIds.length > 1) {
              setBatchEditIds(newIds);
              setBatchMetadata(prev => ({...prev, group: 'New Song'}));
          }
      }
  };

  const handleBatchSave = async () => {
      const updates = batchEditIds.map(async (id) => {
          const original = assets.find(a => a.id === id);
          if (original) {
              const updated = {
                  ...original,
                  group: batchMetadata.group,
                  bpm: batchMetadata.bpm,
                  key: batchMetadata.key || original.key,
                  type: batchMetadata.type as any
              };
              await saveAssetMetadata(updated);
          }
      });
      await Promise.all(updates);
      setBatchEditIds([]);
      loadAssets();
      showToast("Metadata saved", 'success');
  };

  const handleUrlImport = async () => {
      if (!urlInput) return;
      setIsUrlImporting(true);
      try {
          const response = await fetch(urlInput);
          if (!response.ok) throw new Error('Network response was not ok');
          const blob = await response.blob();
          
          if (!blob.type.startsWith('audio/')) {
              showToast('The URL did not return an audio file.', 'error');
              return;
          }

          const key = crypto.randomUUID();
          await saveAudioBlob(key, blob);
          
          const urlName = urlInput.split('/').pop()?.split('?')[0] || `Imported Audio`;
          
          const meta: AssetMetadata = {
              id: key,
              name: decodeURIComponent(urlName),
              type: 'oneshot',
              instrument: 'Other',
              tags: ['imported'],
              duration: 0,
              dateAdded: Date.now(),
              fileType: blob.type
          };
          await saveAssetMetadata(meta);
          setUrlInput('');
          setShowUrlInput(false);
          await loadAssets();
          showToast("Import successful", 'success');
      } catch (err) {
          showToast('Failed to import from URL.', 'error');
          console.error(err);
      } finally {
          setIsUrlImporting(false);
      }
  };

  const handleSaveMetadata = async () => {
      if (editingAsset) {
          await saveAssetMetadata(editingAsset);
          setAssets(prev => prev.map(a => a.id === editingAsset.id ? editingAsset : a));
          setEditingAsset(null);
          showToast("Saved asset metadata", 'success');
      }
  };

  const handleDeleteAsset = async (key: string) => {
    if (confirm('Delete this asset permanently?')) {
      await deleteAudioBlob(key);
      setAssets(prev => prev.filter(a => a.id !== key));
      showToast("Asset deleted", 'info');
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
        } else {
            showToast("Audio file missing", 'error');
        }
    } catch (e) {
        console.error("Preview failed", e);
        showToast("Could not play audio", 'error');
    }
  };

  const filteredAssets = assets.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.tags.some(t => t.includes(searchQuery.toLowerCase())) ||
                          (a.group && a.group.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchInst = filterInstrument ? a.instrument === filterInstrument : true;
      const matchType = filterType ? a.type === filterType : true;
      return matchSearch && matchInst && matchType;
  });

  return (
    <div className="flex flex-col h-full bg-studio-bg text-white overflow-hidden relative">
        {/* Header Tabs - Only show if full variant */}
        {variant === 'full' && (
            <div className="p-4 bg-studio-panel border-b border-zinc-800 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold tracking-tight text-zinc-100 hidden md:block">LIBRARY</h2>
                
                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 mx-auto md:mx-0">
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
        )}
        
        {/* Sidebar Header override */}
        {variant === 'sidebar' && (
             <div className="p-3 bg-studio-panel border-b border-zinc-800 shrink-0">
                 <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                     <FileAudio size={14} /> Library Assets
                 </h2>
             </div>
        )}
        
        {/* Projects Tab */}
        {activeTab === 'projects' && variant !== 'sidebar' && (
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                     <button 
                        onClick={() => { if(onCreateNewProject) onCreateNewProject(); loadProjects(); }}
                        className="bg-zinc-800/30 border border-zinc-700 border-dashed rounded-lg p-6 flex flex-col items-center justify-center space-y-2 hover:bg-zinc-800/50 hover:border-zinc-500 transition-all group min-h-[140px]"
                     >
                        <div className="p-3 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
                            <Plus size={24} className="text-zinc-400 group-hover:text-white" />
                        </div>
                        <span className="text-sm font-bold text-zinc-400 group-hover:text-white">New Project</span>
                     </button>

                     {loadingProjects ? (
                         <div className="col-span-full flex justify-center py-10 text-zinc-500">Loading projects...</div>
                     ) : projects.length === 0 ? null : (
                         projects.map(proj => (
                            <div key={proj.id} className={`bg-zinc-800/50 border rounded-lg p-4 flex flex-col justify-between group hover:bg-zinc-800 transition-colors ${currentProjectId === proj.id ? 'border-studio-accent/50 ring-1 ring-studio-accent/20' : 'border-zinc-700'}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                                            <FileMusic size={20} className="text-zinc-400" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="text-sm font-bold text-zinc-200 truncate">{proj.name || (proj.id === 'default-project' ? 'Demo Project' : `Project ${proj.id.slice(0,4)}...`)}</h3>
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
                                        onClick={() => handleDuplicateProject(proj)}
                                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"
                                        title="Duplicate Project"
                                    >
                                        <Copy size={16} />
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

        {/* Assets Tab */}
        {activeTab === 'assets' && (
            <div className="flex flex-col flex-1 overflow-hidden">
                <div className="p-3 bg-zinc-900 border-b border-zinc-800 space-y-3 shrink-0">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => fileInputRef.current?.click()} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 p-1.5 rounded-md" title="Upload Files">
                                <Upload size={16} />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" className="hidden" />
                            
                            <button onClick={() => setShowUrlInput(!showUrlInput)} className={`border border-zinc-700 text-zinc-300 p-1.5 rounded-md ${showUrlInput ? 'bg-zinc-700 text-white' : 'bg-zinc-800 hover:bg-zinc-700'}`} title="Import from URL">
                                <Globe size={16} />
                            </button>
                        </div>
                    </div>

                    {showUrlInput && (
                        <div className="flex gap-2 animate-in slide-in-from-top-2">
                            <input 
                                type="text" 
                                placeholder="https://example.com/audio.mp3" 
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                            />
                            <button 
                                onClick={handleUrlImport}
                                disabled={isUrlImporting || !urlInput}
                                className="bg-studio-accent text-white px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-50"
                            >
                                {isUrlImporting ? '...' : 'Import'}
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <select 
                            value={filterInstrument} 
                            onChange={(e) => setFilterInstrument(e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] rounded px-2 py-1 outline-none"
                        >
                            <option value="">All Instruments</option>
                            {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] rounded px-2 py-1 outline-none"
                        >
                            <option value="">All Types</option>
                            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 pb-24">
                    {loadingAssets ? (
                        <div className="flex justify-center py-10 text-zinc-500 text-xs">Loading library...</div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-600 space-y-2">
                            <AlertCircle size={32} />
                            <p className="text-xs">No assets found</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredAssets.map(asset => (
                                <div 
                                    key={asset.id} 
                                    draggable={true}
                                    onDragStart={(e) => {
                                        // Resume audio context on interaction for iOS compatibility
                                        audio.resumeContext();
                                        e.dataTransfer.setData('application/json', JSON.stringify(asset));
                                        e.dataTransfer.effectAllowed = 'copy';
                                        // Visual feedback styling
                                        e.currentTarget.classList.add('opacity-50');
                                    }}
                                    onDragEnd={(e) => {
                                        e.currentTarget.classList.remove('opacity-50');
                                    }}
                                    className="group bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md p-2 flex items-center gap-3 transition-colors cursor-grab active:cursor-grabbing select-none"
                                >
                                    <div className="text-zinc-600 group-hover:text-zinc-400">
                                        <GripHorizontal size={14} />
                                    </div>
                                    <button 
                                        onClick={() => handlePreview(asset)}
                                        className={`w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors ${previewing === asset.id ? 'bg-studio-accent text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                                    >
                                        {previewing === asset.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                    </button>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs text-zinc-200 truncate">{asset.name}</span>
                                            {asset.type === 'loop' && <span className="text-[9px] bg-blue-900/50 text-blue-300 px-1 rounded border border-blue-800">LOOP</span>}
                                            {asset.group && <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1 rounded truncate max-w-[80px]">{asset.group}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                                            <span>{asset.instrument}</span>
                                            {asset.bpm && <span>• {asset.bpm} BPM</span>}
                                            {asset.key && <span>• {asset.key}</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onAddAsset && (
                                            <button 
                                                onClick={() => onAddAsset(asset)}
                                                className="p-1.5 rounded hover:bg-green-900/30 text-zinc-500 hover:text-green-400"
                                                title="Add to Project"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setEditingAsset(asset)}
                                            className="p-1.5 rounded hover:bg-blue-900/30 text-zinc-500 hover:text-blue-400"
                                            title="Edit Metadata"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteAsset(asset.id)}
                                            className="p-1.5 rounded hover:bg-red-900/30 text-zinc-500 hover:text-red-400"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Batch Edit Modal */}
        {batchEditIds.length > 0 && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50">
                        <h3 className="font-bold text-zinc-200">Import {batchEditIds.length} Files</h3>
                        <button onClick={() => setBatchEditIds([])} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="p-4 space-y-4">
                        <p className="text-xs text-zinc-400">Add common metadata for these stems/loops.</p>
                        
                        <div>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Group / Song Name</label>
                            <input 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                value={batchMetadata.group}
                                onChange={e => setBatchMetadata({...batchMetadata, group: e.target.value})}
                                placeholder="e.g. Summer Hits Vol 1"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Type</label>
                                <select 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    value={batchMetadata.type}
                                    onChange={e => setBatchMetadata({...batchMetadata, type: e.target.value as any})}
                                >
                                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">BPM</label>
                                <input 
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    value={batchMetadata.bpm || ''}
                                    placeholder="Optional"
                                    onChange={e => setBatchMetadata({...batchMetadata, bpm: parseFloat(e.target.value) || undefined})}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-zinc-800 bg-zinc-800/30 flex justify-end gap-2">
                        <button onClick={() => setBatchEditIds([])} className="px-4 py-2 rounded text-xs font-bold text-zinc-400 hover:text-white">Skip</button>
                        <button onClick={handleBatchSave} className="px-4 py-2 rounded bg-studio-accent hover:bg-red-600 text-white text-xs font-bold flex items-center gap-2">
                            <Check size={14} /> Save All
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Single Edit Modal */}
        {editingAsset && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50">
                        <h3 className="font-bold text-zinc-200">Edit Asset</h3>
                        <button onClick={() => setEditingAsset(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Name</label>
                            <input 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                value={editingAsset.name}
                                onChange={e => setEditingAsset({...editingAsset, name: e.target.value})}
                            />
                        </div>
                        
                        <div>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Group / Song</label>
                            <input 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                value={editingAsset.group || ''}
                                onChange={e => setEditingAsset({...editingAsset, group: e.target.value})}
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Instrument</label>
                                <select 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    value={editingAsset.instrument}
                                    onChange={e => setEditingAsset({...editingAsset, instrument: e.target.value})}
                                >
                                    {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Type</label>
                                <select 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    value={editingAsset.type}
                                    onChange={e => setEditingAsset({...editingAsset, type: e.target.value as any})}
                                >
                                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">BPM</label>
                                <input 
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    value={editingAsset.bpm || ''}
                                    placeholder="Unknown"
                                    onChange={e => setEditingAsset({...editingAsset, bpm: parseFloat(e.target.value) || undefined})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Key</label>
                                <select 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    value={editingAsset.key || ''}
                                    onChange={e => setEditingAsset({...editingAsset, key: e.target.value})}
                                >
                                    <option value="">Unknown</option>
                                    {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                    {KEYS.map(k => <option key={k+'m'} value={k+'m'}>{k}m</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Tags (comma separated)</label>
                            <input 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                value={editingAsset.tags.join(', ')}
                                onChange={e => setEditingAsset({...editingAsset, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                            />
                        </div>
                    </div>
                    <div className="p-4 border-t border-zinc-800 bg-zinc-800/30 flex justify-end gap-2">
                        <button onClick={() => setEditingAsset(null)} className="px-4 py-2 rounded text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
                        <button onClick={handleSaveMetadata} className="px-4 py-2 rounded bg-studio-accent hover:bg-red-600 text-white text-xs font-bold flex items-center gap-2">
                            <Check size={14} /> Save
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Library;
