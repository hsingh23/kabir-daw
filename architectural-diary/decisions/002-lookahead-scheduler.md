# 002 — Lookahead scheduler with an always-advancing beat clock

**Date / era**: metronome commit (4e2f908), fixed in 1cd0037, hardened in 9c5ec8a.
**Status**: current.

## Context

Browser audio must be scheduled ahead on the audio clock (`AudioContext.currentTime`); scheduling from React renders or `setTimeout` produces jitter. The metronome introduced the pattern that tanpura, tabla, the step sequencer, and count-in all reuse.

## Decision

A single `scheduler()` runs with a 0.1s lookahead window, invoked from App's requestAnimationFrame loop (later `services/animation.ts`). It advances `nextNoteTime`/`currentBeat` from `bpm` (and `timeSignature` for tick duration and downbeat accenting) and schedules whatever is due: metronome clicks, tanpura plucks, tabla events, sequencer steps. Playback realigns the clock to the seek position on `play()`.

Two hardening rules learned the hard way:

1. **The beat clock must advance even when a voice is muted.** The first implementation returned early when the metronome was off; re-enabling it mid-playback resumed from a stale beat and fired a burst of catch-up clicks. Fix (1cd0037): gate only `scheduleClick()`, never the clock.
2. **Clamp BPM (20–999) and guard non-finite tick durations**, or a bad tempo value turns the scheduler into an infinite loop (fixed in 9c5ec8a, with a regression test).

## Consequences

- One clock drives all rhythmic features, so transport seek/loop behavior stays consistent across them.
- The scheduler depends on RAF; when the tab is backgrounded the context is suspended (`visibilitychange` handling with `needsResume`) rather than letting the clock free-run.
- Adding a rhythmic feature means adding a voice to `scheduler()`, plus its pattern/frequency helper — tanpura (`getTanpuraFreqs`) and tabla (`getTablaPattern`) set that pattern.
