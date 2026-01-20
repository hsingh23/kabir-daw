
import React from 'react';
import { Edit2, Split, Trash2, Repeat, Copy, Palette } from 'lucide-react';
import { analytics } from '../services/analytics';
import { ProjectState, Clip } from '../types';
import { useToast } from './Toast';

const CLIP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#71717a'
];

interface ArrangerContextMenusProps {
    contextMenu: { x: number, y: number, clipId: string } | null;
    setContextMenu: (val: null) => void;
    autoContextMenu: { x: number, y: number, trackId: string, pointId: string } | null;
    setAutoContextMenu: (val: null) => void;
    trackContextMenu: { x: number, y: number, trackId: string } | null;
    setTrackContextMenu: (val: null) => void;
    project: ProjectState;
    updateProject: (recipe: any) => void; // Renamed from setProject
    onRenameClip?: (clipId: string, name: string) => void;
    onColorClip?: (clipId: string, color: string) => void;
    onRenameTrack?: (trackId: string, name: string) => void;
    onSplit: (clipId: string, time: number) => void;
    calculateSeekTime: (x: number, snap: boolean) => number;
    handleUpdateAutomationPoint: (trackId: string, pointId: string, updates: any) => void;
    handleDeleteAutomationPoint: (trackId: string, pointId: string) => void;
}

