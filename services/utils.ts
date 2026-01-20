
import { MidiNote, AutomationPoint } from "../types";

// Asynchronous WAV Encoding via Worker
export function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
      
      const left = buffer.getChannelData(0);
      const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
      
      worker.onmessage = (e) => {
          resolve(e.data);
          worker.terminate();
      };
      
      worker.onerror = (e) => {
          console.error('WAV Worker Error', e);
          reject(e);
          worker.terminate();
      };

      worker.postMessage({
          left,
          right,
          sampleRate: buffer.sampleRate,
          bitDepth: 16
      });
  });
}

export function moveItem<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const newArray = [...array];
  if (fromIndex < 0 || fromIndex >= newArray.length || toIndex < 0 || toIndex >= newArray.length) {
    return newArray;
  }
  const [removed] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, removed);
  return newArray;
}

// Performance: Shallow comparison to avoid JSON.stringify in render loops
export function shallowEqual(objA: any, objB: any): boolean {
    if (objA === objB) return true;
    if (!objA || !objB || typeof objA !== 'object' || typeof objB !== 'object') return false;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (objA[key] !== objB[key]) return false;
    }

    return true;
}

// Optimization: Cache distortion curves to prevent GC pressure and expensive recalculation
const distortionCache = new Map<number, Float32Array>();

export function makeDistortionCurve(amount: number = 0): Float32Array | null {
  if (amount <= 0) return null;
  
  if (distortionCache.has(amount)) {
      return distortionCache.get(amount)!;
  }

  const k = amount * 100;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  
  distortionCache.set(amount, curve);
  return curve;
}

export const formatBars = (time: number, bpm: number): string => {
    const secondsPerBeat = 60 / bpm;
    if (secondsPerBeat <= 0) return "1:1:1";
    const totalBeats = time / secondsPerBeat;
    const bar = Math.floor(totalBeats / 4) + 1;
    const beat = Math.floor(totalBeats % 4) + 1;
    const sixteenth = Math.floor((totalBeats % 1) * 4) + 1;
    return `${bar}:${beat}:${sixteenth}`;
};

