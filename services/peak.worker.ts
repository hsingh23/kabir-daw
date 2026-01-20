
self.onmessage = function(e) {
  const { channelData, samplesPerPeak } = e.data;
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
  self.postMessage(peaks);
};
