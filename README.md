# PocketStudio DAW (kabir-daw)

A professional-grade, mobile-first digital audio workstation that runs entirely in the browser. Record audio, arrange clips on a multi-track timeline, play MIDI synth parts, practice with Tanpura and Tabla backing, mix with EQ/compression/FX sends, and export your mix as WAV — all offline-capable as a PWA, with projects stored locally in IndexedDB. No accounts, no server, no audio uploaded anywhere.

The project began as a Google AI Studio export and grew into a full DAW. See [CHANGELOG.md](CHANGELOG.md) for the complete commit-by-commit history and [architectural-diary/](architectural-diary/) for the reasoning behind key decisions.

## Why

Built for musicians (especially Indian classical practitioners — hence the Tanpura, Tabla with taal selection, and drone instruments) who want a sketch-to-song studio on a phone or tablet: touch-first arranger interaction, latency calibration for mobile recording, wake-lock during long sessions, and a dark studio UI that works in the field.

## Features

- **Multi-track arranger** — audio and MIDI instrument tracks; drag, trim, split, time-stretch, fade, color, loop, and reorder clips; marquee multi-select; snap grid with beat-based quantize; markers; loop region; minimap; pinch/ctrl-wheel zoom.
- **Recording** — MediaRecorder capture with input monitoring, latency compensation, count-in, and live ghost-clip feedback; auto-arms a track and can record MIDI clips on instrument tracks.
- **Instruments** — subtractive synth (waveform + ADSR) with piano roll and virtual keyboard; Tanpura (Pa/Ma/Ni tunings, fine-tune); Tabla (7 taals, streamed loop MP3s matched to taal/key/BPM); Drone synth; 16-step sequencer.
- **Mixing** — per-track 3-band EQ, distortion, compressor, pan, fader, mute/solo, level meters, and reverb/delay/chorus sends (pre/post configurable); master EQ, compressor, and spectrum analyzer.
- **Editing extras** — clip gain/speed/detune/reverse/normalize, per-clip fades, undo/redo (20 levels), project notes/lyrics, project templates, time signature and metronome (beep/click/hihat) settings.
- **Persistence & export** — projects and audio assets in IndexedDB (multi-project, orphan cleanup, quota handling); export the master mix or per-track stems as WAV via a web worker.
- **Mobile & a11y** — pointer-event interactions (one code path for mouse/touch), Web MIDI input routing, keyboard-operable knobs/faders with ARIA, wake lock, PWA install.

## Stack (with versions)

| Layer | Choice |
| --- | --- |
| UI | React 19.2 + TypeScript 5.9 (strict) |
| Build | Vite 7.3, `@vitejs/plugin-react` |
| Styling | Tailwind CSS 4.1 via `@tailwindcss/vite` (`@theme` variables, no PostCSS) |
| Audio | Web Audio API (custom `AudioEngine`), Web MIDI, MediaRecorder |
| State | React context + Immer 10 (`useProjectState`) |
| Storage | IndexedDB via `idb` 8 (`PocketStudioDB`, v2) |
| Workers | `export.worker` (WAV encode), `peak.worker` (waveform peaks), `wave.worker` (OffscreenCanvas rendering) |
| Lint/format | Biome 2.3 |
| Tests | Vitest 4 + Testing Library (jsdom), Playwright 1.57 (mobile e2e) |
| Deploy | Netlify (`netlify.toml`, SPA redirect), PWA via `vite-plugin-pwa` |

## Quickstart

Prerequisites: Node.js (18+) and npm (or bun — `validate` scripts use `bun:` runners via `concurrently`).

```bash
npm install        # install dependencies
npm run dev        # start dev server on 0.0.0.0:5173
```

Other commands:

```bash
npm run build        # tsc + vite build (dist/)
npm run preview      # preview the production build
npm run lint         # biome check (auto-fix, up to 1000 diagnostics)
npm run format       # biome format --fix
npm run typecheck    # tsc --noEmit
npm run test:unit    # vitest run
npm run test:e2e     # playwright test
npm run validate     # lint + typecheck + unit + build concurrently
```

The dev server allows the external host `kabir.roomtolearn.org` for remote/mobile testing. Audio requires a user gesture to unlock the AudioContext (the app shows an overlay on first load) — expected browser behavior, especially on iOS.

## Project structure

```
App.tsx                     App shell: views, transport, project wiring
index.tsx                   Entry: ErrorBoundary + App + ToastProvider
types.ts                    Domain model (Clip, Track, ProjectState, instruments)
components/                 ~50 UI components (Arranger*, Mixer*, inspectors,
                            PianoRoll, Tanpura, Tabla, DroneSynth, StepSequencer, ...)
contexts/ProjectContext.tsx Project state provider (useProject)
hooks/                      useProjectState, useArrangerInteraction,
                            useKeyboardShortcuts, useRecordingWorkflow,
                            useMidiRouting, useTimelineMath, useWakeLock, ...
services/audio.ts           AudioEngine: Web Audio graph, scheduling, offline render
services/db.ts              IndexedDB persistence (PocketStudioDB)
services/midi.ts            Web MIDI input service
services/SynthVoice.ts      ADSR synth voice
services/audio-math.ts      WAV encode, peak computation (shared with workers)
services/{export,peak,wave}.worker.ts   Off-main-thread DSP/render workers
services/templates.ts       Project templates & factory helpers
tests/                      Vitest unit/integration + Playwright e2e + setup mocks
```

## Environment

No environment variables are required. The codebase only reads the conventional `NODE_ENV` and CI systems set `CI` (Playwright config). There is no API key or backend: all audio processing and storage happen in the browser. (The taba/tanpura loop MP3s are fetched from the public `audio.spardhaschoolofmusic.com` CDN.)

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — every commit, newest-first.
- [AGENTS.md](AGENTS.md) — commands, architecture map, and conventions for coding agents.
- [architectural-diary/](architectural-diary/) — decision records (audio engine, state, persistence).
- [prompt.md](prompt.md) — one-shot prompt that recreates this project from scratch.
