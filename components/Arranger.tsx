
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { ProjectState, ToolMode, Track, AssetMetadata, AutomationPoint } from '../types';
import Playhead from './Playhead'; 
import Ruler from './Ruler'; 
import TrackLane from './TrackLane'; 
import ArrangerTrack from './ArrangerTrack';
import Tanpura from './Tanpura';
import Tabla from './Tabla';
import { useArrangerInteraction } from '../hooks/useArrangerInteraction';
import { useTimelineMath } from '../hooks/useTimelineMath';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, Grid, Music2, Minimize, Plus, Mic, Piano, Edit2, Layers, AlignStartVertical, X, Split, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { analytics } from '../services/analytics';
import { getAllAssetsMetadata } from '../services/db';
import { HEADER_WIDTH_DESKTOP, HEADER_WIDTH_TABLET, HEADER_WIDTH_MOBILE, TRACK_HEIGHT_DEFAULT } from '../constants/layout';

interface ArrangerProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
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

const CLIP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#71717a'
];

const Arranger: React.FC<ArrangerProps> = ({ 
    project, setProject, currentTime, isPlaying, isRecording, recordingStartTime = 0,
    onPlayPause, onStop, onRecord, onSeek, onSplit, onSplitAtPlayhead, zoom, setZoom,
    selectedTrackId, onSelectTrack, selectedClipIds, onSelectClip, onOpenInspector, onOpenClipInspector,
    onMoveTrack, onRenameClip, onColorClip, onRenameTrack, autoScroll = true, onDropAsset, commitTransaction
}) => {
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
  
  // Automation Context Menu State
  const [autoContextMenu, setAutoContextMenu] = useState<{ x: number, y: number, trackId: string, pointId: string } | null>(null);

  useEffect(() => {
      getAllAssetsMetadata().then(setCachedAssets);
  }, []);

  // Use new hook
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
      project, setProject, zoom, setZoom, tool, snapGrid, scrollContainerRef, headerWidth, trackHeight,
      onSelectTrack, onSelectClip, selectedClipIds, onSplit, onSeek, onMoveTrack, multiSelectMode, secondsPerBeat,
      snapLineRef, selectionBoxRef, snapLabelRef, commitTransaction
  });

  // Calculate visible range for virtualization
  const visibleStartTime = Math.max(0, pixelsToTime(scrollLeft));
  const visibleEndTime = pixelsToTime(scrollLeft + containerWidth);
  // Buffer: Render extra 2 screens worth or fixed time to ensure smooth scrolling
  const renderStartTime = Math.max(0, visibleStartTime - 5); 
  const renderEndTime = visibleEndTime + 5;

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
            setIsSidebarCollapsed(true); // Auto collapse on mobile
        } else if (w < 1024) {
            setHeaderWidth(HEADER_WIDTH_TABLET);
            setIsCompactHeader(false);
            setIsSidebarCollapsed(false);
        } else {
            setHeaderWidth(HEADER_WIDTH_DESKTOP);
            setIsCompactHeader(false);
            setIsSidebarCollapsed(false);
        }
        
        if (scrollContainerRef.current) {
            setContainerWidth(scrollContainerRef.current.clientWidth);
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setProject(prev => ({
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
      const gridValue = snapGrid > 0 ? snapGrid : 0.25;
      const strength = quantizeStrength / 100;
      
      commitTransaction();
      setProject(prev => ({
          ...prev,
          clips: prev.clips.map(c => {
              if (selectedClipIds.includes(c.id)) {
                  const targetStart = snapToGrid(c.start, gridValue);
                  // Interpolate between current start and target start based on strength
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
          }
      }
  };

  const handleAddTrack = (type: 'audio' | 'instrument' = 'audio') => {
      const newTrack: Track = {
          id: crypto.randomUUID(),
          type,
          name: type === 'instrument' ? `Synth ${project.tracks.length + 1}` : `Track ${project.tracks.length + 1}`,
          volume: 0.8, pan: 0, muted: false, solo: false, 
          color: CLIP_COLORS[project.tracks.length % CLIP_COLORS.length],
          icon: type === 'instrument' ? 'keyboard' : 'music',
          instrument: type === 'instrument' ? { type: 'synth', preset: 'sawtooth', attack: 0.05, decay: 0.1, sustain: 0.5, release: 0.2 } : undefined,
          eq: { low: 0, mid: 0, high: 0 },
          compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
          sends: { reverb: 0, delay: 0, chorus: 0 },
          sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
      };
      setProject(p => ({...p, tracks: [...p.tracks, newTrack]}));
      setShowAddMenu(false);
      analytics.track('mixer_action', { action: 'add_track' });
  };

  const handleAddAutomationPoint = (trackId: string, time: number, value: number) => {
      commitTransaction();
      setProject(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => {
              if (t.id === trackId) {
                  const points = t.automation?.volume ? [...t.automation.volume] : [];
                  points.push({ id: crypto.randomUUID(), time, value, curve: 'linear' });
                  return {
                      ...t,
                      automation: {
                          ...t.automation,
                          volume: points.sort((a, b) => a.time - b.time)
                      }
                  };
              }
              return t;
          })
      }));
  };

  const handleUpdateAutomationPoint = (trackId: string, pointId: string, updates: Partial<AutomationPoint>) => {
      setProject(prev => ({
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
      setProject(prev => ({
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
      const left = e.currentTarget.scrollLeft;
      
      // Throttle virtualization state update
      if (Math.abs(left - lastScrollLeft.current) > 100) {
          setScrollLeft(left);
          lastScrollLeft.current = left;
      }
      
      // Sync track headers immediately
      if (trackHeaderRef.current) {
          const el = trackHeaderRef.current.querySelector('div[style*="translateY"]');
          if (el) (el as HTMLElement).style.transform = `translateY(-${e.currentTarget.scrollTop || 0}px)`;
      }
  };

  const { backgroundImage, backgroundSize } = useMemo(() => {
      const showTicks = pixelsPerTick > 20;
      let bgImage = `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px)`;
      let bgSize = `${pixelsPerBar}px 100%`;
      if (showTicks) {
          bgImage += `, linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)`;
          bgSize += `, ${pixelsPerTick}px 100%`;
      }
      if (pixelsPerTick > 80) {
          bgImage += `, linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px)`;
          bgSize += `, ${pixelsPerTick / 4}px 100%`;
      }
      return { backgroundImage: bgImage, backgroundSize: bgSize };
  }, [pixelsPerTick, pixelsPerBar]);

  const currentHeaderWidth = isSidebarCollapsed ? 40 : headerWidth;

  return (
    <div 
        className="flex flex-col h-full bg-studio-bg text-xs select-none touch-none"
        onPointerDown={handleGlobalPointerDown}
        onPointerMove={(e) => {
            handleGlobalPointerMove(e);
        }}
        onPointerUp={handleGlobalPointerUp}
        onPointerCancel={handleGlobalPointerUp}
        onContextMenu={e => e.preventDefault()}
        onClick={() => {
            setContextMenu(null);
            setAutoContextMenu(null);
            setShowAddMenu(false);
        }}
    >
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-800 bg-studio-panel flex items-center px-3 justify-between shrink-0 z-30">
         <div className="flex space-x-2 items-center">
            {/* Sidebar Toggle */}
            <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded transition-all bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                title={isSidebarCollapsed ? "Expand Headers" : "Collapse Headers"}
            >
                {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <div className="flex bg-zinc-900 rounded p-0.5 space-x-0.5 shrink-0 border border-zinc-800">
                <button onClick={() => setTool(ToolMode.POINTER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.POINTER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Pointer"><MousePointer size={14} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded transition-all ${tool === ToolMode.SPLIT ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Split"><Scissors size={14} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.ERASER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Erase"><Trash2 size={14} /></button>
                <button onClick={() => setTool(ToolMode.AUTOMATION)} className={`p-1.5 rounded transition-all ${tool === ToolMode.AUTOMATION ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="Automation"><TrendingUp size={14} /></button>
            </div>
            
            {onSplitAtPlayhead && (
                <button 
                    onClick={onSplitAtPlayhead}
                    className="flex items-center space-x-1 px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                    title="Split at Playhead (Ctrl+B)"
                >
                    <Split size={12} />
                    <span className="hidden sm:inline">Split</span>
                </button>
            )}

            {selectedClipIds.length > 0 && (
                <div className="flex items-center gap-1 bg-zinc-900 rounded px-1 border border-zinc-800">
                    <button 
                        onClick={handleQuantize}
                        className="flex items-center space-x-1 px-2 py-1 hover:text-white text-zinc-400 transition-colors"
                        title={`Quantize Selection (${quantizeStrength}%)`}
                    >
                        <AlignStartVertical size={12} />
                        <span className="hidden sm:inline">Q</span>
                    </button>
                    {/* Quantize Strength Toggle */}
                    <select 
                        value={quantizeStrength} 
                        onChange={(e) => setQuantizeStrength(Number(e.target.value))}
                        className="bg-transparent text-zinc-500 text-[10px] w-12 outline-none"
                    >
                        <option value="100">100%</option>
                        <option value="50">50%</option>
                        <option value="25">25%</option>
                    </select>
                </div>
            )}

            <div className="w-px h-5 bg-zinc-800 shrink-0 mx-1" />
            <div className="flex items-center space-x-1 bg-zinc-900 rounded px-2 h-7 border border-zinc-800">
                <Grid size={12} className="text-zinc-500" />
                <select value={snapGrid} onChange={(e) => setSnapGrid(parseFloat(e.target.value))} className="bg-transparent text-zinc-300 outline-none text-[10px] w-14 appearance-none">
                    <option value="0">Off</option>
                    <option value={numerator}>Bar</option>
                    <option value="1">1/4</option>
                    <option value="0.5">1/8</option>
                    <option value="0.25">1/16</option>
                </select>
            </div>
             <button 
                onClick={() => setProject(p => ({...p, isLooping: !p.isLooping}))} 
                className={`p-1.5 rounded transition-all ${project.isLooping ? 'bg-studio-accent text-white' : 'text-zinc-500'}`}
                title="Toggle Loop (L)"
             >
                <Repeat size={14} />
             </button>
         </div>

         <div className="flex items-center space-x-2 shrink-0">
             <div className="flex items-center space-x-1 bg-zinc-900 rounded px-2 h-7 border border-zinc-800 hidden sm:flex">
                 <ZoomOut size={12} className="text-zinc-500 cursor-pointer" onClick={() => setZoom(Math.max(10, zoom * 0.8))} />
                 <span className="text-[9px] text-zinc-400 w-8 text-center">{Math.round(zoom)}%</span>
                 <ZoomIn size={12} className="text-zinc-500 cursor-pointer" onClick={() => setZoom(Math.min(400, zoom * 1.2))} />
                 <button onClick={handleZoomToFit} className="ml-1 text-zinc-500 hover:text-white" title="Zoom to Fit">
                     <Minimize size={12} />
                 </button>
             </div>
             
             {/* Instruments Toggle */}
             <button onClick={() => setShowInstruments(!showInstruments)} className={`p-1.5 rounded transition-all flex items-center gap-1 ${showInstruments ? 'bg-studio-accent text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`} title="Backing Instruments">
                <Music2 size={16} />
                <span className="text-[10px] font-bold hidden sm:inline">Backing</span>
             </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Track Headers */}
        <div className="flex-none bg-studio-panel border-r border-zinc-800 z-20 flex flex-col shadow-xl transition-all duration-300" style={{ width: currentHeaderWidth }}>
             <div className="h-8 border-b border-zinc-800 bg-zinc-800/50 flex items-center px-2 justify-between relative">
                 {!isSidebarCollapsed && <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TRACKS</span>}
                 <button 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowAddMenu(!showAddMenu); 
                    }} 
                    className="text-zinc-500 hover:text-white mx-auto" 
                    title="Add Track"
                 >
                    <Plus size={12} />
                 </button>

                 {showAddMenu && (
                     <div className="absolute top-8 left-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 flex flex-col min-w-[140px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                         <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                handleAddTrack('audio'); 
                            }} 
                            className="px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                         >
                             <Mic size={14} className="text-zinc-500" /> Audio Track
                         </button>
                         <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                handleAddTrack('instrument'); 
                            }} 
                            className="px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 border-t border-zinc-800"
                         >
                             <Piano size={14} className="text-zinc-500" /> Synth Track
                         </button>
                     </div>
                 )}
             </div> 
             <div className="flex-1 overflow-hidden relative" ref={trackHeaderRef}>
                 <div style={{ transform: `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)` }}>
                    {project.tracks.map((track, idx) => (
                        <TrackLane 
                            key={track.id}
                            track={track}
                            index={idx}
                            trackHeight={trackHeight}
                            isCompactHeader={isSidebarCollapsed || isCompactHeader}
                            isSelected={selectedTrackId === track.id}
                            onSelectTrack={onSelectTrack}
                            onOpenInspector={onOpenInspector}
                            handleTrackDragStart={handleTrackDragStart}
                            updateTrack={updateTrack}
                        />
                    ))}
                 </div>
             </div>
        </div>

        {/* Timeline Area */}
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto relative bg-zinc-950"
            onScroll={handleScroll}
            onWheel={handleWheel}
        >
            {/* Empty State Overlay */}
            {project.tracks.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-zinc-600 pointer-events-none">
                    <div className="bg-zinc-900/80 p-8 rounded-2xl border border-zinc-800 flex flex-col items-center max-w-sm text-center pointer-events-auto shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 text-zinc-500">
                            <Layers size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-300 mb-2">No Tracks Created</h3>
                        <p className="text-sm text-zinc-500 mb-6">Start by adding a track or dragging an audio file from the library.</p>
                        <div className="flex gap-2">
                            <button onClick={() => handleAddTrack('audio')} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-transform active:scale-95 text-xs">
                                <Mic size={14} /> Audio Track
                            </button>
                            <button onClick={() => handleAddTrack('instrument')} className="bg-studio-accent hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-transform active:scale-95 text-xs">
                                <Piano size={14} /> Synth Track
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ width: totalWidth, minWidth: '100%', height: Math.max(300, project.tracks.length * trackHeight + 32) }}>
                {/* Background Grid */}
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: backgroundImage, backgroundSize: backgroundSize, top: 32 }} />

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
                        setProject(p => ({...p, markers: [...p.markers, newMarker].sort((a,b) => a.time - b.time)}));
                    }}
                    onDeleteMarker={(id, text) => {
                        if (confirm(`Delete marker "${text}"?`)) setProject(p => ({...p, markers: p.markers.filter(m => m.id !== id)}));
                    }}
                    onLoopDragStart={(e, mode) => {
                        e.stopPropagation();
                        (e.target as Element).setPointerCapture(e.pointerId);
                        setLoopDrag({ mode, startX: e.clientX, initialStart: project.loopStart, initialEnd: project.loopEnd, pointerId: e.pointerId });
                    }}
                />

                {/* Snap Line */}
                <div ref={snapLineRef} className="absolute top-0 bottom-0 w-px bg-yellow-400 z-40 pointer-events-none hidden">
                    <div ref={snapLabelRef} className="absolute top-8 left-1 bg-yellow-400 text-black text-[9px] font-bold px-1 rounded shadow-sm whitespace-nowrap">0:0:0</div>
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

        {/* Selection Box */}
        <div ref={selectionBoxRef} className="absolute bg-blue-500/10 border border-blue-400 z-50 pointer-events-none hidden" />

        {/* Instruments Overlay */}
        {showInstruments && (
            <div className="absolute inset-x-0 bottom-0 bg-zinc-900 border-t border-zinc-700 shadow-2xl z-50 p-4 animate-in slide-in-from-bottom duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-zinc-400 font-bold uppercase text-xs tracking-wider">Backing Instruments</h3>
                    <button onClick={() => setShowInstruments(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    <Tanpura config={project.tanpura} onChange={(cfg) => setProject(p => ({...p, tanpura: cfg}))} />
                    <Tabla config={project.tabla} onChange={(cfg) => setProject(p => ({...p, tabla: cfg}))} />
                </div>
            </div>
        )}

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
      </div>
    </div>
  );
};

export default Arranger;