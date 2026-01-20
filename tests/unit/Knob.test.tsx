
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Knob from '../../components/Knob';

describe('Knob Component', () => {
  it('renders with label', () => {
    const { getByText } = render(<Knob label="Volume" value={0.5} onChange={() => {}} />);
    expect(getByText('Volume')).toBeInTheDocument();
  });

  it('updates on key press arrow up', () => {
      const onChange = vi.fn();
      const { getByRole } = render(<Knob label="Vol" value={0.5} onChange={onChange} />);
      
      const slider = getByRole('slider');
      slider.focus();
      fireEvent.keyDown(slider, { key: 'ArrowUp' });
      
      expect(onChange).toHaveBeenCalled();
      // Default step 0.01. 0.5 + 0.01 = 0.51
      expect(onChange).toHaveBeenCalledWith(0.51);
  });

  it('updates on key press arrow down with shift (large step)', () => {
      const onChange = vi.fn();
      const { getByRole } = render(<Knob label="Vol" value={0.5} onChange={onChange} />);
      
      const slider = getByRole('slider');
      fireEvent.keyDown(slider, { key: 'ArrowDown', shiftKey: true });
      
      // Shift step is 0.1. 0.5 - 0.1 = 0.4
      expect(onChange).toHaveBeenCalledWith(0.4);
  });

  it('resets on double click if defaultValue provided', () => {
      const onChange = vi.fn();
      const { getByRole } = render(<Knob label="Vol" value={0.2} onChange={onChange} defaultValue={0.8} />);
      
      const slider = getByRole('slider');
      fireEvent.doubleClick(slider);
      
      expect(onChange).toHaveBeenCalledWith(0.8);
  });
});
