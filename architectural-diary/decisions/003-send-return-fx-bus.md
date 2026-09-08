# 003 — Send/return FX bus for reverb, delay, and chorus

**Date / era**: chorus commit (438aee6), refined with per-track sends (2bf23ca).
**Status**: current.

## Context

The first effects (reverb, delay) were simple master-level mix knobs. Adding chorus forced the question of architecture: per-track effect chains (expensive, inflexible) or a shared bus with per-track send levels (console-style).

## Decision

A global send/return bus per effect: each of reverb, delay, and chorus has one shared effect node (procedural impulse-response reverb, feedback delay at 0.4, chorus as a 30ms delay modulated by a 1.5Hz LFO). Every track channel strip gets three send-gain nodes (`Track.sends`: reverb/delay/chorus, 0–1) feeding them, with `sendConfig` flags choosing pre- or post-fader tap points per effect. Project-level `effects` levels control return volume.

## Consequences

- Cheap and predictable: three effect instances total, N×3 gain nodes.
- Sends default to 0 (an early version defaulted to full feeds — every track was drowned in reverb until migration reset them).
- Per-effect pre/post routing gives real console behavior for free (send survives fader moves when pre).
- Known gap: during the scheduler rework (d4e80f5) the chorus send was dropped from the offline render path, so exports can differ from realtime playback for chorus. Anyone touching the FX bus should re-verify the mirror (see 005).
