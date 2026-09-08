# AGENTS.md — working guide for coding agents

PocketStudio DAW is a browser-only, mobile-first digital audio workstation (React 19 + TypeScript + Web Audio + IndexedDB). This file tells you how to build, verify, and navigate changes safely. For history see [CHANGELOG.md](CHANGELOG.md); for design reasoning see [architectural-diary/](architectural-diary/main.md).

## Commands

```bash
npm run dev          # dev server on 0.0.0.0:5173 (allowedHosts includes kabir.roomtolearn.org)
npm run build        # tsc && vite build  (typecheck gates the build)
npm run typecheck    # tsc --noEmit
npm run lint         # biome check --max-diagnostics 1000 --fix  (MUTATES files — safe fixes)
npm run format       # biome format --fix
npm run test:unit    # vitest run (jsdom; Web Audio fully mocked in tests/setup.ts)
npm run test:e2e     # playwright test (mobile emulation; needs built/dev server per config)
npm run validate     # concurrently: lint + typecheck + test:unit + build
```

Use `npm run validate` before declaring work done. `lint` auto-fixes in place — expect diffs from it and review them.

## Architecture map

```
index.tsx
  └─ ErrorBoundary → App (view routing: arranger | mixer | library | projects | community; ?view= URL param)
       └─ ProjectProvider (contexts/ProjectContext.tsx)
            └─ useProjectState (hooks/useProjectState.ts)   ← Immer produce + undo/redo history
       └─ MainLayout / BottomNavigation / TransportHeader / AudioSync / GlobalProgressBar
       └─ hooks: useKeyboardShortcuts, useRecordingWorkflow, useMidiRouting,
                  useArrangerInteraction (all arranger pointer logic), useTimelineMath,
                  useTimelineNavigation, useWakeLock
       └─ services/audio.ts  AudioEngine (singleton, class TrackChannel per track)
            realtime graph: input → distortion → EQ(3) → compressor → fader → panner
                            → sends(reverb/delay/chorus, pre/post) → master(EQ → compressor) → out
            scheduling: 0.1s lookahead scheduler() driven by RAF; metronome, tanpura,
                        tabla streams, sequencer, drone, MIDI voices (SynthVoice)
            offline: renderProject() rebuilds the same graph on OfflineAudioContext
            → export.worker (WAV), peak.worker, wave.worker (OffscreenCanvas)
       └─ services/db.ts  PocketStudioDB (idb v2): stores assets(Blob), asset_metadata, projects
       └─ services/midi.ts  Web MIDI in; useMidiRouting maps notes/CC to tracks
```

Key rule: React state is the single source of truth for the project document (`types.ts` → `ProjectState`); the AudioEngine is a mutable singleton that React effects sync *from* state (dirty-checked). Never read engine state back into React.

## Conventions

- **Commit messages**: conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `build:`, `style:`, `perf:`, `docs:`), optional scope from the area (`arranger`, `audio`, `app`, `components`, `tabla`...). Imperative subject ≤ 72 chars, body explains what and why.
- **Code style**: Biome enforces formatting/imports (assist organizes imports); TypeScript strict with ES2024 target; Tailwind v4 via `@theme` variables in `index.css` (not `tailwind.config.js`).
- **Components**: function components in `components/`, props-driven, memoized where they render canvases (`Waveform`, `PianoRoll`, meters use RAF loops, not React state, for animation).
- **State updates**: always mutate the project through `useProject().updateProject(recipe)` (Immer recipe or partial). For undoable gestures, call `commitTransaction()` on pointerdown — history is NOT pushed automatically.
- **Audio changes**: anything affecting the realtime graph must usually be mirrored in `renderProject()` (offline export) and in `applyTrackSettings`/sync paths. Check all three or exports will silently diverge.
- **Tests**: colocate unit/integration under `tests/` mirroring the shape (`tests/components`, `tests/integration`, `tests/unit`, `tests/e2e`). New Web Audio nodes need mocks added to `tests/setup.ts`.

## Gotchas

- **AudioContext unlock**: browsers (iOS especially) require a user gesture; `resumeContext()` is called in gesture handlers and `AudioContextOverlay` gates the app. Tests must use the mocks.
- **Beat clock**: the scheduler's `nextNoteTime`/`currentBeat` must always advance during playback even when the metronome is off, or re-enabling it fires a burst of catch-up clicks (fixed once; keep it that way).
- **BPM bounds**: keep the 20–999 clamps in `play()`/`scheduler()` and non-finite tick guards — removing them reintroduces infinite scheduler loops.
- **Timeline vs buffer seconds**: clip `speed`/`detune` mean many calculations convert between timeline seconds and buffer seconds (loop detection, offsets, trim deltas, loop markers). Use the existing helpers in `useTimelineMath`/`Arranger` rather than raw arithmetic.
- **IndexedDB**: assets are Blobs keyed by `bufferKey`; clips reference them. Deleting assets uses the joint transaction that also removes metadata. Quota errors surface to the UI — don't swallow them.
- **Workers**: `wave.worker` assumes `OffscreenCanvas`; `export.worker` imports from `services/audio-math` (keep that file worker-safe: no DOM imports). Tool modes live in the `ToolMode` enum (`POINTER`, `HAND`, `SPLIT`, `ERASER`, `AUTOMATION`).
- **History**: commit messages on `main` were rewritten on 2026-09-08 (messages only). Don't be surprised that old short hashes in external references no longer resolve.

## Verifying changes

1. `npm run validate` (lint + typecheck + unit + build).
2. If you touched audio scheduling or the graph: run `npm run test:unit -- Audio` and add/extend a fixture — the dirty-check and graph tests (`AudioDirtyCheck`, `AudioGraph`) catch most regressions.
3. If you touched the arranger: `npm run test:unit -- Arranger` (integration tests mock `getBoundingClientRect`; keep the mocks current).
4. Manual smoke: `npm run dev`, record a clip (needs mic permission), play with metronome, export WAV.

## Pointers

- Commit-by-commit history: [CHANGELOG.md](CHANGELOG.md)
- Decision records (audio engine, state management, persistence, workers): [architectural-diary/main.md](architectural-diary/main.md)
- One-shot recreation prompt (full spec): [prompt.md](prompt.md)
