

import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Arranger from '../../components/Arranger';
import { ProjectState } from '../../types';

// Mock audio service to prevent actual AudioContext calls during render
vi.mock('../../services/audio', () => ({
  audio: {
    buffers: new Map(),
    getCurrentTime: () => 0,
  }
}));

// Mock Waveform component as it uses Canvas (hard to test in jsdom without canvas mock)
vi.mock('../../components/Waveform', () => ({
  default: () => <div data-testid="mock-waveform">Waveform</div>
}));

// Mock getBoundingClientRect for dragging tests
Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
}));

const mockProject: ProjectState = {
  id: 'test-project',
  name: 'Test Project',
  bpm: 120,
  tracks: [
    { id: 't1', name: 'Guitar', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 } },
    { id: 't2', name: 'Bass', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 } }
  ],
  clips: [
    { id: 'c1', trackId: 't1', name: 'Riff 1', start: 0, offset: 0, duration: 4, bufferKey: 'key1', fadeIn: 0, fadeOut: 0 },
    { id: 'c2', trackId: 't2', name: 'Bassline', start: 0, offset: 0, duration: 4, bufferKey: 'key2', fadeIn: 0, fadeOut: 0 }
  ],
  markers: [],
  loopStart: 0,
  loopEnd: 4,
  isLooping: false,
  metronomeOn: false,
  countIn: 0,
  masterVolume: 1,
  masterEq: { low: 0, mid: 0, high: 0 },
  masterCompressor: {
    threshold: -24,
    ratio: 12
  },
  effects: { reverb: 0, delay: 0, chorus: 0 },
  tanpura: {
    enabled: false,
    volume: 0.5,
    key: 'C',
    tuning: 'Pa',
    tempo: 60
  },
  tabla: {
    enabled: false,
    volume: 0.5,
    taal: 'TeenTaal',
    bpm: 100,
    key: 'C'
  }
};

describe('Arranger Integration', () => {
  it('renders tracks and allows selection', () => {
    const setProject = vi.fn();
    const onSelectTrack = vi.fn();
    const onSelectClip = vi.fn();
    const setZoom = vi.fn();

    const { getByText } = render(
      <Arranger
        project={mockProject}
        setProject={setProject}
        currentTime={0}
        isPlaying={false}
        isRecording={false}
        onPlayPause={() => {}}
        onStop={() => {}}
        onRecord={() => {}}
        onSeek={() => {}}
        onSplit={() => {}}
        zoom={50}
        setZoom={setZoom}
        selectedTrackId={null}
        onSelectTrack={onSelectTrack}
        selectedClipIds={[]}
        onSelectClip={onSelectClip}
        onOpenInspector={() => {}}
      />
    );

    // Verify Track Name is rendered
    expect(getByText('Guitar')).toBeInTheDocument();

    // Verify Clip is rendered
    expect(getByText('Riff 1')).toBeInTheDocument();

    // Simulate clicking a track header
    getByText('Guitar').click();
    expect(onSelectTrack).toHaveBeenCalledWith('t1');
  });

  it('performs marquee selection on clips', () => {
      const onSelectClip = vi.fn();
      
      const { getByRole } = render(
        <Arranger
            project={mockProject}
            setProject={() => {}}
            currentTime={0}
            isPlaying={false}
            isRecording={false}
            onPlayPause={() => {}}
            onStop={() => {}}
            onRecord={() => {}}
            onSeek={() => {}}
            onSplit={() => {}}
            zoom={50}
            setZoom={() => {}}
            selectedTrackId={null}
            onSelectTrack={() => {}}
            selectedClipIds={[]}
            onSelectClip={onSelectClip}
            onOpenInspector={() => {}}
        />
      );

      // Find background container (application role div)
      const container = getByRole('application');
      const background = container.querySelector('.flex-1.overflow-auto');
      expect(background).toBeInTheDocument();

      // 1. Mouse Down with Shift (Start Marquee)
      fireEvent.pointerDown(background!, { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1 });

      // 2. Mouse Move (Drag to cover clips)
      // Assuming layout starts at (0,0) inside scroll container
      // Header is 160px wide (desktop). Clips start after header.
      // We drag from before tracks to cover them.
      fireEvent.pointerMove(background!, { clientX: 500, clientY: 500, pointerId: 1 });

      // 3. Mouse Up (Finish Marquee)
      fireEvent.pointerUp(background!, { clientX: 500, clientY: 500, shiftKey: true, pointerId: 1 });

      // Expect selection of both clips ('c1' and 'c2')
      expect(onSelectClip).toHaveBeenCalledWith(expect.arrayContaining(['c1', 'c2']));
  });
});