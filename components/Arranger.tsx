
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { ProjectState, ToolMode, Track, AssetMetadata, AutomationPoint } from '../types';
import Playhead from './Playhead'; 
import Ruler from './Ruler'; 
import TrackLane from './TrackLane'; 
import ArrangerTrack from './ArrangerTrack';
import StepSequencer from './StepSequencer';
import DroneSynth from './DroneSynth';
import ArrangerContextMenus from './ArrangerContextMenus';
import ArrangerGrid from './ArrangerGrid';
import ArrangerToolbar from './ArrangerToolbar';
import ArrangerMiniMap from './ArrangerMiniMap'; 
import Library from './Library';
import { useArrangerInteraction } from '../hooks/useArrangerInteraction';
import { useTimelineMath } from '../hooks/useTimelineMath';
import { Plus, Mic, Piano, Layers, X, FileAudio } from 'lucide-react';
import { analytics } from '../services/analytics';
import { getAllAssetsMetadata } from '../services/db';
import { createTrack } from '../services/templates';
import { HEADER_WIDTH_DESKTOP, HEADER_WIDTH_TABLET, HEADER_WIDTH_MOBILE, TRACK_HEIGHT_DEFAULT, TRACK_HEIGHT_COMPACT } from '../constants/layout';
import { useProject } from '../contexts/ProjectContext';

interface ArrangerProps {
  currentTime: number; 
  isPlaying: boolean;
  isRecording: boolean;
  recordingStartTime?: number;
  onPlayPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onSeek: (time: number) => void;
  onSplit: (clipId: string, time: number) => void;
  onSplitAtPlayhead?: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
  selectedClipIds: string[];
  onSelectClip: (ids: string[]) => void;
  onOpenInspector: (trackId: string) => void;
  onOpenClipInspector?: (clipId: string) => void;
  onMoveTrack?: (from: number, to: number) => void;
  onRenameClip?: (clipId: string, name: string) => void;
  onColorClip?: (clipId: string, color: string) => void;
  onRenameTrack?: (trackId: string, name: string) => void;
  autoScroll?: boolean;
  onDropAsset?: (trackId: string, time: number, asset: AssetMetadata) => void;
  commitTransaction: () => void;
}

