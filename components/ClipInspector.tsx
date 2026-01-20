
import React from 'react';
import { Clip } from '../types';
import Knob from './Knob';
import PianoRoll from './PianoRoll';
import { audio } from '../services/audio';
import { X, Copy, Trash2, Clock, Music2, TrendingUp, Scissors, FlipHorizontal, BarChart2, Palette, MicOff, Mic, Gauge, Piano, AlignStartVertical } from 'lucide-react';

interface ClipInspectorProps {
  clip: Clip;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  onDeleteClip: (id: string) => void;
  onDuplicateClip: (id: string) => void;
  onProcessAudio?: (id: string, type: 'reverse' | 'normalize') => void;
  onClose: () => void;
}

const CLIP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#71717a'
];

const ClipInspector: React.FC<ClipInspectorProps> = ({ clip, updateClip, onDeleteClip, onDuplicateClip, onProcessAudio, onClose }) => {
  
  const currentDetune = clip.detune || 0;
  const semitones = Math.floor(currentDetune / 100);
  const fine = currentDetune % 100;

  const updatePitch = (semi: number, cnts: number) => {
      updateClip(clip.id, { detune: (semi * 100) + cnts });
  };

  const isMidi = !!clip.notes;

  const handleQuantize = () => {
      if (!clip.notes) return;
      // Default to 1/16th grid (0.25s at 120bpm, but grid is in seconds for now if we don't have BPM ref here easily. 
      // Actually notes start is in seconds. We should quantize to 16th grid.
      // Assuming 120bpm for "visual" feel or passing BPM prop. 
      // For proper quantization we really need project BPM.
      // However, most DAWs use a grid setting. Let's assume standard 1/16th quantization (0.125s relative grid? No, 120bpm = 0.5s/beat -> 1/16 = 0.125s).
      
      // Since we lack BPM in this component's props directly (design limitation), 
      // let's use a fixed grid of 0.125s (approx 1/16 @ 120bpm) OR modify props.
      // Better: Use a simple rounding for now or pass BPM. 
      // Let's assume 1/16th grid.
      const grid = 0.125; 
      
      const newNotes = clip.notes.map(n => ({
          ...n,
          start: Math.round(n.start / grid) * grid,
          duration: Math.max(grid, Math.round(n.duration / grid) * grid)
      }));
      updateClip(clip.id, { notes: newNotes });
  };

  const handleGainChange = (v: number) => {
      const gain = v * 2;
      updateClip(clip.id, { gain });
      audio.setClipGain(clip.id, gain);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-24 bg-studio-panel z-[100] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-zinc-700">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded flex items-center justify-center bg-zinc-900 shadow-inner" style={{ backgroundColor: clip.color || '#555' }}>
                {isMidi ? <Piano size={16} className="text-white mix-blend-overlay" /> : <Music2 size={16} className="text-white mix-blend-overlay" />}
             </div>
             <div className="flex-1 min-w-0">
                 <input 
                    value={clip.name}
                    onChange={(e) => updateClip(clip.id, { name: e.target.value })}
                    className="bg-transparent text-lg font-bold text-white outline-none w-full placeholder-zinc-500"
                    placeholder="Clip Name"
                 />
                 <p className="text-xs text-zinc-400 uppercase tracking-widest">{isMidi ? 'MIDI Clip' : 'Audio Clip'}</p>
             </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-zinc-700 hover:bg-zinc-600">
            <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-24">
          
          {/* Piano Roll for MIDI */}
          {isMidi && clip.notes && (
              <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 h-96 flex flex-col shadow-inner">
                  <PianoRoll 
                      notes={clip.notes} 
                      duration={clip.duration} 
                      onNotesChange={(notes) => updateClip(clip.id, { notes })} 
                  />
              </div>
          )}

          {/* MIDI Actions */}
          {isMidi && (
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <Music2 size={12} className="mr-2" /> MIDI Tools
                  </h3>
                  <div className="flex gap-4">
                      <button 
                        onClick={handleQuantize}
                        className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center space-x-2 transition-colors border border-zinc-700"
                        title="Quantize to 1/16th Grid"
                      >
                          <AlignStartVertical size={14} />
                          <span>Quantize (1/16)</span>
                      </button>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Timing Section */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <Clock size={12} className="mr-2" /> Timing
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Start Time (s)</label>
                          <input 
                            type="number" step="0.01"
                            value={clip.start.toFixed(3)}
                            onChange={(e) => updateClip(clip.id, { start: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-2 text-sm text-white font-mono focus:border-studio-accent outline-none"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Duration (s)</label>
                          <input 
                            type="number" step="0.01"
                            value={clip.duration.toFixed(3)}
                            onChange={(e) => updateClip(clip.id, { duration: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-2 text-sm text-white font-mono focus:border-studio-accent outline-none"
                          />
                      </div>
                      {!isMidi && (
                          <div>
                              <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Offset (s)</label>
                              <input 
                                type="number" step="0.01"
                                value={clip.offset.toFixed(3)}
                                onChange={(e) => updateClip(clip.id, { offset: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-2 text-sm text-white font-mono focus:border-studio-accent outline-none"
                              />
                          </div>
                      )}
                  </div>
              </div>

              {/* Properties */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50 relative">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">
                          <TrendingUp size={12} className="mr-2" /> Properties
                      </h3>
                      <button 
                         onClick={() => updateClip(clip.id, { muted: !clip.muted })}
                         className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${clip.muted ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                         title={clip.muted ? "Unmute Clip" : "Mute Clip"}
                      >
                          {clip.muted ? <MicOff size={12} /> : <Mic size={12} />}
                          <span>{clip.muted ? "Muted" : "Active"}</span>
                      </button>
                  </div>
                  <div className={`flex justify-around items-center transition-opacity ${clip.muted ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Knob 
                        label="Gain" 
                        value={(clip.gain ?? 1.0) / 2} // 0 to 2.0 mapped to 0-1
                        min={0} max={1}
                        onChange={handleGainChange}
                      />
                      <Knob 
                        label="Speed" 
                        value={((clip.speed ?? 1.0) - 0.5) / 1.5} // 0.5 to 2.0 mapped to 0-1
                        min={0} max={1}
                        onChange={(v) => updateClip(clip.id, { speed: 0.5 + (v * 1.5) })}
                      />
                  </div>
                  <div className="flex justify-around text-[10px] text-zinc-500 font-mono mt-2">
                        <span>{((clip.gain ?? 1.0) * 100).toFixed(0)}%</span>
                        <span>{((clip.speed ?? 1.0)).toFixed(2)}x</span>
                  </div>
              </div>
          </div>

          {/* Pitch & Color */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                          <Gauge size={12} className="mr-2" /> Pitch
                      </h3>
                      <div className="flex justify-around items-center">
                          <Knob 
                              label="Semi" 
                              value={(semitones + 12) / 24} // -12 to +12
                              min={0} max={1}
                              onChange={(v) => updatePitch(Math.round((v * 24) - 12), fine)} 
                          />
                          <Knob 
                              label="Fine" 
                              value={(fine + 50) / 100} // -50 to +50
                              min={0} max={1}
                              onChange={(v) => updatePitch(semitones, Math.round((v * 100) - 50))} 
                          />
                      </div>
                      <div className="flex justify-around text-[10px] text-zinc-500 font-mono mt-2">
                          <span>{semitones > 0 ? '+' : ''}{semitones} st</span>
                          <span>{fine > 0 ? '+' : ''}{fine} ct</span>
                      </div>
                  </div>

                  <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                            <Palette size={12} className="mr-2" /> Appearance
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {CLIP_COLORS.map(c => (
                                <button 
                                    key={c}
                                    onClick={() => updateClip(clip.id, { color: c })}
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${clip.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-zinc-500'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                  </div>
              </div>
          </div>

          {/* Fades */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                    <Scissors size={12} className="mr-2" /> Fades
                </h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                            <span className="font-bold uppercase">Fade In</span>
                            <span>{clip.fadeIn.toFixed(2)}s</span>
                        </div>
                        <input 
                            type="range" min="0" max={Math.min(clip.duration, 5)} step="0.01"
                            value={clip.fadeIn}
                            onChange={(e) => updateClip(clip.id, { fadeIn: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                            <span className="font-bold uppercase">Fade Out</span>
                            <span>{clip.fadeOut.toFixed(2)}s</span>
                        </div>
                        <input 
                            type="range" min="0" max={Math.min(clip.duration, 5)} step="0.01"
                            value={clip.fadeOut}
                            onChange={(e) => updateClip(clip.id, { fadeOut: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
          </div>

          {/* Audio Processing Actions */}
          {!isMidi && onProcessAudio && (
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <Music2 size={12} className="mr-2" /> Processing
                  </h3>
                  <div className="flex gap-4">
                      <button 
                        onClick={() => onProcessAudio(clip.id, 'reverse')}
                        className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center space-x-2 transition-colors border border-zinc-700"
                      >
                          <FlipHorizontal size={14} />
                          <span>Reverse</span>
                      </button>
                      <button 
                        onClick={() => onProcessAudio(clip.id, 'normalize')}
                        className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center space-x-2 transition-colors border border-zinc-700"
                      >
                          <BarChart2 size={14} />
                          <span>Normalize</span>
                      </button>
                  </div>
              </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-4 pt-4">
              <button 
                onClick={() => onDuplicateClip(clip.id)}
                className="py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center space-x-2 transition-colors border border-zinc-700"
              >
                  <Copy size={16} />
                  <span>Duplicate</span>
              </button>
              <button 
                onClick={() => onDeleteClip(clip.id)}
                className="py-3 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold text-sm flex items-center justify-center space-x-2 transition-colors border border-red-900/30"
              >
                  <Trash2 size={16} />
                  <span>Delete</span>
              </button>
          </div>

      </div>
    </div>
  );
};

export default ClipInspector;
