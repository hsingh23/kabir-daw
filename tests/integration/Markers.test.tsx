
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Arranger from '../../components/Arranger';
import { ProjectState } from '../../types';
import { ProjectProvider } from '../../contexts/ProjectContext';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    buffers: new Map(),
    getCurrentTime: () => 0,
  }
}));

// Mock Waveform
vi.mock('../../components/Waveform', () => ({
  default: () => <div />
}));

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
}));

describe('Arranger Markers', () => {
    const mockProject: ProjectState = {
      id: 'test',
      name: 'Test Project',
      bpm: 120,
      timeSignature: [4, 4],
      returnToStartOnStop: true,
      tracks: [],
      clips: [],
      markers: [], // Initially empty
      loopStart: 0,
      loopEnd: 4,
      isLooping: false,
      metronomeOn: false,
      countIn: 0,
      recordingLatency: 0,
      inputMonitoring: false,
      masterVolume: 1,
      masterEq: { low: 0, mid: 0, high: 0 },
      masterCompressor: { threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
      effects: { reverb: 0, delay: 0, chorus: 0 },
      sequencer: { enabled: false, volume: 0.8, tracks: [] },
      drone: { enabled: false, volume: 0.5, note: 36, oscillators: [] }
    };

    it('adds marker on double click in ruler', () => {
        const { container, getByText } = render(
            <ProjectProvider initialProject={mockProject}>
                <Arranger 
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
                    onSelectClip={() => {}}
                    onOpenInspector={() => {}}
                    commitTransaction={() => {}}
                />
            </ProjectProvider>
        );

        // Ruler is the sticky top div
        const ruler = container.querySelector('.sticky');
        expect(ruler).toBeInTheDocument();

        fireEvent.doubleClick(ruler!, { clientX: 100, clientY: 10 });

        // Since updateProject is internal to context, we verify UI update
        expect(getByText('Marker 1')).toBeInTheDocument();
    });
});
