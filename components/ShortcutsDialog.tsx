
import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutsDialogProps {
  onClose: () => void;
}

const SHORTCUTS = [
    { key: 'Space', desc: 'Play / Stop' },
    { key: 'R', desc: 'Toggle Recording' },
    { key: 'L', desc: 'Toggle Loop' },
    { key: 'M', desc: 'Toggle Metronome' },
    { key: '?', desc: 'Show Shortcuts' },
    { key: 'Ctrl + Z', desc: 'Undo' },
    { key: 'Ctrl + Shift + Z', desc: 'Redo' },
    { key: 'Ctrl + C', desc: 'Copy Selection' },
    { key: 'Ctrl + V', desc: 'Paste' },
    { key: 'Ctrl + D', desc: 'Duplicate Selection' },
    { key: 'Ctrl + B', desc: 'Split at Playhead' },
    { key: 'Del / Backspace', desc: 'Delete Selection' },
    { key: 'Arrows', desc: 'Nudge Selection' },
    { key: 'Shift + Arrows', desc: 'Nudge (Large Step)' },
    { key: 'Ctrl + Scroll', desc: 'Zoom Timeline' },
];

const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-800/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Keyboard size={20} className="text-zinc-400" /> Keyboard Shortcuts
                </h2>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    {SHORTCUTS.map((s, i) => (
                        <div key={i} className="flex justify-between items-center group">
                            <span className="text-zinc-400 text-sm font-medium group-hover:text-zinc-200 transition-colors">{s.desc}</span>
                            <span className="flex items-center gap-1">
                                {s.key.split(' ').map((k, j) => (
                                    <React.Fragment key={j}>
                                        {k === '+' || k === '/' ? (
                                            <span className="text-zinc-600 text-xs font-bold px-0.5">{k}</span>
                                        ) : (
                                            <kbd className="bg-zinc-800 border-b-2 border-zinc-950 text-zinc-200 rounded px-1.5 py-0.5 text-xs font-mono min-w-[20px] text-center shadow-sm">
                                                {k === 'Ctrl' ? <Command size={10} /> : k}
                                            </kbd>
                                        )}
                                    </React.Fragment>
                                ))}
                            </span>
                        </div>
                    ))}
                </div>
                
                <div className="mt-8 pt-4 border-t border-zinc-800 text-center">
                    <p className="text-xs text-zinc-500">
                        Double-click tracks or clips to open their respective inspectors.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ShortcutsDialog;
