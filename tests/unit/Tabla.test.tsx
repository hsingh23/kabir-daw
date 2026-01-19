
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Tabla from '../../components/Tabla';
import { TablaState } from '../../types';

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
    expect(getByText('TABLA PERCUSSION')).toBeInTheDocument();
    expect(getByText('TeenTaal')).toBeInTheDocument();
    
    // Check if selector exists and has value C
    const select = getByRole('combobox');
    expect(select).toHaveValue('C');
  });

  it('toggles enabled state', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(<Tabla config={defaultConfig} onChange={onChange} />);
    
    // The first button is usually the toggle in the header (based on component structure)
    // Or we can find the one with the specific styling class if we added a test-id, 
    // but here we know the structure: header button is first.
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
    const { getByRole } = render(<Tabla config={defaultConfig} onChange={onChange} />);
    
    const select = getByRole('combobox');
    fireEvent.change(select, { target: { value: 'G' } });
    
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, key: 'G' });
  });
});