

import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Arranger from '../../components/Arranger';
import { ProjectState } from '../../types';

// Mock audio service
vi.mock('../../services/audio', () => ({
  audio: {
    buffers: new Map(),
    getCurrentTime: () => 0,
  }
}));

// Mock Waveform component
vi.mock('../../components/Waveform', () => ({
  default: () => <div data-testid="mock-waveform">Waveform</div>
}));

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
}));

const mockProject: ProjectState = {
  id: 'test-project',
  name: 'Test Project',
  bpm: 120,
  tracks: [
    { id: 't1', name: 'Guitar', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 } }
  ],
  clips: [
    { id: 'c1', trackId: 't1', name: 'Riff 1', start: 0, offset: 0, duration: 4, bufferKey: 'key1', fadeIn: 0, fadeOut: 0 }
  ],
  markers: [],
  loopStart: 0,
  loopEnd: 4,
  isLooping: true,
  metronomeOn: false,
  countIn: 0,
  recordingLatency: 0,
  inputMonitoring: false,
  masterVolume: 1,
  masterEq: { low: 0, mid: 0, high: 0 },
  masterCompressor: { threshold: -24, ratio: 12 },
  effects: { reverb: 0, delay: 0, chorus: 0 },
  tanpura: { enabled: false, volume: 0.5, key: 'C', tuning: 'Pa', tempo: 60 },
  tabla: { enabled: false, volume: 0.5, taal: 'TeenTaal', bpm: 100, key: 'C' }
};

describe('Arranger Component Interaction', () => {
    
    it('opens context menu on right click', () => {
        const { getByText } = render(
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
                onSelectClip={() => {}}
                onOpenInspector={() => {}}
            />
        );

        const clip = getByText('Riff 1').closest('div[style*="absolute"]');
        expect(clip).toBeInTheDocument();

        // Right click (button: 2)
        fireEvent.pointerDown(clip!, { button: 2, clientX: 100, clientY: 100 });

        // Menu items should appear
        expect(getByText('Rename')).toBeInTheDocument();
        expect(getByText('Delete')).toBeInTheDocument();
    });

    it('renders loop region and handles', () => {
        const { container } = render(
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
                onSelectClip={() => {}}
                onOpenInspector={() => {}}
            />
        );

        // Check for loop handles (css classes based query or structure)
        // We added .cursor-ew-resize for handles
        const handles = container.querySelectorAll('.cursor-ew-resize');
        expect(handles.length).toBeGreaterThan(0); // Should have left and right handles
    });
});