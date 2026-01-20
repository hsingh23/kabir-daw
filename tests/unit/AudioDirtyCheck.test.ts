

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audio } from '../../services/audio';
import { Track } from '../../types';

// We reuse the global audio instance but reset its state
describe('AudioEngine Optimization (Dirty Checking)', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        audio.trackChannels.clear();
    });

    it('creates channel and applies settings on first call', () => {
        const track: Track = { 
            id: 't1', type: 'audio', name: 'Test', volume: 0.8, pan: 0, muted: false, solo: false, 
            color: '#000', eq: { low: 0, mid: 0, high: 0 }, 
            compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
            sends: { reverb: 0, delay: 0, chorus: 0 },
            sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
        };

        const channel = audio.getTrackChannel(track.id);
        
        // Mock setTargetAtTime
        channel.gain.gain.setTargetAtTime = vi.fn();
        
        audio.applyTrackSettings(channel, track, 0, false);
        
        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, 0, expect.any(Number));
    });

    it('skips redundant updates', () => {
        const track: Track = { 
            id: 't1', type: 'audio', name: 'Test', volume: 0.8, pan: 0, muted: false, solo: false, 
            color: '#000', eq: { low: 0, mid: 0, high: 0 }, 
            compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
            sends: { reverb: 0, delay: 0, chorus: 0 },
            sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
        };

        const channel = audio.getTrackChannel(track.id);
        channel.gain.gain.setTargetAtTime = vi.fn();
        channel.panner.pan.setTargetAtTime = vi.fn();

        // First pass
        audio.applyTrackSettings(channel, track, 0, false);
        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledTimes(1);

        // Second pass (identical)
        audio.applyTrackSettings(channel, track, 1, false);
        
        // Should NOT be called again
        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    });

    it('updates only changed parameters', () => {
        const track: Track = { 
            id: 't1', type: 'audio', name: 'Test', volume: 0.8, pan: 0, muted: false, solo: false, 
            color: '#000', eq: { low: 0, mid: 0, high: 0 }, 
            compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
            sends: { reverb: 0, delay: 0, chorus: 0 },
            sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
        };

        const channel = audio.getTrackChannel(track.id);
        channel.gain.gain.setTargetAtTime = vi.fn();
        channel.panner.pan.setTargetAtTime = vi.fn();

        audio.applyTrackSettings(channel, track, 0, false);

        // Modify volume only
        const updatedTrack = { ...track, volume: 0.5 };
        audio.applyTrackSettings(channel, updatedTrack, 1, false);

        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledTimes(2); // Initial + Update
        expect(channel.panner.pan.setTargetAtTime).toHaveBeenCalledTimes(1); // Initial only
    });
});