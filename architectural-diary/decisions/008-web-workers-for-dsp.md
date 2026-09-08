# 008 — Web workers for WAV export, peaks, and waveform drawing

**Date / era**: peak cache (a389952), worker migration (be8e989), OffscreenCanvas wave worker (1ff4185).
**Status**: current.

## Context

Export encoding, waveform peak computation, and waveform bitmap drawing are O(samples) CPU work. On mobile, doing them on the main thread froze the UI during export and while scrolling long arrangements.

## Decision

Three dedicated workers, with shared math kept in `services/audio-math.ts` (DOM-free so both worlds can import it):

- `export.worker.ts` — receives interleaved or split channel `Float32Array`s, interleaves, and encodes PCM WAV via `encodeWAV(samples, numChannels, sampleRate, bitDepth)` off-thread.
- `peak.worker.ts` — computes min/max waveform peaks (`computeWaveformPeaks`) at a given `samplesPerPeak`; results feed the engine's peak cache (pre-computed at 100 peaks/sec on buffer load) so scrolling never rescans channel data.
- `wave.worker.ts` — renders waveform bitmaps to `OffscreenCanvas` (with a main-thread fallback path when unavailable), receiving channel data + dimensions + color.

## Consequences

- Export and waveform work no longer block interaction; the peak cache made zoomed-out views effectively free.
- `Waveform` became a thin canvas component drawing worker/peak output; a `ResizeObserver` handles resize.
- Constraint: `audio-math.ts` must never import DOM/React — breaking that breaks the workers at build time.
- OffscreenCanvas support is assumed-with-fallback; Safari quirks are contained inside `waveformService.ts`.
