
import { useState, useCallback, useEffect, useRef } from 'react';
import { analytics } from '../services/analytics';

export const useWakeLock = () => {
    const [isLocked, setIsLocked] = useState(false);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    const request = useCallback(async () => {
        if ('wakeLock' in navigator) {
            try {
                if (wakeLockRef.current && !wakeLockRef.current.released) {
                    return; // Already locked
                }
                const sentinel = await navigator.wakeLock.request('screen');
                wakeLockRef.current = sentinel;
                setIsLocked(true);
                
                sentinel.addEventListener('release', () => {
                    setIsLocked(false);
                    wakeLockRef.current = null;
                });
            } catch (err) {
                console.warn('Wake Lock request failed:', err);
            }
        }
    }, []);

    const release = useCallback(async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
            } catch(err) {
                console.warn('Wake Lock release failed:', err);
            }
            wakeLockRef.current = null;
            setIsLocked(false);
        }
    }, []);

    // Re-acquire lock when visibility changes (if it was previously requested/active conceptually)
    // However, the browser releases lock on visibility change. 
    // We typically want to re-request if we are still in a state that needs it (handled by consumer useEffect).
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            release();
        };
    }, [release]);

    return { isLocked, request, release };
};
