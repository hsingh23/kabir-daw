
import React, { useRef, useMemo, useState } from 'react';
import { ProjectState, ToolMode, Track, AssetMetadata } from '../types';
import Waveform from './Waveform';
import Playhead from './Playhead'; 
import Ruler from './Ruler'; 
import TrackLane from './TrackLane'; 
import Tanpura from './Tanpura';
import Tabla from './Tabla';
import { useArrangerInteraction } from '../hooks/useArrangerInteraction';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, Grid, Music2, Minimize, Plus, MicOff, Edit2, Layers, AlignStartVertical, X } from 'lucide-react';
import { formatBars, formatTime } from '../services/utils';
import { analytics } from '../services/analytics';

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

const SNAP_OPTIONS = [
    { label: 'Off', value: 0 },
    { label: 'Bar', value: 4 },
    { label: '1/4', value: 1 },
    { label: '1/8', value: 0.5 },
    { label: '1/16', value: 0.25 },
];

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
  const [trackHeight, setTrackHeight] = React.useState(100);
  const [isCompactHeader, setIsCompactHeader] = React.useState(false);
  const [headerWidth, setHeaderWidth] = React.useState(220);
  
  // Instrument Drawer State
  const [showInstruments, setShowInstruments] = useState(false);
  
  const secondsPerBeat = 60 / project.bpm;
  const [numerator, denominator] = project.timeSignature || [4, 4];
  const beatsPerBar = numerator;
  const beatMultiplier = 4 / denominator;
  const secondsPerTick = secondsPerBeat * beatMultiplier;
  const secondsPerBar = secondsPerTick * beatsPerBar;
  
  const pixelsPerTick = zoom * secondsPerTick; 
  const pixelsPerBar = pixelsPerTick * beatsPerBar;
  
  const totalBars = Math.max(50, Math.ceil((project.loopEnd + 20) / secondsPerBar));
  const totalWidth = totalBars * pixelsPerBar;

  const {
      dragState, loopDrag, trackDrag, isScrubbing, contextMenu, setContextMenu,
      handleClipPointerDown, handleTrackDragStart, handleGlobalPointerDown, 
      handleGlobalPointerMove, handleGlobalPointerUp, handleWheel, calculateSeekTime,
      setIsScrubbing, setLoopDrag
  } = useArrangerInteraction({
      project, setProject, zoom, setZoom, tool, snapGrid, scrollContainerRef, headerWidth, trackHeight,
      onSelectTrack, onSelectClip, selectedClipIds, onSplit, onSeek, onMoveTrack, multiSelectMode, secondsPerBeat,
      snapLineRef, selectionBoxRef, snapLabelRef, commitTransaction
  });

  const clipsByTrack = useMemo(() => {
      const map = new Map<string, any[]>();
      project.tracks.forEach(t => map.set(t.id, []));
      project.clips.forEach(c => {
          if (map.has(c.trackId)) {
              map.get(c.trackId)?.push(c);
          }
      });
      return map;
  }, [project.clips, project.tracks]);

  React.useEffect(() => {
    const handleResize = () => {
        const w = window.innerWidth;
        if (w < 640) {
            setHeaderWidth(80); 
            setIsCompactHeader(true);
        } else if (w < 1024) {
            setHeaderWidth(160);
            setIsCompactHeader(false);
        } else {
            setHeaderWidth(220);
            setIsCompactHeader(false);
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
      const gridSeconds = (snapGrid > 0 ? snapGrid : 0.25) * secondsPerBeat;
      commitTransaction();
      setProject(prev => ({
          ...prev,
          clips: prev.clips.map(c => {
              if (selectedClipIds.includes(c.id)) {
                  const quantizedStart = Math.round(c.start / gridSeconds) * gridSeconds;
                  return { ...c, start: quantizedStart };
              }
              return c;
          })
      }));
      analytics.track('clip_action', { action: 'quantize', count: selectedClipIds.length });
  };

  const handleTimelineDrop = (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const data = e.dataTransfer.getData('application/json');
      if (data && onDropAsset && scrollContainerRef.current) {
          try {
              const asset = JSON.parse(data);
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const offsetX = e.clientX - rect.left;
              const time = Math.max(0, offsetX / zoom);
              
              let snappedTime = time;
              if (snapGrid > 0) {
                  const snapSeconds = snapGrid * secondsPerBeat;
                  snappedTime = Math.round(time / snapSeconds) * snapSeconds;
              }
              onDropAsset(trackId, snappedTime, asset);
          } catch (err) {
              console.error("Failed to parse dropped data", err);
          }
      }
  };

  const handleAddTrack = () => {
      const newTrack: Track = {
          id: crypto.randomUUID(),
          name: `Track ${project.tracks.length + 1}`,
          volume: 0.8, pan: 0, muted: false, solo: false, color: CLIP_COLORS[project.tracks.length % CLIP_COLORS.length],
          eq: { low: 0, mid: 0, high: 0 },
          compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
          sends: { reverb: 0, delay: 0, chorus: 0 }
      };
      setProject(p => ({...p, tracks: [...p.tracks, newTrack]}));
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

  return (
    <div 
        className="flex flex-col h-full bg-studio-bg text-xs select-none touch-none"
        onPointerDown={handleGlobalPointerDown}
        onPointerMove={handleGlobalPointerMove}
        onPointerUp={handleGlobalPointerUp}
        onPointerCancel={handleGlobalPointerUp}
        onContextMenu={e => e.preventDefault()}
        onClick={() => setContextMenu(null)}
    >
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-800 bg-studio-panel flex items-center px-3 justify-between shrink-0 z-30">
         <div className="flex space-x-2 items-center">
            <div className="flex bg-zinc-900 rounded p-0.5 space-x-0.5 shrink-0 border border-zinc-800">
                <button onClick={() => setTool(ToolMode.POINTER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.POINTER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><MousePointer size={14} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded transition-all ${tool === ToolMode.SPLIT ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Scissors size={14} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.ERASER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Trash2 size={14} /></button>
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
                <button 
                    onClick={handleQuantize}
                    className="flex items-center space-x-1 px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                    title="Quantize Selection (Q)"
                >
                    <AlignStartVertical size={12} />
                    <span className="hidden sm:inline">Quantize</span>
                </button>
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
        <div className="flex-none bg-studio-panel border-r border-zinc-800 z-20 flex flex-col shadow-xl" style={{ width: headerWidth }}>
             <div className="h-8 border-b border-zinc-800 bg-zinc-800/50 flex items-center px-3 justify-between">
                 <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TRACKS</span>
                 <button onClick={handleAddTrack} className="text-zinc-500 hover:text-white" title="Add Track">
                    <Plus size={12} />
                 </button>
             </div> 
             <div className="flex-1 overflow-hidden relative">
                 <div style={{ transform: `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)` }}>
                    {project.tracks.map((track, idx) => (
                        <TrackLane 
                            key={track.id}
                            track={track}
                            index={idx}
                            trackHeight={trackHeight}
                            isCompactHeader={isCompactHeader}
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
            onScroll={() => {
                if (trackHeaderRef.current) {
                    const el = trackHeaderRef.current.querySelector('div[style*="translateY"]');
                    if (el) (el as HTMLElement).style.transform = `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)`;
                }
            }}
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
                        <button onClick={handleAddTrack} className="bg-studio-accent hover:bg-red-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 transition-transform active:scale-95">
                            <Plus size={16} /> Add First Track
                        </button>
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
                            className={`absolute w-full border-b border-zinc-800/50 transition-all ${
                                (track.muted || (project.tracks.some(t => t.solo) && !track.solo)) ? 'opacity-50 grayscale' : ''
                            }`} 
                            style={{ top: i * trackHeight, height: trackHeight }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
                            onDrop={(e) => handleTimelineDrop(e, track.id)}
                         >
                              {clipsByTrack.get(track.id)?.map(clip => {
                                  const isSelected = selectedClipIds.includes(clip.id);
                                  const clipGain = clip.gain ?? 1.0;
                                  // Check if stretching (clip is active in drag state and mode is stretch)
                                  const isStretching = dragState?.clipId === clip.id && dragState?.mode === 'STRETCH';
                                  
                                  return (
                                      <div 
                                        key={clip.id}
                                        className={`absolute top-1 bottom-1 rounded-md overflow-hidden transition-all cursor-move group shadow-sm ${isSelected ? 'ring-2 ring-white z-10' : 'ring-1 ring-black/20 hover:ring-white/30'} ${clip.muted ? 'opacity-50 grayscale' : 'opacity-100'} ${isStretching ? 'bg-orange-600' : ''}`}
                                        style={{ 
                                            left: clip.start * zoom, 
                                            width: clip.duration * zoom,
                                            backgroundColor: isStretching ? undefined : (clip.color || track.color || '#555') 
                                        }}
                                        onPointerDown={(e) => {
                                            // Handle Alt+Click for Stretch
                                            const mode = e.altKey ? 'STRETCH' : 'MOVE';
                                            handleClipPointerDown(e, clip, mode);
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenClipInspector) onOpenClipInspector(clip.id);
                                        }}
                                      >
                                          <div className="absolute inset-0 opacity-80 pointer-events-none bg-black/20">
                                               <Waveform 
                                                    bufferKey={clip.bufferKey} 
                                                    color="rgba(255,255,255,0.8)" 
                                                    offset={clip.offset}
                                                    duration={clip.duration}
                                                    fadeIn={clip.fadeIn}
                                                    fadeOut={clip.fadeOut}
                                                    gain={clipGain}
                                               />
                                          </div>
                                          
                                          <div className="absolute top-0 left-0 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-br-md pointer-events-none flex items-center gap-1">
                                              {clip.muted && <MicOff size={8} className="text-red-400" />}
                                              <span className="text-[9px] font-bold text-white shadow-black drop-shadow-md truncate max-w-[100px] block">{clip.name}</span>
                                          </div>

                                          {isSelected && (
                                              <>
                                                {/* Gain Overlay & Knob */}
                                                <div className="absolute left-0 right-0 h-px bg-white/50 pointer-events-none" style={{ top: `${Math.max(0, Math.min(100, (1 - (clipGain / 2.0)) * 100))}%` }} />
                                                <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white/80 rounded-full shadow-md cursor-ns-resize z-30 hover:scale-125 transition-transform flex items-center justify-center group/gain"
                                                    style={{ top: `${Math.max(0, Math.min(100, (1 - (clipGain / 2.0)) * 100))}%`, marginTop: '-8px' }}
                                                    onPointerDown={(e) => handleClipPointerDown(e, clip, 'GAIN')}
                                                >
                                                    <div className="w-1.5 h-1.5 bg-black/50 rounded-full" />
                                                    <div className="absolute -top-6 bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover/gain:opacity-100 whitespace-nowrap pointer-events-none">{clipGain.toFixed(2)}x</div>
                                                </div>

                                                {/* Resize Handles */}
                                                <div className="absolute left-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/30 cursor-ew-resize z-20 flex items-center justify-center" onPointerDown={(e) => handleClipPointerDown(e, clip, 'TRIM_START')}>
                                                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                                </div>
                                                {/* Right Edge: Normal=Trim/Loop, Alt=Stretch */}
                                                <div className={`absolute right-0 top-0 bottom-0 w-3 ${dragState?.mode === 'STRETCH' ? 'bg-orange-500/50' : 'bg-white/10 hover:bg-white/30'} cursor-ew-resize z-20 flex items-center justify-center`} 
                                                     onPointerDown={(e) => handleClipPointerDown(e, clip, e.altKey ? 'STRETCH' : 'TRIM_END')}
                                                     title="Drag to Loop / Alt+Drag to Stretch"
                                                >
                                                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                                </div>
                                                <div className="absolute top-0 left-0 w-4 h-4 bg-white/20 hover:bg-white/40 rounded-br cursor-ne-resize z-20" style={{ transform: `translateX(${clip.fadeIn * zoom}px)` }} onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_IN')} />
                                                <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 hover:bg-white/40 rounded-bl cursor-nw-resize z-20" style={{ transform: `translateX(-${clip.fadeOut * zoom}px)` }} onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_OUT')} />
                                              </>
                                          )}
                                      </div>
                                  );
                              })}
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

        {/* Context Menu */}
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
      </div>
    </div>
  );
};

export default Arranger;
