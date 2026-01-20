
import React from 'react';
import { Undo2, Redo2, Square, Pause, Play, Circle, VolumeX, Piano, Settings, Download, Menu, Timer } from 'lucide-react';
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
        <div className="flex items-center justify-between h-14 bg-studio-panel border-b border-zinc-800 px-2 sm:px-4 shrink-0 z-50">
            {/* Left: Logo/Undo */}
            <div className="flex items-center gap-2 sm:gap-4">
                <h1 className="text-xl font-bold tracking-tight text-white hidden md:block">
                    <span className="text-studio-accent">Pocket</span>Studio
                </h1>
                
                {/* Mobile Menu Trigger */}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-zinc-400 hover:text-white">
                    <Menu size={20} />
                </button>

                <div className="flex gap-1 hidden sm:flex">
                    <button onClick={undo} disabled={!canUndo} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30" title="Undo (Ctrl+Z)">
                        <Undo2 size={16} />
                    </button>
                    <button onClick={redo} disabled={!canRedo} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 size={16} />
                    </button>
                </div>
                <div className="hidden sm:block">
                    <StatusIndicator status={saveStatus} />
                </div>
            </div>

            {/* Center: Transport & Time (Responsive) */}
            <div className="flex items-center gap-2 sm:gap-6 flex-1 justify-center sm:flex-none">
                <div className="flex items-center gap-2 bg-zinc-900 rounded-full px-2 sm:px-4 py-1.5 border border-zinc-800">
                    <TimeDisplay currentTime={currentTime} bpm={project.bpm} isPlaying={isPlaying} />
                    <div className="w-px h-6 bg-zinc-800 mx-1 hidden sm:block" />
                    <div className="hidden sm:block flex items-center gap-2">
                        <TempoControl bpm={project.bpm} onChange={updateBpm} />
                        <button 
                            onClick={toggleMetronome}
                            className={`p-1 rounded-md transition-colors ${project.metronomeOn ? 'text-studio-accent bg-white/10' : 'text-zinc-600 hover:text-zinc-400'}`}
                            title="Toggle Metronome (M)"
                        >
                            <Timer size={14} />
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={stop} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 text-zinc-400 hidden sm:flex" title="Stop">
                        <Square size={14} fill="currentColor" />
                    </button>
                    <button onClick={togglePlay} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 ${isPlaying ? 'bg-zinc-200 text-black' : 'bg-studio-accent text-white shadow-lg shadow-red-500/20'}`} title="Play/Pause (Space)">
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <button onClick={toggleRecord} className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-red-500 hover:bg-zinc-700'}`} title="Record (R)">
                        <Circle size={14} fill="currentColor" />
                    </button>
                    {hasSolo && (
                        <button onClick={clearSolo} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 flex items-center justify-center animate-pulse" title="Clear Solo">
                            <VolumeX size={14} />
                        </button>
                    )}
                    {(isRecording || project.inputMonitoring) && <HeaderInputMeter isRecordingOrMonitoring={isRecording || project.inputMonitoring} />}
                </div>
            </div>

            {/* Right: Tools & Settings */}
            <div className="flex items-center gap-2">
                {isMidiLearnActive && (
                    <span className="text-[10px] font-bold bg-studio-accent px-2 py-1 rounded text-white animate-pulse mr-2 hidden sm:inline">MIDI LEARN</span>
                )}
                {isInstrumentTrackSelected && (
                    <button 
                        onClick={() => setShowKeyboard(!showKeyboard)}
                        className={`p-2 rounded transition-colors hidden sm:block ${showKeyboard ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                        title="Virtual Keyboard"
                    >
                        <Piano size={20} />
                    </button>
                )}
                <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-white hidden sm:block" title="Settings">
                    <Settings size={20} />
                </button>
                <button onClick={() => setShowExport(true)} className="p-2 text-studio-accent hover:text-red-400 hidden sm:block" title="Export Mix">
                    <Download size={20} />
                </button>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="absolute top-14 left-0 w-48 bg-zinc-900 border-r border-b border-zinc-700 shadow-2xl z-50 p-2 flex flex-col gap-2 md:hidden animate-in slide-in-from-top-2">
                    <div className="flex gap-2 p-2 border-b border-zinc-800">
                        <button onClick={undo} disabled={!canUndo} className="flex-1 p-2 rounded bg-zinc-800 text-zinc-400 disabled:opacity-30 justify-center flex"><Undo2 size={16} /></button>
                        <button onClick={redo} disabled={!canRedo} className="flex-1 p-2 rounded bg-zinc-800 text-zinc-400 disabled:opacity-30 justify-center flex"><Redo2 size={16} /></button>
                    </div>
                    <div className="p-2 bg-zinc-800 rounded flex justify-between items-center">
                        <span className="text-xs text-zinc-400">Tempo</span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={toggleMetronome}
                                className={`p-1 rounded-md transition-colors ${project.metronomeOn ? 'text-studio-accent bg-white/10' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                <Timer size={14} />
                            </button>
                            <TempoControl bpm={project.bpm} onChange={updateBpm} />
                        </div>
                    </div>
                    <button onClick={() => { setShowSettings(true); setMobileMenuOpen(false); }} className="p-3 rounded hover:bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center gap-3">
                        <Settings size={16} /> Settings
                    </button>
                    <button onClick={() => { setShowExport(true); setMobileMenuOpen(false); }} className="p-3 rounded hover:bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center gap-3">
                        <Download size={16} /> Export
                    </button>
                    {isInstrumentTrackSelected && (
                        <button onClick={() => { setShowKeyboard(!showKeyboard); setMobileMenuOpen(false); }} className="p-3 rounded hover:bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center gap-3">
                            <Piano size={16} /> Keyboard
                        </button>
                    )}
                </div>
            )}
            
            {/* Mobile Overlay for Menu */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 top-14 z-40 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
            )}
        </div>
    );
};

export default TransportHeader;
