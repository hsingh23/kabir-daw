import React from 'react';
import { Track } from '../types';
import Knob from './Knob';
import CustomFader from './Fader';
import { X, Mic, Music, Drum, Guitar, Keyboard } from 'lucide-react';

interface TrackInspectorProps {
  track: Track;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  onClose: () => void;
}

const TrackIcon = ({ name, color, size = 24 }: { name: string, color: string, size?: number }) => {
    const n = name.toLowerCase();
    if (n.includes('drum') || n.includes('beat')) return <Drum size={size} style={{ color }} />;
    if (n.includes('bass') || n.includes('guitar')) return <Guitar size={size} style={{ color }} />;
    if (n.includes('synth') || n.includes('piano') || n.includes('key')) return <Keyboard size={size} style={{ color }} />;
    if (n.includes('voc') || n.includes('mic')) return <Mic size={size} style={{ color }} />;
    return <Music size={size} style={{ color }} />;
};

const TrackInspector: React.FC<TrackInspectorProps> = ({ track, updateTrack, onClose }) => {
  
  const updateEQ = (band: 'low' | 'mid' | 'high', value: number) => {
      updateTrack(track.id, {
          eq: {
              ...track.eq,
              [band]: value
          }
      });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 bg-studio-panel z-[100] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded flex items-center justify-center bg-zinc-900 shadow-inner">
                <TrackIcon name={track.name} color={track.color} />
             </div>
             <div>
                 <h2 className="text-lg font-bold text-white">{track.name}</h2>
                 <p className="text-xs text-zinc-400 uppercase tracking-widest">Channel Strip</p>
             </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-zinc-700 hover:bg-zinc-600">
            <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* EQ Section */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                  3-Band Equalizer
              </h3>
              <div className="flex justify-around items-center">
                  <Knob 
                    label="High" 
                    value={(track.eq?.high + 12) / 24} // map -12..12 to 0..1
                    min={0} max={1}
                    onChange={(v) => updateEQ('high', (v * 24) - 12)} 
                  />
                  <Knob 
                    label="Mid" 
                    value={(track.eq?.mid + 12) / 24} 
                    min={0} max={1}
                    onChange={(v) => updateEQ('mid', (v * 24) - 12)} 
                  />
                  <Knob 
                    label="Low" 
                    value={(track.eq?.low + 12) / 24} 
                    min={0} max={1}
                    onChange={(v) => updateEQ('low', (v * 24) - 12)} 
                  />
              </div>
          </div>

          {/* Fader & Pan Section */}
          <div className="flex-1 flex justify-center space-x-8 items-end h-64">
              <div className="flex flex-col items-center space-y-4">
                  <Knob 
                    label="Pan" 
                    value={(track.pan + 1) / 2} 
                    min={0} max={1}
                    onChange={(v) => updateTrack(track.id, { pan: (v * 2) - 1 })} 
                  />
                  <div className="text-xs text-zinc-400 font-mono">{track.pan.toFixed(2)}</div>
              </div>

              <div className="h-full flex flex-col items-center space-y-4 pt-4">
                  <CustomFader 
                    value={track.volume} 
                    onChange={(v) => updateTrack(track.id, { volume: v })} 
                    height={220}
                  />
                  <div className="text-xs text-zinc-400 font-mono">{Math.round(track.volume * 100)}%</div>
              </div>
          </div>
          
          {/* Controls */}
          <div className="flex justify-center space-x-4">
                <button 
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-colors ${track.muted ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}
                >Mute</button>
                <button 
                    onClick={() => updateTrack(track.id, { solo: !track.solo })}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-colors ${track.solo ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}
                >Solo</button>
          </div>

      </div>
    </div>
  );
};

export default TrackInspector;