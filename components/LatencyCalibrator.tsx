
import React, { useState, useRef } from 'react';
import { audio } from '../services/audio';
import { Activity, Play, CheckCircle2, AlertCircle } from 'lucide-react';

interface LatencyCalibratorProps {
    currentLatency: number;
    onApply: (latency: number) => void;
}

const LatencyCalibrator: React.FC<LatencyCalibratorProps> = ({ currentLatency, onApply }) => {
    const [status, setStatus] = useState<'idle' | 'recording' | 'analyzing' | 'success' | 'error'>('idle');
    const [measuredLatency, setMeasuredLatency] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const runCalibration = async () => {
        try {
            setStatus('recording');
            setErrorMsg('');
            
            // 1. Ensure Audio Context is running
            await audio.resumeContext();
            
            // 2. Start Recording (without monitoring to prevent feedback)
            const startTime = await audio.startRecording(false);
            
            // 3. Play a sharp click (impulse) at start time + 100ms padding
            const impulseTime = startTime + 0.1;
            
            const osc = audio.ctx.createOscillator();
            const gain = audio.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = 1000;
            osc.connect(gain);
            gain.connect(audio.masterGain); // Route to speakers
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.setValueAtTime(1, impulseTime);
            gain.gain.exponentialRampToValueAtTime(0.001, impulseTime + 0.05);
            
            osc.start(startTime);
            osc.stop(impulseTime + 0.1);

            // 4. Wait for audio to be captured (impulse + travel time + buffering)
            await new Promise(resolve => setTimeout(resolve, 500));

            // 5. Stop Recording
            setStatus('analyzing');
            const blob = await audio.stopRecording();
            
            // 6. Analyze
            const buffer = await audio.loadAudio('calibration-temp', blob);
            const channelData = buffer.getChannelData(0);
            
            // Find the peak
            let peakIndex = -1;
            let peakValue = 0;
            const threshold = 0.1; // Noise floor threshold

            for (let i = 0; i < channelData.length; i++) {
                if (Math.abs(channelData[i]) > peakValue) {
                    peakValue = Math.abs(channelData[i]);
                    peakIndex = i;
                }
            }

            if (peakValue < threshold) {
                throw new Error("Signal too quiet. Increase volume or move closer to mic.");
            }

            const peakTime = peakIndex / buffer.sampleRate;
            // The impulse was scheduled at 0.1s into the recording (relative to AudioContext time logic in AudioRecorder)
            // However, AudioRecorder starts immediately. 
            // We scheduled the sound at `impulseTime`.
            // The recorder tracks `ctx.currentTime`.
            // Delay = Time(Detected) - Time(Scheduled)
            
            // Note: Our simple recorder starts capturing roughly when startRecording resolves.
            // The simpler heuristic: The impulse played 100ms after start.
            // So latency is PeakTime - 0.1s.
            
            let detectedLatency = (peakTime - 0.1) * 1000; // ms
            detectedLatency = Math.max(0, detectedLatency);

            setMeasuredLatency(Math.round(detectedLatency));
            setStatus('success');

        } catch (e: any) {
            console.error(e);
            setStatus('error');
            setErrorMsg(e.message || "Calibration failed.");
        }
    };

    return (
        <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity size={16} className="text-studio-accent" /> Latency Calibration
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                        Place your microphone near your speakers and ensure volume is up.
                        This will play a loud click to measure round-trip delay.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-900 p-3 rounded border border-zinc-800">
                <div className="flex-1">
                    {status === 'idle' && <span className="text-xs text-zinc-500">Ready to calibrate</span>}
                    {status === 'recording' && <span className="text-xs text-yellow-500 animate-pulse">Listening...</span>}
                    {status === 'analyzing' && <span className="text-xs text-blue-400">Analyzing...</span>}
                    {status === 'error' && <span className="text-xs text-red-400">{errorMsg}</span>}
                    {status === 'success' && (
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-mono font-bold text-white">{measuredLatency} ms</span>
                            <span className="text-xs text-green-500">detected</span>
                        </div>
                    )}
                </div>
                
                {status === 'success' ? (
                    <button 
                        onClick={() => measuredLatency !== null && onApply(measuredLatency)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-bold flex items-center gap-2"
                    >
                        <CheckCircle2 size={14} /> Apply
                    </button>
                ) : (
                    <button 
                        onClick={runCalibration}
                        disabled={status === 'recording' || status === 'analyzing'}
                        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        <Play size={14} /> Start
                    </button>
                )}
            </div>
            
            {status === 'success' && Math.abs((measuredLatency || 0) - currentLatency) > 50 && (
                <div className="flex items-center gap-2 text-[10px] text-yellow-500 bg-yellow-900/20 p-2 rounded">
                    <AlertCircle size={12} />
                    <span>Large difference from current setting ({currentLatency} ms).</span>
                </div>
            )}
        </div>
    );
};

export default LatencyCalibrator;
