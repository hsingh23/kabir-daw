
import React, { memo } from 'react';
import { Track } from '../types';
import CustomFader from './Fader';
import LevelMeter from './LevelMeter';
import TrackIcon from './TrackIcon';
import { audio } from '../services/audio';

interface MixerStripProps {
    track: Track;
    updateTrack: (id: string, updates: Partial<Track>) => void;
    handleRenameTrack: (id: string, currentName: string) => void;
    analytics: any;
    isImplicitlyMuted?: boolean;
}

const MixerStrip: React.FC<MixerStripProps> = memo(({ track, updateTrack, handleRenameTrack, analytics, isImplicitlyMuted }) => {
    return (
        <div className={`flex flex-col w-24 border-r border-zinc-900/50 relative group h-full transition-colors duration-300 select-none ${isImplicitlyMuted ? 'opacity-50 grayscale' : ''} bg-[#1e1e1e]`}>
            
            {/* 1. EQ / Insert Slot Placeholder (Top) */}
            <div className="h-16 bg-[#252525] border-b border-black/40 flex flex-col items-center justify-center space-y-1 p-1">
                <div className="w-full h-4 bg-[#111] rounded-sm border border-zinc-800/50 cursor-pointer hover:border-zinc-600" title="EQ Thumbnail">
                    <div className="w-full h-full opacity-30 bg-gradient-to-r from-green-900 to-blue-900" />
                </div>
                <div className="w-full h-4 bg-[#111] rounded-sm border border-zinc-800/50 cursor-pointer hover:border-zinc-600 flex items-center justify-center">
                    <span className="text-[8px] text-zinc-500">COMP</span>
                </div>
            </div>

            {/* 2. Pan Knob Area */}
            <div className="h-12 bg-[#252525] border-b border-black/40 flex flex-col items-center justify-center relative">
                <div className="relative w-8 h-8 rounded-full border border-zinc-700 bg-[#1a1a1a] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
                    <input 
                        type="range" 
                        min={-1} max={1} step={0.01}
                        value={track.pan}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateTrack(track.id, { pan: val });
                            audio.setTrackPan(track.id, val);
                        }}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-ns-resize z-10"
                        title={`Pan: ${track.pan.toFixed(2)}`}
                    />
                    {/* Visual Pan Dot */}
                    <div 
                        className="w-1 h-3 bg-zinc-400 rounded-full shadow-sm pointer-events-none transform origin-bottom"
                        style={{ transform: `rotate(${track.pan * 45}deg) translateY(-25%)` }}
                    />
                </div>
            </div>

            {/* 3. Fader & Meter Area */}
            <div className="flex-1 bg-[#1a1a1a] p-2 flex justify-between relative shadow-inner">
                {/* Background Track Lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-6 px-4 opacity-20">
                    <div className="w-full h-px bg-zinc-500" /> {/* +6 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* 0 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* -5 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* -10 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* -20 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* -30 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* -40 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* -60 */}
                    <div className="w-full h-px bg-zinc-500" /> {/* -inf */}
                </div>

                {/* Volume Fader */}
                <div className="flex-1 pr-1 z-10 relative">
                    <CustomFader 
                        value={track.volume} 
                        onChange={(v) => audio.setTrackVolume(track.id, v)} 
                        onChangeEnd={(v) => {
                            updateTrack(track.id, { volume: v });
                            analytics.track('mixer_action', { action: 'set_volume', trackId: track.id, value: v });
                        }}
                        height={280} 
                        defaultValue={0.8}
                    />
                </div>

                {/* Meter */}
                <div className="w-3 h-full pb-2 pt-1 bg-[#0a0a0a] rounded-sm border border-zinc-800/50 shadow-inner">
                    <LevelMeter trackId={track.id} vertical={true} />
                </div>
            </div>

            {/* 4. Controls (Mute/Solo) & Name */}
            <div className="bg-[#252525] border-t border-black/40 flex flex-col">
                <div className="flex p-1 gap-1 border-b border-black/20">
                    <button 
                        onClick={() => updateTrack(track.id, { muted: !track.muted })}
                        className={`flex-1 h-6 rounded-[2px] text-[10px] font-bold border shadow-sm transition-all ${
                            track.muted 
                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_8px_rgba(37,99,235,0.5)]' 
                            : 'bg-[#333] border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                    >M</button>
                    <button 
                        onClick={() => updateTrack(track.id, { solo: !track.solo })}
                        className={`flex-1 h-6 rounded-[2px] text-[10px] font-bold border shadow-sm transition-all ${
                            track.solo 
                            ? 'bg-yellow-500 border-yellow-400 text-black shadow-[0_0_8px_rgba(234,179,8,0.5)]' 
                            : 'bg-[#333] border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                    >S</button>
                </div>

                <div className="p-1.5 flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-black/40 shadow-inner text-zinc-400">
                        <TrackIcon icon={track.icon} name={track.name} color={track.color} size={14} />
                    </div>
                    <button 
                        className="text-[10px] font-medium text-zinc-200 hover:text-white truncate w-full text-center bg-black/20 rounded px-1 border border-transparent hover:border-zinc-600"
                        onClick={() => handleRenameTrack(track.id, track.name)}
                    >
                        {track.name}
                    </button>
                </div>
                
                {/* Track Color Bottom Strip */}
                <div className="h-1.5 w-full shadow-sm" style={{ backgroundColor: track.color }} />
            </div>
        </div>
    );
});

export default MixerStrip;
