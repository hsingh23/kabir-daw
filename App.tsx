
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, Clip, Marker, AssetMetadata } from './types';
import Mixer from './components/Mixer';
import Arranger from './components/Arranger';
import Library from './components/Library';
import TrackInspector from './components/TrackInspector';
import ClipInspector from './components/ClipInspector';
import MasterInspector from './components/MasterInspector';
import SettingsDialog from './components/SettingsDialog';
import ShortcutsDialog from './components/ShortcutsDialog';
import ExportDialog from './components/ExportDialog';
import TimeDisplay from './components/TimeDisplay';
import TempoControl from './components/TempoControl';
import StatusIndicator from './components/StatusIndicator';
import HeaderInputMeter from './components/HeaderInputMeter';
import AudioContextOverlay from './components/AudioContextOverlay'; 
import { ToastProvider, useToast } from './components/Toast';
import { audio } from './services/audio';
import { saveAudioBlob, saveProject, getProject, getAudioBlob } from './services/db';
import { moveItem, audioBufferToWav } from './services/utils';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProjectState } from './hooks/useProjectState';
import { TEMPLATES, createTrack } from './services/templates';
import { analytics } from './services/analytics';
import { Mic, Music, LayoutGrid, Upload, Plus, Undo2, Redo2, Download, Play, Pause, Square, Circle, Settings, Activity, ArrowRightLeft, Keyboard, ArrowRight, VolumeX, FolderOpen } from 'lucide-react';

