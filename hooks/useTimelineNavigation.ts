
import React, { useRef, useCallback } from 'react';

export const useTimelineNavigation = (
    zoom: number,
    setZoom: (z: number) => void,
    scrollContainerRef: React.RefObject<HTMLDivElement | null>
) => {
    const activePointers = useRef<Map<number, {x: number, y: number}>>(new Map());
    const initialPinchDist = useRef<number | null>(null);
    const initialZoom = useRef<number>(50);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(Math.max(10, Math.min(400, zoom * delta)));
        } else if (e.shiftKey && scrollContainerRef.current) {
            e.preventDefault();
            scrollContainerRef.current.scrollLeft += e.deltaY;
        }
    }, [zoom, setZoom, scrollContainerRef]);

    const handleTouchZoomStart = useCallback((e: React.PointerEvent) => {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        
        if (activePointers.current.size === 2) {
            const points: {x: number, y: number}[] = Array.from(activePointers.current.values());
            const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            initialPinchDist.current = dist;
            initialZoom.current = zoom;
            return true; // Pinch started
        }
        return false;
    }, [zoom]);

    const handleTouchZoomMove = useCallback((e: React.PointerEvent) => {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.current.size === 2 && initialPinchDist.current) {
            const points: {x: number, y: number}[] = Array.from(activePointers.current.values());
            const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            if (dist > 0 && initialPinchDist.current > 0) {
                const scale = dist / initialPinchDist.current;
                const newZoom = Math.max(10, Math.min(400, initialZoom.current * scale));
                setZoom(newZoom);
            }
            return true; // Pinching
        }
        return false;
    }, [setZoom]);

    const handleTouchZoomEnd = useCallback((e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId);
        if (activePointers.current.size < 2) {
            initialPinchDist.current = null;
        }
    }, []);

    return {
        handleWheel,
        handleTouchZoomStart,
        handleTouchZoomMove,
        handleTouchZoomEnd,
        activePointers // Exposed if other hooks need shared pointer state
    };
};
