
import React, { useEffect, useState } from 'react';
import { MousePointer2, MoveHorizontal, Maximize2, Zap } from 'lucide-react';
import { analytics } from '../services/analytics';

const WelcomeOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('onboarding_complete');
    if (!hasSeenWelcome) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem('onboarding_complete', 'true');
    analytics.track('onboarding_completed');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden">
        <div className="p-6 bg-gradient-to-br from-zinc-800 to-zinc-900 border-b border-zinc-800 text-center">
          <div className="w-16 h-16 bg-studio-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 text-studio-accent">
            <Zap size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to PocketStudio</h2>
          <p className="text-zinc-400 text-sm">
            A professional DAW designed for touch. Here are a few tips to get you started.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300 shrink-0">
              <Maximize2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Pinch to Zoom</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pinch the timeline horizontally to zoom in and out. Use two fingers to scroll.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300 shrink-0">
              <MousePointer2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Long Press Actions</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Long press on clips to reveal the context menu for renaming, coloring, or deleting.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300 shrink-0">
              <MoveHorizontal size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Double Tap to Reset</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Double click or tap any fader or knob to reset it to its default value.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 pt-0">
          <button 
            onClick={handleDismiss}
            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors active:scale-95"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeOverlay;