const INITIAL_PROJECT: ProjectState = {
  id: 'default-project',
  name: 'New Project',
  notes: '',
  bpm: 120,
  timeSignature: [4, 4],
  tracks: TEMPLATES['Basic Band'].tracks || [],
  clips: [],
  markers: [],
  loopStart: 0,
  loopEnd: 8,
  isLooping: false,
  metronomeOn: false,
  metronomeSound: 'beep',
  countIn: 0,
  recordingLatency: 0,
  inputMonitoring: false,
  returnToStartOnStop: true,
  masterVolume: 1.0,
  masterEq: { low: 0, mid: 0, high: 0 },
  masterCompressor: {
      threshold: -24,
      ratio: 12,
      knee: 10,
      attack: 0.05,
      release: 0.25
  },
  effects: { reverb: 0.2, delay: 0.1, chorus: 0.0 },
  tanpura: {
      enabled: false,
      volume: 0.5,
      key: 'C',
      tuning: 'Pa',
      tempo: 60,
      fineTune: 0
  },
  tabla: {
      enabled: false,
      volume: 0.5,
      taal: 'TeenTaal',
      bpm: 100,
      key: 'C'
  }
};

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  // Default view is now 'arranger'
  const [view, setView] = useState<'mixer' | 'arranger' | 'library'>(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get('view') as 'mixer' | 'arranger' | 'library') || 'arranger';
  });

  const { project, updateProject, setProject, undo, redo, past, future, loadProject, commitTransaction } = useProjectState(INITIAL_PROJECT);
  const [clipboard, setClipboard] = useState<Clip[]>([]); 

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(50); 
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]); 
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Track Inspector Modal
  const [inspectorTrackId, setInspectorTrackId] = useState<string | null>(null);
  
  // Clip Inspector Modal
  const [inspectorClipId, setInspectorClipId] = useState<string | null>(null);
  
  // Master Inspector Modal
  const [showMasterInspector, setShowMasterInspector] = useState(false);
  
  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  
  // Save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Visual Metronome
  const [visualBeat, setVisualBeat] = useState(false);

  const rafRef = useRef<number>(0);
  const saveTimeoutRef = useRef<number | null>(null);

  // Sync URL State
  useEffect(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      window.history.replaceState({}, '', url);
  }, [view]);

  // Load Project on Mount
  useEffect(() => {
      loadProjectState('default-project');
  }, []);

  // Auto-Save Logic
  useEffect(() => {
      if (project === INITIAL_PROJECT) return;
      
      setSaveStatus('unsaved');
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
          setSaveStatus('saving');
          try {
            await saveProject(project);
            setSaveStatus('saved');
          } catch (e) {
            console.error("Save failed", e);
            setSaveStatus('unsaved');
            showToast("Failed to auto-save", 'error');
          }
      }, 2000) as unknown as number; 
  }, [project, showToast]);

  const loadProjectState = async (projectId: string) => {
    audio.clearBuffers();
    const saved = await getProject(projectId);
    if (saved) {
        const migrated = {
            ...INITIAL_PROJECT,
            ...saved,
            // Ensure deep merge of nested objects if fields are missing in old saves
            masterCompressor: { ...INITIAL_PROJECT.masterCompressor, ...saved.masterCompressor },
            tanpura: { ...INITIAL_PROJECT.tanpura, ...saved.tanpura },
            tracks: saved.tracks.map((t: any) => ({
                ...t,
                eq: t.eq || { low: 0, mid: 0, high: 0 },
                compressor: t.compressor || { enabled: false, threshold: -15, ratio: 3, attack: 0.01, release: 0.1 },
                sends: t.sends || { reverb: 0, delay: 0, chorus: 0 },
                distortion: t.distortion || 0
            })),
            clips: saved.clips.map((c: any) => ({
                ...c,
                speed: c.speed || 1,
                gain: c.gain !== undefined ? c.gain : 1.0,
                detune: c.detune || 0
            }))
        };
        
        const bufferPromises = migrated.clips.map(async (clip: Clip) => {
            try {
                const blob = await getAudioBlob(clip.bufferKey);
                if (blob) {
                    await audio.loadAudio(clip.bufferKey, blob);
                }
            } catch (e) {
                console.error(`Failed to load audio for clip ${clip.name}`, e);
            }
        });
        
        await Promise.all(bufferPromises);
        loadProject(migrated);
        // Default select first track if exists
        if (migrated.tracks.length > 0) setSelectedTrackId(migrated.tracks[0].id);
        
        showToast("Project loaded successfully", 'success');
        analytics.track('project_loaded', { projectId: migrated.id });
    } else if (projectId !== 'default-project') {
        loadProject({ ...INITIAL_PROJECT, id: projectId, name: 'New Project' });
    }
  };

  const createNewProject = useCallback(async (template: Partial<ProjectState> = {}) => {
      const newId = crypto.randomUUID();
      const newProject: ProjectState = { 
          ...INITIAL_PROJECT, 
          ...template,
          id: newId, 
          name: template.name || 'Untitled Project',
          tracks: template.tracks || INITIAL_PROJECT.tracks,
          bpm: template.bpm || INITIAL_PROJECT.bpm
      };
      await saveProject(newProject);
      await loadProjectState(newId);
      showToast(`Created new project: ${newProject.name}`, 'info');
      analytics.track('project_created', { template: template.name || 'Empty' });
  }, [loadProject, showToast]);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
      updateProject(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
      }));
  }, [updateProject]);

  const updateClip = useCallback((id: string, updates: Partial<Clip>) => {
      updateProject(prev => ({
          ...prev,
          clips: prev.clips.map(c => c.id === id ? { ...c, ...updates } : c)
      }));
  }, [updateProject]);

  const togglePlay = useCallback(() => {
      setIsPlaying(prevIsPlaying => {
          if (isRecording) return prevIsPlaying;
          if (prevIsPlaying) {
              audio.pause();
              setCurrentTime(audio.getCurrentTime());
              if (project.returnToStartOnStop) {
                  setCurrentTime(project.isLooping ? project.loopStart : 0);
              }
              analytics.track('transport_stop');
              return false;
          } else {
              analytics.track('transport_play');
              return true;
          }
      });
  }, [isRecording, project.returnToStartOnStop, project.isLooping, project.loopStart]);

  useEffect(() => {
     if (isPlaying && !audio.isPlaying) {
         audio.play(project.clips, project.tracks, currentTime);
     } else if (!isPlaying && audio.isPlaying) {
         audio.pause();
     }
  }, [isPlaying, currentTime, project.clips, project.tracks]);

  const startActualRecording = useCallback(async () => {
        try {
            await audio.startRecording(project.inputMonitoring);
            const startTime = currentTime;
            setRecordingStartTime(startTime);
            audio.play(project.clips, project.tracks, startTime);
            setIsPlaying(true);
            setIsRecording(true);
            showToast("Recording started", 'success');
            analytics.track('recording_started');
        } catch (_e) {
            showToast("Could not start recording. Check permissions.", 'error');
        }
  }, [currentTime, project.clips, project.tracks, project.inputMonitoring, showToast]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
        audio.stop(); 
        const blob = await audio.stopRecording();
        setIsPlaying(false);
        setIsRecording(false);
        setCurrentTime(audio.getCurrentTime()); 
        
        if (blob && selectedTrackId) {
            const key = crypto.randomUUID();
            await saveAudioBlob(key, blob);
            await audio.loadAudio(key, blob);
            const buffer = audio.buffers.get(key);
            
            const latencySeconds = (project.recordingLatency || 0) / 1000;
            const rawStart = recordingStartTime;
            let finalStart = rawStart - latencySeconds;
            let finalOffset = 0;
            let finalDuration = buffer?.duration || 0;

            if (finalStart < 0) {
                finalOffset = Math.abs(finalStart);
                finalDuration -= finalOffset;
                finalStart = 0;
            }

            const newClip: Clip = {
                id: crypto.randomUUID(),
                trackId: selectedTrackId,
                name: `Rec ${new Date().toLocaleTimeString()}`,
                start: finalStart,
                offset: finalOffset,
                duration: finalDuration,
                bufferKey: key,
                fadeIn: 0,
                fadeOut: 0,
                speed: 1,
                gain: 1.0
            };
            
            updateProject(prev => ({
                ...prev,
                clips: [...prev.clips, newClip]
            }));
            setSelectedClipIds([newClip.id]);
            showToast("Recording saved", 'success');
            analytics.track('clip_action', { action: 'record_complete', duration: finalDuration });
        }
    } else {
        // AUTO-ARM LOGIC
        let trackIdToRecord = selectedTrackId;
        
        if (!trackIdToRecord) {
            if (project.tracks.length > 0) {
                trackIdToRecord = project.tracks[0].id;
                setSelectedTrackId(trackIdToRecord);
                showToast(`Armed Track: ${project.tracks[0].name}`, 'info');
            } else {
                // Create a new track if none exist
                const newTrack = createTrack("Audio 1", "#ef4444");
                updateProject(prev => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
                trackIdToRecord = newTrack.id;
                setSelectedTrackId(newTrack.id);
                showToast("Created and Armed new Audio Track", 'info');
                // Give React a cycle to update state before starting? 
                // Actually, since we use `updateProject`, we can't guarantee `selectedTrackId` is updated in this closure
                // But we can proceed assuming the next render will catch up, or refactor to use a ref for immediate access.
                // For safety in this function scope, we use the local variable `trackIdToRecord` if we needed to pass it down, 
                // but `stopRecording` uses `selectedTrackId` from state. 
                // This is a race condition risk. 
                // FIX: We need `selectedTrackId` to be correct when stopping. 
                // Since `handleRecordToggle` (stop) runs in a new closure later, the state *should* be updated.
            }
        } else {
             const t = project.tracks.find(t => t.id === trackIdToRecord);
             if (t) showToast(`Recording on ${t.name}`, 'info');
        }

        // Proceed to record
        if (project.countIn > 0) {
            setIsCountingIn(true);
            await audio.playCountIn(project.countIn, project.bpm);
            setIsCountingIn(false);
            startActualRecording();
        } else {
            startActualRecording();
        }
    }
  }, [isRecording, selectedTrackId, recordingStartTime, currentTime, project.clips, project.tracks, updateProject, project.countIn, project.bpm, project.recordingLatency, startActualRecording, showToast]);

  const handleSplit = useCallback((clipId: string, time: number) => {
    const clip = project.clips.find(c => c.id === clipId);
    if (!clip) return;
    if (time <= clip.start || time >= clip.start + clip.duration) return;

    const splitOffset = time - clip.start;
    const clipA: Clip = { ...clip, duration: splitOffset, fadeOut: 0.05 };
    const clipB: Clip = { ...clip, id: crypto.randomUUID(), start: time, offset: clip.offset + splitOffset, duration: clip.duration - splitOffset, name: `${clip.name} (cut)`, fadeIn: 0.05, speed: clip.speed || 1, gain: clip.gain || 1.0 };

    updateProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? clipA : c).concat(clipB) }));
    setSelectedClipIds([clipB.id]);
    analytics.track('arranger_clip_split');
  }, [project.clips, updateProject]);

  const handleSplitAtPlayhead = useCallback(() => {
      let splitCount = 0;
      if (selectedClipIds.length > 0) {
          selectedClipIds.forEach(id => { handleSplit(id, currentTime); splitCount++; });
      } else if (selectedTrackId) {
          const clipsToSplit = project.clips.filter(c => c.trackId === selectedTrackId && c.start < currentTime && (c.start + c.duration) > currentTime);
          clipsToSplit.forEach(c => { handleSplit(c.id, currentTime); splitCount++; });
      }
      if (splitCount > 0) showToast("Split clip(s)", 'info');
  }, [selectedClipIds, selectedTrackId, currentTime, project.clips, handleSplit, showToast]);

  const handleDuplicateTrack = useCallback((trackId: string) => {
      const track = project.tracks.find(t => t.id === trackId);
      if (!track) return;
      const newTrackId = crypto.randomUUID();
      const newTrack: Track = { ...track, id: newTrackId, name: `${track.name} (Copy)` };
      const trackClips = project.clips.filter(c => c.trackId === trackId);
      const newClips = trackClips.map(clip => ({ ...clip, id: crypto.randomUUID(), trackId: newTrackId }));
      const trackIndex = project.tracks.findIndex(t => t.id === trackId);
      const newTracks = [...project.tracks];
      newTracks.splice(trackIndex + 1, 0, newTrack);
      updateProject(prev => ({ ...prev, tracks: newTracks, clips: [...prev.clips, ...newClips] }));
      setSelectedTrackId(newTrackId);
      if (inspectorTrackId) setInspectorTrackId(newTrackId);
      showToast("Track duplicated", 'success');
  }, [project.tracks, project.clips, updateProject, inspectorTrackId, showToast]);

  const clearSolo = useCallback(() => {
      updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => ({ ...t, solo: false })) }));
      showToast("Solo cleared", 'info');
  }, [updateProject, showToast]);

  const handleSeek = useCallback((time: number) => {
    if (isRecording) return;
    setCurrentTime(time);
    if (isPlaying) {
      audio.play(project.clips, project.tracks, time);
    }
  }, [isRecording, isPlaying, project.clips, project.tracks]);

  const handleQuantize = useCallback(() => {
      if (selectedClipIds.length === 0) return;
      const secondsPerBeat = 60 / project.bpm;
      const grid = 0.25 * secondsPerBeat;
      commitTransaction();
      updateProject(prev => ({ ...prev, clips: prev.clips.map(c => { if (selectedClipIds.includes(c.id)) { const qStart = Math.round(c.start / grid) * grid; return { ...c, start: qStart }; } return c; }) }));
      showToast("Quantized clips", 'success');
  }, [selectedClipIds, project.bpm, updateProject, commitTransaction, showToast]);

  useKeyboardShortcuts({
      project, setProject: updateProject, selectedClipIds, setSelectedClipIds, selectedTrackId, setSelectedTrackId, currentTime, isRecording, togglePlay, handleRecordToggle, undo, redo, clipboard, setClipboard, handleSplit, onSplitAtPlayhead: handleSplitAtPlayhead, setShowShortcuts, onSeek: handleSeek, onQuantize: handleQuantize
  });

  useEffect(() => {
    audio.syncTracks(project.tracks);
    audio.syncInstruments(project.tanpura, project.tabla);
    audio.setMasterVolume(project.masterVolume);
    if (project.masterCompressor) {
        audio.setMasterCompressor(project.masterCompressor.threshold, project.masterCompressor.ratio, project.masterCompressor.knee, project.masterCompressor.attack, project.masterCompressor.release);
    }
    if (project.masterEq) audio.setMasterEq(project.masterEq.low, project.masterEq.mid, project.masterEq.high);
    audio.setDelayLevel(project.effects.delay); audio.setReverbLevel(project.effects.reverb); audio.setChorusLevel(project.effects.chorus);
    audio.bpm = project.bpm; audio.timeSignature = project.timeSignature;
    audio.metronomeEnabled = project.metronomeOn; audio.metronomeSound = project.metronomeSound || 'beep';
  }, [project]);

  useEffect(() => {
    const loop = () => {
      if (isPlaying) {
        audio.scheduler();
        const time = audio.getCurrentTime();
        const secondsPerBeat = 60 / project.bpm;
        const timeSinceBeat = time % secondsPerBeat;
        setVisualBeat(timeSinceBeat < 0.1 && project.metronomeOn);
        if (project.isLooping && time >= project.loopEnd && !isRecording) {
            audio.play(project.clips, project.tracks, project.loopStart);
            setCurrentTime(project.loopStart);
        } 
        rafRef.current = requestAnimationFrame(loop);
      } else {
          setVisualBeat(false);
      }
    };
    if (isPlaying) loop();
    else cancelAnimationFrame(rafRef.current!);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [isPlaying, isRecording, project.isLooping, project.loopEnd, project.loopStart, project.clips, project.tracks, project.bpm, project.metronomeOn]);

  const handlePlayPauseClick = useCallback(() => {
      audio.resumeContext();
      if (isRecording) { handleRecordToggle(); return; }
      togglePlay();
  }, [isRecording, handleRecordToggle, togglePlay]);

  const stop = useCallback(() => {
    if (isRecording) { handleRecordToggle(); return; }
    audio.stop();
    setIsPlaying(false);
    if (project.returnToStartOnStop) setCurrentTime(project.isLooping ? project.loopStart : 0);
    else setCurrentTime(audio.getCurrentTime());
    analytics.track('transport_stop');
  }, [isRecording, handleRecordToggle, project.isLooping, project.loopStart, project.returnToStartOnStop]);

  const handleExport = useCallback(async (options: { type: 'master' | 'stems' }) => {
      if (project.clips.length === 0) { showToast("Nothing to export!", 'error'); return; }
      setIsExporting(true);
      analytics.track('export_started', { type: options.type });
      if (isPlaying) stop();
      try {
          if (options.type === 'master') {
              const blob = await audio.renderProject(project);
              if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${project.name || 'PocketStudio_Mix'}_${new Date().toISOString().slice(0,10)}.wav`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast("Export complete!", 'success');
              }
          } else {
              for (const track of project.tracks) {
                  const stemProject = { ...project, tracks: project.tracks.map(t => ({ ...t, muted: t.id !== track.id, solo: false })) };
                  const blob = await audio.renderProject(stemProject);
                  if (blob) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${project.name || 'Project'}_${track.name}_Stem.wav`;
                      a.click();
                      URL.revokeObjectURL(url);
                  }
              }
              showToast("Stems exported!", 'success');
          }
          analytics.track('export_completed');
      } catch (e) {
          console.error("Export failed", e);
          showToast("Export failed. See console.", 'error');
      } finally {
          setIsExporting(false);
          setShowExport(false);
      }
  }, [project, isPlaying, stop, showToast]);

  const handleProcessAudio = useCallback(async (clipId: string, type: 'reverse' | 'normalize') => {
      const clip = project.clips.find(c => c.id === clipId);
      if (!clip) return;
      try {
          const newBuffer = audio.processAudioBuffer(clip.bufferKey, type);
          const newKey = crypto.randomUUID();
          const wav = audioBufferToWav(newBuffer);
          await saveAudioBlob(newKey, wav);
          audio.buffers.set(newKey, newBuffer);
          updateProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, bufferKey: newKey, name: `${c.name} (${type})` } : c) }));
          showToast(`Audio ${type}d`, 'success');
          analytics.track('clip_action', { action: type });
      } catch (e) {
          console.error("Processing failed", e);
          showToast("Audio processing failed.", 'error');
      }
  }, [project.clips, updateProject, showToast]);

  const handleDropAsset = async (trackId: string, time: number, asset: AssetMetadata) => {
      const blob = await getAudioBlob(asset.id);
      if (blob) {
          await audio.loadAudio(asset.id, blob);
          const buffer = audio.buffers.get(asset.id);
          const duration = buffer?.duration || 10;
          const newClip: Clip = { id: crypto.randomUUID(), trackId, name: asset.name, start: time, offset: 0, duration, bufferKey: asset.id, fadeIn: 0, fadeOut: 0, speed: 1, gain: 1 };
          updateProject(prev => ({...prev, clips: [...prev.clips, newClip]}));
      }
  };

  const addAssetToTrack = async (asset: AssetMetadata) => {
        const trackId = selectedTrackId || (project.tracks.length > 0 ? project.tracks[0].id : null);
        if (!trackId) {
            // Logic to create track handled in Library component or we force create one here?
            // Library handles basic add, but better if we are safe
            return;
        }
        await handleDropAsset(trackId, currentTime, asset);
        showToast(`Added ${asset.name} to track`, 'success');
  };

  const hasSolo = project.tracks.some(t => t.solo);

  return (
    <div className={`flex flex-col h-screen overflow-hidden transition-all duration-300 ${isRecording ? 'ring-4 ring-red-500/50' : ''}`}>
      <AudioContextOverlay />
      
      {/* Top Header (Transport & Global) */}
      <div className="flex items-center justify-between h-14 bg-studio-panel border-b border-zinc-800 px-4 shrink-0 z-50">
          <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">
                  <span className="text-studio-accent">Pocket</span>Studio
              </h1>
              <div className="flex gap-1">
                  <button onClick={undo} disabled={past.length === 0} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30" title="Undo">
                      <Undo2 size={16} />
                  </button>
                  <button onClick={redo} disabled={future.length === 0} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30" title="Redo">
                      <Redo2 size={16} />
                  </button>
              </div>
              <StatusIndicator status={saveStatus} />
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
              <div className="hidden sm:flex items-center gap-2 bg-zinc-900 rounded-full px-4 py-1.5 border border-zinc-800">
                  <TimeDisplay currentTime={currentTime} bpm={project.bpm} isPlaying={isPlaying} />
                  <div className="w-px h-6 bg-zinc-800 mx-1" />
                  <TempoControl bpm={project.bpm} onChange={(bpm) => updateProject(p => ({...p, bpm}))} />
              </div>
              
              <div className="flex items-center gap-4">
                  <button onClick={stop} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 text-zinc-400" title="Stop">
                      <Square size={14} fill="currentColor" />
                  </button>
                  <button onClick={handlePlayPauseClick} className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 ${isPlaying ? 'bg-zinc-200 text-black' : 'bg-studio-accent text-white shadow-lg shadow-red-500/20'}`} title="Play/Pause">
                      {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <button onClick={handleRecordToggle} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-red-500 hover:bg-zinc-700'}`} title="Record">
                      <Circle size={14} fill="currentColor" />
                  </button>
                  {hasSolo && (
                      <button onClick={clearSolo} className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 flex items-center justify-center animate-pulse" title="Clear Solo">
                          <VolumeX size={14} />
                      </button>
                  )}
                  {(isRecording || project.inputMonitoring) && <HeaderInputMeter isRecordingOrMonitoring={isRecording || project.inputMonitoring} />}
              </div>
          </div>

          <div className="flex items-center gap-2">
               <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-white" title="Settings">
                   <Settings size={20} />
               </button>
               <button onClick={() => setShowExport(true)} className="p-2 text-studio-accent hover:text-red-400" title="Export Mix">
                   <Download size={20} />
               </button>
          </div>
      </div>

      {/* Main View Area */}
      <div className="flex flex-1 overflow-hidden relative pb-16"> 
          {/* Main Content (Swapped via State) */}
          <div className="flex-1 overflow-hidden relative flex flex-col h-full">
              {view === 'mixer' && (
                  <Mixer 
                    project={project} 
                    setProject={setProject} 
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPauseClick}
                    onStop={stop}
                    onRecord={handleRecordToggle}
                    onOpenMaster={() => setShowMasterInspector(true)}
                  />
              )}
              {view === 'arranger' && (
                  <Arranger 
                    project={project} 
                    setProject={setProject}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    isRecording={isRecording}
                    recordingStartTime={recordingStartTime}
                    onPlayPause={handlePlayPauseClick}
                    onStop={stop}
                    onRecord={handleRecordToggle}
                    onSeek={handleSeek}
                    onSplit={handleSplit}
                    onSplitAtPlayhead={handleSplitAtPlayhead}
                    zoom={zoom}
                    setZoom={setZoom}
                    selectedTrackId={selectedTrackId}
                    onSelectTrack={setSelectedTrackId}
                    selectedClipIds={selectedClipIds}
                    onSelectClip={setSelectedClipIds}
                    onOpenInspector={setInspectorTrackId}
                    onOpenClipInspector={setInspectorClipId}
                    onMoveTrack={(from, to) => updateProject(p => ({...p, tracks: moveItem(p.tracks, from, to)}))}
                    onRenameClip={(id, name) => updateClip(id, { name })}
                    onColorClip={(id, color) => updateClip(id, { color })}
                    onRenameTrack={(id, name) => updateTrack(id, { name })}
                    autoScroll={autoScroll}
                    onDropAsset={handleDropAsset}
                    commitTransaction={commitTransaction}
                  />
              )}
              {view === 'library' && (
                  <div className="h-full">
                      <Library 
                          currentProjectId={project.id}
                          onLoadProject={loadProjectState}
                          onCreateNewProject={createNewProject}
                          onAddAsset={addAssetToTrack}
                          variant="full"
                      />
                  </div>
              )}
              
              {visualBeat && <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-white animate-ping pointer-events-none z-50" />}
          </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-zinc-800 flex items-center justify-around px-4 z-[90] pb-safe">
          <button onClick={() => setView('arranger')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${view === 'arranger' ? 'text-studio-accent' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <LayoutGrid size={20} />
              <span className="text-[10px] font-bold">Arranger</span>
          </button>
          <button onClick={() => setView('mixer')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${view === 'mixer' ? 'text-studio-accent' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Activity size={20} />
              <span className="text-[10px] font-bold">Mixer</span>
          </button>
          <button onClick={() => setView('library')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${view === 'library' ? 'text-studio-accent' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <FolderOpen size={20} />
              <span className="text-[10px] font-bold">Library</span>
          </button>
      </div>

      {/* Inspectors & Dialogs */}
      {inspectorTrackId && (
          <TrackInspector 
              track={project.tracks.find(t => t.id === inspectorTrackId)!} 
              updateTrack={updateTrack}
              onClose={() => setInspectorTrackId(null)}
              onDeleteTrack={(id) => {
                  if (confirm("Delete track and all its clips?")) {
                      updateProject(prev => ({...prev, tracks: prev.tracks.filter(t => t.id !== id), clips: prev.clips.filter(c => c.trackId !== id)}));
                      setInspectorTrackId(null);
                      showToast("Track deleted", 'info');
                  }
              }}
              onDuplicateTrack={handleDuplicateTrack}
          />
      )}

      {inspectorClipId && (
          <ClipInspector 
              clip={project.clips.find(c => c.id === inspectorClipId)!}
              updateClip={updateClip}
              onClose={() => setInspectorClipId(null)}
              onDeleteClip={(id) => {
                  updateProject(prev => ({...prev, clips: prev.clips.filter(c => c.id !== id)}));
                  setInspectorClipId(null);
                  showToast("Clip deleted", 'info');
              }}
              onDuplicateClip={(id) => {
                  const c = project.clips.find(clip => clip.id === id);
                  if (c) {
                      const copy = { ...c, id: crypto.randomUUID(), start: c.start + c.duration, name: `${c.name} (Copy)` };
                      updateProject(prev => ({...prev, clips: [...prev.clips, copy]}));
                      showToast("Clip duplicated", 'success');
                  }
              }}
              onProcessAudio={handleProcessAudio}
          />
      )}
      
      {showMasterInspector && <MasterInspector project={project} setProject={setProject} onClose={() => setShowMasterInspector(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} project={project} setProject={setProject} />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} onExport={handleExport} isExporting={isExporting} project={project} />}
    </div>
  );
};

const App: React.FC = () => {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
};

export default App;
