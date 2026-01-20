
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
import AudioContextOverlay from './components/AudioContextOverlay'; // Import Overlay
import { ToastProvider, useToast } from './components/Toast';
import { audio } from './services/audio';
import { saveAudioBlob, saveProject, getProject, getAudioBlob } from './services/db';
import { moveItem, audioBufferToWav } from './services/utils';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProjectState } from './hooks/useProjectState';
import { TEMPLATES } from './services/templates';
import { analytics } from './services/analytics';
import { Mic, Music, LayoutGrid, Upload, Plus, Undo2, Redo2, Download, Play, Pause, Square, Circle, Settings, Activity, ArrowRightLeft, Keyboard, ArrowRight, VolumeX } from 'lucide-react';

const INITIAL_PROJECT: ProjectState = {
  id: 'default-project',
  name: 'New Project',
  notes: '',
  bpm: 120,
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
  // URL State Initialization
  const [view, setView] = useState<'mixer' | 'arranger' | 'library'>(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get('view') as 'mixer' | 'arranger' | 'library') || 'mixer';
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
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('1');
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
    // Critical: Clean up old buffers to prevent memory leak
    audio.clearBuffers();
    
    const saved = await getProject(projectId);
    if (saved) {
        // Migration for new state fields
        const migrated = {
            ...INITIAL_PROJECT,
            ...saved,
            name: saved.name || (projectId === 'default-project' ? 'New Project' : `Project ${projectId.slice(0,4)}`),
            effects: { ...INITIAL_PROJECT.effects, ...saved.effects },
            masterCompressor: { ...INITIAL_PROJECT.masterCompressor, ...saved.masterCompressor },
            masterEq: saved.masterEq || INITIAL_PROJECT.masterEq,
            markers: saved.markers || [],
            metronomeSound: saved.metronomeSound || 'beep',
            countIn: saved.countIn || 0,
            recordingLatency: saved.recordingLatency || 0,
            inputMonitoring: saved.inputMonitoring || false,
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
        
        // Load Audio Buffers concurrently with error handling
        const bufferPromises = migrated.clips.map(async (clip: Clip) => {
            try {
                const blob = await getAudioBlob(clip.bufferKey);
                if (blob) {
                    await audio.loadAudio(clip.bufferKey, blob);
                } else {
                    console.warn(`Audio data missing for clip: ${clip.name}`);
                }
            } catch (e) {
                console.error(`Failed to load audio for clip ${clip.name}`, e);
                // We proceed even if audio fails, so the project structure remains
            }
        });
        
        await Promise.all(bufferPromises);
        
        // Set project AFTER buffers are ready
        loadProject(migrated);
        showToast("Project loaded successfully", 'success');
        analytics.track('project_loaded', { projectId: migrated.id });
        
    } else if (projectId !== 'default-project') {
        // If loading a new ID that doesn't exist, init it
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
          if (isRecording) {
             return prevIsPlaying;
          }
          if (prevIsPlaying) {
              audio.pause();
              // Update currentTime one last time when stopping for seek accuracy
              setCurrentTime(audio.getCurrentTime());
              analytics.track('transport_stop');
              return false;
          } else {
              analytics.track('transport_play');
              return true;
          }
      });
  }, [isRecording]);

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
            showToast("Could not start recording. Check microphone permissions.", 'error');
        }
  }, [currentTime, project.clips, project.tracks, project.inputMonitoring, showToast]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
        // Stop Recording
        audio.stop(); 
        const blob = await audio.stopRecording();
        setIsPlaying(false);
        setIsRecording(false);
        setCurrentTime(audio.getCurrentTime()); // Sync time on stop
        
        if (blob && selectedTrackId) {
            const key = crypto.randomUUID();
            await saveAudioBlob(key, blob);
            await audio.loadAudio(key, blob);
            const buffer = audio.buffers.get(key);
            
            // Latency Compensation Logic
            const latencySeconds = (project.recordingLatency || 0) / 1000;
            const rawStart = recordingStartTime;
            let finalStart = rawStart - latencySeconds;
            let finalOffset = 0;
            let finalDuration = buffer?.duration || 0;

            if (finalStart < 0) {
                // If latency pushes clip before 0, truncate start
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
        if (!selectedTrackId) {
            showToast("Select a track to record on first.", 'error');
            return;
        }
        
        // Start Recording Logic
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
    
    const clipA: Clip = {
        ...clip,
        duration: splitOffset,
        fadeOut: 0.05 
    };

    const clipB: Clip = {
        ...clip,
        id: crypto.randomUUID(),
        start: time,
        offset: clip.offset + splitOffset,
        duration: clip.duration - splitOffset,
        name: `${clip.name} (cut)`,
        fadeIn: 0.05,
        speed: clip.speed || 1,
        gain: clip.gain || 1.0
    };

    updateProject(prev => ({
        ...prev,
        clips: prev.clips.map(c => c.id === clipId ? clipA : c).concat(clipB)
    }));
    setSelectedClipIds([clipB.id]);
    analytics.track('arranger_clip_split');
  }, [project.clips, updateProject]);

  const handleSplitAtPlayhead = useCallback(() => {
      let splitCount = 0;
      if (selectedClipIds.length > 0) {
          selectedClipIds.forEach(id => {
              handleSplit(id, currentTime);
              splitCount++;
          });
      } else if (selectedTrackId) {
          const clipsToSplit = project.clips.filter(c => 
              c.trackId === selectedTrackId && 
              c.start < currentTime && 
              (c.start + c.duration) > currentTime
          );
          clipsToSplit.forEach(c => {
              handleSplit(c.id, currentTime);
              splitCount++;
          });
      }
      if (splitCount > 0) showToast("Split clip(s)", 'info');
  }, [selectedClipIds, selectedTrackId, currentTime, project.clips, handleSplit, showToast]);

  const handleDuplicateTrack = useCallback((trackId: string) => {
      const track = project.tracks.find(t => t.id === trackId);
      if (!track) return;

      const newTrackId = crypto.randomUUID();
      const newTrack: Track = {
          ...track,
          id: newTrackId,
          name: `${track.name} (Copy)`
      };

      // Duplicate clips
      const trackClips = project.clips.filter(c => c.trackId === trackId);
      const newClips = trackClips.map(clip => ({
          ...clip,
          id: crypto.randomUUID(),
          trackId: newTrackId
      }));

      // Insert after original track
      const trackIndex = project.tracks.findIndex(t => t.id === trackId);
      const newTracks = [...project.tracks];
      newTracks.splice(trackIndex + 1, 0, newTrack);

      updateProject(prev => ({
          ...prev,
          tracks: newTracks,
          clips: [...prev.clips, ...newClips]
      }));
      
      setSelectedTrackId(newTrackId);
      if (inspectorTrackId) setInspectorTrackId(newTrackId);
      showToast("Track duplicated", 'success');

  }, [project.tracks, project.clips, updateProject, inspectorTrackId, showToast]);

  const clearSolo = useCallback(() => {
      updateProject(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => ({ ...t, solo: false }))
      }));
      showToast("Solo cleared", 'info');
  }, [updateProject, showToast]);

  const handleSeek = useCallback((time: number) => {
    if (isRecording) return;
    setCurrentTime(time);
    if (isPlaying) {
      audio.play(project.clips, project.tracks, time);
    }
  }, [isRecording, isPlaying, project.clips, project.tracks]);

  // Use the extracted keyboard shortcuts hook
  useKeyboardShortcuts({
      project,
      setProject: updateProject,
      selectedClipIds,
      setSelectedClipIds,
      selectedTrackId,
      setSelectedTrackId,
      currentTime,
      isRecording,
      togglePlay,
      handleRecordToggle,
      undo,
      redo,
      clipboard,
      setClipboard,
      handleSplit,
      onSplitAtPlayhead: handleSplitAtPlayhead,
      setShowShortcuts,
      onSeek: handleSeek
  });

  useEffect(() => {
    audio.syncTracks(project.tracks);
    audio.syncInstruments(project.tanpura, project.tabla);
    audio.setMasterVolume(project.masterVolume);
    if (project.masterCompressor) {
        audio.setMasterCompressor(
            project.masterCompressor.threshold, 
            project.masterCompressor.ratio,
            project.masterCompressor.knee,
            project.masterCompressor.attack,
            project.masterCompressor.release
        );
    }
    if (project.masterEq) {
        audio.setMasterEq(project.masterEq.low, project.masterEq.mid, project.masterEq.high);
    }
    audio.setDelayLevel(project.effects.delay);
    audio.setReverbLevel(project.effects.reverb);
    audio.setChorusLevel(project.effects.chorus);
    audio.bpm = project.bpm;
    audio.metronomeEnabled = project.metronomeOn;
    audio.metronomeSound = project.metronomeSound || 'beep';
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
    if (isPlaying) {
      loop();
    } else {
      cancelAnimationFrame(rafRef.current!);
    }
    return () => cancelAnimationFrame(rafRef.current!);
  }, [isPlaying, isRecording, project.isLooping, project.loopEnd, project.loopStart, project.clips, project.tracks, project.bpm, project.metronomeOn]);

  const handlePlayPauseClick = useCallback(() => {
      audio.resumeContext();
      if (isRecording) {
          handleRecordToggle();
          return;
      }
      togglePlay();
  }, [isRecording, handleRecordToggle, togglePlay]);

  const stop = useCallback(() => {
    if (isRecording) {
        handleRecordToggle();
        return;
    }
    audio.stop();
    setIsPlaying(false);
    setCurrentTime(project.isLooping ? project.loopStart : 0);
    analytics.track('transport_stop');
  }, [isRecording, handleRecordToggle, project.isLooping, project.loopStart]);

  const handleExport = useCallback(async (options: { type: 'master' | 'stems' }) => {
      if (project.clips.length === 0) {
          showToast("Nothing to export!", 'error');
          return;
      }
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
              // Export Stems
              for (const track of project.tracks) {
                  const stemProject = {
                      ...project,
                      tracks: project.tracks.map(t => ({
                          ...t,
                          muted: t.id !== track.id,
                          solo: false
                      }))
                  };
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
          updateProject(prev => ({
              ...prev,
              clips: prev.clips.map(c => c.id === clipId ? { ...c, bufferKey: newKey, name: `${c.name} (${type})` } : c)
          }));
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
          
          const newClip: Clip = {
              id: crypto.randomUUID(),
              trackId,
              name: asset.name,
              start: time,
              offset: 0,
              duration,
              bufferKey: asset.id,
              fadeIn: 0, fadeOut: 0, speed: 1, gain: 1
          };
          updateProject(prev => ({...prev, clips: [...prev.clips, newClip]}));
      }
  };

  const addAssetToTrack = async (asset: AssetMetadata) => {
        const trackId = selectedTrackId || project.tracks[0]?.id;
        if (!trackId) return;
        // Default to adding at playhead if using button
        await handleDropAsset(trackId, currentTime, asset);
        showToast(`Added ${asset.name} to track`, 'success');
  };

  const hasSolo = project.tracks.some(t => t.solo);

  return (
    <div className={`flex flex-col h-screen overflow-hidden transition-all duration-300 ${isRecording ? 'ring-4 ring-red-500/50' : ''}`}>
      <AudioContextOverlay />
      
      {/* Header */}
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

          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-zinc-900 rounded-full px-4 py-1.5 border border-zinc-800">
                  <TimeDisplay currentTime={currentTime} bpm={project.bpm} isPlaying={isPlaying} />
                  <div className="w-px h-6 bg-zinc-800 mx-1" />
                  <TempoControl bpm={project.bpm} onChange={(bpm) => updateProject(p => ({...p, bpm}))} />
              </div>
              
              <div className="flex items-center gap-4">
                  <button 
                    onClick={stop}
                    className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 text-zinc-400"
                    title="Stop"
                  >
                      <Square size={14} fill="currentColor" />
                  </button>
                  <button 
                    onClick={handlePlayPauseClick}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 ${isPlaying ? 'bg-zinc-200 text-black' : 'bg-studio-accent text-white shadow-lg shadow-red-500/20'}`}
                    title="Play/Pause (Space)"
                  >
                      {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <button 
                    onClick={handleRecordToggle}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-red-500 hover:bg-zinc-700'}`}
                    title="Record (R)"
                  >
                      <Circle size={14} fill="currentColor" />
                  </button>
                  
                  {/* Clear Solo Button */}
                  {hasSolo && (
                      <button 
                          onClick={clearSolo}
                          className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 flex items-center justify-center animate-pulse hover:bg-yellow-500 hover:text-black transition-colors"
                          title="Clear Solo"
                      >
                          <VolumeX size={14} />
                      </button>
                  )}
                  
                  {/* Visual Feedback for Input */}
                  {(isRecording || project.inputMonitoring) && (
                      <HeaderInputMeter isRecordingOrMonitoring={isRecording || project.inputMonitoring} />
                  )}
              </div>
          </div>

          <div className="flex items-center gap-2">
               {/* View Toggles / Tools */}
               <div className="hidden lg:flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button 
                        onClick={() => setView('mixer')} 
                        className={`p-2 rounded ${view === 'mixer' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                        title="Studio"
                    >
                        <Activity size={18} />
                    </button>
                    <button 
                        onClick={() => setView('arranger')} 
                        className={`p-2 rounded ${view === 'arranger' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                        title="Arranger"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    {/* Auto-Scroll Toggle */}
                    {view === 'arranger' && (
                        <button 
                            onClick={() => setAutoScroll(!autoScroll)} 
                            className={`p-2 rounded ml-1 ${autoScroll ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                            title="Auto-Scroll"
                        >
                            <ArrowRight size={18} />
                        </button>
                    )}
               </div>
               
               {/* Mobile Toggles */}
               <div className="lg:hidden flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button onClick={() => setView('mixer')} className={`p-2 rounded ${view === 'mixer' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}><Activity size={18} /></button>
                    <button onClick={() => setView('arranger')} className={`p-2 rounded ${view === 'arranger' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}><LayoutGrid size={18} /></button>
                    <button onClick={() => setView('library')} className={`p-2 rounded ${view === 'library' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}><Music size={18} /></button>
               </div>
               
               <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-white" title="Settings">
                   <Settings size={20} />
               </button>
               <button onClick={() => setShowExport(true)} className="p-2 text-studio-accent hover:text-red-400" title="Export Mix">
                   <Download size={20} />
               </button>
          </div>
      </div>

      {/* Main View Area */}
      <div className="flex flex-1 overflow-hidden relative">
          
          {/* Central Workspace */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
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
              {/* Force Arranger view on desktop if Library was selected in state but now sidebar handles it, or just use view state normally */}
              {(view === 'arranger' || (view === 'library' && window.innerWidth >= 1024)) && (
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
              {/* Mobile Only Library View */}
              {view === 'library' && (
                  <div className="lg:hidden h-full">
                      <Library 
                          currentProjectId={project.id}
                          onLoadProject={loadProjectState}
                          onCreateNewProject={createNewProject}
                          onAddAsset={addAssetToTrack}
                      />
                  </div>
              )}
              
              {/* Visual Metronome Overlay */}
              {visualBeat && (
                  <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-white animate-ping pointer-events-none z-50" />
              )}
          </div>

          {/* Desktop Library Sidebar */}
          <div className="hidden lg:block w-80 border-l border-zinc-800 bg-studio-panel z-10 shrink-0">
               <Library 
                  currentProjectId={project.id}
                  onLoadProject={loadProjectState}
                  onCreateNewProject={createNewProject}
                  onAddAsset={addAssetToTrack}
                  variant="sidebar"
               />
          </div>

      </div>

      {/* Inspectors & Dialogs */}
      {inspectorTrackId && (
          <TrackInspector 
              track={project.tracks.find(t => t.id === inspectorTrackId)!} 
              updateTrack={updateTrack}
              onClose={() => setInspectorTrackId(null)}
              onDeleteTrack={(id) => {
                  if (confirm("Delete track and all its clips?")) {
                      updateProject(prev => ({
                          ...prev,
                          tracks: prev.tracks.filter(t => t.id !== id),
                          clips: prev.clips.filter(c => c.trackId !== id)
                      }));
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
      
      {showMasterInspector && (
          <MasterInspector 
              project={project} 
              setProject={setProject} 
              onClose={() => setShowMasterInspector(false)} 
          />
      )}

      {showSettings && (
          <SettingsDialog 
            onClose={() => setShowSettings(false)} 
            project={project}
            setProject={setProject}
          />
      )}
      
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      
      {showExport && (
          <ExportDialog 
              onClose={() => setShowExport(false)} 
              onExport={handleExport}
              isExporting={isExporting}
              project={project}
          />
      )}
    </div>
  );
};

// Wrap App content with providers
const App: React.FC = () => {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
};

export default App;
