
import React from 'react';
import { ProjectState, ToolMode } from '../types';
import { MousePointer, Hand, Scissors, Trash2, TrendingUp, Split, AlignStartVertical, Grid, ZoomOut, ZoomIn, Minimize, ChevronsUpDown, Music2, ChevronLeft, ChevronRight, Repeat, FolderOpen } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface ArrangerToolbarProps {
    tool: ToolMode;
    setTool: (mode: ToolMode) => void;
    snapGrid: number;
    setSnapGrid: (val: number) => void;
    quantizeStrength: number;
    setQuantizeStrength: (val: number) => void;
    zoom: number;
    setZoom: (val: number) => void;
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: (val: boolean) => void;
    isLibraryOpen: boolean;
    setIsLibraryOpen: (val: boolean) => void;
    showInstruments: boolean;
    setShowInstruments: (val: boolean) => void;
    selectedClipIds: string[];
    onSplitAtPlayhead?: () => void;
    onZoomToFit: () => void;
    toggleTrackHeight: () => void;
    numerator: number;
    handleQuantize: () => void;
}

const ArrangerToolbar: React.FC<ArrangerToolbarProps> = ({
    tool, setTool, snapGrid, setSnapGrid,
    quantizeStrength, setQuantizeStrength, zoom, setZoom,
    isSidebarCollapsed, setIsSidebarCollapsed, 
    isLibraryOpen, setIsLibraryOpen,
    showInstruments, setShowInstruments,
    selectedClipIds, onSplitAtPlayhead, onZoomToFit, toggleTrackHeight, numerator, handleQuantize
}) => {
    const { project, updateProject } = useProject();

    return (
      <div className="h-10 border-b border-zinc-800 bg-studio-panel flex items-center px-3 justify-between shrink-0 z-30 overflow-x-auto no-scrollbar">
         <div className="flex space-x-2 items-center min-w-max">
            {/* Library Toggle */}
            <button 
                onClick={() => setIsLibraryOpen(!isLibraryOpen)} 
                className={`p-1.5 rounded transition-all border border-zinc-800 ${isLibraryOpen ? 'bg-studio-accent text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`} 
                title="Toggle Library"
            >
                <FolderOpen size={14} />
            </button>

            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 rounded transition-all bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800" title={isSidebarCollapsed ? "Expand Headers" : "Collapse Headers"}>
                {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <div className="flex bg-zinc-900 rounded p-0.5 space-x-0.5 shrink-0 border border-zinc-800">
                <button onClick={() => setTool(ToolMode.POINTER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.POINTER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Pointer (Edit/Move)"><MousePointer size={14} /></button>
                <button onClick={() => setTool(ToolMode.HAND)} className={`p-1.5 rounded transition-all ${tool === ToolMode.HAND ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Hand (Scroll/Safe)"><Hand size={14} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded transition-all ${tool === ToolMode.SPLIT ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Split"><Scissors size={14} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.ERASER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Erase"><Trash2 size={14} /></button>
                <button onClick={() => setTool(ToolMode.AUTOMATION)} className={`p-1.5 rounded transition-all ${tool === ToolMode.AUTOMATION ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Automation"><TrendingUp size={14} /></button>
            </div>
            
            {onSplitAtPlayhead && (
                <button onClick={onSplitAtPlayhead} className="hidden md:flex items-center space-x-1 px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors" title="Split at Playhead (Ctrl+B)">
                    <Split size={12} />
                    <span>Split</span>
                </button>
            )}

            {selectedClipIds.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 bg-zinc-900 rounded px-1 border border-zinc-800">
                    <button onClick={handleQuantize} className="flex items-center space-x-1 px-2 py-1 hover:text-white text-zinc-400 transition-colors" title={`Quantize Selection (${quantizeStrength}%)`}>
                        <AlignStartVertical size={12} />
                        <span className="hidden sm:inline">Q</span>
                    </button>
                    <select value={quantizeStrength} onChange={(e) => setQuantizeStrength(Number(e.target.value))} className="bg-transparent text-zinc-500 text-[10px] w-12 outline-none">
                        <option value="100">100%</option>
                        <option value="50">50%</option>
                        <option value="25">25%</option>
                    </select>
                </div>
            )}

            <div className="w-px h-5 bg-zinc-800 shrink-0 mx-1 hidden sm:block" />
            <div className="hidden sm:flex items-center space-x-1 bg-zinc-900 rounded px-2 h-7 border border-zinc-800">
                <Grid size={12} className="text-zinc-500" />
                <select value={snapGrid} onChange={(e) => setSnapGrid(parseFloat(e.target.value))} className="bg-transparent text-zinc-300 outline-none text-[10px] w-14 appearance-none">
                    <option value="0">Off</option>
                    <option value={numerator}>Bar</option>
                    <option value="1">1/4</option>
                    <option value="0.5">1/8</option>
                    <option value="0.25">1/16</option>
                </select>
            </div>
             <button onClick={() => updateProject((p: ProjectState) => ({...p, isLooping: !p.isLooping}))} className={`p-1.5 rounded transition-all ${project.isLooping ? 'bg-studio-accent text-white' : 'text-zinc-500'}`} title="Toggle Loop (L)">
                <Repeat size={14} />
             </button>
         </div>

         <div className="flex items-center space-x-2 shrink-0">
             <div className="flex items-center space-x-1 bg-zinc-900 rounded px-2 h-7 border border-zinc-800 hidden lg:flex">
                 <ZoomOut size={12} className="text-zinc-500 cursor-pointer" onClick={() => setZoom(Math.max(10, zoom * 0.8))} />
                 <span className="text-[9px] text-zinc-400 w-8 text-center">{Math.round(zoom)}%</span>
                 <ZoomIn size={12} className="text-zinc-500 cursor-pointer" onClick={() => setZoom(Math.min(400, zoom * 1.2))} />
                 <button onClick={onZoomToFit} className="ml-1 text-zinc-500 hover:text-white" title="Zoom to Fit">
                     <Minimize size={12} />
                 </button>
                 <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                 <button onClick={toggleTrackHeight} className="text-zinc-500 hover:text-white" title="Toggle Track Height">
                     <ChevronsUpDown size={12} />
                 </button>
             </div>
             
             <button onClick={() => setShowInstruments(!showInstruments)} className={`p-1.5 rounded transition-all flex items-center gap-1 ${showInstruments ? 'bg-studio-accent text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`} title="Backing Instruments">
                <Music2 size={16} />
                <span className="text-[10px] font-bold hidden sm:inline">Backing</span>
             </button>
         </div>
      </div>
    );
};

export default ArrangerToolbar;
