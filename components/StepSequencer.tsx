
import React, { useEffect, useState, useRef } from 'react';
import { SequencerState } from '../types';
import Knob from './Knob';
import { audio } from '../services/audio';
import { Power, Volume2 } from 'lucide-react';

interface StepSequencerProps {
  config: SequencerState;
  onChange: (config: SequencerState) => void;
}

const StepSequencer: React.FC<StepSequencerProps> = ({ config, onChange }) => {
  const [currentStep, setCurrentStep] = useState(-1);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const loop = () => {
        if (config.enabled && audio.isPlaying) {
            setCurrentStep(audio.currentStep % 16);
        } else {
            setCurrentStep(-1);
        }
        rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [config.enabled]);

  const toggleStep = (trackIndex: number, stepIndex: number) => {
      const newTracks = [...config.tracks];
      newTracks[trackIndex].steps = [...newTracks[trackIndex].steps];
      newTracks[trackIndex].steps[stepIndex] = !newTracks[trackIndex].steps[stepIndex];
      onChange({ ...config, tracks: newTracks });
  };

  const toggleTrackMute = (trackIndex: number) => {
      const newTracks = [...config.tracks];
      newTracks[trackIndex] = { ...newTracks[trackIndex], muted: !newTracks[trackIndex].muted };
      onChange({ ...config, tracks: newTracks });
  };

  return (
    <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
            <h3 className="text-zinc-200 font-bold tracking-wide uppercase text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-studio-accent"></span>
                Beat Sequencer
            </h3>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Volume2 size={14} className="text-zinc-500" />
                    <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={config.volume}
                        onChange={(e) => onChange({...config, volume: parseFloat(e.target.value)})}
                        className="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
                <button 
                    onClick={() => onChange({ ...config, enabled: !config.enabled })}
                    className={`p-1.5 rounded-md transition-all duration-300 ${config.enabled ? 'bg-studio-accent text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
                >
                    <Power size={14} />
                </button>
            </div>
        </div>

        <div className="flex flex-col space-y-3">
            {config.tracks.map((track, trackIdx) => (
                <div key={track.name} className="flex items-center gap-2">
                    <button 
                        onClick={() => toggleTrackMute(trackIdx)}
                        className={`w-16 text-[10px] font-bold uppercase py-1 rounded transition-colors ${track.muted ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
                    >
                        {track.name}
                    </button>
                    
                    <div className="flex-1 grid grid-cols-16 gap-0.5 sm:gap-1">
                        {track.steps.map((active, stepIdx) => {
                            const isCurrent = stepIdx === currentStep;
                            const isBeat = stepIdx % 4 === 0;
                            return (
                                <button
                                    key={stepIdx}
                                    onPointerDown={() => toggleStep(trackIdx, stepIdx)}
                                    className={`
                                        h-8 sm:h-10 rounded-sm transition-all duration-75 relative
                                        ${active 
                                            ? (track.muted ? 'bg-zinc-600' : 'bg-studio-accent shadow-[0_0_8px_rgba(239,68,68,0.6)]') 
                                            : (isBeat ? 'bg-zinc-700' : 'bg-zinc-800')}
                                        ${isCurrent ? 'ring-1 ring-white brightness-150' : ''}
                                        hover:brightness-110
                                    `}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
        
        {/* Step Indicators */}
        <div className="flex gap-2 pl-[72px]">
             <div className="flex-1 grid grid-cols-16 gap-0.5 sm:gap-1">
                 {Array.from({length:16}).map((_, i) => (
                     <div key={i} className={`h-1 rounded-full ${i % 4 === 0 ? 'bg-zinc-600' : 'bg-zinc-800'}`} />
                 ))}
             </div>
        </div>
    </div>
  );
};

export default StepSequencer;
