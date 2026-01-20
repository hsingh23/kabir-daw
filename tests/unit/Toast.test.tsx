
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from '../../components/Toast';
import React, { useEffect } from 'react';

// Test component to trigger toast
const TestComponent = ({ message, type }: { message: string, type: 'success' | 'error' | 'info' }) => {
  const { showToast } = useToast();
  
  useEffect(() => {
    showToast(message, type);
  }, [message, type, showToast]);

  return <div>Test</div>;
};

describe('Toast Notification System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a toast message', () => {
    render(
      <ToastProvider>
        <TestComponent message="Operation Successful" type="success" />
      </ToastProvider>
    );

    expect(screen.getByText('Operation Successful')).toBeInTheDocument();
  });

  it('auto-removes toast after 3 seconds', () => {
    render(
      <ToastProvider>
        <TestComponent message="Temporary Message" type="info" />
      </ToastProvider>
    );

    expect(screen.getByText('Temporary Message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Temporary Message')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    const MultiToastComponent = () => {
        const { showToast } = useToast();
        return (
            <button onClick={() => {
                showToast("Msg 1", "info");
                showToast("Msg 2", "error");
            }}>Trigger</button>
        )
    };

    render(
        <ToastProvider>
            <MultiToastComponent />
        </ToastProvider>
    );

    const btn = screen.getByText('Trigger');
    act(() => {
        btn.click();
    });

    expect(screen.getByText('Msg 1')).toBeInTheDocument();
    expect(screen.getByText('Msg 2')).toBeInTheDocument();
  });
});
