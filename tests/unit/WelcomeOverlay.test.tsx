
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WelcomeOverlay from '../../components/WelcomeOverlay';

describe('WelcomeOverlay Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders on first visit', () => {
    const { getByText } = render(<WelcomeOverlay />);
    expect(getByText('Welcome to PocketStudio')).toBeInTheDocument();
  });

  it('does not render if already visited', () => {
    localStorage.setItem('onboarding_complete', 'true');
    const { queryByText } = render(<WelcomeOverlay />);
    expect(queryByText('Welcome to PocketStudio')).not.toBeInTheDocument();
  });

  it('sets localStorage and closes on dismiss', () => {
    const { getByText, queryByText } = render(<WelcomeOverlay />);
    const btn = getByText('Get Started');
    
    fireEvent.click(btn);
    
    expect(localStorage.getItem('onboarding_complete')).toBe('true');
    expect(queryByText('Welcome to PocketStudio')).not.toBeInTheDocument();
  });
});