export const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const millis = Math.floor((time % 1) * 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis}`;
};

export const getAutomationValueAtTime = (points: AutomationPoint[], time: number, defaultValue: number): number => {
    if (!points || points.length === 0) return defaultValue;
    
    // Sort points just in case
    const sorted = [...points].sort((a, b) => a.time - b.time);
    
    // Time is before first point
    if (time <= sorted[0].time) return sorted[0].value;
    
    // Time is after last point
    if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
    
    // Find surrounding points
    const index = sorted.findIndex(p => p.time > time);
    if (index === -1) return sorted[sorted.length - 1].value;
    
    const pNext = sorted[index];
    const pPrev = sorted[index - 1];
    
    if (pPrev.curve === 'step') {
        return pPrev.value;
    } else if (pPrev.curve === 'exponential') {
        // Simple exponential interpolation
        const t = (time - pPrev.time) / (pNext.time - pPrev.time);
        // Avoid zero for log calcs
        const v1 = Math.max(0.001, pPrev.value);
        const v2 = Math.max(0.001, pNext.value);
        return v1 * Math.pow(v2 / v1, t);
    } else {
        // Linear
        const t = (time - pPrev.time) / (pNext.time - pPrev.time);
        return pPrev.value + (pNext.value - pPrev.value) * t;
    }
};

// EQ Constants matching AudioEngine
export const EQ_FREQS = {
    low: 320,
    mid: 1000,
    high: 3200
};

export const getEQResponse = (lowGain: number, midGain: number, highGain: number, width: number): Float32Array => {
    // Helper to calculate approximate mag response for visualization
    const freqCount = width; 
    const freqs = new Float32Array(freqCount);
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    
    for (let i = 0; i < freqCount; i++) {
        const f = Math.pow(10, minLog + (i / freqCount) * (maxLog - minLog));
        freqs[i] = f;
    }

    const sampleRate = 44100;
    const magResponse = new Float32Array(freqCount).fill(0); // in dB

    // 1. Low Shelf
    addBiquadResponse(freqs, magResponse, 0, EQ_FREQS.low, 0, lowGain, sampleRate);
    // 2. Peaking (Mid)
    addBiquadResponse(freqs, magResponse, 5, EQ_FREQS.mid, 1.0, midGain, sampleRate);
    // 3. High Shelf
    addBiquadResponse(freqs, magResponse, 1, EQ_FREQS.high, 0, highGain, sampleRate);

    return magResponse;
};

// Filter Types: 0=LowShelf, 1=HighShelf, 5=Peaking
function addBiquadResponse(freqs: Float32Array, outputDb: Float32Array, type: number, f0: number, Q: number, gainDb: number, Fs: number) {
    if (Math.abs(gainDb) < 0.01) return; // Optimization

    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * f0 / Fs;
    const alphaPeak = Math.sin(w0) / (2 * Q);

    let b0=0, b1=0, b2=0, a0=0, a1=0, a2=0;

    if (type === 0) { // LowShelf
        const cos = Math.cos(w0);
        const sin = Math.sin(w0);
        const alphaShelf = sin / 2 * Math.sqrt( (A + 1/A)*(1/1 - 1) + 2 ); // S=1
        
        b0 =    A*( (A+1) - (A-1)*cos + 2*Math.sqrt(A)*alphaShelf );
        b1 =  2*A*( (A-1) - (A+1)*cos                   );
        b2 =    A*( (A+1) - (A-1)*cos - 2*Math.sqrt(A)*alphaShelf );
        a0 =        (A+1) + (A-1)*cos + 2*Math.sqrt(A)*alphaShelf;
        a1 =   -2*( (A-1) + (A+1)*cos                   );
        a2 =        (A+1) + (A-1)*cos - 2*Math.sqrt(A)*alphaShelf;

    } else if (type === 1) { // HighShelf
        const cos = Math.cos(w0);
        const sin = Math.sin(w0);
        const alphaShelf = sin / 2 * Math.sqrt( (A + 1/A)*(1/1 - 1) + 2 );

        b0 =    A*( (A+1) + (A-1)*cos + 2*Math.sqrt(A)*alphaShelf );
        b1 = -2*A*( (A-1) + (A+1)*cos                   );
        b2 =    A*( (A+1) + (A-1)*cos - 2*Math.sqrt(A)*alphaShelf );
        a0 =        (A+1) - (A-1)*cos + 2*Math.sqrt(A)*alphaShelf;
        a1 =    2*( (A-1) - (A+1)*cos                   );
        a2 =        (A+1) - (A-1)*cos - 2*Math.sqrt(A)*alphaShelf;

    } else if (type === 5) { // Peaking
        const cos = Math.cos(w0);
        b0 = 1 + alphaPeak * A;
        b1 = -2 * cos;
        b2 = 1 - alphaPeak * A;
        a0 = 1 + alphaPeak / A;
        a1 = -2 * cos;
        a2 = 1 - alphaPeak / A;
    }

    // Normalize
    b0 /= a0; b1 /= a0; b2 /= a0;
    a1 /= a0; a2 /= a0; 

    for (let i = 0; i < freqs.length; i++) {
        const w = 2 * Math.PI * freqs[i] / Fs;
        const cosW = Math.cos(w);
        const cos2W = Math.cos(2*w);
        
        // Simplified magnitude calc:
        const num = b0*b0 + b1*b1 + b2*b2 + 2*(b0*b1 + b1*b2)*cosW + 2*b0*b2*cos2W;
        const den = 1 + a1*a1 + a2*a2 + 2*(a1 + a1*a2)*cosW + 2*a2*cos2W;
        
        const magSq = num / den;
        const db = 10 * Math.log10(magSq);
        
        outputDb[i] += db;
    }
}

export const getCompressorCurve = (threshold: number, ratio: number, knee: number): { x: number, y: number }[] => {
    const points: { x: number, y: number }[] = [];
    const minDb = -60;
    const maxDb = 0;
    const steps = 60; 

    for (let i = 0; i <= steps; i++) {
        const x = minDb + (i / steps) * (maxDb - minDb);
        let y = x;
        
        if (ratio > 1) {
            if (knee <= 0) {
                if (x > threshold) {
                    y = threshold + (x - threshold) / ratio;
                }
            } else {
                const W = knee;
                const T = threshold;
                
                if (2 * (x - T) < -W) {
                    y = x;
                } else if (2 * (x - T) > W) {
                    y = T + (x - T) / ratio;
                } else {
                    const gainReduction = (1 - 1/ratio) * Math.pow(x - T + W/2, 2) / (2 * W);
                    y = x - gainReduction;
                }
            }
        }
        
        points.push({ x, y });
    }
    return points;
};

// --- Piano Roll Math ---

export const getPitchAtY = (y: number, noteHeight: number, maxPitch: number): number => {
    const row = Math.floor(y / noteHeight);
    return maxPitch - row;
};

export const getTimeAtX = (x: number, keysWidth: number, zoomX: number): number => {
    return Math.max(0, (x - keysWidth) / zoomX);
};

export const getNoteAtPosition = (
    x: number, 
    y: number, 
    notes: MidiNote[], 
    zoomX: number, 
    noteHeight: number, 
    maxPitch: number,
    keysWidth: number
): number => {
    return notes.findIndex(n => {
        const nx = keysWidth + (n.start * zoomX);
        const ny = (maxPitch - n.note) * noteHeight;
        const nw = n.duration * zoomX;
        return x >= nx && x <= nx + nw && y >= ny && y <= ny + noteHeight;
    });
};
