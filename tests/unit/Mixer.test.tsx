
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Mixer from '../../components/Mixer';
import { ProjectState } from '../../types';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    measureTrackLevel: () => 0,
    measureMasterLevel: () => 0,
  }
}));

const mockProject: ProjectState = {
  id: 'test',
  bpm: 120,
  tracks: [
    { id: 't1', name: 'Track 1', volume: 0.8, pan: 0, muted: false, solo: false, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 } },
    { id: 't2', name: 'Track 2', volume: 0.5, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 } }
  ],
  clips: [],
  markers: [],
  loopStart: 0,
  loopEnd: 4,
  isLooping: false,
  metronomeOn: false,
  masterVolume: 1,
  masterEq: { low: 0, mid: 0, high: 0 },
  masterCompressor: { threshold: -24, ratio: 12 },
  effects: { reverb: 0, delay: 0, chorus: 0 },
  tanpura: { enabled: false, volume: 0.5, key: 'C', tuning: 'Pa', tempo: 60 },
  tabla: { enabled: false, volume: 0.5, taal: 'TeenTaal', bpm: 100, key: 'C' }
};

describe('Mixer Component', () => {
  it('renders all tracks', () => {
    const { getByText } = render(
      <Mixer 
        project={mockProject} 
        setProject={() => {}} 
        isPlaying={false} 
        onPlayPause={() => {}} 
        onStop={() => {}} 
        onRecord={() => {}} 
      />
    );

    expect(getByText('Track 1')).toBeInTheDocument();
    expect(getByText('Track 2')).toBeInTheDocument();
  });

  it('updates master volume knob', () => {
    const setProject = vi.fn();
    const { getByLabelText } = render(
      <Mixer 
        project={mockProject} 
        setProject={setProject} 
        isPlaying={false} 
        onPlayPause={() => {}} 
        onStop={() => {}} 
        onRecord={() => {}} 
      />
    );
    
    // Knobs have aria-label equal to their label prop
    const masterKnob = getByLabelText('Master');
    expect(masterKnob).toBeInTheDocument();
    
    // Simulate keyboard interaction to change value (easier than pointer events in jsdom)
    fireEvent.keyDown(masterKnob, { key: 'ArrowDown', shiftKey: true });
    expect(setProject).toHaveBeenCalled();
  });

  it('switches tabs', () => {
      const { getByText, queryByText } = render(
        <Mixer 
          project={mockProject} 
          setProject={() => {}} 
          isPlaying={false} 
          onPlayPause={() => {}} 
          onStop={() => {}} 
          onRecord={() => {}} 
        />
      );

      // Default is tracks
      expect(getByText('Track 1')).toBeInTheDocument();

      // Switch to Backing
      fireEvent.click(getByText('Backing'));
      
      expect(queryByText('Track 1')).not.toBeInTheDocument();
      expect(getByText('Tanpura Drone')).toBeInTheDocument();
  });
});
