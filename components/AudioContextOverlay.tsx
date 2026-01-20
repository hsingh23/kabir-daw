
import React, { useState, useEffect } from 'react';
import { audio } from '../services/audio';
import { Power, Activity } from 'lucide-react';

const AudioContextOverlay: React.FC = () => {
  const [needsResume, setNeedsResume] = useState(false);

  useEffect(() => {
    const checkState = () => {
      // If context exists and is suspended, we need user interaction
      if (audio.ctx && audio.ctx.state === 'suspended') {
        setNeedsResume(true);
      } else {
        setNeedsResume(false);
      }
    };

    // Check immediately
    checkState();

    // Listen for state changes
    const ctx = audio.ctx;
    ctx.addEventListener('statechange', checkState);

    // Also poll specifically on touch start once to catch edge cases
    const unlock = () => {
        if (audio.ctx.state === 'suspended') {
            audio.resumeContext().then(checkState);
        }
    };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });

    // --- Mobile Lifecycle Handling ---
    const handleVisibilityChange = () => {
        if (document.hidden) {
            // Background: Suspend to save battery and stop audio
            if (audio.ctx.state === 'running') {
                audio.ctx.suspend().then(() => console.log('Audio suspended (background)'));
            }
        } else {
            // Foreground: Resume if we were playing or active
            // Note: We might show overlay if browser blocks resume
            if (audio.ctx.state === 'suspended') {
                setNeedsResume(true);
            }
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ctx.removeEventListener('statechange', checkState);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleResume = async () => {
    await audio.resumeContext();
    setNeedsResume(false);
  };

  if (!needsResume) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="max-w-sm w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
        <div className="w-20 h-20 bg-studio-accent/20 rounded-full flex items-center justify-center text-studio-accent animate-pulse">
            <Activity size={40} />
        </div>
        
        <div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to PocketStudio</h2>
            <p className="text-zinc-400 text-sm">
                The browser requires a click to initialize the audio engine for high-performance playback.
            </p>
        </div>

        <button 
            onClick={handleResume}
            className="w-full py-4 bg-studio-accent hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 flex items-center justify-center gap-3 transition-transform active:scale-95 group"
        >
            <Power size={20} className="group-hover:text-black transition-colors" />
            <span>Start Audio Engine</span>
        </button>
      </div>
    </div>
  );
};

export default AudioContextOverlay;
