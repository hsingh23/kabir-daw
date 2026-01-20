
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

// Mock Waveform component to capture props
vi.mock('../../components/Waveform', () => ({
  default: (props: any) => <div data-testid="mock-waveform" data-props={JSON.stringify(props)}>Waveform</div>
}));

// Mock getBoundingClientRect for dragging tests
Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
}));

const mockProject: ProjectState = {
  id: 'test-project',
  name: 'Test Project',
  bpm: 120,
  timeSignature: [4, 4],
  returnToStartOnStop: true,
  tracks: [
    { id: 't1', type: 'audio', name: 'Guitar', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } },
    { id: 't2', type: 'audio', name: 'Bass', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
  ],
  clips: [
    { id: 'c1', trackId: 't1', name: 'Riff 1', start: 0, offset: 2, duration: 4, bufferKey: 'key1', fadeIn: 0.5, fadeOut: 0.5 },
    { id: 'c2', trackId: 't2', name: 'Bassline', start: 0, offset: 0, duration: 4, bufferKey: 'key2', fadeIn: 0, fadeOut: 0 }
  ],
  markers: [],
  loopStart: 0,
  loopEnd: 4,
  isLooping: false,
  metronomeOn: false,
  countIn: 0,
  recordingLatency: 0,
  inputMonitoring: false,
  masterVolume: 1,
  masterEq: { low: 0, mid: 0, high: 0 },
  masterCompressor: {
    threshold: -24,
    ratio: 12,
    knee: 10,
    attack: 0.05,
    release: 0.25
  },
  effects: { reverb: 0, delay: 0, chorus: 0 },
  sequencer: { enabled: false, volume: 0.8, tracks: [] },
  drone: { enabled: false, volume: 0.5, note: 36, oscillators: [] }
};

describe('Arranger Integration', () => {
  it('renders tracks and passes correct props to Waveform', () => {
    const setProject = vi.fn();
    const onSelectTrack = vi.fn();
    const onSelectClip = vi.fn();
    const setZoom = vi.fn();

    const { getByText, getAllByTestId } = render(
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
        commitTransaction={() => {}}
      />
    );

    // Verify Track Name is rendered
    expect(getByText('Guitar')).toBeInTheDocument();

    // Verify Waveform props for clipping/fades
    const waveforms = getAllByTestId('mock-waveform');
    // c1 has offset 2, fadeIn 0.5
    const c1Props = JSON.parse(waveforms[0].getAttribute('data-props') || '{}');
    expect(c1Props.offset).toBe(2);
    expect(c1Props.duration).toBe(4);
    expect(c1Props.fadeIn).toBe(0.5);
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
            commitTransaction={() => {}}
        />
      );

      const container = getByRole('application');
      const background = container.querySelector('.flex-1.overflow-auto');
      
      fireEvent.pointerDown(background!, { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1 });
      fireEvent.pointerMove(background!, { clientX: 500, clientY: 500, pointerId: 1 });
      fireEvent.pointerUp(background!, { clientX: 500, clientY: 500, shiftKey: true, pointerId: 1 });

      expect(onSelectClip).toHaveBeenCalledWith(expect.arrayContaining(['c1', 'c2']));
  });

  it('calls onSplitAtPlayhead when Split button is clicked', () => {
      const onSplitAtPlayhead = vi.fn();
      const { getByTitle } = render(
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
            onSplitAtPlayhead={onSplitAtPlayhead}
            zoom={50}
            setZoom={() => {}}
            selectedTrackId={null}
            onSelectTrack={() => {}}
            selectedClipIds={[]}
            onSelectClip={() => {}}
            onOpenInspector={() => {}}
            commitTransaction={() => {}}
        />
      );

      const splitBtn = getByTitle('Split at Playhead (Ctrl+B)');
      fireEvent.click(splitBtn);
      expect(onSplitAtPlayhead).toHaveBeenCalled();
  });
});
