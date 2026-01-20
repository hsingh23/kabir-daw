
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWakeLock } from '../../../hooks/useWakeLock';

describe('useWakeLock Hook', () => {
    let mockWakeLock: any;
    let mockSentinel: any;

    beforeEach(() => {
        mockSentinel = {
            release: vi.fn().mockResolvedValue(undefined),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            released: false
        };

        mockWakeLock = {
            request: vi.fn().mockResolvedValue(mockSentinel)
        };

        Object.defineProperty(navigator, 'wakeLock', {
            value: mockWakeLock,
            writable: true
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('requests wake lock successfully', async () => {
        const { result } = renderHook(() => useWakeLock());

        await act(async () => {
            await result.current.request();
        });

        expect(mockWakeLock.request).toHaveBeenCalledWith('screen');
        expect(result.current.isLocked).toBe(true);
    });

    it('releases wake lock manually', async () => {
        const { result } = renderHook(() => useWakeLock());

        await act(async () => {
            await result.current.request();
        });

        await act(async () => {
            await result.current.release();
        });

        expect(mockSentinel.release).toHaveBeenCalled();
        expect(result.current.isLocked).toBe(false);
    });

    it('handles release event from system', async () => {
        const { result } = renderHook(() => useWakeLock());

        await act(async () => {
            await result.current.request();
        });

        const releaseHandler = mockSentinel.addEventListener.mock.calls.find((c: any) => c[0] === 'release')?.[1];
        
        act(() => {
            if (releaseHandler) releaseHandler();
        });

        expect(result.current.isLocked).toBe(false);
    });

    it('prevents multiple locks if already active', async () => {
        const { result } = renderHook(() => useWakeLock());

        await act(async () => {
            await result.current.request();
        });
        
        await act(async () => {
            await result.current.request();
        });

        expect(mockWakeLock.request).toHaveBeenCalledTimes(1);
    });
});
