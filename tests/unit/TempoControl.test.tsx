
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TempoControl from '../../components/TempoControl';

describe('TempoControl', () => {
    
    beforeEach(() => {
        vi.useFakeTimers();
    });
    
    afterEach(() => {
        vi.useRealTimers();
    });

  it('renders current bpm', () => {
    const { getByText } = render(<TempoControl bpm={120} onChange={() => {}} />);
    expect(getByText('120')).toBeInTheDocument();
  });

  it('calls onChange with prompt value', () => {
      const onChange = vi.fn();
      const { getByTitle } = render(<TempoControl bpm={120} onChange={onChange} />);
      
      // Mock Prompt
      vi.spyOn(window, 'prompt').mockReturnValue('140');
      
      const display = getByTitle('Click to edit BPM');
      fireEvent.click(display);
      
      expect(onChange).toHaveBeenCalledWith(140);
  });

  it('calculates tap tempo', () => {
      const onChange = vi.fn();
      const { getByText } = render(<TempoControl bpm={120} onChange={onChange} />);
      
      const tapBtn = getByText('TAP');
      
      // We need to mock performance.now() to control time
      // 120 BPM = 500ms interval
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => {
          now += 500;
          return now;
      });

      // Tap 1
      fireEvent.pointerDown(tapBtn);
      expect(onChange).not.toHaveBeenCalled(); // Need at least 2 taps

      // Tap 2 (interval 500ms)
      fireEvent.pointerDown(tapBtn);
      expect(onChange).toHaveBeenCalledWith(120);

      // Tap 3 (interval 500ms)
      fireEvent.pointerDown(tapBtn);
      expect(onChange).toHaveBeenLastCalledWith(120);
  });
});