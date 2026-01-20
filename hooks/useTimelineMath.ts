
import { useMemo, useCallback } from 'react';

export const useTimelineMath = (zoom: number, bpm: number, timeSignature: [number, number]) => {
    const math = useMemo(() => {
        const safeBpm = Math.max(20, bpm);
        const secondsPerBeat = 60.0 / safeBpm;
        const [numerator, denominator] = timeSignature;
        const beatMultiplier = 4 / denominator;
        const secondsPerTick = secondsPerBeat * beatMultiplier;
        const secondsPerBar = secondsPerTick * numerator;
        
        // Zoom is pixels per second approx? 
        // In Arranger: pixelsPerTick = zoom * secondsPerTick.
        // So zoom acts as a scaling factor on the tick duration.
        // Let's standardize: 
        // pixelsPerSecond = zoom (if zoom was strictly px/s)
        // But current implementation: left = time * zoom.
        // So `zoom` IS `pixelsPerSecond`.
        
        const pixelsPerSecond = zoom;
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
    }, [zoom, bpm, timeSignature]);

    const timeToPixels = useCallback((time: number) => {
        return time * math.pixelsPerSecond;
    }, [math.pixelsPerSecond]);

    const pixelsToTime = useCallback((pixels: number) => {
        return pixels / math.pixelsPerSecond;
    }, [math.pixelsPerSecond]);

    const snapToGrid = useCallback((time: number, gridValue: number) => {
        if (gridValue <= 0) return time;
        const snapSeconds = gridValue * math.secondsPerBeat; // gridValue is in beats (e.g. 0.25 = 1/16th)
        // Actually gridValue in Arranger passed as "fraction of bar" or "beats"?
        // In Arranger select: option value="1" (1/4), "0.5" (1/8). 
        // These look like beat fractions.
        // Correct logic: gridValue * secondsPerBeat * (4 / denominator)? 
        // Let's assume gridValue is in Quarter Notes (Beats).
        
        return Math.round(time / snapSeconds) * snapSeconds;
    }, [math.secondsPerBeat]);

    return {
        ...math,
        timeToPixels,
        pixelsToTime,
        snapToGrid
    };
};
