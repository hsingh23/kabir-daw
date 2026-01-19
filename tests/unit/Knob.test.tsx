import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Knob from '../../components/Knob';

describe('Knob Component', () => {
  it('renders with label', () => {
    render(<Knob label="Volume" value={0.5} onChange={() => {}} />);
    expect(screen.getByText('Volume')).toBeInTheDocument();
  });
});