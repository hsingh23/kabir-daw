
import { interleave, encodeWAV } from "./audio-math";

self.onmessage = (e) => {
    const { left, right, sampleRate, bitDepth } = e.data;
    const numChannels = right ? 2 : 1;
    
    let samples: Float32Array;
    if (numChannels === 2) {
        samples = interleave(left, right);
    } else {
        samples = left;
    }

    const wavBlob = encodeWAV(samples, numChannels, sampleRate, bitDepth);
    self.postMessage(wavBlob);
};
