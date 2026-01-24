
import React, { useEffect, useRef, useCallback } from 'react';
import { midi } from '../services/midi';
import { audio } from '../services/audio';
import { ProjectState, MidiNote } from '../types';

export const useMidiRouting = (
    project: ProjectState, 
    selectedTrackId: string | null, 
    isRecording: boolean,
    recordingNotesRef: React.MutableRefObject<MidiNote[]>
) => {
    // Ref to access latest state inside callback without re-binding listener constantly
    const stateRef = useRef({ project, selectedTrackId, isRecording });
    
    // Map to track active notes for duration calculation during recording
    const activeRecordingNotes = useRef<Map<number, { startTime: number, velocity: number }>>(new Map());

    useEffect(() => {
        stateRef.current = { project, selectedTrackId, isRecording };
    }, [project, selectedTrackId, isRecording]);

    const handleNoteOn = useCallback((note: number, vel: number) => {
        const { selectedTrackId, project, isRecording } = stateRef.current;
        if (!selectedTrackId) return;
        
        const track = project.tracks.find(t => t.id === selectedTrackId);
        if (track?.type === 'instrument' && track.instrument) {
            // Pass velocity to audio engine
            audio.triggerNoteAttack(track.id, note, track.instrument, vel);
            
            // Recording Logic
            if (isRecording) {
                activeRecordingNotes.current.set(note, { 
                    startTime: audio.getCurrentTime(), // Relative to song start
                    velocity: vel 
                });
            }
        }
    }, []);

    const handleNoteOff = useCallback((note: number) => {
        const { selectedTrackId, isRecording } = stateRef.current;
        if (!selectedTrackId) return;
        audio.triggerNoteRelease(selectedTrackId, note);
        
        // Recording Logic
        if (isRecording) {
            const active = activeRecordingNotes.current.get(note);
            if (active) {
                const endTime = audio.getCurrentTime();
                const duration = Math.max(0.1, endTime - active.startTime);
                
                // Create Note Event
                const midiNote: MidiNote = {
                    note,
                    velocity: active.velocity,
                    start: active.startTime, // Absolute song time for now, normalized later
                    duration
                };
                
                recordingNotesRef.current.push(midiNote);
                activeRecordingNotes.current.delete(note);
            }
        }
    }, []);

    useEffect(() => {
        // midi.init() is called once in App mount, listeners managed here
        // We wrap our manual handlers to match the MidiNoteHandler signature (note, vel, timestamp)
        // Timestamp from MIDI event is high-res but we use audio.getCurrentTime() for synchronization anyway
        const onMidiNoteOn = (n: number, v: number) => handleNoteOn(n, v);
        const onMidiNoteOff = (n: number) => handleNoteOff(n);

        const unsubOn = midi.onNoteOn(onMidiNoteOn);
        const unsubOff = midi.onNoteOff(onMidiNoteOff);

        return () => {
            unsubOn();
            unsubOff();
        };
    }, [handleNoteOn, handleNoteOff]);
    
    // Reset recording state when recording stops
    useEffect(() => {
        if (!isRecording) {
            activeRecordingNotes.current.clear();
        }
    }, [isRecording]);

    return {
        onVirtualNoteOn: handleNoteOn,
        onVirtualNoteOff: handleNoteOff
    };
};
