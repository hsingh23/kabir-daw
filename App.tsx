
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, Clip, Marker, AssetMetadata, MidiNote, MidiMapping } from './types';
import Mixer from './components/Mixer';
import Arranger from './components/Arranger';
import Library from './components/Library';
import ProjectsView from './components/ProjectsView';
import CommunityView from './components/CommunityView';
import TrackInspector from './components/TrackInspector';
import ClipInspector from './components/ClipInspector';
import MasterInspector from './components/MasterInspector';
import SettingsDialog from './components/SettingsDialog';
import ShortcutsDialog from './components/ShortcutsDialog';
import ExportDialog from './components/ExportDialog';
import AudioContextOverlay from './components/AudioContextOverlay'; 
import WelcomeOverlay from './components/WelcomeOverlay';
import VirtualKeyboard from './components/VirtualKeyboard';
import MetronomeIndicator from './components/MetronomeIndicator';
import TransportHeader from './components/TransportHeader';
import BottomNavigation, { ViewType } from './components/BottomNavigation';
import { ToastProvider, useToast } from './components/Toast';
import { audio } from './services/audio';
import { midi } from './services/midi';
import { saveAudioBlob, saveProject, getProject, getAudioBlob } from './services/db';
import { moveItem, audioBufferToWav } from './services/utils';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProjectState } from './hooks/useProjectState';
import { useMidiRouting } from './hooks/useMidiRouting';
import { TEMPLATES, createTrack } from './services/templates';
import { analytics } from './services/analytics';

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
  sequencer: {
      enabled: false,
      volume: 0.8,
      tracks: [
          { name: 'Kick', sample: 'kick', steps: new Array(16).fill(false), volume: 1, muted: false },
          { name: 'Snare', sample: 'snare', steps: new Array(16).fill(false), volume: 1, muted: false },
          { name: 'HiHat', sample: 'hihat', steps: new Array(16).fill(false), volume: 0.7, muted: false }
      ]
  },
  drone: {
      enabled: false,
      volume: 0.5,
      note: 36, // C2
      oscillators: [
          { active: true, type: 'sawtooth', octave: 0, detune: 0, gain: 0.5, pan: 0 },
          { active: true, type: 'sine', octave: 1, detune: 5, gain: 0.3, pan: -0.2 },
          { active: false, type: 'square', octave: -1, detune: -5, gain: 0.3, pan: 0.2 },
          { active: false, type: 'triangle', octave: 0, detune: 700, gain: 0.2, pan: 0 } // +7 semitones (Fifth)
      ]
  },
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
  },
  midiMappings: []
};

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const [view, setView] = useState<ViewType>(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get('view') as ViewType) || 'arranger';
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
  
  // MIDI Learn State
  const [isMidiLearnActive, setIsMidiLearnActive] = useState(false);
  const [pendingMidiTarget, setPendingMidiTarget] = useState<{ id: string, param: 'volume' | 'pan' } | null>(null);
  
  // Virtual Keyboard
  const [showKeyboard, setShowKeyboard] = useState(false);
  
  // Save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  const rafRef = useRef<number>(0);
  const saveTimeoutRef = useRef<number | null>(null);
  const recordingNotesRef = useRef<MidiNote[]>([]); // Accumulate MIDI notes here

  // Sync MIDI
  useEffect(() => { 
      midi.init(); 
      
      const handleCC = (cc: number, value: number, channel: number) => {
          // If in learn mode and a UI element is pending
          if (isMidiLearnActive && pendingMidiTarget) {
              const newMapping: MidiMapping = {
                  id: crypto.randomUUID(),
                  cc,
                  channel,
                  targetId: pendingMidiTarget.id,
                  parameter: pendingMidiTarget.param as any
              };
              updateProject(prev => {
                  // Remove existing mappings for this target/param to avoid conflicts
                  const filtered = prev.midiMappings?.filter(m => m.targetId !== pendingMidiTarget.id || m.parameter !== pendingMidiTarget.param) || [];
                  return { ...prev, midiMappings: [...filtered, newMapping] };
              });
              setPendingMidiTarget(null);
              showToast(`Mapped CC${cc} to ${pendingMidiTarget.param}`, 'success');
              return;
          }

          // Normal Operation: Check mappings
          if (project.midiMappings) {
              const mapping = project.midiMappings.find(m => m.cc === cc && m.channel === channel);
              if (mapping) {
                  const normValue = value / 127; // 0-1
                  if (mapping.targetId === 'master') {
                      if (mapping.parameter === 'volume') updateProject(prev => ({ ...prev, masterVolume: normValue }));
                  } else {
                      const track = project.tracks.find(t => t.id === mapping.targetId);
                      if (track) {
                          if (mapping.parameter === 'volume') {
                              updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === mapping.targetId ? { ...t, volume: normValue } : t) }));
                          } else if (mapping.parameter === 'pan') {
                              // MIDI 0-127 -> Pan -1 to 1
                              const panVal = (normValue * 2) - 1;
                              updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === mapping.targetId ? { ...t, pan: panVal } : t) }));
                          }
                      }
                  }
              }
          }
      };

      const unsubCC = midi.onControlChange(handleCC);
      return () => { unsubCC(); };
  }, [isMidiLearnActive, pendingMidiTarget, project.midiMappings, project.tracks]);

  // Use the hook and get the manual triggers
  const { onVirtualNoteOn, onVirtualNoteOff } = useMidiRouting(project, selectedTrackId, isRecording, recordingNotesRef);

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
        // Migration Logic for Legacy Instruments
        const migratedState = { ...INITIAL_PROJECT, ...saved };
        
        // Ensure tracks are migrated with defaults if missing
        migratedState.tracks = saved.tracks.map((t: any) => ({
            ...t,
            type: t.type || 'audio',
            eq: t.eq || { low: 0, mid: 0, high: 0 },
            compressor: t.compressor || { enabled: false, threshold: -15, ratio: 3, attack: 0.01, release: 0.1 },
            sends: t.sends || { reverb: 0, delay: 0, chorus: 0 },
            distortion: t.distortion || 0
        }));

        // If new instrument states are missing, use defaults
        if (!migratedState.sequencer) migratedState.sequencer = INITIAL_PROJECT.sequencer;
        if (!migratedState.drone) migratedState.drone = INITIAL_PROJECT.drone;
        if (!migratedState.tanpura) migratedState.tanpura = INITIAL_PROJECT.tanpura;
        if (!migratedState.tabla) migratedState.tabla = INITIAL_PROJECT.tabla;

        const bufferPromises = migratedState.clips.map(async (clip: Clip) => {
            if (clip.bufferKey) {
                try {
                    const blob = await getAudioBlob(clip.bufferKey);
                    if (blob) {
                        await audio.loadAudio(clip.bufferKey, blob);
                    }
                } catch (e) {
                    console.error(`Failed to load audio for clip ${clip.name}`, e);
                }
            }
        });
        
        await Promise.all(bufferPromises);
        loadProject(migratedState);
        if (migratedState.tracks.length > 0) setSelectedTrackId(migratedState.tracks[0].id);
        
        showToast("Project loaded successfully", 'success');
        analytics.track('project_loaded', { projectId: migratedState.id });
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
      setView('arranger');
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

  // Recording logic same as before...
  const startActualRecording = useCallback(async () => {
        const track = project.tracks.find(t => t.id === selectedTrackId);
        if (track?.type === 'audio') {
            try {
                await audio.initInput();
            } catch (_e) {
                console.error("Recording init failed:", _e);
                setIsRecording(false);
                setIsPlaying(false);
                showToast("Could not access microphone.", 'error');
                return;
            }
        }
        if (track?.type === 'instrument') {
            recordingNotesRef.current = [];
        }
        const startTime = currentTime;
        audio.play(project.clips, project.tracks, startTime);
        setIsPlaying(true);
        setIsRecording(true);
        if (track?.type === 'audio') {
            const contextRecStart = await audio.startRecording(project.inputMonitoring);
            const preciseProjectStart = audio.getProjectTime(contextRecStart);
            setRecordingStartTime(preciseProjectStart);
        } else {
            setRecordingStartTime(startTime);
        }
        showToast("Recording started", 'success');
        analytics.track('recording_started');
  }, [currentTime, project.clips, project.tracks, project.inputMonitoring, selectedTrackId, showToast]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
        audio.stop(); 
        let blob: Blob | undefined;
        
        if (audio['recorder']) { 
             blob = await audio.stopRecording();
        }
        
        setIsPlaying(false);
        setIsRecording(false);
        const stopTime = audio.getCurrentTime();
        setCurrentTime(stopTime); 
        
        const track = project.tracks.find(t => t.id === selectedTrackId);
        
        if (track?.type === 'audio' && blob) {
            const key = crypto.randomUUID();
            try {
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
                    trackId: selectedTrackId!,
                    name: `Audio ${new Date().toLocaleTimeString()}`,
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
            } catch (e: any) {
                console.error("Failed to save recording", e);
                showToast(e.message || "Failed to save recording", 'error');
            }
        } else if (track?.type === 'instrument') {
            const notes = recordingNotesRef.current;
            if (notes.length > 0) {
                const minTime = Math.min(...notes.map(n => n.start));
                const maxTime = Math.max(...notes.map(n => n.start + n.duration));
                const duration = maxTime - minTime;
                
                const relativeNotes = notes.map(n => ({
                    ...n,
                    start: n.start - minTime
                }));

                const newClip: Clip = {
                    id: crypto.randomUUID(),
                    trackId: selectedTrackId!,
                    name: `Midi ${new Date().toLocaleTimeString()}`,
                    start: minTime,
                    offset: 0,
                    duration: duration,
                    loopLength: duration, 
                    notes: relativeNotes,
                    fadeIn: 0,
                    fadeOut: 0,
                    speed: 1,
                    gain: 1.0,
                    bufferKey: '' 
                };

                updateProject(prev => ({
                    ...prev,
                    clips: [...prev.clips, newClip]
                }));
                setSelectedClipIds([newClip.id]);
                showToast(`Recorded ${notes.length} notes`, 'success');
            } else {
                showToast("No notes recorded", 'info');
            }
        }
    } else {
        // Auto-Arm logic
        let trackIdToRecord = selectedTrackId;
        if (!trackIdToRecord) {
            if (project.tracks.length > 0) {
                trackIdToRecord = project.tracks[0].id;
                setSelectedTrackId(trackIdToRecord);
                showToast(`Armed Track: ${project.tracks[0].name}`, 'info');
            } else {
                const newTrack = createTrack('audio', 'Audio 1', '#ef4444');
                updateProject(prev => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
                trackIdToRecord = newTrack.id;
                setSelectedTrackId(newTrack.id);
                showToast("Created and Armed new Audio Track", 'info');
            }
        } else {
             const t = project.tracks.find(t => t.id === trackIdToRecord);
             if (t) showToast(`Recording on ${t.name}`, 'info');
        }

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
    
    // Audio Split
    const clipA: Clip = { ...clip, duration: splitOffset, fadeOut: 0.05 };
    const clipB: Clip = { ...clip, id: crypto.randomUUID(), start: time, offset: clip.offset + splitOffset, duration: clip.duration - splitOffset, name: `${clip.name} (cut)`, fadeIn: 0.05, speed: clip.speed || 1, gain: clip.gain || 1.0 };

    // Midi Split
    if (clip.notes) {
        const notesA = clip.notes.filter(n => n.start < splitOffset);
        const notesB = clip.notes
            .filter(n => (n.start + n.duration) > splitOffset)
            .map(n => ({
                ...n,
                start: n.start - splitOffset
            }));
            
        clipA.notes = notesA;
        clipB.notes = notesB;
        clipB.offset = 0; 
        clipA.loopLength = clipA.duration;
        clipB.loopLength = clipB.duration;
    }

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
      
      updateProject(prev => ({ 
          ...prev, 
          clips: prev.clips.map(c => { 
              if (selectedClipIds.includes(c.id)) { 
                  const qStart = Math.round(c.start / grid) * grid; 
                  let notes = c.notes;
                  if (notes) {
                      notes = notes.map(n => ({
                          ...n,
                          start: Math.round(n.start / grid) * grid,
                          duration: Math.max(grid, Math.round(n.duration / grid) * grid)
                      }));
                  }
                  return { ...c, start: qStart, notes }; 
              } 
              return c; 
          }) 
      }));
      showToast("Quantized clips", 'success');
  }, [selectedClipIds, project.bpm, updateProject, commitTransaction, showToast]);

  useKeyboardShortcuts({
      project, setProject: updateProject, selectedClipIds, setSelectedClipIds, selectedTrackId, setSelectedTrackId, currentTime, isRecording, togglePlay, handleRecordToggle, undo, redo, clipboard, setClipboard, handleSplit, onSplitAtPlayhead: handleSplitAtPlayhead, setShowShortcuts, onSeek: handleSeek, onQuantize: handleQuantize
  });

  useEffect(() => {
    audio.syncTracks(project.tracks);
    audio.syncInstruments(project.sequencer, project.drone);
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
        audio.scheduler(project.tracks, project.clips);
        const time = audio.getCurrentTime();
        if (project.isLooping && time >= project.loopEnd && !isRecording) {
            audio.play(project.clips, project.tracks, project.loopStart);
            setCurrentTime(project.loopStart);
        } 
        rafRef.current = requestAnimationFrame(loop);
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
      
      if (!clip.bufferKey) {
          showToast("Cannot process MIDI clips.", 'error');
          return;
      }

      try {
          const newBuffer = audio.processAudioBuffer(clip.bufferKey, type);
          const newKey = crypto.randomUUID();
          const wav = await audioBufferToWav(newBuffer);
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
            return;
        }
        await handleDropAsset(trackId, currentTime, asset);
        showToast(`Added ${asset.name} to track`, 'success');
  };

  const hasSolo = project.tracks.some(t => t.solo);
  const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
  const inspectorTrack = project.tracks.find(t => t.id === inspectorTrackId);
  const inspectorClip = project.clips.find(c => c.id === inspectorClipId);

  return (
    <div className={`flex flex-col h-screen overflow-hidden transition-all duration-300 ${isRecording ? 'ring-4 ring-red-500/50' : ''}`}>
      <AudioContextOverlay />
      <WelcomeOverlay />
      
      <TransportHeader 
          project={project}
          isPlaying={isPlaying}
          isRecording={isRecording}
          hasSolo={hasSolo}
          saveStatus={saveStatus}
          isMidiLearnActive={isMidiLearnActive}
          showKeyboard={showKeyboard}
          isInstrumentTrackSelected={selectedTrack?.type === 'instrument'}
          undo={undo}
          redo={redo}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          stop={stop}
          togglePlay={handlePlayPauseClick}
          toggleRecord={handleRecordToggle}
          clearSolo={clearSolo}
          updateBpm={(bpm) => updateProject(p => ({...p, bpm}))}
          setShowKeyboard={setShowKeyboard}
          setShowSettings={setShowSettings}
          setShowExport={setShowExport}
          currentTime={currentTime}
      />

      {/* Main View Area */}
      <div className="flex flex-1 overflow-hidden relative pb-16"> 
          {/* Main Content (Swapped via State) */}
          <div className="flex-1 overflow-hidden relative flex flex-col h-full">
              {view === 'projects' && (
                  <ProjectsView 
                      currentProjectId={project.id}
                      onLoadProject={(id) => { loadProjectState(id); setView('arranger'); }}
                      onCreateNewProject={createNewProject}
                  />
              )}
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
              {view === 'community' && (
                  <CommunityView />
              )}
              
              {/* Metronome Indicator - Detached from main render loop */}
              <MetronomeIndicator isPlaying={isPlaying} metronomeOn={project.metronomeOn} bpm={project.bpm} />
          </div>
      </div>

      <BottomNavigation view={view} setView={setView} />

      {/* Virtual Keyboard Overlay */}
      {showKeyboard && selectedTrack?.type === 'instrument' && selectedTrack.instrument && (
          <VirtualKeyboard 
              trackId={selectedTrack.id}
              config={selectedTrack.instrument}
              onClose={() => setShowKeyboard(false)}
              onNoteOn={onVirtualNoteOn}
              onNoteOff={onVirtualNoteOff}
          />
      )}

      {/* Inspectors & Dialogs */}
      {inspectorTrack && (
          <TrackInspector 
              track={inspectorTrack} 
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

      {inspectorClip && (
          <ClipInspector 
              clip={inspectorClip}
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
      
      {showSettings && (
          <SettingsDialog 
              onClose={() => setShowSettings(false)} 
              project={project} 
              setProject={setProject} 
              isMidiLearnActive={isMidiLearnActive}
              setMidiLearnActive={setIsMidiLearnActive}
          />
      )}
      
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
