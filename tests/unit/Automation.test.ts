

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audio } from '../../services/audio';
import { Track } from '../../types';

describe('AudioEngine Automation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset state
        audio.trackChannels.clear();
    });

    it('schedules volume automation points correctly', () => {
        // Mock Context Time
        const mockCurrentTime = 10;
        (audio.ctx as any).currentTime = mockCurrentTime;
        
        // Setup track with automation
        const track: Track = {
            id: 't1', type: 'audio', name: 'AutoTrack', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0},
            sendConfig: { reverbPre: false, delayPre: false, chorusPre: false },
            automation: {
                volume: [
                    { id: 'p1', time: 0, value: 0.5 },
                    { id: 'p2', time: 10.05, value: 0.8 }, // Inside lookahead (10 + 0.15 = 10.15)
                    { id: 'p3', time: 12, value: 0.2 }     // Outside lookahead
                ]
            }
        };

        // Initialize channel
        const channel = audio.getTrackChannel('t1');
        const gainParam = channel.gain.gain;
        gainParam.linearRampToValueAtTime = vi.fn();

        // Start playback state
        (audio as any)._isPlaying = true;
        (audio as any)._startTime = 0; // Song start at 0 context time for simplicity? 
        // Logic: schedulerWindowStart = now - _startTime.
        // If _startTime = 0, schedulerWindowStart = 10.
        // Lookahead = 0.15. WindowEnd = 10.15.
        // Point p2 is at 10.05. It should be scheduled.
        
        audio.scheduler([track], []);

        expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(0.8, 10.05); // p2
        expect(gainParam.linearRampToValueAtTime).not.toHaveBeenCalledWith(0.5, expect.any(Number)); // p1 (past)
        expect(gainParam.linearRampToValueAtTime).not.toHaveBeenCalledWith(0.2, expect.any(Number)); // p3 (future)
    });
});