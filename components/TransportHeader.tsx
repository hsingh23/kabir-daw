
import React from 'react';
import { Undo2, Redo2, Square, Pause, Play, Circle, VolumeX, Piano, Settings, Download, Menu, Timer, Music, Activity } from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import TimeDisplay from './TimeDisplay';
import TempoControl from './TempoControl';
import HeaderInputMeter from './HeaderInputMeter';
import { useProject } from '../contexts/ProjectContext';

interface TransportHeaderProps {
    isPlaying: boolean;
    isRecording: boolean;
    hasSolo: boolean;
    saveStatus: 'saved' | 'saving' | 'unsaved';
    isMidiLearnActive: boolean;
    showKeyboard: boolean;
    isInstrumentTrackSelected: boolean;
    stop: () => void;
    togglePlay: () => void;
    toggleRecord: () => void;
    clearSolo: () => void;
    toggleMetronome: () => void;
    updateBpm: (bpm: number) => void;
    setShowKeyboard: (show: boolean) => void;
    setShowSettings: (show: boolean) => void;
    setShowExport: (show: boolean) => void;
    currentTime: number;
}

const TransportHeader: React.FC<TransportHeaderProps> = ({
    isPlaying, isRecording, hasSolo, saveStatus, isMidiLearnActive, showKeyboard, isInstrumentTrackSelected,
    stop, togglePlay, toggleRecord, clearSolo, toggleMetronome, updateBpm,
    setShowKeyboard, setShowSettings, setShowExport, currentTime
}) => {
    const { project, undo, redo, canUndo, canRedo } = useProject();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    return (
        <div className="flex items-center justify-between h-14 bg-[#262626] border-b border-[#111] shadow-lg px-2 sm:px-4 shrink-0 z-50 select-none relative">
            {/* Top Shine Highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-white/10 pointer-events-none" />

            {/* Left: History & Status */}
            <div className="flex items-center gap-3 w-1/4 min-w-max">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-zinc-400 hover:text-white rounded hover:bg-white/10">
                    <Menu size={20} />
                </button>

                <div className="hidden sm:flex bg-[#1a1a1a] rounded-lg p-0.5 border border-zinc-800 shadow-inner">
                    <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded hover:bg-[#333] text-zinc-400 disabled:opacity-30 active:scale-95 transition-transform" title="Undo">
                        <Undo2 size={16} />
                    </button>
                    <div className="w-px bg-zinc-800 mx-0.5" />
                    <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded hover:bg-[#333] text-zinc-400 disabled:opacity-30 active:scale-95 transition-transform" title="Redo">
                        <Redo2 size={16} />
                    </button>
                </div>
                
                <div className="hidden lg:block">
                    <StatusIndicator status={saveStatus} />
                </div>
            </div>

            {/* Center: LCD & Transport */}
            <div className="flex items-center justify-center gap-6 flex-1">
                
                {/* Transport Buttons */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={stop} 
                        className="group flex flex-col items-center justify-center outline-none"
                        title="Stop (Enter)"
                    >
                        <div className="w-9 h-9 rounded bg-gradient-to-b from-[#444] to-[#222] border border-[#111] shadow flex items-center justify-center group-active:from-[#222] group-active:to-[#222] group-active:translate-y-px">
                            <Square size={12} fill="#bbb" className="text-[#bbb]" />
                        </div>
                    </button>
                    
                    <button 
                        onClick={togglePlay} 
                        className="group flex flex-col items-center justify-center outline-none"
                        title="Play (Space)"
                    >
                        <div className={`w-9 h-9 rounded border border-[#111] shadow flex items-center justify-center group-active:translate-y-px ${isPlaying ? 'bg-gradient-to-b from-green-500 to-green-700 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-gradient-to-b from-[#444] to-[#222]'}`}>
                            {isPlaying ? <Pause size={14} fill="white" className="text-white" /> : <Play size={14} fill="#bbb" className="text-[#bbb] ml-0.5" />}
                        </div>
                    </button>
                    
                    <button 
                        onClick={toggleRecord} 
                        className="group flex flex-col items-center justify-center outline-none"
                        title="Record (R)"
                    >
                        <div className={`w-9 h-9 rounded border border-[#111] shadow flex items-center justify-center group-active:translate-y-px ${isRecording ? 'bg-gradient-to-b from-red-500 to-red-700 animate-pulse' : 'bg-gradient-to-b from-[#444] to-[#222]'}`}>
                            <Circle size={12} fill={isRecording ? 'white' : '#ef4444'} className={isRecording ? 'text-white' : 'text-red-500'} />
                        </div>
                    </button>
                </div>

                {/* LCD Display */}
                <div className="hidden md:flex items-stretch bg-black rounded-lg border-[2px] border-[#555] shadow-[inset_0_2px_10px_rgba(0,0,0,1)] overflow-hidden h-11 w-80 relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />
                    
                    {/* Section 1: Time */}
                    <div className="flex-1 border-r border-[#333] flex items-center justify-center bg-[#111] relative group cursor-pointer hover:bg-[#151515]">
                        <TimeDisplay currentTime={currentTime} bpm={project.bpm} isPlaying={isPlaying} />
                    </div>

                    {/* Section 2: BPM & Div */}
                    <div className="w-24 border-r border-[#333] flex flex-col items-center justify-center bg-[#111] relative">
                        <TempoControl bpm={project.bpm} onChange={updateBpm} />
                        <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Tempo</span>
                    </div>

                    {/* Section 3: Signature / Metronome */}
                    <div className="w-20 flex flex-col items-center justify-center bg-[#111] relative">
                        <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-xs font-mono font-bold text-cyan-500">4</span>
                            <span className="text-[10px] text-zinc-600">/</span>
                            <span className="text-xs font-mono font-bold text-cyan-500">4</span>
                        </div>
                        <button 
                            onClick={toggleMetronome}
                            className={`text-[8px] font-bold uppercase px-1.5 py-px rounded ${project.metronomeOn ? 'bg-purple-900 text-purple-300 shadow-[0_0_5px_rgba(168,85,247,0.5)]' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            Metro
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Master Tools */}
            <div className="flex items-center justify-end gap-3 w-1/4 min-w-max">
                {(isRecording || project.inputMonitoring) && (
                    <div className="hidden sm:block">
                        <HeaderInputMeter isRecordingOrMonitoring={true} />
                    </div>
                )}
                
                {hasSolo && (
                    <button onClick={clearSolo} className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 text-[10px] font-bold animate-pulse uppercase tracking-wider" title="Clear Solo">
                        SOLO
                    </button>
                )}

                {isMidiLearnActive && (
                    <span className="text-[10px] font-bold bg-studio-accent px-2 py-1 rounded text-white animate-pulse hidden sm:inline">MIDI LEARN</span>
                )}
                
                <div className="flex bg-[#1a1a1a] rounded-lg p-0.5 border border-zinc-800 shadow-inner">
                    {isInstrumentTrackSelected && (
                        <button 
                            onClick={() => setShowKeyboard(!showKeyboard)}
                            className={`p-2 rounded hover:bg-[#333] transition-colors hidden sm:block ${showKeyboard ? 'text-studio-accent bg-black/50' : 'text-zinc-400'}`}
                            title="Virtual Keyboard"
                        >
                            <Piano size={18} />
                        </button>
                    )}
                    
                    <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-white hidden sm:block hover:bg-[#333] rounded transition-colors" title="Settings">
                        <Settings size={18} />
                    </button>
                    
                    <div className="w-px bg-zinc-800 my-1 mx-0.5 hidden sm:block" />
                    
                    <button onClick={() => setShowExport(true)} className="p-2 text-blue-400 hover:text-blue-300 hidden sm:block hover:bg-[#333] rounded transition-colors" title="Export Mix">
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown */}
            {mobileMenuOpen && (
                <div className="absolute top-14 left-0 w-64 bg-[#2a2a2a] border-r border-b border-black shadow-2xl z-50 flex flex-col md:hidden animate-in slide-in-from-top-2">
                    <div className="p-4 border-b border-black/20">
                        <div className="text-xs text-zinc-500 font-bold uppercase mb-2">Transport</div>
                        <div className="flex items-center justify-between bg-black rounded p-2 border border-zinc-700">
                            <TempoControl bpm={project.bpm} onChange={updateBpm} />
                            <button 
                                onClick={toggleMetronome}
                                className={`px-2 py-1 rounded text-xs font-bold ${project.metronomeOn ? 'bg-purple-900/50 text-purple-400' : 'text-zinc-500'}`}
                            >
                                Click
                            </button>
                        </div>
                    </div>
                    
                    <button onClick={() => { setShowSettings(true); setMobileMenuOpen(false); }} className="p-4 hover:bg-[#333] text-zinc-300 text-sm font-bold flex items-center gap-3 border-b border-black/20">
                        <Settings size={16} /> Project Settings
                    </button>
                    <button onClick={() => { setShowExport(true); setMobileMenuOpen(false); }} className="p-4 hover:bg-[#333] text-zinc-300 text-sm font-bold flex items-center gap-3 border-b border-black/20">
                        <Download size={16} /> Export / Bounce
                    </button>
                    {isInstrumentTrackSelected && (
                        <button onClick={() => { setShowKeyboard(!showKeyboard); setMobileMenuOpen(false); }} className="p-4 hover:bg-[#333] text-zinc-300 text-sm font-bold flex items-center gap-3">
                            <Piano size={16} /> Virtual Keyboard
                        </button>
                    )}
                </div>
            )}
            
            {mobileMenuOpen && (
                <div className="fixed inset-0 top-14 z-40 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
            )}
        </div>
    );
};

export default TransportHeader;
