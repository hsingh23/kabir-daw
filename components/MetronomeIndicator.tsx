
import React, { useEffect, useState } from 'react';
import { audio } from '../services/audio';
import { animation } from '../services/animation';

interface MetronomeIndicatorProps {
    isPlaying: boolean;
    metronomeOn: boolean;
    bpm: number;
}

const MetronomeIndicator: React.FC<MetronomeIndicatorProps> = ({ isPlaying, metronomeOn, bpm }) => {
    const [visualBeat, setVisualBeat] = useState(false);

    useEffect(() => {
        if (!isPlaying || !metronomeOn) {
            setVisualBeat(false);
            return;
        }

        const update = () => {
            const time = audio.getCurrentTime();
            const secondsPerBeat = 60 / bpm;
            const timeSinceBeat = time % secondsPerBeat;
            // Visual pulse for 10% of the beat duration or 100ms, whichever is smaller to be snappy
            const duration = Math.min(0.1, secondsPerBeat * 0.1);
            setVisualBeat(timeSinceBeat < duration);
        };
        
        const unsubscribe = animation.subscribe(update);
        return unsubscribe;
    }, [isPlaying, metronomeOn, bpm]);

    if (!visualBeat) return null;

    return (
        <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-white animate-ping pointer-events-none z-50 shadow-[0_0_10px_white]" />
    );
};

export default MetronomeIndicator;
