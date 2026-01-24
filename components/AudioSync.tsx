
import React, { useEffect } from 'react';
import { audio } from '../services/audio';
import { useProject } from '../contexts/ProjectContext';

const AudioSync: React.FC = () => {
    const { project } = useProject();

    // Sync Tracks
    useEffect(() => {
        audio.syncTracks(project.tracks);
    }, [project.tracks]);

    // Sync Instruments
    useEffect(() => {
        audio.syncInstruments(project.sequencer, project.drone);
    }, [project.sequencer, project.drone]);

    // Sync Backing (Tanpura/Tabla) - Refactored to unified backing handler
    useEffect(() => {
        if (project.tanpura && project.tabla) {
            audio.syncBacking(project.tanpura, project.tabla);
        }
    }, [project.tanpura, project.tabla]);

    // Sync Master Chain
    useEffect(() => {
        audio.setMasterVolume(project.masterVolume);
        if (project.masterCompressor) {
            audio.setMasterCompressor(
                project.masterCompressor.threshold, 
                project.masterCompressor.ratio, 
                project.masterCompressor.knee || 30, 
                project.masterCompressor.attack || 0.003, 
                project.masterCompressor.release || 0.25
            );
        }
        if (project.masterEq) {
            audio.setMasterEq(
                project.masterEq.low, 
                project.masterEq.mid, 
                project.masterEq.high
            );
        }
    }, [project.masterVolume, project.masterCompressor, project.masterEq]);

    // Sync Effects
    useEffect(() => {
        audio.setDelayLevel(project.effects.delay);
        audio.setReverbLevel(project.effects.reverb);
        audio.setChorusLevel(project.effects.chorus);
    }, [project.effects]);

    // Sync Transport Settings
    useEffect(() => {
        audio.bpm = project.bpm;
        audio.timeSignature = project.timeSignature;
        audio.metronomeEnabled = project.metronomeOn;
        audio.metronomeSound = project.metronomeSound || 'beep';
    }, [project.bpm, project.timeSignature, project.metronomeOn, project.metronomeSound]);

    return null;
};

export default AudioSync;
