
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TimeDisplay from '../../components/TimeDisplay';

describe('TimeDisplay', () => {
  it('formats bars correctly', () => {
    // 120 bpm = 2 beats/sec = 0.5s/beat. 4/4 time.
    // 0s -> 1:1:1
    const { getByText, rerender } = render(<TimeDisplay currentTime={0} bpm={120} isPlaying={false} />);
    expect(getByText('1:1:1')).toBeInTheDocument();

    // 0.5s (1 beat) -> 1:2:1
    rerender(<TimeDisplay currentTime={0.5} bpm={120} isPlaying={false} />);
    expect(getByText('1:2:1')).toBeInTheDocument();
    
    // 2.0s (1 bar) -> 2:1:1
    rerender(<TimeDisplay currentTime={2.0} bpm={120} isPlaying={false} />);
    expect(getByText('2:1:1')).toBeInTheDocument();
  });

  it('toggles mode on click', () => {
    const { getByText } = render(<TimeDisplay currentTime={65} bpm={120} isPlaying={false} />);
    
    // Default is bars
    expect(getByText('BARS')).toBeInTheDocument();
    
    // Click to switch
    fireEvent.click(getByText('BARS'));
    
    // Should show TIME and formatted time
    expect(getByText('TIME')).toBeInTheDocument();
    expect(getByText('01:05.0')).toBeInTheDocument(); // 65s = 1m 5s
  });
});
