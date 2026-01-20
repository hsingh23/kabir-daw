
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const _format = 1; // PCM
  const bitDepth = 16;
  
  let result: Float32Array;
  if (numChannels === 2) {
      result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
      result = buffer.getChannelData(0);
  }

  return encodeWAV(result, numChannels, sampleRate, bitDepth);
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);

  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function encodeWAV(samples: Float32Array, numChannels: number, sampleRate: number, bitDepth: number): Blob {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
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
    // Generate transfer curve points [inputdB, outputdB]
    // Range -60dB to 0dB
    const points: { x: number, y: number }[] = [];
    const minDb = -60;
    const maxDb = 0;
    const steps = 60; 

    for (let i = 0; i <= steps; i++) {
        const x = minDb + (i / steps) * (maxDb - minDb);
        let y = x;

        // Soft Knee Approximation logic similar to WebAudio API
        // if x < threshold, y = x
        // if x > threshold, y = threshold + (x - threshold) / ratio
        // with knee smoothing
        
        if (ratio > 1) {
            // Simple hard knee for visualization if knee is 0
            if (knee <= 0) {
                if (x > threshold) {
                    y = threshold + (x - threshold) / ratio;
                }
            } else {
                // Soft knee
                // 2*(x - T) < -W  => no compression
                // 2*(x - T) > W   => full compression
                // else            => interpolate
                const W = knee;
                const T = threshold;
                
                if (2 * (x - T) < -W) {
                    y = x;
                } else if (2 * (x - T) > W) {
                    y = T + (x - T) / ratio;
                } else {
                    // Spline
                    const slope = 1 / ratio;
                    // Exact formula from WebAudio spec is complex, standard approximation:
                    // y = x + (1/R - 1) * (x - T + W/2)^2 / (2*W)
                    const gainReduction = (1 - 1/ratio) * Math.pow(x - T + W/2, 2) / (2 * W);
                    y = x - gainReduction;
                }
            }
        }
        
        points.push({ x, y });
    }
    return points;
};
