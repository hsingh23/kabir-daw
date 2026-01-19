export interface Clip {
  id: string;
  trackId: string;
  name: string;
  start: number; // Start time in seconds on timeline
  offset: number; // Start time in the source audio file
  duration: number; // Duration of the clip
  bufferKey: string; // IDB key for the audio buffer
  color?: string;
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
}

export interface ProjectState {
  id: string;
  bpm: number;
  tracks: Track[];
  clips: Clip[];
  loopStart: number;
  loopEnd: number;
  isLooping: boolean;
  masterVolume: number;
  effects: {
    reverb: number; // 0-1
    delay: number; // 0-1
  };
}

export enum ToolMode {
  POINTER = 'POINTER',
  SPLIT = 'SPLIT',
  ERASER = 'ERASER',
}