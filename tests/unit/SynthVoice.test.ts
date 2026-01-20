
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audio } from '../../services/audio'; // Uses singleton but we only need classes/types if exported or we rely on mockCtx injection
// Since SynthVoice is not exported, we test via audio.scheduleNote or similar public methods if possible, 
// OR we export SynthVoice for testing. Given constraints, we will test via AudioEngine public methods which use SynthVoice.

describe('SynthVoice Lifecycle', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        audio.scheduledSynthVoices.clear();
        audio.trackChannels.clear();
    });

    it('schedules release and stops oscillator', () => {
        // Setup track
        const track = { id: 't1', type: 'instrument', name: 'Synth', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}, instrument: { type: 'synth', preset: 'sawtooth', attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.2 } };
        audio.syncTracks([track as any]);
        
        // Mock context times
        (audio.ctx as any).currentTime = 0;
        
        // Schedule note
        // Duration 1s. Release 0.2s.
        audio.scheduleNote('t1', 60, 0, 1, track.instrument as any, 100);
        
        expect(audio.scheduledSynthVoices.size).toBe(1);
        const voice = audio.scheduledSynthVoices.values().next().value;
        
        // Check start
        expect(voice.osc.start).toHaveBeenCalledWith(0);
        
        // Check attack ramp
        expect(voice.env.gain.linearRampToValueAtTime).toHaveBeenCalled();
        
        // Check release trigger logic (it is triggered in constructor for scheduleNote case)
        // triggerRelease(0 + 1) -> 1.0s
        // setTargetAtTime(0, 1.0, release/3)
        expect(voice.env.gain.setTargetAtTime).toHaveBeenCalledWith(0, 1.0, expect.any(Number));
        
        // Check stop time: 1.0 + 0.2 + 0.1 = 1.3
        expect(voice.osc.stop).toHaveBeenCalledWith(1.3);
    });

    it('stops immediately on engine stop', () => {
        const track = { id: 't1', type: 'instrument', name: 'Synth', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}, instrument: { type: 'synth', preset: 'sawtooth', attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.2 } };
        audio.syncTracks([track as any]);
        
        audio.scheduleNote('t1', 60, 0, 1, track.instrument as any, 100);
        
        const voice = audio.scheduledSynthVoices.values().next().value;
        const spyDisconnect = vi.spyOn(voice.osc, 'disconnect');
        const spyStop = vi.spyOn(voice.osc, 'stop');
        
        audio.stop();
        
        // Should cancel future events and stop now
        expect(voice.env.gain.cancelScheduledValues).toHaveBeenCalled();
        expect(spyStop).toHaveBeenCalled(); // Called without args or with currentTime
        expect(spyDisconnect).toHaveBeenCalled();
        expect(audio.scheduledSynthVoices.size).toBe(0);
    });
});
