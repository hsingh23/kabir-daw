
import { describe, it, expect } from 'vitest';
import { interleave, encodeWAV, computeWaveformPeaks } from '../../services/audio-math';

describe('Worker Logic (Audio Math)', () => {
    
    it('interleaves audio channels correctly', () => {
        const left = new Float32Array([1, 1, 1]);
        const right = new Float32Array([0, 0, 0]);
        const result = interleave(left, right);
        
        // Expect L R L R L R
        expect(result[0]).toBe(1);
        expect(result[1]).toBe(0);
        expect(result[2]).toBe(1);
        expect(result[3]).toBe(0);
        expect(result[4]).toBe(1);
        expect(result[5]).toBe(0);
        expect(result.length).toBe(6);
    });

    it('computes waveform peaks', () => {
        // Samples per peak = 2
        const samples = new Float32Array([0.1, 0.5, -0.9, 0.2, 0.3, 0.3]);
        const peaks = computeWaveformPeaks(samples, 2);
        
        // Chunk 1: [0.1, 0.5] -> max 0.5
        // Chunk 2: [-0.9, 0.2] -> max 0.9 (abs)
        // Chunk 3: [0.3, 0.3] -> max 0.3
        
        expect(peaks.length).toBe(3);
        expect(peaks[0]).toBe(0.5);
        expect(peaks[1]).toBe(0.9);
        expect(peaks[2]).toBe(0.3);
    });

    it('encodes WAV blob correctly', () => {
        const samples = new Float32Array([0, 0.5, -0.5, 0]);
        const sampleRate = 44100;
        const bitDepth = 16;
        const numChannels = 1;
        
        const blob = encodeWAV(samples, numChannels, sampleRate, bitDepth);
        
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('audio/wav');
        expect(blob.size).toBeGreaterThan(44); // Header + Data
    });
});
