# 005 — Offline render mirrors the live graph for export

**Date / era**: export commit (8241853), reworked repeatedly (d4e80f5, 382fa57).
**Status**: current (with one known chorus gap).

## Context

Exporting the mix can't just record the live output (that would take real-time and include monitoring/latency artifacts). The project needed faster-than-realtime, deterministic bounces — and later, per-track stem exports.

## Decision

`AudioEngine.renderProject()` rebuilds the entire project graph on an `OfflineAudioContext`: master chain (gain → master EQ → master compressor), per-track channel strips via the shared `createTrackGraph`, FX bus, all clip sources scheduled with their fades/gain/speed/detune, plus instruments (tanpura/tabla/sequencer/drone/MIDI voices) honored within the loop range. Automation (`getAutomationValueAtTime`) is evaluated identically. The result is encoded to 16-bit PCM WAV by `services/utils.ts` / `audio-math.ts` and, since the workers commit, encoded off-main-thread in `export.worker.ts`. `ExportDialog` offers master mix or per-track stems.

## Consequences

- Deterministic, faster-than-realtime exports; stems come almost free from the same path.
- Every realtime feature must be mirrored manually — historically the source of export bugs:
  - chorus send dropped during the scheduler rework (still absent offline; see 003),
  - early versions missed master compressor / EQ until explicitly mirrored.
- Shared math (`audio-math.ts`) keeps WAV encoding identical between worker and main thread; that file must stay DOM-free.
- Acceptance rule adopted: any PR touching the audio graph must state whether the offline mirror was updated.
