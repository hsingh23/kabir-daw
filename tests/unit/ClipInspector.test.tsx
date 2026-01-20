
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import ClipInspector from '../../components/ClipInspector';
import { Clip } from '../../types';

describe('ClipInspector Component', () => {
  const mockClip: Clip = {
    id: 'c1',
    trackId: 't1',
    name: 'Guitar Riff',
    start: 2.0,
    duration: 4.0,
    offset: 0,
    bufferKey: 'key',
    fadeIn: 0.1,
    fadeOut: 0.2,
    speed: 1.0,
    gain: 1.0
  };

  it('renders clip details', () => {
    const { getByDisplayValue, getByText } = render(
      <ClipInspector 
        clip={mockClip} 
        updateClip={() => {}} 
        onDeleteClip={() => {}} 
        onDuplicateClip={() => {}} 
        onClose={() => {}} 
      />
    );

    expect(getByDisplayValue('Guitar Riff')).toBeInTheDocument();
    expect(getByText('Clip Editor')).toBeInTheDocument();
  });

  it('updates clip gain', () => {
    const updateClip = vi.fn();
    const { getByLabelText } = render(
      <ClipInspector 
        clip={mockClip} 
        updateClip={updateClip} 
        onDeleteClip={() => {}} 
        onDuplicateClip={() => {}} 
        onClose={() => {}} 
      />
    );

    const gainKnob = getByLabelText('Gain');
    fireEvent.keyDown(gainKnob, { key: 'ArrowUp', shiftKey: true });
    expect(updateClip).toHaveBeenCalledWith('c1', expect.objectContaining({ gain: expect.any(Number) }));
  });

  it('updates timing', () => {
    const updateClip = vi.fn();
    const { container } = render(
        <ClipInspector 
          clip={mockClip} 
          updateClip={updateClip} 
          onDeleteClip={() => {}} 
          onDuplicateClip={() => {}} 
          onClose={() => {}} 
        />
    );

    // Inputs might not have associated label explicitly connected via ID in this simple form, searching by type/value
    const startInput = container.querySelector('input[type="number"][value="2.000"]');
    expect(startInput).toBeInTheDocument();
    
    fireEvent.change(startInput!, { target: { value: '3.0' } });
    expect(updateClip).toHaveBeenCalledWith('c1', { start: 3.0 });
  });

  it('calls delete', () => {
      const onDeleteClip = vi.fn();
      const { getByText } = render(
        <ClipInspector 
          clip={mockClip} 
          updateClip={() => {}} 
          onDeleteClip={onDeleteClip} 
          onDuplicateClip={() => {}} 
          onClose={() => {}} 
        />
      );

      fireEvent.click(getByText('Delete'));
      expect(onDeleteClip).toHaveBeenCalledWith('c1');
  });
});
