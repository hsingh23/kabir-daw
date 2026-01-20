
import { ProjectState, Track } from '../types';

const CLIP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#71717a'
];

export const createTrack = (type: 'audio' | 'instrument' = 'audio', name?: string, color?: string): Track => {
    const trackColor = color || CLIP_COLORS[Math.floor(Math.random() * CLIP_COLORS.length)];
    
    return {
        id: crypto.randomUUID(),
        type,
        name: name || (type === 'instrument' ? 'Synth' : 'Audio'),
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        color: trackColor,
        icon: type === 'instrument' ? 'keyboard' : 'music',
        instrument: type === 'instrument' ? { type: 'synth', preset: 'sawtooth', attack: 0.05, decay: 0.1, sustain: 0.5, release: 0.2 } : undefined,
        eq: { low: 0, mid: 0, high: 0 },
        compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
        sends: { reverb: 0, delay: 0, chorus: 0 },
        sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
    };
};

export const TEMPLATES: Record<string, Partial<ProjectState>> = {
    'Basic Band': {
        name: 'Band Recording',
        bpm: 120,
        tracks: [
            createTrack('audio', 'Drums', '#ef4444'),
            createTrack('audio', 'Bass', '#3b82f6'),
            createTrack('audio', 'Guitar', '#eab308'),
            createTrack('audio', 'Vocals', '#a855f7'),
        ]
    },
    'Electronic': {
        name: 'Electronic Beat',
        bpm: 128,
        tracks: [
            createTrack('audio', 'Kick', '#ef4444'),
            createTrack('audio', 'Snare', '#f97316'),
            createTrack('audio', 'HiHats', '#eab308'),
            createTrack('instrument', 'Bass', '#3b82f6'),
            createTrack('instrument', 'Lead', '#06b6d4'),
            createTrack('audio', 'FX', '#ec4899'),
        ]
    },
    'Podcast': {
        name: 'Podcast Episode',
        bpm: 100,
        tracks: [
            createTrack('audio', 'Host', '#3b82f6'),
            createTrack('audio', 'Guest', '#a855f7'),
            createTrack('audio', 'Music Bed', '#22c55e'),
            createTrack('audio', 'SFX', '#f97316'),
        ]
    },
    'Empty': {
        name: 'Empty Project',
        bpm: 120,
        tracks: []
    }
};
