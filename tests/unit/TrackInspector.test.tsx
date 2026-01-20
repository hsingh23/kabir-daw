

import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import TrackInspector from '../../components/TrackInspector';
import { Track } from '../../types';

describe('TrackInspector Component', () => {
  const mockTrack: Track = {
    id: 't1',
    type: 'audio',
    name: 'Guitar',
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    color: '#ff0000',
    eq: { low: 0, mid: 0, high: 0 },
    compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
    sends: { reverb: 0, delay: 0, chorus: 0 },
    sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
  };

  it('renders track info correctly', () => {
    const { getByText } = render(<TrackInspector track={mockTrack} updateTrack={() => {}} onClose={() => {}} />);
    expect(getByText('Guitar')).toBeInTheDocument();
    expect(getByText('Channel Strip')).toBeInTheDocument();
  });

  it('updates EQ knobs', () => {
      const updateTrack = vi.fn();
      const { getByLabelText } = render(<TrackInspector track={mockTrack} updateTrack={updateTrack} onClose={() => {}} />);

      const highKnob = getByLabelText('High');
      fireEvent.keyDown(highKnob, { key: 'ArrowUp', shiftKey: true });
      expect(updateTrack).toHaveBeenCalled();
  });

  it('toggles compressor', () => {
      const updateTrack = vi.fn();
      const { getByText } = render(<TrackInspector track={mockTrack} updateTrack={updateTrack} onClose={() => {}} />);

      // Find Dynamics Header
      const dynamicsHeader = getByText('Dynamics').parentElement;
      // Find button inside header
      const toggleBtn = dynamicsHeader?.querySelector('button');
      
      expect(toggleBtn).toBeInTheDocument();
      fireEvent.click(toggleBtn!);
      
      expect(updateTrack).toHaveBeenCalledWith('t1', expect.objectContaining({
          compressor: expect.objectContaining({ enabled: true })
      }));
  });

  it('updates compressor threshold', () => {
    const updateTrack = vi.fn();
    const enabledTrack = { ...mockTrack, compressor: { ...mockTrack.compressor!, enabled: true } };
    
    const { getByLabelText } = render(<TrackInspector track={enabledTrack} updateTrack={updateTrack} onClose={() => {}} />);
    
    const threshKnob = getByLabelText('Thresh');
    fireEvent.keyDown(threshKnob, { key: 'ArrowDown', shiftKey: true }); // Decrease threshold
    
    expect(updateTrack).toHaveBeenCalledWith('t1', expect.objectContaining({
        compressor: expect.objectContaining({ threshold: expect.any(Number) })
    }));
  });
  
  it('updates FX sends', () => {
      const updateTrack = vi.fn();
      const { getByLabelText } = render(<TrackInspector track={mockTrack} updateTrack={updateTrack} onClose={() => {}} />);

      const reverbKnob = getByLabelText('Reverb');
      fireEvent.keyDown(reverbKnob, { key: 'ArrowUp', shiftKey: true });

      expect(updateTrack).toHaveBeenCalledWith('t1', expect.objectContaining({
          sends: expect.objectContaining({ reverb: expect.any(Number) })
      }));
  });

  it('calls updateTrack when mute button is clicked', () => {
    const updateTrack = vi.fn();
    const { getByText } = render(<TrackInspector track={mockTrack} updateTrack={updateTrack} onClose={() => {}} />);
    
    fireEvent.click(getByText('Mute'));
    expect(updateTrack).toHaveBeenCalledWith('t1', { muted: true });
  });
});