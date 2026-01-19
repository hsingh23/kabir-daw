
export interface Clip {
  id: string;
  trackId: string;
  name: string;
  start: number; // Start time in seconds on timeline
  offset: number; // Start time in the source audio file
  duration: number; // Duration of the clip
  bufferKey: string; // IDB key for the audio buffer
  color?: string;
  fadeIn: number; // Duration of fade in seconds
  fadeOut: number; // Duration of fade out seconds
}

export interface Track {
  id: string;
  name: string;
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
  color: string;
  icon?: string; // 'piano', 'drums', 'guitar', 'mic'
  eq: {
    low: number; // Gain in dB (-12 to 12)
    mid: number; // Gain in dB
    high: number; // Gain in dB
  };
}

export interface TanpuraState {
  enabled: boolean;
  volume: number;
  key: string; // "C", "C#", etc.
  tuning: 'Pa' | 'Ma' | 'Ni'; // First string tuning relative to Sa
  tempo: number;
}

export interface TablaState {
  enabled: boolean;
  volume: number;
  taal: string; // "TeenTaal", "Dadra", "Keherwa"
  bpm: number;
  key: string; // Tuning
}

export interface ProjectState {
  id: string;
  bpm: number;
  tracks: Track[];
  clips: Clip[];
  loopStart: number;
  loopEnd: number;
  isLooping: boolean;
  metronomeOn: boolean;
  masterVolume: number;
  effects: {
    reverb: number; // 0-1
    delay: number; // 0-1
    chorus: number; // 0-1
  };
  tanpura: TanpuraState;
  tabla: TablaState;
}

export enum ToolMode {
  POINTER = 'POINTER',
  SPLIT = 'SPLIT',
  ERASER = 'ERASER',
}
