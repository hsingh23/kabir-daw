import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Knob from '../../components/Knob';

describe('Knob Component', () => {
  it('renders with label', () => {
    const { getByText } = render(<Knob label="Volume" value={0.5} onChange={() => {}} />);
    expect(getByText('Volume')).toBeInTheDocument();
  });
});