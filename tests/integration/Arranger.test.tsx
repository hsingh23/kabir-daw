import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

const mockProject: ProjectState = {
  id: 'test-project',
  bpm: 120,
  tracks: [
    { id: 't1', name: 'Guitar', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 } }
  ],
  clips: [
    { id: 'c1', trackId: 't1', name: 'Riff 1', start: 0, offset: 0, duration: 4, bufferKey: 'key1', fadeIn: 0, fadeOut: 0 }
  ],
  loopStart: 0,
  loopEnd: 4,
  isLooping: false,
  metronomeOn: false,
  masterVolume: 1,
  effects: { reverb: 0, delay: 0 }
};

describe('Arranger Integration', () => {
  it('renders tracks and allows selection', () => {
    const setProject = vi.fn();
    const onSelectTrack = vi.fn();
    const onSelectClip = vi.fn();
    const setZoom = vi.fn();

    render(
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
        selectedClipId={null}
        onSelectClip={onSelectClip}
        onOpenInspector={() => {}}
      />
    );

    // Verify Track Name is rendered
    expect(screen.getByText('Guitar')).toBeInTheDocument();

    // Verify Clip is rendered
    expect(screen.getByText('Riff 1')).toBeInTheDocument();

    // Simulate clicking a track header
    fireEvent.click(screen.getByText('Guitar'));
    expect(onSelectTrack).toHaveBeenCalledWith('t1');
  });
});