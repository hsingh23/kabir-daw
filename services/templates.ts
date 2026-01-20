
import { ProjectState, Track } from '../types';

export const createTrack = (name: string, color: string, icon: string = 'music'): Track => ({
    id: crypto.randomUUID(),
    type: 'audio',
    name,
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    color,
    icon,
    eq: { low: 0, mid: 0, high: 0 },
    compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
    sends: { reverb: 0, delay: 0, chorus: 0 }
});

export const TEMPLATES: Record<string, Partial<ProjectState>> = {
    'Basic Band': {
        name: 'Band Recording',
        bpm: 120,
        tracks: [
            createTrack('Drums', '#ef4444', 'drum'),
            createTrack('Bass', '#3b82f6', 'guitar'),
            createTrack('Guitar', '#eab308', 'guitar'),
            createTrack('Vocals', '#a855f7', 'mic'),
        ]
    },
    'Electronic': {
        name: 'Electronic Beat',
        bpm: 128,
        tracks: [
            createTrack('Kick', '#ef4444', 'drum'),
            createTrack('Snare', '#f97316', 'drum'),
            createTrack('HiHats', '#eab308', 'drum'),
            createTrack('Bass', '#3b82f6', 'keyboard'),
            createTrack('Lead', '#06b6d4', 'keyboard'),
            createTrack('FX', '#ec4899', 'music'),
        ]
    },
    'Podcast': {
        name: 'Podcast Episode',
        bpm: 100,
        tracks: [
            createTrack('Host', '#3b82f6', 'mic'),
            createTrack('Guest', '#a855f7', 'mic'),
            createTrack('Music Bed', '#22c55e', 'music'),
            createTrack('SFX', '#f97316', 'speaker'),
        ]
    },
    'Empty': {
        name: 'Empty Project',
        bpm: 120,
        tracks: []
    }
};