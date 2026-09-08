# Architectural Diary — Main Index

PocketStudio DAW grew from an AI Studio scaffold (2026-01-19) to a full browser DAW in 62 commits over six days (2026-01-19 → 2026-01-24), single-authored. This diary records the decisions that shaped it, in roughly chronological order. Each entry links to a decision file with context, the choice, and consequences.

## Timeline at a glance

- **Day 1 (2026-01-19, 54 commits)**: core codebase, arranger UX iterations (three layout rewrites), audio engine growth (EQ → compressor → sends → master chain), persistence, tooling (Vite/Tailwind v4/Biome/PWA/tests), inspectors/export/visualization suite, and the big refactor wave (decomposition, templates, error boundary).
- **Day 2 (2026-01-20, 4 commits)**: MIDI + instrument tracks, Immer/automation/workers restructure, sequencer & drone instruments, ProjectContext decomposition.
- **Day 4 (2026-01-24, 4 commits)**: tabla switched from synthesis to streamed loops, polish passes.

## Decision index

| # | Decision | Commit (era) | File |
| --- | --- | --- | --- |
| 001 | Single AudioEngine singleton synced from React state | initial codebase | [001-audio-engine-singleton.md](decisions/001-audio-engine-singleton.md) |
| 002 | Lookahead scheduler with an always-advancing beat clock | metronome era, later fixed | [002-lookahead-scheduler.md](decisions/002-lookahead-scheduler.md) |
| 003 | Send/return FX bus (reverb, delay, chorus) | chorus commit | [003-send-return-fx-bus.md](decisions/003-send-return-fx-bus.md) |
| 004 | Full channel strip per track via TrackChannel | EQ → compressor → distortion era | [004-channel-strip-trackchannel.md](decisions/004-channel-strip-trackchannel.md) |
| 005 | Offline render mirrors the live graph for export | export commit | [005-offline-render-mirror.md](decisions/005-offline-render-mirror.md) |
| 006 | IndexedDB persistence: blobs + metadata + projects | persistence era | [006-indexeddb-persistence.md](decisions/006-indexeddb-persistence.md) |
| 007 | Immer state with explicit undo transactions | Immer commit | [007-immer-undo-transactions.md](decisions/007-immer-undo-transactions.md) |
| 008 | Web workers for WAV export, peaks, waveform drawing | workers commit | [008-web-workers-for-dsp.md](decisions/008-web-workers-for-dsp.md) |
| 009 | Pointer Events as the single interaction path | arranger rewrites | [009-pointer-events-interaction.md](decisions/009-pointer-events-interaction.md) |
| 010 | Tabla as streamed CDN loops instead of synthesis | tabla rework | [010-tabla-streamed-loops.md](decisions/010-tabla-streamed-loops.md) |

## Themes and lessons

- **The arranger was rewritten three times** (two-pane → single sticky container → two-pane again with pointer events). Each rewrite temporarily dropped features (metronome toggle, pinch-zoom, long-press, deselection) that had to be consciously restored — one commit (`1056566`) even shipped a syntactically truncated `Arranger.tsx`, repaired by the next commit. Lesson recorded in [009](decisions/009-pointer-events-interaction.md): consolidate interaction logic into `useArrangerInteraction` so layout rewrites stop costing features.
- **The audio engine accreted stages** (EQ, compressor, distortion, sends, master chain) that each had to be mirrored in offline render — eventually unified by the shared `createTrackGraph` factory (see [004](decisions/004-channel-strip-trackchannel.md) and [005](decisions/005-offline-render-mirror.md)). One known divergence: chorus was dropped from offline rendering during a scheduler rework.
- **State management evolved twice**: hand-rolled immutable snapshots with `structuredClone` → Immer `produce` → explicit `commitTransaction()` undo points ([007](decisions/007-immer-undo-transactions.md)).
- **App.tsx shrank repeatedly** (574 lines today) via context extraction, workflow hooks, and component decomposition — culminating in `ProjectContext` + `useRecordingWorkflow` + `MainLayout`.
