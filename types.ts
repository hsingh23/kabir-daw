
export interface Clip {
  id: string;
  trackId: string;
  name: string;
  start: number; // Start time in seconds on timeline
  offset: number; // Start time in the source audio file
  duration: number; // Duration of the clip
  bufferKey: string; // IDB key for the audio buffer
  color?: string;
  muted?: boolean; // Whether the clip is muted
  fadeIn: number; // Duration of fade in seconds
  fadeOut: number; // Duration of fade out seconds
  speed?: number; // Playback speed (1.0 is normal)
  gain?: number; // Volume gain (1.0 is nominal)
  detune?: number; // Pitch shift in cents
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
  distortion?: number; // 0 to 1
  compressor?: {
    enabled: boolean;
    threshold: number; // -60 to 0 dB
    ratio: number; // 1 to 20
    attack: number; // 0 to 1
    release: number; // 0 to 1
  };
  sends: {
    reverb: number; // 0 to 1
    delay: number; // 0 to 1
    chorus: number; // 0 to 1
  };
}

export interface AssetMetadata {
  id: string; // matches the key in ASSET_STORE
  name: string;
  type: 'loop' | 'oneshot' | 'stem' | 'song';
  instrument: string; // 'Drums', 'Bass', 'Synth', etc.
  group?: string; // Song Name or Pack Name
  key?: string;
  bpm?: number;
  tags: string[];
  duration: number;
  dateAdded: number;
  fileType: string;
}

export interface TanpuraState {
  enabled: boolean;
  volume: number;
  key: string; // "C", "C#", etc.
  tuning: 'Pa' | 'Ma' | 'Ni'; // First string tuning relative to Sa
  tempo: number;
  fineTune?: number; // Detune in cents (+/- 100)
}

export interface TablaState {
  enabled: boolean;
  volume: number;
  taal: string; // "TeenTaal", "Dadra", "Keherwa"
  bpm: number;
  key: string; // Tuning
}

export interface Marker {
  id: string;
  time: number;
  text: string;
  color: string;
}

export interface ProjectState {
  id: string;
  name: string;
  notes?: string; // Project notes/lyrics
  bpm: number;
  timeSignature: [number, number]; // [Numerator, Denominator] e.g. [4, 4]
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  loopStart: number;
  loopEnd: number;
  isLooping: boolean;
  metronomeOn: boolean;
  metronomeSound?: 'beep' | 'click' | 'hihat';
  countIn: number; // 0, 1, 2, 4 bars
  recordingLatency: number; // in milliseconds
  inputMonitoring: boolean;
  returnToStartOnStop: boolean; // Behavior preference
  masterVolume: number;
  masterEq: {
      low: number; // -12 to 12 dB
      mid: number;
      high: number;
  };
  masterCompressor: {
      threshold: number; // -60 to 0 dB
      ratio: number; // 1 to 20
      knee?: number; // 0 to 40
      attack?: number; // 0 to 1
      release?: number; // 0 to 1
  };
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
