# 004 — Full channel strip per track, unified by createTrackGraph

**Date / era**: EQ (5ecc412) → compressor (866c555) → distortion + shared factory (382fa57) → TrackChannel class (1ff4185).
**Status**: current.

## Context

Tracks started as bare `GainNode` + `StereoPannerNode`. EQ was added by hand-wiring BiquadFilters; the per-track compressor repeated the exercise; distortion would have been a third copy. Live and offline rendering also duplicated the chain.

## Decision

Each track is a `TrackChannel` (class in `services/audio.ts`) built by one shared factory, `createTrackGraph`:

```
input → distortion(WaveShaper) → EQ (lowshelf 320Hz, peaking 1kHz, highshelf 3.2kHz)
      → compressor (DynamicsCompressorNode, bypassable) → fader(gain) → panner
      → sends (reverb/delay/chorus, pre or post) → master
```

- The live context injects a post-fader analyser for metering; offline export builds the same chain on `OfflineAudioContext`.
- `applyTrackSettings` syncs parameters: smoothed with `setTargetAtTime` live, direct `.value` assignment offline; a dirty-check cache (`mix`/`processing`/`routing`) skips redundant writes.
- The compressor is bypassed by neutral settings (0dB threshold compensation, 1:1 ratio) rather than rewiring the chain.
- Clip-level processing (fades, per-clip gain, speed, detune) happens on the source feeding the strip — per-source envelope `GainNode`s connected to the channel input.

## Consequences

- One place to add a track processing stage; live and export stay consistent by construction.
- Mute/solo is evaluated at sync time (`effectiveMute` includes "not soloed when any solo exists").
- The `Track` type mirrors the strip's parameters; new saved projects and migrations must supply defaults for every new stage (each addition shipped a migration — keep doing that).
