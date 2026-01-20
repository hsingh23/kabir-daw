
import { useMemo, useCallback } from 'react';

export const useTimelineMath = (zoomLevel: number, bpm: number, timeSignature: [number, number]) => {
    const math = useMemo(() => {
        const safeBpm = Math.max(20, bpm);
        const secondsPerBeat = 60.0 / safeBpm;
        const [numerator, denominator] = timeSignature;
        const beatMultiplier = 4 / denominator;
        const secondsPerTick = secondsPerBeat * beatMultiplier;
        const secondsPerBar = secondsPerTick * numerator;
        
        // Cognitive Refactor: 
        // The user concept is "Zoom", but the system concept is "Pixels Per Second".
        // Explicitly naming this variable reduces the need to recall what "zoom" mathematically represents.
        const pixelsPerSecond = zoomLevel;
        
        const pixelsPerBar = secondsPerBar * pixelsPerSecond;
        const pixelsPerTick = secondsPerTick * pixelsPerSecond;

        return {
            secondsPerBeat,
            secondsPerTick,
            secondsPerBar,
            pixelsPerSecond,
            pixelsPerBar,
            pixelsPerTick,
            numerator,
            denominator
        };
    }, [zoomLevel, bpm, timeSignature]);

    const timeToPixels = useCallback((time: number) => {
        return time * math.pixelsPerSecond;
    }, [math.pixelsPerSecond]);

    const pixelsToTime = useCallback((pixels: number) => {
        return pixels / math.pixelsPerSecond;
    }, [math.pixelsPerSecond]);

    const snapToGrid = useCallback((time: number, gridValueInBeats: number) => {
        if (gridValueInBeats <= 0) return time;
        const snapSeconds = gridValueInBeats * math.secondsPerBeat;
        
        return Math.round(time / snapSeconds) * snapSeconds;
    }, [math.secondsPerBeat]);

    return {
        ...math,
        timeToPixels,
        pixelsToTime,
        snapToGrid
    };
};
