
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ShortcutsDialog from '../../components/ShortcutsDialog';

describe('ShortcutsDialog Component', () => {
  it('renders shortcuts list', () => {
    const { getByText } = render(<ShortcutsDialog onClose={() => {}} />);
    
    expect(getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(getByText('Play / Stop')).toBeInTheDocument();
    expect(getByText('Toggle Recording')).toBeInTheDocument();
  });

  it('closes when X button is clicked', () => {
    const onClose = vi.fn();
    const { getByRole } = render(<ShortcutsDialog onClose={onClose} />);
    
    const closeBtn = getByRole('button'); // X icon button
    fireEvent.click(closeBtn);
    
    expect(onClose).toHaveBeenCalled();
  });
});
