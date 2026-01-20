
import { useState, useCallback, useRef } from 'react';
import { audio } from '../services/audio';
import { saveAudioBlob, deleteAudioBlob } from '../services/db';
import { ProjectState, Clip, MidiNote, Track } from '../types';
import { useToast } from '../components/Toast';
import { analytics } from '../services/analytics';

interface UseRecordingWorkflowProps {
    project: ProjectState;
    updateProject: (recipe: any) => void;
    setSelectedClipIds: (ids: string[]) => void;
}

export const useRecordingWorkflow = ({ project, updateProject, setSelectedClipIds }: UseRecordingWorkflowProps) => {
    const { showToast } = useToast();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStartTime, setRecordingStartTime] = useState(0);
    const recordingNotesRef = useRef<MidiNote[]>([]);

    const startRecording = useCallback(async (trackId: string, currentTime: number) => {
        const track = project.tracks.find(t => t.id === trackId);
        if (!track) {
            showToast("No track selected for recording", 'error');
            return;
        }

        if (track.type === 'audio') {
            try {
                await audio.initInput();
                // Playback must start before recording to ensure sync
                audio.play(project.clips, project.tracks, currentTime);
                setIsRecording(true);
                
                const contextRecStart = await audio.startRecording(project.inputMonitoring);
                const preciseProjectStart = audio.getProjectTime(contextRecStart);
                setRecordingStartTime(preciseProjectStart);
                
                showToast("Recording started", 'success');
                analytics.track('recording_started');
            } catch (e) {
                console.error("Recording init failed:", e);
                setIsRecording(false);
                audio.stop();
                showToast("Could not access microphone.", 'error');
            }
        } else if (track.type === 'instrument') {
            recordingNotesRef.current = [];
            audio.play(project.clips, project.tracks, currentTime);
            setIsRecording(true);
            setRecordingStartTime(currentTime);
            showToast("MIDI Recording started", 'success');
            analytics.track('recording_started', { type: 'midi' });
        }
    }, [project.tracks, project.clips, project.inputMonitoring, showToast]);

    const stopRecording = useCallback(async (trackId: string | null) => {
        if (!isRecording) return;

        // 1. Stop Engine
        audio.stop(); // Stops playback and sources
        let blob: Blob | undefined;
        
        // 2. Stop Capture
        try {
            if (audio['recorder']) { 
                 blob = await audio.stopRecording();
            }
        } catch (e) {
            console.error("Failed to stop recording", e);
        }
        
        setIsRecording(false);
        const track = project.tracks.find(t => t.id === trackId);
        
        // 3. Process Result (Transaction)
        if (track?.type === 'audio' && blob) {
            const key = crypto.randomUUID();
            try {
                // Step A: Persist Asset
                await saveAudioBlob(key, blob);
                
                // Step B: Load into Engine Memory
                await audio.loadAudio(key, blob);
                const buffer = audio.buffers.get(key);
                
                // Step C: Calculate Timing
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
                    trackId: track.id,
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
                
                // Step D: Update State
                updateProject((prev: ProjectState) => ({
                    ...prev,
                    clips: [...prev.clips, newClip]
                }));
                setSelectedClipIds([newClip.id]);
                showToast("Recording saved", 'success');
                analytics.track('clip_action', { action: 'record_complete', duration: finalDuration });

            } catch (e: any) {
                console.error("Failed to save recording transaction", e);
                showToast(e.message || "Failed to save recording", 'error');
                
                // Compensating Transaction: Cleanup Orphaned Blob
                try {
                    await deleteAudioBlob(key);
                } catch (cleanupErr) {
                    console.warn("Failed to cleanup orphaned blob", cleanupErr);
                }
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
                    trackId: track.id,
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

                updateProject((prev: ProjectState) => ({
                    ...prev,
                    clips: [...prev.clips, newClip]
                }));
                setSelectedClipIds([newClip.id]);
                showToast(`Recorded ${notes.length} notes`, 'success');
            } else {
                showToast("No notes recorded", 'info');
            }
        }
    }, [isRecording, project.tracks, project.recordingLatency, recordingStartTime, updateProject, setSelectedClipIds, showToast]);

    return {
        isRecording,
        startRecording,
        stopRecording,
        recordingNotesRef,
        recordingStartTime
    };
};
