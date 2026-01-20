
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTimelineMath } from '../../../hooks/useTimelineMath';

describe('useTimelineMath', () => {
    const bpm = 120;
    const timeSignature: [number, number] = [4, 4];
    const zoom = 100; // 100 pixels per second (approx)

    it('calculates seconds per beat correctly', () => {
        const { result } = renderHook(() => useTimelineMath(zoom, bpm, timeSignature));
        // 120 bpm = 2 beats per second = 0.5s per beat
        expect(result.current.secondsPerBeat).toBe(0.5);
    });

    it('converts time to pixels', () => {
        const { result } = renderHook(() => useTimelineMath(zoom, bpm, timeSignature));
        // 2 seconds * 100 px/s = 200px
        expect(result.current.timeToPixels(2)).toBe(200);
    });

    it('converts pixels to time', () => {
        const { result } = renderHook(() => useTimelineMath(zoom, bpm, timeSignature));
        // 300px / 100 px/s = 3 seconds
        expect(result.current.pixelsToTime(300)).toBe(3);
    });

    it('snaps time to grid', () => {
        const { result } = renderHook(() => useTimelineMath(zoom, bpm, timeSignature));
        // Grid 1 (Quarter Note) = 0.5s
        // Time 0.6s should snap to 0.5s
        expect(result.current.snapToGrid(0.6, 1)).toBe(0.5);
        
        // Time 0.8s should snap to 1.0s (0.5 * 2)
        expect(result.current.snapToGrid(0.8, 1)).toBe(1.0);
        
        // Grid 0.5 (Eighth Note) = 0.25s
        // Time 0.3s should snap to 0.25s
        expect(result.current.snapToGrid(0.3, 0.5)).toBe(0.25);
    });

    it('calculates pixels per bar', () => {
        const { result } = renderHook(() => useTimelineMath(zoom, bpm, timeSignature));
        // 4/4 Time = 4 beats per bar.
        // 1 beat = 0.5s.
        // 1 bar = 2.0s.
        // 2.0s * 100px/s = 200px.
        expect(result.current.pixelsPerBar).toBe(200);
    });
});
