
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Tabla from '../../components/Tabla';

// Local definition
interface TablaState {
  enabled: boolean;
  volume: number;
  taal: string;
  bpm: number;
  key: string;
}

describe('Tabla Component', () => {
  const defaultConfig: TablaState = {
    enabled: false,
    volume: 0.5,
    taal: 'TeenTaal',
    bpm: 100,
    key: 'C'
  };

  it('renders correctly', () => {
    const { getByText, getByRole } = render(<Tabla config={defaultConfig} onChange={() => {}} />);
    expect(getByText('Tabla (Legacy)')).toBeInTheDocument();
    expect(getByText('TeenTaal')).toBeInTheDocument();
    
    // Check if selector exists (buttons in new implementation)
    // The previous test might have assumed select, but current implementation uses buttons
    // So let's check for the key button 'C' being active or present
    expect(getByText('C')).toBeInTheDocument();
  });

  it('toggles enabled state', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(<Tabla config={defaultConfig} onChange={onChange} />);
    
    // The first button is usually the toggle in the header (based on component structure)
    const buttons = getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, enabled: true });
  });

  it('changes taal pattern', () => {
    const onChange = vi.fn();
    const { getByText } = render(<Tabla config={defaultConfig} onChange={onChange} />);
    
    fireEvent.click(getByText('Dadra'));
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, taal: 'Dadra' });
  });

  it('changes tuning key', () => {
    const onChange = vi.fn();
    const { getByText } = render(<Tabla config={defaultConfig} onChange={onChange} />);
    
    fireEvent.click(getByText('G'));
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, key: 'G' });
  });
});
