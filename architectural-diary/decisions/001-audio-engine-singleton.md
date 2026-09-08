# 001 — Single AudioEngine singleton synced from React state

**Date / era**: initial codebase (fb742a8), stabilized through the sync/effects commits.
**Status**: current.

## Context

A DAW has two worlds: the project document (tracks, clips, settings — naturally React state) and the Web Audio graph (nodes, sources, schedulers — inherently mutable and imperative). Early commits needed playback, per-track gain/pan, reverb/delay, and MediaRecorder recording without drowning in state-sync bugs.

## Decision

One mutable `AudioEngine` singleton (`services/audio.ts`) owns the entire Web Audio graph and all scheduling. React never reads engine state back. Instead, effects in App (later the `AudioSync` component) push project state into the engine through setter methods (`syncTracks`, `setMasterEq`, `setMasterCompressor`, `syncBacking`, ...). The document in React state is the single source of truth; the engine is a projection of it.

## Consequences

- Simple mental model; undo/redo works on the document and the engine just follows.
- Dirty-checking became necessary: `TrackChannel.lastState` (later a structured `cache` with `mix`/`processing`/`routing` chunks) skips redundant `AudioParam` writes on every sync pass, and `loadingPromises` dedupes concurrent buffer loads.
- The engine grew a lifecycle API (`dispose()`, `reset()`, `clearBuffers()`) to avoid leaks across project loads; `source.onended` cleanup fixed an early memory leak with `activeSources`.
- Risk to watch: any state the engine derives on its own (beat clock, buffer caches) can drift from the document — which is exactly what decision 002's bug was about.
