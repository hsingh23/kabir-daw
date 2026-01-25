
import React, { useEffect, useState, useRef } from 'react';
import { SequencerState } from '../types';
import { audio } from '../services/audio';
import { Power, Volume2, MoreVertical, Circle } from 'lucide-react';

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

  const colors = ['#ef4444', '#3b82f6', '#eab308']; // Red, Blue, Yellow for Kick, Snare, Hat

  return (
    <div className="bg-[#1c1c1c] rounded-xl border border-black shadow-2xl overflow-hidden flex flex-col relative group">
        {/* Rack Ear Gradient */}
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-zinc-700 to-zinc-900" />
        <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-zinc-700 to-zinc-900" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black bg-[#252525] shadow-sm z-10">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] transition-colors ${config.enabled ? 'bg-green-500 text-green-500' : 'bg-zinc-700 text-transparent'}`} />
                <h3 className="text-zinc-200 font-bold tracking-widest uppercase text-xs">Step Sequencer</h3>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-black/30 rounded p-1 border border-white/5">
                    <Volume2 size={12} className="text-zinc-500 ml-1" />
                    <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={config.volume}
                        onChange={(e) => onChange({...config, volume: parseFloat(e.target.value)})}
                        className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                    />
                </div>
                <button 
                    onClick={() => onChange({ ...config, enabled: !config.enabled })}
                    className={`p-1.5 rounded border transition-all ${config.enabled ? 'bg-zinc-800 border-green-500/50 text-green-500 shadow-[inset_0_0_10px_rgba(34,197,94,0.2)]' : 'bg-zinc-800 border-zinc-700 text-zinc-600'}`}
                    title="Power"
                >
                    <Power size={14} />
                </button>
            </div>
        </div>

        {/* Sequencer Grid */}
        <div className="p-4 bg-[#151515] space-y-1">
            {/* Step Indicators */}
            <div className="flex gap-1 pl-[100px] mb-2">
                 {Array.from({length:16}).map((_, i) => (
                     <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i === currentStep ? 'bg-white shadow-[0_0_8px_white]' : (i % 4 === 0 ? 'bg-zinc-700' : 'bg-zinc-800')}`} />
                 ))}
            </div>

            {config.tracks.map((track, trackIdx) => (
                <div key={track.name} className="flex items-center gap-2 h-10">
                    {/* Track Header */}
                    <div className="w-[92px] h-full bg-[#252525] rounded border border-zinc-800 flex items-center justify-between px-2 relative overflow-hidden group/header">
                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: colors[trackIdx % colors.length] }} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${track.muted ? 'text-zinc-600' : 'text-zinc-300'}`}>
                            {track.name}
                        </span>
                        <button 
                            onClick={() => toggleTrackMute(trackIdx)}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${track.muted ? 'bg-blue-900/50 border-blue-800 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                            title="Mute"
                        >
                            M
                        </button>
                    </div>
                    
                    {/* Steps */}
                    <div className="flex-1 grid grid-cols-16 gap-1 h-full">
                        {track.steps.map((active, stepIdx) => {
                            const isCurrent = stepIdx === currentStep;
                            const isBeat = stepIdx % 4 === 0;
                            const color = colors[trackIdx % colors.length];
                            
                            return (
                                <button
                                    key={stepIdx}
                                    onPointerDown={() => toggleStep(trackIdx, stepIdx)}
                                    className={`
                                        rounded-[2px] transition-all duration-75 relative overflow-hidden border
                                        ${active 
                                            ? (track.muted ? 'bg-zinc-700 border-zinc-600 opacity-50' : `bg-opacity-80 border-opacity-50`) 
                                            : (isBeat ? 'bg-zinc-800 border-zinc-700' : 'bg-[#1a1a1a] border-[#222]')}
                                        ${isCurrent ? 'brightness-150 ring-1 ring-white/50 z-10' : ''}
                                        hover:brightness-125
                                    `}
                                    style={{ 
                                        backgroundColor: active && !track.muted ? color : undefined,
                                        borderColor: active && !track.muted ? color : undefined,
                                        boxShadow: active && !track.muted ? `0 0 8px ${color}40` : 'none'
                                    }}
                                >
                                    {/* Inner LED glow look */}
                                    {active && !track.muted && (
                                        <div className="absolute inset-x-1 top-1 h-[2px] bg-white/40 rounded-full blur-[1px]" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default StepSequencer;