const Arranger: React.FC<ArrangerProps> = ({ 
    currentTime, isPlaying, isRecording, recordingStartTime = 0,
    onPlayPause, onStop, onRecord, onSeek, onSplit, onSplitAtPlayhead, zoom, setZoom,
    selectedTrackId, onSelectTrack, selectedClipIds, onSelectClip, onOpenInspector, onOpenClipInspector,
    onMoveTrack, onRenameClip, onColorClip, onRenameTrack, autoScroll = true, onDropAsset, commitTransaction
}) => {
  const { project, updateProject } = useProject();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackHeaderRef = useRef<HTMLDivElement>(null);
  
  const snapLineRef = useRef<HTMLDivElement>(null);
  const snapLabelRef = useRef<HTMLDivElement>(null);
  const selectionBoxRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = React.useState<ToolMode>(ToolMode.POINTER);
  const [multiSelectMode, setMultiSelectMode] = React.useState(false);
  const [snapGrid, setSnapGrid] = React.useState(1); 
  const [quantizeStrength, setQuantizeStrength] = React.useState(100);
  const [trackHeight, setTrackHeight] = React.useState(TRACK_HEIGHT_DEFAULT);
  const [isCompactHeader, setIsCompactHeader] = React.useState(false);
  const [headerWidth, setHeaderWidth] = React.useState(HEADER_WIDTH_DESKTOP);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Library Sidebar State
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Instrument Drawer State
  const [showInstruments, setShowInstruments] = useState(false);
  
  // Add Track Menu
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  // Virtualization State
  const [scrollLeft, setScrollLeft] = useState(0);
  const lastScrollLeft = useRef(0);
  const [containerWidth, setContainerWidth] = useState(1000); 
  
  // Local asset cache for drag/drop lookup
  const [cachedAssets, setCachedAssets] = useState<AssetMetadata[]>([]);
  
  // Automation & Track Context Menu State
  const [autoContextMenu, setAutoContextMenu] = useState<{ x: number, y: number, trackId: string, pointId: string } | null>(null);
  const [trackContextMenu, setTrackContextMenu] = useState<{ x: number, y: number, trackId: string } | null>(null);

  const refreshAssets = useCallback(() => {
      getAllAssetsMetadata().then(setCachedAssets);
  }, []);

  useEffect(() => {
      refreshAssets();
  }, [refreshAssets]);

  const { 
      secondsPerBeat, 
      secondsPerBar, 
      pixelsPerBar, 
      pixelsPerTick, 
      timeToPixels, 
      pixelsToTime, 
      snapToGrid, 
      numerator 
  } = useTimelineMath(zoom, project.bpm, project.timeSignature || [4, 4]);
  
  const totalBars = Math.max(50, Math.ceil((project.loopEnd + 20) / secondsPerBar));
  const totalWidth = totalBars * pixelsPerBar;

  const {
      dragState, loopDrag, trackDrag, isScrubbing, contextMenu, setContextMenu,
      handleClipPointerDown, handleTrackDragStart, handleGlobalPointerDown, 
      handleGlobalPointerUp, handleWheel, calculateSeekTime,
      setIsScrubbing, setLoopDrag, handleGlobalPointerMove
  } = useArrangerInteraction({
      project, updateProject, zoom, setZoom, tool, snapGrid, scrollContainerRef, headerWidth, trackHeight,
      onSelectTrack, onSelectClip, selectedClipIds, onSplit, onSeek, onMoveTrack, multiSelectMode, secondsPerBeat,
      snapLineRef, selectionBoxRef, snapLabelRef, commitTransaction
  });

  // Calculate visible range for virtualization
  const visibleStartTime = Math.max(0, pixelsToTime(scrollLeft));
  const visibleDuration = pixelsToTime(containerWidth);
  const visibleEndTime = visibleStartTime + visibleDuration;
  const renderStartTime = Math.max(0, visibleStartTime - 5); 
  const renderEndTime = visibleEndTime + 5;

  // Mini Map Calculations
  const projectDuration = Math.max(
      project.loopEnd + 4, 
      ...project.clips.map(c => c.start + c.duration + 4),
      60 // Minimum 60s
  );

  const clipsByTrack = useMemo(() => {
      const map = new Map<string, any[]>();
      project.tracks.forEach(t => map.set(t.id, []));
      project.clips.forEach(c => {
          // Filter invisible clips
          const clipEnd = c.start + c.duration;
          if (clipEnd < renderStartTime || c.start > renderEndTime) {
              return;
          }
          if (map.has(c.trackId)) {
              map.get(c.trackId)?.push(c);
          }
      });
      return map;
  }, [project.clips, project.tracks, renderStartTime, renderEndTime]);

  React.useEffect(() => {
    const handleResize = () => {
        const w = window.innerWidth;
        if (w < 640) {
            setHeaderWidth(HEADER_WIDTH_MOBILE); 
            setIsCompactHeader(true);
            setIsSidebarCollapsed(true);
            if (!isMobile) {
                // Auto switch to Hand tool on mobile for better scrolling experience
                setTool(ToolMode.HAND);
            }
            setIsMobile(true);
        } else if (w < 1024) {
            setHeaderWidth(HEADER_WIDTH_TABLET);
            setIsCompactHeader(false);
            setIsSidebarCollapsed(false);
            setIsMobile(false);
        } else {
            setHeaderWidth(HEADER_WIDTH_DESKTOP);
            setIsCompactHeader(false);
            setIsSidebarCollapsed(false);
            setIsMobile(false);
        }
        
        if (scrollContainerRef.current) {
            setContainerWidth(scrollContainerRef.current.clientWidth);
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]); 

  const updateTrackInArranger = (id: string, updates: Partial<Track>) => {
    updateProject((prev: ProjectState) => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const handleZoomToFit = () => {
      if (project.clips.length === 0 || !scrollContainerRef.current) return;
      const maxTime = Math.max(...project.clips.map(c => c.start + c.duration), project.loopEnd);
      const containerWidth = scrollContainerRef.current.clientWidth - 50; 
      const newZoom = Math.max(10, Math.min(400, containerWidth / maxTime));
      setZoom(newZoom);
  };

  const handleQuantize = () => {
      if (selectedClipIds.length === 0) return;
      const gridValue = snapGrid > 0 ? snapGrid * secondsPerBeat : 0.25; // in seconds
      const strength = quantizeStrength / 100;
      
      commitTransaction();
      updateProject((prev: ProjectState) => ({
          ...prev,
          clips: prev.clips.map(c => {
              if (selectedClipIds.includes(c.id)) {
                  const targetStart = Math.round(c.start / gridValue) * gridValue;
                  const newStart = c.start + (targetStart - c.start) * strength;
                  return { ...c, start: newStart };
              }
              return c;
          })
      }));
      analytics.track('clip_action', { action: 'quantize', count: selectedClipIds.length, strength: quantizeStrength });
  };

  const handleTimelineDrop = (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const assetId = e.dataTransfer.getData('application/x-pocketstudio-asset-id');
      if (assetId && onDropAsset && scrollContainerRef.current) {
          const asset = cachedAssets.find(a => a.id === assetId);
          if (asset) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const offsetX = e.clientX - rect.left;
              const time = Math.max(0, pixelsToTime(offsetX));
              const gridValue = snapGrid > 0 ? snapGrid : 0;
              const snappedTime = snapToGrid(time, gridValue);
              onDropAsset(trackId, snappedTime, asset);
              
              // On mobile, auto-close library after drop to see timeline
              if (isMobile) setIsLibraryOpen(false);
          }
      }
  };

  const handleAddTrack = (type: 'audio' | 'instrument' = 'audio') => {
      const newTrack = createTrack(type, type === 'instrument' ? `Synth ${project.tracks.length + 1}` : `Track ${project.tracks.length + 1}`);
      updateProject((p: ProjectState) => ({...p, tracks: [...p.tracks, newTrack]}));
      setShowAddMenu(false);
      analytics.track('mixer_action', { action: 'add_track' });
  };

  const handleAddAutomationPoint = (trackId: string, time: number, value: number) => {
      commitTransaction();
      updateProject((prev: ProjectState) => ({
          ...prev,
          tracks: prev.tracks.map(t => {
              if (t.id === trackId) {
                  const points = t.automation?.volume ? [...t.automation.volume] : [];
                  points.push({ id: crypto.randomUUID(), time, value, curve: 'linear' });
                  return {
                      ...t,
                      automation: { ...t.automation, volume: points.sort((a, b) => a.time - b.time) }
                  };
              }
              return t;
          })
      }));
  };

  const handleUpdateAutomationPoint = (trackId: string, pointId: string, updates: Partial<AutomationPoint>) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          tracks: prev.tracks.map(t => {
              if (t.id === trackId && t.automation?.volume) {
                  return {
                      ...t,
                      automation: {
                          ...t.automation,
                          volume: t.automation.volume.map(p => p.id === pointId ? { ...p, ...updates } : p).sort((a,b) => a.time - b.time)
                      }
                  };
              }
              return t;
          })
      }));
  };

  const handleDeleteAutomationPoint = (trackId: string, pointId: string) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          tracks: prev.tracks.map(t => {
              if (t.id === trackId && t.automation?.volume) {
                  return {
                      ...t,
                      automation: {
                          ...t.automation,
                          volume: t.automation.volume.filter(p => p.id !== pointId)
                      }
                  };
              }
              return t;
          })
      }));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollLeft, scrollTop } = e.currentTarget;
      if (Math.abs(scrollLeft - lastScrollLeft.current) > 20) { // Throttled update
          setScrollLeft(scrollLeft);
          lastScrollLeft.current = scrollLeft;
      }
      
      // Sync track header vertical scroll
      if (trackHeaderRef.current) {
          trackHeaderRef.current.scrollTop = scrollTop;
      }
  };

  const currentHeaderWidth = isSidebarCollapsed ? 50 : headerWidth; // 50px for collapsed icon only mode

  const toggleTrackHeight = () => {
      setTrackHeight(h => h === TRACK_HEIGHT_DEFAULT ? TRACK_HEIGHT_COMPACT : TRACK_HEIGHT_DEFAULT);
  };

  return (
    <div 
        className="flex flex-col h-full bg-[#1e1e1e] text-xs select-none touch-none overflow-hidden"
        onPointerDown={handleGlobalPointerDown}
        onPointerMove={(e) => handleGlobalPointerMove(e)}
        onPointerUp={handleGlobalPointerUp}
        onPointerCancel={handleGlobalPointerUp}
        onContextMenu={e => e.preventDefault()}
        onClick={() => {
            setContextMenu(null);
            setAutoContextMenu(null);
            setTrackContextMenu(null);
            setShowAddMenu(false);
        }}
    >
      <ArrangerToolbar 
          tool={tool} setTool={setTool}
          snapGrid={snapGrid} setSnapGrid={setSnapGrid}
          quantizeStrength={quantizeStrength} setQuantizeStrength={setQuantizeStrength}
          zoom={zoom} setZoom={setZoom}
          isSidebarCollapsed={isSidebarCollapsed} setIsSidebarCollapsed={setIsSidebarCollapsed}
          isLibraryOpen={isLibraryOpen} setIsLibraryOpen={setIsLibraryOpen}
          showInstruments={showInstruments} setShowInstruments={setShowInstruments}
          selectedClipIds={selectedClipIds}
          onSplitAtPlayhead={onSplitAtPlayhead}
          onZoomToFit={handleZoomToFit}
          toggleTrackHeight={toggleTrackHeight}
          numerator={numerator}
          handleQuantize={handleQuantize}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Library Sidebar (Responsive Overlay on Mobile) */}
        {isLibraryOpen && (
            <div className={`
                border-r border-zinc-800 bg-[#1a1a1a] flex flex-col z-30 transition-all duration-300
                ${isMobile ? 'fixed inset-y-0 left-0 w-64 shadow-2xl' : 'w-64 shrink-0 relative'}
            `}>
                {isMobile && (
                    <div className="p-3 border-b border-zinc-700 flex justify-end bg-zinc-900">
                        <button onClick={() => setIsLibraryOpen(false)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
                            <X size={20} />
                        </button>
                    </div>
                )}
                <Library 
                    variant="sidebar" 
                    currentProjectId={project.id}
                    onAssetsChange={refreshAssets}
                    onAddAsset={(asset) => onDropAsset && onDropAsset(project.tracks[0]?.id, currentTime, asset)}
                />
            </div>
        )}
        
        {/* Mobile Overlay Backdrop */}
        {isLibraryOpen && isMobile && (
            <div 
                className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm"
                onClick={() => setIsLibraryOpen(false)}
            />
        )}

        {/* Track Headers */}
        <div className="flex-none bg-[#252525] border-r border-black z-20 flex flex-col shadow-[2px_0_10px_rgba(0,0,0,0.3)] transition-all duration-300" style={{ width: currentHeaderWidth }}>
             <div className="h-8 border-b border-zinc-900 bg-[#2a2a2a] flex items-center px-2 justify-between relative shadow-sm shrink-0">
                 {!isSidebarCollapsed && <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TRACKS</span>}
                 {/* Desktop Add Button */}
                 <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); }} className={`text-zinc-400 hover:text-white mx-auto ${isSidebarCollapsed ? '' : 'hidden sm:block'}`} title="Add Track">
                    <Plus size={14} />
                 </button>

                 {showAddMenu && (
                     <div className="absolute top-8 left-2 bg-[#333] border border-black rounded shadow-xl z-50 flex flex-col min-w-[140px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                         <button onClick={(e) => { e.stopPropagation(); handleAddTrack('audio'); }} className="px-3 py-2 text-left text-xs text-zinc-300 hover:bg-[#444] hover:text-white flex items-center gap-2">
                             <Mic size={14} className="text-zinc-500" /> Audio Track
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); handleAddTrack('instrument'); }} className="px-3 py-2 text-left text-xs text-zinc-300 hover:bg-[#444] hover:text-white flex items-center gap-2 border-t border-black/20">
                             <Piano size={14} className="text-zinc-500" /> Synth Track
                         </button>
                     </div>
                 )}
             </div> 
             <div className="flex-1 overflow-hidden relative no-scrollbar" ref={trackHeaderRef}>
                 {project.tracks.map((track, idx) => (
                    <TrackLane 
                        key={track.id}
                        track={track}
                        index={idx}
                        trackHeight={trackHeight}
                        isCompactHeader={isSidebarCollapsed}
                        isSelected={selectedTrackId === track.id}
                        onSelectTrack={onSelectTrack}
                        onOpenInspector={onOpenInspector}
                        handleTrackDragStart={handleTrackDragStart}
                        updateTrack={updateTrackInArranger}
                        onContextMenu={(e, id) => setTrackContextMenu({ x: e.clientX, y: e.clientY, trackId: id })}
                    />
                ))}
             </div>
        </div>

        {/* Timeline Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#191919]">
            {/* Mini Map (Sticky) */}
            <ArrangerMiniMap 
                clips={project.clips}
                totalDuration={projectDuration}
                visibleStartTime={visibleStartTime}
                visibleDuration={visibleDuration}
                onScroll={(time) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollLeft = timeToPixels(time);
                    }
                }}
            />

            <div ref={scrollContainerRef} className="flex-1 overflow-auto relative custom-scrollbar" onScroll={handleScroll} onWheel={handleWheel}>
                {/* Empty State Overlay */}
                {project.tracks.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-zinc-600 pointer-events-none">
                        <div className="bg-zinc-900/80 p-8 rounded-2xl border border-zinc-800 flex flex-col items-center max-w-sm text-center pointer-events-auto shadow-2xl backdrop-blur-sm">
                            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 text-zinc-500">
                                <Layers size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-300 mb-2">No Tracks Created</h3>
                            <p className="text-sm text-zinc-500 mb-6">Start by adding a track or dragging an audio file from the library.</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <button onClick={() => handleAddTrack('audio')} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-transform active:scale-95 text-xs border border-zinc-700">
                                    <Mic size={14} /> Audio Track
                                </button>
                                <button onClick={() => handleAddTrack('instrument')} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-transform active:scale-95 text-xs border border-zinc-700">
                                    <Piano size={14} /> Synth Track
                                </button>
                                <button onClick={() => setIsLibraryOpen(true)} className="bg-studio-accent hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-transform active:scale-95 text-xs">
                                    <FileAudio size={14} /> Import Audio
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ width: totalWidth, minWidth: '100%', height: Math.max(300, project.tracks.length * trackHeight + 32) }}>
                    {/* Background Grid */}
                    <div className="absolute inset-0 top-8 pointer-events-none">
                        <ArrangerGrid pixelsPerBar={pixelsPerBar} pixelsPerTick={pixelsPerTick} height={Math.max(300, project.tracks.length * trackHeight)} width={totalWidth} zoom={zoom} />
                    </div>

                    {/* Ruler */}
                    <Ruler 
                        totalBars={totalBars} pixelsPerBar={pixelsPerBar} zoom={zoom} markers={project.markers}
                        loopStart={project.loopStart} loopEnd={project.loopEnd} isLooping={project.isLooping}
                        onSeek={(e) => {
                            (e.target as Element).setPointerCapture(e.pointerId);
                            setIsScrubbing({ active: true, pointerId: e.pointerId });
                            onSeek(calculateSeekTime(e.clientX, e.shiftKey));
                        }}
                        onAddMarker={(e) => {
                            const time = calculateSeekTime(e.clientX, true);
                            const newMarker = { id: crypto.randomUUID(), time, text: `Marker ${project.markers.length + 1}`, color: '#eab308' };
                            updateProject((p: ProjectState) => ({...p, markers: [...p.markers, newMarker].sort((a,b) => a.time - b.time)}));
                        }}
                        onDeleteMarker={(id, text) => {
                            if (confirm(`Delete marker "${text}"?`)) updateProject((p: ProjectState) => ({...p, markers: p.markers.filter(m => m.id !== id)}));
                        }}
                        onLoopDragStart={(e, mode) => {
                            e.stopPropagation();
                            (e.target as Element).setPointerCapture(e.pointerId);
                            setLoopDrag({ mode, startX: e.clientX, initialStart: project.loopStart, initialEnd: project.loopEnd, pointerId: e.pointerId });
                        }}
                    />

                    {/* Snap Line */}
                    <div ref={snapLineRef} className="absolute top-0 bottom-0 w-px bg-white/50 z-40 pointer-events-none hidden mix-blend-difference" style={{ boxShadow: '0 0 2px rgba(255,255,255,0.8)' }}>
                        <div ref={snapLabelRef} className="absolute top-8 left-1 bg-zinc-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-md whitespace-nowrap border border-zinc-600">0:0:0</div>
                    </div>

                    {/* Track Lanes */}
                    <div className="relative" style={{ height: project.tracks.length * trackHeight }}>
                        {project.tracks.map((track, i) => (
                            <div 
                                key={track.id} 
                                style={{ top: i * trackHeight, height: trackHeight, position: 'absolute', width: '100%' }}
                            >
                                <ArrangerTrack 
                                    track={track}
                                    clips={clipsByTrack.get(track.id) || []}
                                    trackHeight={trackHeight}
                                    zoom={zoom}
                                    selectedClipIds={selectedClipIds}
                                    dragState={dragState}
                                    onDrop={handleTimelineDrop}
                                    onClipPointerDown={handleClipPointerDown}
                                    onOpenClipInspector={onOpenClipInspector}
                                    toolMode={tool}
                                    onAddAutomationPoint={handleAddAutomationPoint}
                                    onOpenAutomationMenu={(pointId, x, y) => setAutoContextMenu({ pointId, trackId: track.id, x, y })}
                                />
                            </div>
                        ))}
                        
                        <Playhead zoom={zoom} isPlaying={isPlaying} scrollContainerRef={scrollContainerRef} staticTime={currentTime} autoScroll={autoScroll} />
                    </div>
                </div>
            </div>
        </div>

        {/* Mobile Floating Action Button (FAB) for Adding Tracks */}
        {isMobile && (
            <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-3 items-end">
                {showAddMenu && (
                    <div className="flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <button 
                            onClick={() => handleAddTrack('instrument')}
                            className="bg-zinc-800 text-white p-3 rounded-full shadow-lg flex items-center gap-2 border border-zinc-700"
                        >
                            <span className="text-xs font-bold mr-1">Synth</span>
                            <Piano size={20} />
                        </button>
                        <button 
                            onClick={() => handleAddTrack('audio')}
                            className="bg-zinc-800 text-white p-3 rounded-full shadow-lg flex items-center gap-2 border border-zinc-700"
                        >
                            <span className="text-xs font-bold mr-1">Audio</span>
                            <Mic size={20} />
                        </button>
                    </div>
                )}
                <button 
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${showAddMenu ? 'bg-zinc-700 rotate-45' : 'bg-studio-accent'}`}
                >
                    <Plus size={28} className="text-white" />
                </button>
            </div>
        )}

        {/* Selection Box */}
        <div ref={selectionBoxRef} className="absolute bg-blue-500/10 border border-blue-400/50 z-50 pointer-events-none hidden rounded-sm backdrop-blur-[1px]" />

        {/* Instruments Overlay */}
        {showInstruments && (
            <div className="absolute inset-x-0 bottom-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-700 shadow-2xl z-50 p-4 animate-in slide-in-from-bottom duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-zinc-400 font-bold uppercase text-xs tracking-wider">Backing Instruments</h3>
                    <button onClick={() => setShowInstruments(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    {project.drone && <DroneSynth config={project.drone} onChange={(cfg) => updateProject((p: ProjectState) => ({...p, drone: cfg}))} />}
                    {project.sequencer && <StepSequencer config={project.sequencer} onChange={(cfg) => updateProject((p: ProjectState) => ({...p, sequencer: cfg}))} />}
                </div>
            </div>
        )}

        <ArrangerContextMenus 
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
            autoContextMenu={autoContextMenu}
            setAutoContextMenu={setAutoContextMenu}
            trackContextMenu={trackContextMenu}
            setTrackContextMenu={setTrackContextMenu}
            project={project}
            updateProject={updateProject}
            onRenameClip={onRenameClip}
            onRenameTrack={onRenameTrack}
            onColorClip={onColorClip}
            onSplit={onSplit}
            calculateSeekTime={calculateSeekTime}
            handleUpdateAutomationPoint={handleUpdateAutomationPoint}
            handleDeleteAutomationPoint={handleDeleteAutomationPoint}
        />
      </div>
    </div>
  );
};

export default Arranger;
