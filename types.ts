
export interface MidiNote {
  note: number; // MIDI note number (0-127)
  velocity: number; // 0-127
  start: number; // Start time relative to clip start (seconds)
  duration: number; // Duration in seconds
}

export interface MidiMapping {
  id: string;
  cc: number; // Control Change Number
  channel: number;
  targetId: string; // Track ID or 'master'
  parameter: 'volume' | 'pan' | 'cutoff'; // Parameter to control
}

export interface AutomationPoint {
  id: string;
  time: number; // Time in seconds
  value: number; // Normalized value 0-1
  curve?: 'linear' | 'exponential' | 'step'; // Interpolation type
}

export interface AutomationCurves {
  volume?: AutomationPoint[];
  pan?: AutomationPoint[];
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  start: number; // Start time in seconds on timeline
  offset: number; // Start time in the source audio file
  duration: number; // Duration of the clip
  loopLength?: number; // Length of the loop source in seconds (for MIDI looping)
  bufferKey?: string; // IDB key for the audio buffer (Optional for MIDI)
  notes?: MidiNote[]; // Array of MIDI notes (Optional for Audio)
  color?: string;
  muted?: boolean; // Whether the clip is muted
  fadeIn: number; // Duration of fade in seconds
  fadeOut: number; // Duration of fade out seconds
  speed?: number; // Playback speed (1.0 is normal)
  gain?: number; // Volume gain (1.0 is nominal)
  detune?: number; // Pitch shift in cents
}

export type TrackType = 'audio' | 'instrument';

export interface InstrumentConfig {
  type: 'synth';
  preset: 'sine' | 'square' | 'sawtooth' | 'triangle';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
  color: string;
  icon?: string; // 'piano', 'drums', 'guitar', 'mic'
  instrument?: InstrumentConfig; // Only for 'instrument' type tracks
  automation?: AutomationCurves;
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
  sendConfig: {
      reverbPre: boolean;
      delayPre: boolean;
      chorusPre: boolean;
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

// --- NEW INSTRUMENT TYPES ---

export interface SequencerTrack {
  name: string;
  sample: 'kick' | 'snare' | 'hihat';
  steps: boolean[]; // 16 steps
  volume: number;
  muted: boolean;
}

export interface SequencerState {
  enabled: boolean;
  volume: number;
  tracks: SequencerTrack[];
}

export interface DroneOscillator {
  active: boolean;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  octave: number; // -2 to +2 relative to root
  detune: number; // cents
  gain: number;
  pan: number;
}

export interface DroneState {
  enabled: boolean;
  volume: number;
  note: number; // MIDI Root Note
  oscillators: DroneOscillator[];
}

export interface TanpuraState {
  enabled: boolean;
  volume: number;
  key: string;
  tuning: 'Pa' | 'Ma' | 'Ni';
  tempo: number;
  fineTune?: number;
}

export interface TablaState {
  enabled: boolean;
  volume: number;
  taal: string;
  bpm: number;
  key: string;
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
  
  // Instruments
  sequencer: SequencerState;
  drone: DroneState;
  tanpura?: TanpuraState;
  tabla?: TablaState;
  
  midiMappings?: MidiMapping[]; // Saved MIDI mappings
  lastModified?: number;
}

export enum ToolMode {
  POINTER = 'POINTER',
  SPLIT = 'SPLIT',
  ERASER = 'ERASER',
  AUTOMATION = 'AUTOMATION'
}
