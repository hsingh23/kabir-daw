
// Pure mathematical functions for audio processing
// Extracted to be testable and shared between workers and main thread

export function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
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

export function encodeWAV(samples: Float32Array, numChannels: number, sampleRate: number, bitDepth: number): Blob {
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

export function computeWaveformPeaks(channelData: Float32Array, samplesPerPeak: number): Float32Array {
    const length = Math.ceil(channelData.length / samplesPerPeak);
    const peaks = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channelData.length);
      let max = 0;
      const stride = 10; 
      for (let j = start; j < end; j += stride) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks[i] = max;
    }
    return peaks;
}
