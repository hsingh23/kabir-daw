
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Tanpura from '../../components/Tanpura';

// Local definition
interface TanpuraState {
  enabled: boolean;
  volume: number;
  key: string;
  tuning: 'Pa' | 'Ma' | 'Ni';
  tempo: number;
  fineTune?: number;
}

describe('Tanpura Component', () => {
  const defaultConfig: TanpuraState = {
    enabled: false,
    volume: 0.5,
    key: 'C',
    tuning: 'Pa',
    tempo: 60
  };

  it('renders correctly', () => {
    const { getByText } = render(<Tanpura config={defaultConfig} onChange={() => {}} />);
    expect(getByText('Tanpura (Legacy)')).toBeInTheDocument();
    expect(getByText('Pa')).toBeInTheDocument();
    expect(getByText('C')).toBeInTheDocument();
  });

  it('toggles enabled state on button click', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Tanpura config={defaultConfig} onChange={onChange} />);
    
    // The enable toggle is a button in the header
    const toggleBtn = getByRole('button', { name: '' }); // It has no text, just a div
    fireEvent.click(toggleBtn);
    
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, enabled: true });
  });

  it('changes key when clicked', () => {
    const onChange = vi.fn();
    const { getByText } = render(<Tanpura config={defaultConfig} onChange={onChange} />);
    
    fireEvent.click(getByText('D'));
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, key: 'D' });
  });

  it('changes tuning when clicked', () => {
    const onChange = vi.fn();
    const { getByText } = render(<Tanpura config={defaultConfig} onChange={onChange} />);
    
    fireEvent.click(getByText('Ma'));
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, tuning: 'Ma' });
  });
});
