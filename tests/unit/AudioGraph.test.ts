
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audio } from '../../services/audio';

describe('Audio Graph Connectivity', () => {
    beforeEach(() => {
        // Reset the singleton state
        audio.trackChannels.clear();
        // Re-initialize might be needed if constructor logic was complex, 
        // but for now we rely on the singleton structure.
        // We can manually reset Master routing if needed, but it's done in constructor.
    });

    it('connects master chain correctly', () => {
        // Access private properties via 'any' to check graph
        const eng = audio as any;
        
        // Check Master Gain -> Low Filter
        expect(eng.masterGain.connectedNodes).toContain(eng.masterLow);
        
        // Low -> Mid
        expect(eng.masterLow.connectedNodes).toContain(eng.masterMid);
        
        // Mid -> High
        expect(eng.masterMid.connectedNodes).toContain(eng.masterHigh);
        
        // High -> Compressor
        expect(eng.masterHigh.connectedNodes).toContain(eng.compressor);
        
        // Compressor -> Analyser
        expect(eng.compressor.connectedNodes).toContain(eng.masterAnalyser);
        
        // Analyser -> Destination
        expect(eng.masterAnalyser.connectedNodes).toContain(eng.ctx.destination);
    });

    it('connects FX returns to master', () => {
        const eng = audio as any;
        expect(eng.reverbReturn.connectedNodes).toContain(eng.masterGain);
        expect(eng.delayReturn.connectedNodes).toContain(eng.masterGain);
        expect(eng.chorusReturn.connectedNodes).toContain(eng.masterGain);
    });

    it('connects track channel to FX sends and master', () => {
        const channel = audio.getTrackChannel('test-track');
        const eng = audio as any;

        // Channel structure: Input -> Distortion -> Filters... -> Gain -> Panner -> Sends/Master
        
        // Check Panner output (which is the effective output of the track strip)
        // Note: In getTrackChannel, we connect panner to sends.
        // But do we connect panner to master? 
        // The `createTrackGraph` connects panner to `destination` arg (which is masterGain).
        // Let's verify.
        
        // In audio.ts `createTrackGraph(this.ctx, this.masterGain)` is called.
        // So panner should connect to masterGain.
        expect((channel.panner as any).connectedNodes).toContain(eng.masterGain);
        
        // Sends
        expect((channel.panner as any).connectedNodes).toContain(channel.reverbSend);
        expect((channel.panner as any).connectedNodes).toContain(channel.delaySend);
        expect((channel.panner as any).connectedNodes).toContain(channel.chorusSend);
        
        // Check Send routing to main FX inputs
        expect((channel.reverbSend as any).connectedNodes).toContain(eng.reverbInput);
        expect((channel.delaySend as any).connectedNodes).toContain(eng.delayInput);
        expect((channel.chorusSend as any).connectedNodes).toContain(eng.chorusInput);
    });

    it('disconnects channel when track is removed', () => {
        const channel = audio.getTrackChannel('to-be-removed');
        
        // Mock disconnect
        const spyDisconnect = vi.spyOn(channel.input, 'disconnect');
        
        // Sync with empty tracks list -> should trigger disconnect/cleanup
        audio.syncTracks([]);
        
        expect(audio.trackChannels.has('to-be-removed')).toBe(false);
        // We call disconnect on input, panner, gain, sends
        expect(spyDisconnect).toHaveBeenCalled();
    });
});
