# prompt.md — One-shot recreation prompt for PocketStudio DAW

Give this prompt to a capable coding agent to recreate this project from scratch. It encodes the goal, exact stack, build order, data model, named APIs, UI/UX decisions, and acceptance criteria distilled from the 62-commit history (see [CHANGELOG.md](CHANGELOG.md) and [architectural-diary/](architectural-diary/main.md) for the reasoning).

---

## Goal

Build **PocketStudio DAW**: a professional-grade, mobile-first digital audio workstation that runs entirely in the browser as an offline-capable PWA. Users record audio, arrange clips on a multi-track timeline, play MIDI synth parts, practice with Indian classical backing instruments (Tanpura, Tabla, Drone, Step Sequencer), mix with EQ/compression/FX sends, and export WAV mixes or stems. No backend, no accounts: all state and audio live in IndexedDB. Dark "studio" aesthetic, touch-first interactions, single-user local app.

## Exact stack (pin these)

- React 19 + TypeScript 5.9 (strict, ES2024 target), Vite 7 with `@vitejs/plugin-react`
- Tailwind CSS 4 via `@tailwindcss/vite` (no PostCSS; `@theme` variables + `@utility` directives in `index.css`)
- Web Audio API (custom engine), Web MIDI (`navigator.requestMIDIAccess`), MediaRecorder
- State: React context + Immer (`produce`)
- Storage: IndexedDB via `idb` (DB name `PocketStudioDB`, version 2)
- Web Workers: `export.worker` (WAV encode), `peak.worker` (peaks), `wave.worker` (OffscreenCanvas waveform bitmaps); shared math in a DOM-free `audio-math.ts`
- Lint/format: Biome 2 (`biome check --max-diagnostics 1000 --fix`); Tests: Vitest 4 + Testing Library (jsdom, full Web Audio mocks in `tests/setup.ts`), Playwright (mobile emulation)
- Deploy: Netlify (`netlify.toml` SPA redirect), PWA via `vite-plugin-pwa` (autoUpdate, theme #1a1a1a, background #121212)
- Deps: `uuid`, `idb`, `clsx`, `tailwind-merge`, `immer`, `lucide-react` icons
- Scripts: `dev`, `build` (tsc && vite build), `preview`, `lint`, `lint:fix`, `format`, `typecheck`, `test:unit`, `test:e2e`, `validate` (lint+typecheck+unit+build concurrently)
- Dev server: host `0.0.0.0`, port 5173, `allowedHosts: ["kabir.roomtolearn.org"]`

## Phased build order

1. **Skeleton**: Vite+React+TS app, domain types, `AudioEngine` singleton with per-track gain/pan, master compressor, procedural IR reverb + feedback delay; MediaRecorder recording; IndexedDB layer; minimal App with Arranger (canvas Waveform), Mixer (Knob/Fader), transport.
2. **Arranger UX**: clip selection + Space/Delete shortcuts; beat-based snap grid (Off/1/16/1/8/1/4/Bar, default 1/4 note; Shift bypasses); BPM input + Bars.Beats.Sub display; bar-numbered ruler with strong/weak beat lines; scrubbable ruler; two-pane layout (fixed left track headers synced via `translateY`, scrollable timeline); pointer-events interactions with `setPointerCapture`; pinch-zoom + ctrl/wheel zoom (cap ~400 px/s); long-press (600ms) context menus.
3. **Clips**: fades (SVG curves + drag handles, clamped, 0.05s anti-click on split), smart looping past buffer end with ghost waveform repeats, per-clip color/speed/detune/gain/mute/reverse/normalize, split at playhead (Cmd/Ctrl+B), quantize start (Q), time-stretch drag mode, marquee multi-select, copy/paste/duplicate/nudge shortcuts.
4. **Engine maturity**: 0.1s lookahead scheduler driven by RAF; metronome (1000/800Hz, three voices: beep/click/hihat); per-track channel strip (distortion → 3-band EQ → compressor → fader → panner → sends); master EQ + compressor; send/return FX bus (reverb, delay 0.4 feedback, chorus 30ms/1.5Hz; per-effect pre/post); level metering via Analysers; offline `renderProject()` mirror for export.
5. **Persistence & projects**: auto-save (debounced) with status, multi-project (create/open/duplicate/delete), templates (Basic Band, Electronic, Podcast, Empty), asset library with `AssetMetadata`, auto speed-matching (`speed = project.bpm / asset.bpm`), orphan cleanup, quota-error UX.
6. **Instruments**: synth (waveform + ADSR via `SynthVoice`), PianoRoll + VirtualKeyboard + Web MIDI routing, recording MIDI clips on instrument tracks; Tanpura (Pa/Ma/Ni tuning, fine-tune); Tabla as streamed loops from `https://audio.spardhaschoolofmusic.com/music/tabla/{taal}/{key}/{bpm}bpm.mp3` (7 taals, BPM clamped to taal range in steps of 5, per-URL buffer cache, race guards); DroneSynth (multi-oscillator); 16-step sequencer (kick/snare/hihat).
7. **App shell & polish**: `ProjectContext` + `useProject()`, `useRecordingWorkflow`, `useKeyboardShortcuts`, `useArrangerInteraction`, `useTimelineMath`, `useWakeLock`; views (arranger/mixer/library/projects/community) via `?view=` URL param, BottomNavigation, TransportHeader, ErrorBoundary, Toasts, AudioContextOverlay unlock gate, SettingsDialog (I/O devices, metronome, count-in 0/1/2/4 bars, latency calibrator), inspectors (Clip/Master/Track with VisualEQ/VisualCompressor canvases), SpectrumAnalyzer, minimap, project markers, notes/lyrics, time signature + return-to-start.

## Data model (types.ts)

- `Clip { id, trackId, name, start, offset, duration, loopLength?, bufferKey?, notes?: MidiNote[], color?, muted?, fadeIn, fadeOut, speed?, gain?, detune? }`
- `Track { id, type: 'audio'|'instrument', name, volume, pan, muted, solo, color, icon?, instrument?: InstrumentConfig, automation?: AutomationCurves, eq{low,mid,high}, distortion?, compressor?{enabled,threshold,ratio,attack,release}, sends{reverb,delay,chorus}, sendConfig{reverbPre,delayPre,chorusPre} }`
- `ProjectState { id, name, notes?, bpm, timeSignature:[n,n], tracks, clips, markers, loopStart, loopEnd, isLooping, metronomeOn, metronomeSound?, countIn, recordingLatency, inputMonitoring, returnToStartOnStop, masterVolume, masterEq, masterCompressor, effects{reverb,delay,chorus}, tanpura?, tabla?, sequencer?, drone? }`
- Supporting: `MidiNote`, `MidiMapping`, `AutomationPoint`/`AutomationCurves` (linear/exponential/step), `InstrumentConfig` (synth preset + ADSR), `AssetMetadata` (name/type/instrument/group/key/bpm/tags/duration/dateAdded/fileType), `Marker`, `SequencerState`, `DroneState`, `TanpuraState`, `TablaState`.

## APIs by name (keep these)

- Engine (`services/audio.ts`, class `AudioEngine`, singleton): `play`, `pause`, `seek`, `scheduler`, `scheduleClick`, `scheduleSource`, `renderProject` (offline), `resumeContext`, `syncTracks`, `applyTrackSettings`, `createTrackGraph`, `setMasterEq`, `setMasterCompressor`, `setReverbLevel`, `setChorusLevel`, `syncBacking`, `syncTablaPlayback`, `getTanpuraFreqs`, `getTablaPattern`, `getAutomationValueAtTime`, `processAudioBuffer`, `playCountIn`, `measureTrackLevel`, `measureMasterLevel`, `measureInputLevel`, `makeDistortionCurve` (cached), `clearBuffers`, `dispose`, `reset`; classes `TrackChannel`, `SynthVoice`.
- DB (`services/db.ts`): `saveAudioBlob`, `getAudioBlob`, `deleteAudioBlob`, `getAllAssetKeys`, `saveAssetMetadata`, `getAllAssetsMetadata`, `saveProject`, `getProject`, `getAllProjects`, `deleteProject`, `cleanupOrphanedAssets`.
- State (`contexts/ProjectContext.tsx` via `useProject()`): `updateProject(recipe)`, `commitTransaction()`, `undo`, `redo`, `canUndo`, `canRedo`, `loadProject`.
- Workers: `export.worker` (encodeWAV), `peak.worker` (computeWaveformPeaks), `wave.worker` (OffscreenCanvas bitmaps); shared math in `audio-math.ts`.

## UI/UX & design decisions

- Dark studio theme: panels #1e1e1e / #252525 / #191919 on #121212 background (`--color-studio-bg`); clip colors from a fixed palette; per-track colored clip borders/headers.
- `Knob`: SVG arc control, `size`/`color` props, drag with local state, double-click resets to `defaultValue`, arrow keys (Shift coarse), full ARIA slider semantics, focus rings.
- `Fader`: metal cap, dB ticks (+6 to −48), same keyboard/reset/ARIA contract.
- Arranger: track headers collapse to a 50px icon rail; RAF-driven `Playhead` (never React state); ghost recording clip grows live; edge auto-scroll during drags; minimap; zoom-to-fit; snap overlays.
- Transport: floating glass pill (stop/record/play) with pulsing record state; header has undo/redo, input meter, blinking metronome dot, save status.
- Mobile: wake lock during playback/recording, `visibilitychange` suspends the AudioContext (with `needsResume` resume gate), AudioContext unlock overlay on first load, count-in + latency calibration for recording, input monitoring toggle.
- Undo = one step per gesture: `commitTransaction()` fires on pointerdown / before discrete edits; 20-entry history.

## Engineering invariants (non-negotiable)

1. React state is the single source of truth; the engine is synced from it (dirty-checked). Never read engine state back into React.
2. The scheduler's beat clock (`nextNoteTime`/`currentBeat`) always advances during playback; only voice scheduling (e.g. `scheduleClick`) is gated by enable flags.
3. BPM clamped 20–999; guard non-finite tick durations everywhere they're derived.
4. Any realtime-graph change must be mirrored in `renderProject()` (known historical gap: chorus send missing offline — fix it if you touch the FX bus).
5. Timeline seconds ≠ buffer seconds whenever `speed`/`detune` are involved; use the shared conversion helpers.
6. `audio-math.ts` stays DOM-free (worker-shared).
7. New audio nodes require mocks in `tests/setup.ts` (including an `OfflineAudioContextMock` with `startRendering`).
8. No secrets, no env config required (only conventional `NODE_ENV`/`CI` reads).

## Acceptance criteria

- `npm run validate` passes (lint, typecheck, unit tests, build).
- Cold load: overlay unlocks audio on first gesture; default view is the arranger; a template or empty project opens with waveform peaks rendered immediately.
- Record flow: auto-arms/creates a track, optional count-in, live ghost clip + input meter; stop honors return-to-start; recorded clip gets latency compensation and is undoable as one step.
- Playback: metronome stays on-beat after seek and after toggling mid-playback; loop region loops; mute/solo (including solo-exclusivity) and fades/speed/detune/gain audibly correct.
- Export: master mix and per-track stems render offline, faster than realtime, as valid PCM WAVs (`encodeWAV` with configurable bit depth) matching realtime behavior (EQ, compressor, sends, master chain, automation, instruments within loop range).
- Persistence: reload restores the project (clips reference blobs correctly); quota errors surface actionable messaging; orphan cleanup removes only unreferenced metadata-less assets.
- Instruments: Tanpura/Drone/Sequencer fully local; Tabla streams and caches by taal/key/BPM with clamped ranges and no stale-play races; MIDI hardware and virtual keyboard record into instrument tracks via the piano roll.
- Interaction: pointer events handle mouse and touch identically; pinch-zoom, long-press context menus, marquee select, snap (Shift bypass), keyboard shortcuts (Space, Cmd/Ctrl+Z/Shift+Z, C/V/D, arrows, B, Q) all work; knobs/faders are keyboard-operable with ARIA.
- Mobile: installable PWA (manifest, icons, offline shell), wake lock during playback, backgrounding suspends audio cleanly and resumes.