const ArrangerContextMenus: React.FC<ArrangerContextMenusProps> = ({
    contextMenu, setContextMenu,
    autoContextMenu, setAutoContextMenu,
    trackContextMenu, setTrackContextMenu,
    project, updateProject,
    onRenameClip, onColorClip, onRenameTrack, onSplit, calculateSeekTime,
    handleUpdateAutomationPoint, handleDeleteAutomationPoint
}) => {
    const { showToast } = useToast();

    const handleDuplicateClip = () => {
        if (!contextMenu) return;
        const clip = project.clips.find(c => c.id === contextMenu.clipId);
        if (clip) {
            const newClip: Clip = {
                ...clip,
                id: crypto.randomUUID(),
                start: clip.start + clip.duration,
                name: `${clip.name} (Copy)`
            };
            updateProject(p => ({ ...p, clips: [...p.clips, newClip] }));
            showToast("Clip duplicated", 'success');
            analytics.track('clip_action', { action: 'duplicate', source: 'context_menu' });
        }
        setContextMenu(null);
    };

    const handleDuplicateTrack = () => {
        if (!trackContextMenu) return;
        const track = project.tracks.find(t => t.id === trackContextMenu.trackId);
        if (track) {
            const newTrackId = crypto.randomUUID();
            const newTrack = { ...track, id: newTrackId, name: `${track.name} (Copy)` };
            const newClips = project.clips
                .filter(c => c.trackId === track.id)
                .map(c => ({ ...c, id: crypto.randomUUID(), trackId: newTrackId }));
            
            const trackIndex = project.tracks.findIndex(t => t.id === trackContextMenu.trackId);
            const newTracks = [...project.tracks];
            newTracks.splice(trackIndex + 1, 0, newTrack);
            
            updateProject(p => ({ ...p, tracks: newTracks, clips: [...p.clips, ...newClips] }));
            showToast("Track duplicated", 'success');
        }
        setTrackContextMenu(null);
    };

    const handleDeleteTrack = () => {
        if (!trackContextMenu) return;
        if (confirm("Delete track and all its clips?")) {
            updateProject(p => ({
                ...p,
                tracks: p.tracks.filter(t => t.id !== trackContextMenu.trackId),
                clips: p.clips.filter(c => c.trackId !== trackContextMenu.trackId)
            }));
            showToast("Track deleted", 'info');
        }
        setTrackContextMenu(null);
    };

    const handleColorTrack = (color: string) => {
        if (!trackContextMenu) return;
        updateProject(p => ({
            ...p,
            tracks: p.tracks.map(t => t.id === trackContextMenu.trackId ? { ...t, color } : t)
        }));
        setTrackContextMenu(null);
    }

    if (!contextMenu && !autoContextMenu && !trackContextMenu) return null;

    return (
        <>
            {/* Clip Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[90] bg-black/50 sm:bg-transparent" onClick={() => setContextMenu(null)} />
                    <div 
                        className="fixed sm:absolute z-[100] bg-zinc-900 sm:bg-zinc-800 border-t sm:border border-zinc-700 shadow-2xl sm:rounded-lg overflow-hidden
                                   bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto sm:right-auto sm:w-auto w-full
                                   rounded-t-2xl sm:rounded-t-lg
                                   animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 sm:duration-100"
                        style={{ 
                            top: window.innerWidth >= 640 ? Math.min(window.innerHeight - 300, contextMenu.y) : undefined,
                            left: window.innerWidth >= 640 ? Math.min(window.innerWidth - 200, contextMenu.x) : undefined
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col p-2 sm:p-1 gap-1">
                            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-2 sm:hidden" />
                            
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg flex items-center gap-3 sm:gap-2" onClick={() => { const newName = prompt("Rename Clip"); if(newName && onRenameClip) onRenameClip(contextMenu.clipId, newName); setContextMenu(null); }}>
                                <Edit2 size={16} className="sm:w-3 sm:h-3" /> Rename
                            </button>
                            
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg flex items-center gap-3 sm:gap-2" onClick={() => { 
                                const clip = project.clips.find(c => c.id === contextMenu.clipId); 
                                if (clip) { 
                                    updateProject(p => ({
                                        ...p,
                                        loopStart: clip.start,
                                        loopEnd: clip.start + clip.duration,
                                        isLooping: true
                                    }));
                                    showToast("Loop range set to clip", "success");
                                } 
                                setContextMenu(null); 
                            }}>
                                <Repeat size={16} className="sm:w-3 sm:h-3" /> Loop Clip
                            </button>

                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg flex items-center gap-3 sm:gap-2" onClick={handleDuplicateClip}>
                                <Copy size={16} className="sm:w-3 sm:h-3" /> Duplicate
                            </button>

                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg flex items-center gap-3 sm:gap-2" onClick={() => { const clip = project.clips.find(c => c.id === contextMenu.clipId); if (clip) { onSplit(clip.id, calculateSeekTime(contextMenu.x, false)); analytics.track('clip_action', { action: 'split', source: 'context_menu' }); } setContextMenu(null); }}>
                                <Split size={16} className="sm:w-3 sm:h-3" /> Split at Cursor
                            </button>
                            
                            <div className="h-px bg-zinc-700 my-1 mx-2 sm:mx-0" />
                            
                            <div className="px-4 py-2 sm:px-2 sm:py-1">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2 sm:mb-1 ml-1">Color</p>
                                <div className="flex flex-wrap gap-3 sm:gap-1 justify-start">
                                    {CLIP_COLORS.map(c => (
                                        <button key={c} className="w-8 h-8 sm:w-4 sm:h-4 rounded-full border border-transparent hover:border-white shadow-sm" style={{ backgroundColor: c }} onClick={() => { if(onColorClip) onColorClip(contextMenu.clipId, c); setContextMenu(null); }} />
                                    ))}
                                </div>
                            </div>
                            
                            <div className="h-px bg-zinc-700 my-1 mx-2 sm:mx-0" />
                            
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-red-400 hover:bg-red-900/30 rounded-lg flex items-center gap-3 sm:gap-2" onClick={() => { updateProject(p => ({...p, clips: p.clips.filter(c => c.id !== contextMenu.clipId)})); analytics.track('clip_action', { action: 'delete', source: 'context_menu' }); setContextMenu(null); }}>
                                <Trash2 size={16} className="sm:w-3 sm:h-3" /> Delete
                            </button>
                            
                            <button className="mt-2 w-full py-3 bg-zinc-800 rounded-lg text-sm font-bold text-zinc-400 sm:hidden" onClick={() => setContextMenu(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Track Context Menu */}
            {trackContextMenu && (
                <>
                    <div className="fixed inset-0 z-[90] bg-black/50 sm:bg-transparent" onClick={() => setTrackContextMenu(null)} />
                    <div 
                        className="fixed sm:absolute z-[100] bg-zinc-900 sm:bg-zinc-800 border-t sm:border border-zinc-700 shadow-2xl sm:rounded-lg overflow-hidden
                                   bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto sm:right-auto sm:w-auto w-full
                                   rounded-t-2xl sm:rounded-t-lg
                                   animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 sm:duration-100"
                        style={{ 
                            top: window.innerWidth >= 640 ? Math.min(window.innerHeight - 200, trackContextMenu.y) : undefined, 
                            left: window.innerWidth >= 640 ? Math.min(window.innerWidth - 200, trackContextMenu.x) : undefined 
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col p-2 sm:p-1 gap-1">
                            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-2 sm:hidden" />
                            
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg flex items-center gap-3 sm:gap-2" onClick={() => { 
                                const current = project.tracks.find(t => t.id === trackContextMenu.trackId)?.name || '';
                                const newName = prompt("Rename Track", current); 
                                if(newName && onRenameTrack) onRenameTrack(trackContextMenu.trackId, newName); 
                                setTrackContextMenu(null); 
                            }}>
                                <Edit2 size={16} className="sm:w-3 sm:h-3" /> Rename
                            </button>

                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg flex items-center gap-3 sm:gap-2" onClick={handleDuplicateTrack}>
                                <Copy size={16} className="sm:w-3 sm:h-3" /> Duplicate
                            </button>

                            <div className="px-4 py-2 sm:px-2 sm:py-1">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2 sm:mb-1 ml-1">Color</p>
                                <div className="flex flex-wrap gap-3 sm:gap-1 justify-start">
                                    {CLIP_COLORS.map(c => (
                                        <button key={c} className="w-8 h-8 sm:w-4 sm:h-4 rounded-full border border-transparent hover:border-white shadow-sm" style={{ backgroundColor: c }} onClick={() => handleColorTrack(c)} />
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-zinc-700 my-1 mx-2 sm:mx-0" />

                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-red-400 hover:bg-red-900/30 rounded-lg flex items-center gap-3 sm:gap-2" onClick={handleDeleteTrack}>
                                <Trash2 size={16} className="sm:w-3 sm:h-3" /> Delete Track
                            </button>

                            <button className="mt-2 w-full py-3 bg-zinc-800 rounded-lg text-sm font-bold text-zinc-400 sm:hidden" onClick={() => setTrackContextMenu(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Automation Context Menu */}
            {autoContextMenu && (
                <>
                    <div className="fixed inset-0 z-[90] bg-black/50 sm:bg-transparent" onClick={() => setAutoContextMenu(null)} />
                    <div 
                        className="fixed sm:absolute z-[100] bg-zinc-900 sm:bg-zinc-800 border-t sm:border border-zinc-700 shadow-2xl sm:rounded-lg overflow-hidden
                                   bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto sm:right-auto sm:w-auto w-full
                                   rounded-t-2xl sm:rounded-t-lg
                                   animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 sm:duration-100"
                        style={{ 
                            top: window.innerWidth >= 640 ? Math.min(window.innerHeight - 150, autoContextMenu.y) : undefined, 
                            left: window.innerWidth >= 640 ? Math.min(window.innerWidth - 140, autoContextMenu.x) : undefined 
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col p-2 sm:p-1 gap-1">
                            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-2 sm:hidden" />
                            
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg" onClick={() => { handleUpdateAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId, { curve: 'linear' }); setAutoContextMenu(null); }}>
                                Set Linear
                            </button>
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg" onClick={() => { handleUpdateAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId, { curve: 'exponential' }); setAutoContextMenu(null); }}>
                                Set Exponential
                            </button>
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-lg" onClick={() => { handleUpdateAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId, { curve: 'step' }); setAutoContextMenu(null); }}>
                                Set Step
                            </button>
                            <div className="h-px bg-zinc-700 my-1 mx-2 sm:mx-0" />
                            <button className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-red-400 hover:bg-red-900/30 rounded-lg flex items-center gap-3 sm:gap-2" onClick={() => { handleDeleteAutomationPoint(autoContextMenu.trackId, autoContextMenu.pointId); setAutoContextMenu(null); }}>
                                <Trash2 size={16} className="sm:w-3 sm:h-3" /> Delete Point
                            </button>
                            <button className="mt-2 w-full py-3 bg-zinc-800 rounded-lg text-sm font-bold text-zinc-400 sm:hidden" onClick={() => setAutoContextMenu(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default ArrangerContextMenus;
