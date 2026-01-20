
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomFader from '../../components/Fader';

describe('Fader Component', () => {
  it('renders correctly', () => {
    const { getByRole } = render(<CustomFader value={0.5} onChange={() => {}} />);
    const slider = getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('calls onChange when dragging', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<CustomFader value={0.5} onChange={onChange} height={100} />);
    const slider = getByRole('slider');

    // Mock getBoundingClientRect
    slider.getBoundingClientRect = vi.fn(() => ({
      top: 0,
      bottom: 100,
      left: 0,
      right: 20,
      width: 20,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {}
    }));

    // Start drag
    fireEvent.pointerDown(slider, { clientY: 50, pointerId: 1, buttons: 1 });
    
    // Move to 25px from top (should be 0.75 value, since bottom is 0)
    // 0 is at bottom (100px y). 1 is at top (0px y).
    // y=25 => 75% height from bottom => 0.75
    fireEvent.pointerMove(slider, { clientY: 25, pointerId: 1, buttons: 1 });

    expect(onChange).toHaveBeenCalledWith(0.75);
  });

  it('calls onChangeEnd on pointer up', () => {
    const onChangeEnd = vi.fn();
    const { getByRole } = render(<CustomFader value={0.5} onChange={() => {}} onChangeEnd={onChangeEnd} />);
    const slider = getByRole('slider');

    fireEvent.pointerUp(slider, { pointerId: 1 });
    expect(onChangeEnd).toHaveBeenCalledWith(0.5);
  });

  it('resets to default on double click', () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    const { getByRole } = render(
      <CustomFader value={0.2} onChange={onChange} onChangeEnd={onChangeEnd} defaultValue={0.8} />
    );
    const slider = getByRole('slider');

    fireEvent.doubleClick(slider);
    
    expect(onChange).toHaveBeenCalledWith(0.8);
    expect(onChangeEnd).toHaveBeenCalledWith(0.8);
  });

  it('handles keyboard navigation', () => {
      const onChange = vi.fn();
      const { getByRole } = render(<CustomFader value={0.5} onChange={onChange} />);
      const slider = getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowUp' });
      // Default step 0.01
      expect(onChange).toHaveBeenCalledWith(0.51);

      fireEvent.keyDown(slider, { key: 'ArrowDown', shiftKey: true });
      // Shift step 0.1
      expect(onChange).toHaveBeenCalledWith(0.4);
  });
});
