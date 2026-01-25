
import React from 'react';
import { ProjectState, ToolMode } from '../types';
import { 
    MousePointer2, Hand, Scissors, Trash2, TrendingUp,
    AlignStartVertical, ZoomOut, ZoomIn, Minimize2, 
    ChevronLeft, ChevronRight, FolderOpen, Magnet 
} from 'lucide-react';
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
    const { project } = useProject();

    const tools = [
        { id: ToolMode.POINTER, icon: MousePointer2, label: 'Pointer' },
        { id: ToolMode.HAND, icon: Hand, label: 'Hand' },
        { id: ToolMode.SPLIT, icon: Scissors, label: 'Split' },
        { id: ToolMode.ERASER, icon: Trash2, label: 'Erase' },
        { id: ToolMode.AUTOMATION, icon: TrendingUp, label: 'Auto' },
    ];

    return (
      <div className="h-10 border-b border-black bg-[#2a2a2a] flex items-center px-3 justify-between shrink-0 z-30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3)]">
         {/* Left: Toggles */}
         <div className="flex items-center gap-2 shrink-0">
            <button 
                onClick={() => setIsLibraryOpen(!isLibraryOpen)} 
                className={`w-7 h-7 flex items-center justify-center rounded transition-all ${isLibraryOpen ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`} 
                title="Toggle Library"
            >
                <FolderOpen size={16} />
            </button>

            <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 transition-all hidden sm:flex" 
                title={isSidebarCollapsed ? "Expand Headers" : "Collapse Headers"}
            >
                {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
         </div>

         {/* Center: Tools */}
         <div className="flex bg-black/40 rounded p-0.5 gap-0.5">
            {tools.map((t) => {
                const isActive = tool === t.id;
                const Icon = t.icon;
                return (
                    <button
                        key={t.id}
                        onClick={() => setTool(t.id)}
                        className={`
                            relative w-8 h-6 rounded flex items-center justify-center transition-all
                            ${isActive ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                        `}
                        title={t.label}
                    >
                        <Icon size={14} />
                    </button>
                );
            })}
         </div>

         {/* Right: Snap, Quantize, Zoom */}
         <div className="flex items-center gap-3 shrink-0">
            
            {/* Dynamic Actions */}
            {selectedClipIds.length > 0 && (
                <div className="flex items-center gap-1 bg-black/20 rounded px-1 animate-in fade-in">
                    <button onClick={handleQuantize} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-zinc-300" title="Quantize">
                        <AlignStartVertical size={14} />
                    </button>
                    <select 
                        value={quantizeStrength} 
                        onChange={(e) => setQuantizeStrength(Number(e.target.value))} 
                        className="bg-transparent text-[10px] font-bold text-zinc-400 w-10 text-center outline-none cursor-pointer"
                    >
                        <option value="100">100%</option>
                        <option value="75">75%</option>
                        <option value="50">50%</option>
                    </select>
                </div>
            )}

            {/* Snap */}
            <div className="hidden md:flex items-center gap-1 border-r border-zinc-700 pr-3">
                <Magnet size={14} className={snapGrid > 0 ? "text-studio-accent" : "text-zinc-600"} />
                <select 
                    value={snapGrid} 
                    onChange={(e) => setSnapGrid(parseFloat(e.target.value))} 
                    className="bg-transparent text-xs font-medium text-zinc-300 outline-none appearance-none w-10 text-center cursor-pointer hover:text-white"
                >
                    <option value="0">Off</option>
                    <option value={numerator}>Bar</option>
                    <option value="1">1/4</option>
                    <option value="0.5">1/8</option>
                    <option value="0.25">1/16</option>
                </select>
            </div>

            {/* Zoom Controls */}
            <div className="hidden lg:flex items-center gap-0.5 text-zinc-400">
                 <button onClick={() => setZoom(Math.max(10, zoom * 0.8))} className="p-1 hover:text-white"><ZoomOut size={14} /></button>
                 {/* Slider Placeholder or Number */}
                 <button onClick={onZoomToFit} className="p-1 hover:text-white"><Minimize2 size={14} /></button>
                 <button onClick={() => setZoom(Math.min(400, zoom * 1.2))} className="p-1 hover:text-white"><ZoomIn size={14} /></button>
            </div>
         </div>
      </div>
    );
};

export default ArrangerToolbar;
