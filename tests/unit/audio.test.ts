
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audio } from '../../services/audio';
import { Track, Clip } from '../../types';

describe('AudioEngine', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset tracks
        audio.trackChannels.clear();
        audio.activeSources.clear();
        audio.buffers.clear();
    });

    it('initializes with correct default nodes', () => {
        expect(audio.ctx).toBeDefined();
        expect(audio.masterGain).toBeDefined();
        expect(audio.reverbNode).toBeDefined();
        expect(audio.delayNode).toBeDefined();
    });

    it('creates track channel strip on demand', () => {
        const channel = audio.getTrackChannel('t1');
        expect(channel).toBeDefined();
        expect(channel.gain).toBeDefined();
        expect(channel.panner).toBeDefined();
        expect(channel.reverbSend).toBeDefined();
        expect(channel.delaySend).toBeDefined();
        expect(channel.chorusSend).toBeDefined();
        expect(audio.trackChannels.has('t1')).toBe(true);
    });

    it('syncs track parameters correctly including sends', () => {
        const tracks: Track[] = [
            { id: 't1', type: 'audio', name: 'Test', volume: 0.5, pan: -0.5, muted: false, solo: false, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0.5, delay: 0.2, chorus: 0 } }
        ];

        audio.syncTracks(tracks);
        
        const channel = audio.getTrackChannel('t1');
        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), expect.any(Number));
        expect(channel.panner.pan.setTargetAtTime).toHaveBeenCalledWith(-0.5, expect.any(Number), expect.any(Number));
        expect(channel.reverbSend.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), expect.any(Number));
        expect(channel.delaySend.gain.setTargetAtTime).toHaveBeenCalledWith(0.2, expect.any(Number), expect.any(Number));
    });

    it('mutes track when muted', () => {
        const tracks: Track[] = [
            { id: 't1', type: 'audio', name: 'Test', volume: 0.8, pan: 0, muted: true, solo: false, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 } }
        ];

        audio.syncTracks(tracks);
        const channel = audio.getTrackChannel('t1');
        // Volume should be 0 if muted
        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));
    });

    it('measures input level', () => {
        // Just verify method exists and runs without error in mock env
        const level = audio.measureInputLevel();
        // Since getFloatTimeDomainData mock usually returns zeros or uninitialized array,
        // we check it returns a number.
        expect(level).toBeGreaterThanOrEqual(0);
    });

    it('does not play muted clips', () => {
        // Setup mock buffer
        audio.buffers.set('k1', { duration: 5, sampleRate: 44100, numberOfChannels: 1, getChannelData: () => new Float32Array(100) } as any);
        
        const clips: Clip[] = [
            { id: 'c1', trackId: 't1', name: 'Muted Clip', muted: true, start: 0, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0 },
            { id: 'c2', trackId: 't1', name: 'Active Clip', muted: false, start: 5, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0 }
        ];
        
        const tracks: Track[] = [{ id: 't1', type: 'audio', name: 'T1', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends: {reverb:0,delay:0,chorus:0} }];

        // Spy on createBufferSource
        const spyCreateSource = vi.spyOn(audio.ctx, 'createBufferSource');

        audio.play(clips, tracks, 0);

        // Should only be called once for the active clip
        expect(spyCreateSource).toHaveBeenCalledTimes(1);
    });
});