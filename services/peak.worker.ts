
import { computeWaveformPeaks } from "./audio-math";

self.onmessage = function(e) {
  const { channelData, samplesPerPeak } = e.data;
  const peaks = computeWaveformPeaks(channelData, samplesPerPeak);
  self.postMessage(peaks);
};
