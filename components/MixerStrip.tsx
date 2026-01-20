
import React, { memo } from 'react';
import { Track } from '../types';
import CustomFader from './Fader';
import LevelMeter from './LevelMeter';
import TrackIcon from './TrackIcon';

interface MixerStripProps {
    track: Track;
    updateTrack: (id: string, updates: Partial<Track>) => void;
    handleRenameTrack: (id: string, currentName: string) => void;
    analytics: any;
    isImplicitlyMuted?: boolean;
}

const MixerStrip: React.FC<MixerStripProps> = memo(({ track, updateTrack, handleRenameTrack, analytics, isImplicitlyMuted }) => {
    return (
        <div className={`flex flex-col w-20 border-x border-zinc-800 relative group h-full transition-colors duration-300 ${isImplicitlyMuted ? 'opacity-40 bg-black' : 'bg-zinc-900'}`}>
            {/* Top: Info & Routing */}
            <div className={`h-24 p-2 flex flex-col items-center justify-between border-b border-zinc-800 ${isImplicitlyMuted ? 'bg-zinc-950' : 'bg-zinc-900'}`}>
                <div className="w-6 h-6 rounded flex items-center justify-center bg-zinc-800 shadow-inner text-zinc-400">
                    <TrackIcon icon={track.icon} name={track.name} color={track.color} size={14} />
                </div>
                
                <button 
                    className="text-[10px] font-bold text-zinc-400 hover:text-white truncate w-full text-center px-1"
                    onClick={() => handleRenameTrack(track.id, track.name)}
                >
                    {track.name}
                </button>

                <div className="flex space-x-1 w-full justify-center">
                    <button 
                        onClick={() => updateTrack(track.id, { muted: !track.muted })}
                        className={`w-6 h-5 rounded text-[9px] font-bold transition-colors border ${track.muted ? 'bg-red-500 border-red-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:bg-zinc-700'}`}
                    >M</button>
                    <button 
                        onClick={() => updateTrack(track.id, { solo: !track.solo })}
                        className={`w-6 h-5 rounded text-[9px] font-bold transition-colors border ${track.solo ? 'bg-yellow-500 border-yellow-600 text-black' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:bg-zinc-700'}`}
                    >S</button>
                </div>
            </div>

            {/* Middle: Fader Area */}
            <div className={`flex-1 p-2 flex justify-center relative ${isImplicitlyMuted ? 'bg-black' : 'bg-zinc-950/50'}`}>
                {/* Grid Lines */}
                <div className="absolute inset-0 pointer-events-none opacity-20 flex flex-col justify-between py-8 px-4">
                    {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-zinc-700" />)}
                </div>
                
                <div className="h-full flex gap-1 z-10 py-2">
                    <CustomFader 
                        value={track.volume} 
                        onChange={(v) => updateTrack(track.id, { volume: v })} 
                        onChangeEnd={(v) => analytics.track('mixer_action', { action: 'set_volume', trackId: track.id, value: v })}
                        height={300} // Flexible based on container
                        defaultValue={0.8}
                    />
                    <LevelMeter trackId={track.id} vertical={true} />
                </div>
            </div>

            {/* Bottom: Color */}
            <div className="h-3 w-full" style={{ backgroundColor: track.color }} />
        </div>
    );
});

export default MixerStrip;
