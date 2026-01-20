

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useArrangerInteraction } from '../../../hooks/useArrangerInteraction';
import { ProjectState, ToolMode } from '../../../types';

const mockProject: ProjectState = {
    id: 'test',
    name: 'Test Project',
    bpm: 120,
    timeSignature: [4, 4],
    returnToStartOnStop: true,
    tracks: [
        { id: 't1', type: 'audio', name: 'Track 1', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq:{low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
    ],
    clips: [{ id: 'c1', trackId: 't1', name: 'Clip', start: 0, duration: 4, offset: 0, bufferKey: 'k', fadeIn: 0, fadeOut: 0 }],
    markers: [], loopStart:0, loopEnd:4, isLooping:false, metronomeOn:false, countIn:0, recordingLatency:0, inputMonitoring:false,
    masterVolume:1, masterEq:{low:0,mid:0,high:0}, masterCompressor:{threshold:0,ratio:1, attack: 0.01, release: 0.1}, effects:{reverb:0,delay:0,chorus:0},
    tanpura:{enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla:{enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
};

describe('useArrangerInteraction Hook', () => {
    let mockProps: any;
    let snapLineRefMock: any;
    let selectionBoxRefMock: any;
    let snapLabelRefMock: any;

    beforeEach(() => {
        vi.useFakeTimers();
        
        // Mock Refs
        snapLineRefMock = { current: { style: { display: 'none', left: '0px' } } };
        selectionBoxRefMock = { current: { style: { display: 'none', left: '0px', top: '0px', width: '0px', height: '0px' } } };
        snapLabelRefMock = { current: { textContent: '' } };

        mockProps = {
            project: mockProject,
            setProject: vi.fn(),
            zoom: 50,
            setZoom: vi.fn(),
            tool: ToolMode.POINTER,
            snapGrid: 1,
            scrollContainerRef: { 
                current: { 
                    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }), 
                    scrollLeft: 0, 
                    scrollTop: 0 
                } 
            },
            headerWidth: 200,
            trackHeight: 100,
            onSelectTrack: vi.fn(),
            onSelectClip: vi.fn(),
            selectedClipIds: [],
            onSplit: vi.fn(),
            onSeek: vi.fn(),
            onMoveTrack: vi.fn(),
            multiSelectMode: false,
            secondsPerBeat: 0.5,
            snapLineRef: snapLineRefMock,
            selectionBoxRef: selectionBoxRefMock,
            snapLabelRef: snapLabelRefMock,
            commitTransaction: vi.fn()
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('handles long press to open context menu', () => {
        const { result } = renderHook(() => useArrangerInteraction(mockProps));
        const clip = mockProject.clips[0];
        
        act(() => {
            result.current.handleClipPointerDown(
                { stopPropagation: vi.fn(), button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn(), target: { setPointerCapture: vi.fn() } } as any,
                clip,
                'MOVE'
            );
        });

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current.contextMenu).toEqual({ x: 100, y: 100, clipId: 'c1' });
        expect(result.current.dragState).toBeNull();
    });

    it('updates snap line ref when dragging', () => {
        const { result } = renderHook(() => useArrangerInteraction(mockProps));
        const clip = mockProject.clips[0];

        act(() => {
            result.current.handleClipPointerDown(
                { stopPropagation: vi.fn(), button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn(), target: { setPointerCapture: vi.fn() } } as any,
                clip,
                'MOVE'
            );
        });

        act(() => {
            result.current.handleGlobalPointerMove(
                { clientX: 200, clientY: 100 } as any
            );
        });

        // Check if style was updated directly
        expect(snapLineRefMock.current.style.display).toBe('block');
        // Dragging 100px at zoom 50 = 2 seconds.
        // Start 0. New Start ~2.
        expect(snapLineRefMock.current.style.left).toBeDefined();
    });

    it('updates selection box ref when maruee selecting', () => {
        const { result } = renderHook(() => useArrangerInteraction(mockProps));
        
        // Start selection
        act(() => {
            result.current.handleGlobalPointerDown({ pointerId: 1, clientX: 0, clientY: 0, shiftKey: true, target: { setPointerCapture: vi.fn() } } as any);
        });

        // Drag
        act(() => {
            result.current.handleGlobalPointerMove({ pointerId: 1, clientX: 200, clientY: 200 } as any);
        });

        expect(selectionBoxRefMock.current.style.display).toBe('block');
        expect(selectionBoxRefMock.current.style.width).toBe('200px');
    });
});