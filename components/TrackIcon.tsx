
import React from 'react';
import { Mic, Music, Drum, Guitar, Keyboard, Speaker, Headphones } from 'lucide-react';

interface TrackIconProps {
  icon?: string;
  name: string;
  color: string;
  size?: number;
}

export const ICONS: Record<string, React.ElementType> = {
    'music': Music,
    'mic': Mic,
    'drum': Drum,
    'guitar': Guitar,
    'keyboard': Keyboard,
    'speaker': Speaker,
    'headphones': Headphones
};

const TrackIcon: React.FC<TrackIconProps> = ({ icon, name, color, size = 14 }) => {
  // 1. Explicit Icon
  if (icon && ICONS[icon]) {
      const Icon = ICONS[icon];
      return <Icon size={size} style={{ color }} />;
  }

  // 2. Heuristic
  const n = name.toLowerCase();
  if (n.includes('drum') || n.includes('beat') || n.includes('kick') || n.includes('snare')) return <Drum size={size} style={{ color }} />;
  if (n.includes('bass') || n.includes('guitar')) return <Guitar size={size} style={{ color }} />;
  if (n.includes('synth') || n.includes('piano') || n.includes('key') || n.includes('pad')) return <Keyboard size={size} style={{ color }} />;
  if (n.includes('voc') || n.includes('mic') || n.includes('sing')) return <Mic size={size} style={{ color }} />;
  
  // 3. Default
  return <Music size={size} style={{ color }} />;
};

export default TrackIcon;
