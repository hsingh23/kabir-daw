
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { ProjectState } from '../../../types';

// Mock dependencies
const mockProject: ProjectState = {
    id: 'test',
    name: 'Test Project',
    bpm: 120,
    timeSignature: [4, 4],
    returnToStartOnStop: true,
    tracks: [],
    clips: [],
    markers: [],
    loopStart: 0,
    loopEnd: 4,
    isLooping: false,
    metronomeOn: false,
    countIn: 0,
    recordingLatency: 0,
    inputMonitoring: false,
    masterVolume: 1,
    masterEq: { low: 0, mid: 0, high: 0 },
    masterCompressor: { threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
    effects: { reverb: 0, delay: 0, chorus: 0 },
    sequencer: { enabled: false, volume: 0.8, tracks: [] },
    drone: { enabled: false, volume: 0.5, note: 36, oscillators: [] }
};

describe('useKeyboardShortcuts Hook', () => {
    let mockProps: any;

    beforeEach(() => {
        mockProps = {
            project: mockProject,
            setProject: vi.fn(),
            selectedClipIds: [],
            setSelectedClipIds: vi.fn(),
            selectedTrackId: null,
            setSelectedTrackId: vi.fn(),
            currentTime: 0,
            isRecording: false,
            togglePlay: vi.fn(),
            handleRecordToggle: vi.fn(),
            undo: vi.fn(),
            redo: vi.fn(),
            setClipboard: vi.fn(),
            clipboard: [],
            handleSplit: vi.fn(),
            onSplitAtPlayhead: vi.fn(),
            setShowShortcuts: vi.fn(),
            onSeek: vi.fn(),
            onQuantize: vi.fn()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('toggles play on Space', () => {
        renderHook(() => useKeyboardShortcuts(mockProps));
        
        const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
        window.dispatchEvent(event);
        
        expect(mockProps.togglePlay).toHaveBeenCalled();
    });

    it('toggles record on R', () => {
        renderHook(() => useKeyboardShortcuts(mockProps));
        
        const event = new KeyboardEvent('keydown', { key: 'r', bubbles: true });
        window.dispatchEvent(event);
        
        expect(mockProps.handleRecordToggle).toHaveBeenCalled();
    });

    it('calls undo on Ctrl+Z', () => {
        renderHook(() => useKeyboardShortcuts(mockProps));
        
        const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
        window.dispatchEvent(event);
        
        expect(mockProps.undo).toHaveBeenCalled();
    });

    it('calls redo on Ctrl+Shift+Z', () => {
        renderHook(() => useKeyboardShortcuts(mockProps));
        
        const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true });
        window.dispatchEvent(event);
        
        expect(mockProps.redo).toHaveBeenCalled();
    });

    it('copies selected clips on Ctrl+C', () => {
        mockProps.selectedClipIds = ['c1'];
        mockProps.project.clips = [{ id: 'c1', name: 'Clip' } as any];
        
        renderHook(() => useKeyboardShortcuts(mockProps));
        
        const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
        window.dispatchEvent(event);
        
        expect(mockProps.setClipboard).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'c1' })]));
    });

    it('ignores shortcuts when typing in input', () => {
        renderHook(() => useKeyboardShortcuts(mockProps));
        
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        
        const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
        input.dispatchEvent(event);
        
        expect(mockProps.togglePlay).not.toHaveBeenCalled();
        document.body.removeChild(input);
    });
});
