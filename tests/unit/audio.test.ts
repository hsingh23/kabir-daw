
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
        audio.scheduledSynthVoices.clear();
        (audio.ctx as any).state = 'suspended';
        (audio.ctx as any).resume = vi.fn().mockResolvedValue(undefined);
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
        expect(channel.reverbSendPre).toBeDefined();
        expect(channel.reverbSendPost).toBeDefined();
        expect(audio.trackChannels.has('t1')).toBe(true);
    });

    it('syncs track parameters correctly including sends', () => {
        const tracks: Track[] = [
            { id: 't1', type: 'audio', name: 'Test', volume: 0.5, pan: -0.5, muted: false, solo: false, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0.5, delay: 0.2, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
        ];

        audio.syncTracks(tracks);
        
        const channel = audio.getTrackChannel('t1');
        // Check if setTargetAtTime was called on the gain param of the GainNode
        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), expect.any(Number));
        expect(channel.panner.pan.setTargetAtTime).toHaveBeenCalledWith(-0.5, expect.any(Number), expect.any(Number));
        expect(channel.reverbSendPost.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), expect.any(Number));
        expect(channel.delaySendPost.gain.setTargetAtTime).toHaveBeenCalledWith(0.2, expect.any(Number), expect.any(Number));
    });

    it('mutes track when muted', () => {
        const tracks: Track[] = [
            { id: 't1', type: 'audio', name: 'Test', volume: 0.8, pan: 0, muted: true, solo: false, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
        ];

        audio.syncTracks(tracks);
        const channel = audio.getTrackChannel('t1');
        // Volume should be 0 if muted
        expect(channel.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));
    });

    it('implicitly mutes non-soloed tracks when solo is active', () => {
        const tracks: Track[] = [
            { id: 't1', type: 'audio', name: 'Solo Track', volume: 0.8, pan: 0, muted: false, solo: true, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } },
            { id: 't2', type: 'audio', name: 'Other Track', volume: 0.8, pan: 0, muted: false, solo: false, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
        ];

        audio.syncTracks(tracks);
        
        const channel1 = audio.getTrackChannel('t1');
        const channel2 = audio.getTrackChannel('t2');
        
        // Solo track should be at volume
        expect(channel1.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, expect.any(Number), expect.any(Number));
        // Other track should be muted (0)
        expect(channel2.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));
    });

    it('does not play muted clips', () => {
        // Setup mock buffer
        audio.buffers.set('k1', { duration: 5, sampleRate: 44100, numberOfChannels: 1, getChannelData: () => new Float32Array(100) } as any);
        
        const clips: Clip[] = [
            { id: 'c1', trackId: 't1', name: 'Muted Clip', muted: true, start: 0, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0 },
            { id: 'c2', trackId: 't1', name: 'Active Clip', muted: false, start: 5, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0 }
        ];
        
        const tracks: Track[] = [{ id: 't1', type: 'audio', name: 'T1', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends: {reverb:0,delay:0,chorus:0}, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }];

        // Spy on createBufferSource
        const spyCreateSource = vi.spyOn(audio.ctx, 'createBufferSource');

        audio.play(clips, tracks, 0);
        
        audio.processSchedule(tracks, clips);
        
        expect(spyCreateSource).toHaveBeenCalledTimes(0);
    });

    it('pauses correctly', () => {
        audio.isPlaying = true;
        
        // Mock a running source
        const mockSource = { stop: vi.fn(), disconnect: vi.fn() };
        audio.activeSources.set('c1', { source: mockSource as any, gain: {} as any });
        
        audio.pause();
        
        expect(audio.isPlaying).toBe(false);
        expect(mockSource.stop).toHaveBeenCalled();
        expect(audio.activeSources.size).toBe(0);
    });

    it('stops previous sources when playing (seeking)', () => {
        // Setup state as if playing
        audio.isPlaying = true;
        const mockSource = { stop: vi.fn(), disconnect: vi.fn() };
        audio.activeSources.set('c1', { source: mockSource as any, gain: {} as any });
        
        // Call play again (simulating loop or seek)
        audio.play([], [], 5);
        
        // Should have stopped previous sources
        expect(mockSource.stop).toHaveBeenCalled();
        expect(audio.activeSources.size).toBe(0);
        expect(audio.isPlaying).toBe(true);
    });

    it('sets clip gain in real-time', () => {
        const mockGainNode = { gain: { setTargetAtTime: vi.fn() } };
        audio.activeSources.set('c1', { source: {} as any, gain: mockGainNode as any });
        
        audio.setClipGain('c1', 0.5);
        
        expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), expect.any(Number));
    });
});
