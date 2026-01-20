
import React from 'react';
import { Edit2, Split, Trash2 } from 'lucide-react';
import { analytics } from '../services/analytics';
import { ProjectState } from '../types';

const CLIP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#71717a'
];

interface ArrangerContextMenusProps {
    contextMenu: { x: number, y: number, clipId: string } | null;
    setContextMenu: (val: null) => void;
    autoContextMenu: { x: number, y: number, trackId: string, pointId: string } | null;
    setAutoContextMenu: (val: null) => void;
    project: ProjectState;
    setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
    onRenameClip?: (clipId: string, name: string) => void;
    onColorClip?: (clipId: string, color: string) => void;
    onSplit: (clipId: string, time: number) => void;
    calculateSeekTime: (x: number, snap: boolean) => number;
    handleUpdateAutomationPoint: (trackId: string, pointId: string, updates: any) => void;
    handleDeleteAutomationPoint: (trackId: string, pointId: string) => void;
}

const ArrangerContextMenus: React.FC<ArrangerContextMenusProps> = ({
    contextMenu, setContextMenu,
    autoContextMenu, setAutoContextMenu,
    project, setProject,
    onRenameClip, onColorClip, onSplit, calculateSeekTime,
    handleUpdateAutomationPoint, handleDeleteAutomationPoint
}) => {
    if (!contextMenu && !autoContextMenu) return null;

    return (
        <>
            {/* Clip Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setContextMenu(null)} />
                    <div 
                        className="fixed bg-zinc-800 border border-zinc-700 shadow-2xl rounded-lg p-1 z-[100] min-w-[160px] animate-in zoom-in-95 duration-100"
                        style={{ top: Math.min(window.innerHeight - 200, contextMenu.y), left: Math.min(window.innerWidth - 160, contextMenu.x) }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white rounded flex items-center gap-2" onClick={() => { const newName = prompt("Rename Clip"); if(newName && onRenameClip) onRenameClip(contextMenu.clipId, newName); setContextMenu(null); }}>
                            <Edit2 size={12} /> Rename
                        </button>
                        <button className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white rounded flex items-center gap-2" onClick={() => { const clip = project.clips.find(c => c.id === contextMenu.clipId); if (clip) { onSplit(clip.id, calculateSeekTime(contextMenu.x, false)); analytics.track('clip_action', { action: 'split', source: 'context_menu' }); } setContextMenu(null); }}>
                            <Split size={12} /> Split at Cursor
                        </button>
                        <div className="h-px bg-zinc-700 my-1" />
                        <div className="px-2 py-1">
                            <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1 ml-1">Color</p>
                            <div className="flex flex-wrap gap-1">
                                {CLIP_COLORS.map(c => (
                                    <button key={c} className="w-4 h-4 rounded-full border border-transparent hover:border-white" style={{ backgroundColor: c }} onClick={() => { if(onColorClip) onColorClip(contextMenu.clipId, c); setContextMenu(null); }} />
                                ))}
                            </div>
                        </div>
                        <div className="h-px bg-zinc-700 my-1" />
                        <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 rounded flex items-center gap-2" onClick={() => { setProject(p => ({...p, clips: p.clips.filter(c => c.id !== contextMenu.clipId)})); analytics.track('clip_action', { action: 'delete', source: 'context_menu' }); setContextMenu(null); }}>
                            <Trash2 size={12} /> Delete
                        </button>
                    </div>
                </>
            )}

            {/* Automation Context Menu */}
            {autoContextMenu && (
                <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setAutoContextMenu(null)} />
                    <div 
                        className="fixed bg-zinc-800 border border-zinc-700 shadow-2xl rounded-lg p-1 z-[100] min-w-[140px] animate-in zoom-in-95 duration-100"
                        style={{ top: Math.min(window.innerHeight - 150, autoContextMenu.y), left: Math.min(window.innerWidth - 140, autoContextMenu.x) }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white rounded" onClick={() => { handleUpdateAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId, { curve: 'linear' }); setAutoContextMenu(null); }}>
                            Set Linear
                        </button>
                        <button className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white rounded" onClick={() => { handleUpdateAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId, { curve: 'exponential' }); setAutoContextMenu(null); }}>
                            Set Exponential
                        </button>
                        <button className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white rounded" onClick={() => { handleUpdateAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId, { curve: 'step' }); setAutoContextMenu(null); }}>
                            Set Step
                        </button>
                        <div className="h-px bg-zinc-700 my-1" />
                        <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 rounded flex items-center gap-2" onClick={() => { handleDeleteAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId); setAutoContextMenu(null); }}>
                            <Trash2 size={12} /> Delete Point
                        </button>
                    </div>
                </>
            )}
        </>
    );
};

export default ArrangerContextMenus;
