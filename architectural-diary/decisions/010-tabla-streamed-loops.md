# 010 — Tabla as streamed CDN loops instead of synthesis

**Date / era**: synthesized tabla (9f5bcc2, d4e80f5), replaced with streaming (a185185).
**Status**: current.

## Context

Tabla was first synthesized with oscillators (bayan swoop tuned to key, triangle-wave dayan variants for TeenTaal/Keherwa/Dadra). It worked, but never sounded like a real tabla — the articulations (bols like dha/dhin/tin/na with their pitch bends and resonances) are extremely hard to synthesize convincingly. Meanwhile recordings of full taal cycles at every key/BPM existed on a CDN.

## Decision

Switch tabla playback to streamed loop MP3s from the public Spardha School of Music CDN:

```
https://audio.spardhaschoolofmusic.com/music/tabla/{taal}/{key}/{bpm}bpm.mp3
```

- Seven taals grouped by BPM range (80–200 high set, 80–150 low set); chromatic key; BPM clamped to the taal's range in steps of 5.
- The engine caches decoded buffers per URL (`tablaBufferCache`), starts/stops loops with race-condition guards (a fast taal/BPM switch cancels stale fetch-then-play chains), and restarts loops on transport play.
- `syncBacking(tanpura, tabla)` unifies both backing instruments' sync path (driven by the `AudioSync` effect) and resumes a suspended context when either is enabled.
- The old oscillator synthesis was retired; the UI shows a loading spinner while the loop buffers.

## Consequences

- Dramatically better sound; taal cycles are authentic by construction.
- New runtime dependency on an external CDN — offline PWA use of tabla degrades without network (tanpura/drone/sequencer remain fully local synthesis).
- Latency on first selection of a taal/key/BPM combination (fetch + decode); mitigated by the cache.
- The pattern established a precedent: for instruments where realism matters more than synthesis control, prefer high-quality sampled loops; keep synthesizable instruments (tanpura, drone, sequencer samples) local.
