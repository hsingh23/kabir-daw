# Changelog

All notable changes to **PocketStudio DAW** (repo: `kabir-daw`), newest-first.

> **Note on history.** On 2026-09-08 the commit messages on `main` were rewritten
> (messages only — every tree is byte-identical to before; 37 of 62 messages were
> improved to accurate conventional-commit form). As a result, all short hashes
> below refer to the **rewritten** history. A pre-rewrite backup branch
> (`backup/pre-docs-20260908`) exists locally but was never pushed.

## 2026-01-24

### b4d5827 — refactor(ErrorBoundary): Extend React.Component instead of import
- Drop the named `Component` import and extend `React.Component` directly, matching the codebase's default-React-import convention.
- No behavior change; partially reverts an equivalent import cleanup from the previous tidy-up commit.

### 75efe80 — style(components): Redesign knobs, faders, and dark theme across UI
- Rewrite `Knob` as an SVG arc control with `size`/`color` props; give `Fader` a metal cap with dB tick marks (+6 to −48) and `cursor-ns-resize`.
- Fix Arranger quantize to scale the snap grid by `secondsPerBeat` so it follows tempo; sync track headers via direct `scrollTop` with throttling; collapse headers to a 50px icon rail.
- Apply a consistent dark palette (#1e1e1e / #252525 / #191919) across ~30 components; slim `Library` into a simpler projects/assets browser (drops batch metadata editing and URL import).

### 68c4722 — chore(audio): Remove leftover AI meta-comments in audio.ts
- Strip accidental LLM commentary ("I will output the FULL file content...") left in `services/audio.ts` by the previous tabla commit.
- Drop the unused `Component` import and trailing newline in `ErrorBoundary`. No behavior change.

### a185185 — feat(tabla): Stream taal/key/bpm loops with BPM range clamping
- Replace the disabled "Tabla (Legacy)" placeholder with a working instrument: seven taals in two BPM-range groups, chromatic key selection, and BPM clamped to the taal's range in steps of 5.
- Stream and cache loop MP3s from `https://audio.spardhaschoolofmusic.com/music/tabla/{taal}/{key}/{bpm}bpm.mp3`, looped with race-condition guards and restarted on transport play.
- Add a unified `syncBacking(tanpura, tabla)` handler (wired from the `AudioSync` effect) that also resumes a suspended context when either backing instrument is enabled.

## 2026-01-20

### 5a54851 — refactor(app): Decompose App into ProjectContext and workflow hooks
- Move project state behind a new `ProjectContext` / `useProject()` provider; extract recording logic into `useRecordingWorkflow`; add `MainLayout`, `AudioSync`, and `GlobalProgressBar` components.
- Add a `HAND` pan tool, `ArrangerMiniMap` overview, `useTimelineNavigation`, and `useWakeLock` (screen stays awake during playback/recording).
- Restructure the audio engine's dirty-check `lastState` into a `cache` object (`mix`/`processing`/`routing`) and add `dispose()`/`reset()` lifecycle methods.

### 1ff4185 — feat: Add Sequencer and Drone instruments
- Introduce a 16-step `StepSequencer` (kick/snare/hihat, per-track steps/volume/mute, live step highlight) and a `DroneSynth` (multi-oscillator with waveform/octave/detune/gain/pan), both integrated with the scheduler and offline render.
- Refactor the audio engine around a `TrackChannel` class; split WAV math into `services/audio-math.ts` and waveform rendering into `waveformService.ts` plus an OffscreenCanvas-based `wave.worker.ts`.
- Decompose the Arranger into `ArrangerToolbar`/`ArrangerGrid`/`ArrangerContextMenus`; add a `LatencyCalibrator` that measures round-trip latency by recording an impulse.

### be8e989 — feat: Add Immer state, automation, project views, and audio workers
- Integrate Immer (`produce`) into `useProjectState` for immutable updates and cheaper undo snapshots (drops `structuredClone`).
- Add `MidiMapping` and `AutomationPoint`/`AutomationCurves` types with `ToolMode.AUTOMATION`; volume automation is evaluated live and in offline render via `getAutomationValueAtTime`.
- Restructure the shell: `ProjectsView`, `CommunityView` placeholder, `BottomNavigation` over five views, `WelcomeOverlay`, extracted `TransportHeader`/`ArrangerTrack`/`MixerStrip`, RAF-based `services/animation.ts`.
- Move WAV encoding to `export.worker.ts` and peak computation to `peak.worker.ts`; extract `AudioRecorder`, `SynthVoice`, `useTimelineMath`; add `cleanupOrphanedAssets` and quota-error handling to `db.ts`.

### c937fde — feat: Introduce MIDI clip support and instrument tracks
- Add a full MIDI subsystem: `MidiNote`/`TrackType`/`InstrumentConfig` types, a Web MIDI `services/midi.ts` service, and a `SynthVoice` class with per-channel voices for live input and scheduled voices for clip playback (plus offline render).
- Add a canvas-based `PianoRoll` editor (draw/move/resize notes), `VirtualKeyboard`, `MidiClipView`, and MIDI quantize in `ClipInspector`; `useMidiRouting` routes hardware/virtual note events and records MIDI clips on instrument tracks.
- Add Arranger clip virtualization (only visible clips render) and migrate legacy tracks to `type: 'audio'`.

## 2026-01-19

### 9c5ec8a — fix(audio): Clamp BPM/tempo values and handle mobile backgrounding
- Clamp BPM to 20–999 in `play()` and the scheduler, guard against non-finite tick durations, and clamp tanpura/tabla tempo division to prevent infinite scheduler loops.
- Suspend the AudioContext on `visibilitychange` when the tab is hidden and flag `needsResume` on return; cache `makeDistortionCurve` results to avoid 44100-sample recomputation.
- Restore the `.gitignore` and README accidentally deleted by the previous commit; reset `isRecording`/`isPlaying` and log on recording start failure.

### 45ae5e9 — chore: Remove scaffold files and comment noise
- Delete the `.gitignore` and the AI Studio boilerplate `README.md` (both restored by the next commit); drop a stale `/index.css` link from `index.html`.
- Strip recording race-condition comments from `App.tsx`; add the `Split` icon import and test-import tidy-ups ahead of upcoming split work.

### da4c3bc — feat(arranger): Add time-stretch drag mode and looping waveforms
- Add a `STRETCH` drag mode that resizes a clip's duration and compensates its `speed` ratio (with snapping), enabling time-stretch editing.
- Rewrite `Waveform` drawing with a `drawSegment` helper, looping "ghost repeat" rendering with dashed loop markers, and gradient fade overlays with visible quadratic fade curves.
- Make the arranger the default view, implement `returnToStartOnStop`, auto-arm a track when recording starts, and replace the backing toggle with an instruments drawer hosting Tanpura and Tabla.

### 8aaee92 — feat: Add time signature and return-to-start settings
- Add `timeSignature: [number, number]` and `returnToStartOnStop` to `ProjectState`; metronome tick duration, downbeat accenting, and count-in length now derive from the signature instead of hardcoded 4/4.
- Add a Quantize action (toolbar button plus `Q` shortcut) that snaps selected clip starts to the snap grid.
- Rework `SettingsDialog` into a tabbed layout; add `tests/unit/AudioDirtyCheck.test.ts` for the `applyTrackSettings` cache.

### 9967abe — feat: Decompose Arranger; add templates, analytics, and dirty-check sync
- Decompose the Arranger (895→559 lines) by extracting memoized `Ruler` and `TrackLane` components and a 557-line `useArrangerInteraction` hook owning all pointer logic (drags, marquee, tools, loop/scrub, pinch-zoom, auto-scroll, snap overlays).
- Add project `TEMPLATES` (Basic Band, Electronic, Podcast, Empty) with a Library picker, a stub `analytics.ts` wired across ~20 call sites, and an `AudioContextOverlay` gate.
- Change undo semantics: `updateProject` no longer auto-pushes history — an explicit `commitTransaction()` (snapshotted on pointerdown) is required. Engine gains `lastState` dirty-checking and `loadingPromises` load dedup.

### a389952 — feat: Add project notes, waveform peak cache, toasts, and input meter
- Add a `notes` field to `ProjectState` with a notes/lyrics editor; pre-compute waveform peaks at 100 samples/sec on buffer load and cache them in the engine for rendering.
- Add an `inputAnalyser` with `measureInputLevel()` driving a canvas `HeaderInputMeter` during recording/monitoring.
- Introduce `ToastProvider`/`useToast` notifications; extract undo/redo into `hooks/useProjectState.ts`; make `clearBuffers` disconnect channels, clear the peak cache, and cancel master events.

### 6a9d7c5 — feat: Introduce ErrorBoundary and memory leak fix
- Add a class-based `ErrorBoundary` wrapping `<App />` with a reload screen on render crashes.
- Fix an audio-engine memory leak by deleting finished `AudioBufferSourceNode`s from `activeSources` via `source.onended`.
- Extract the ~200-line keyboard-shortcut effect into `hooks/useKeyboardShortcuts.ts`; add multi-tier grid background memoization and edge auto-scroll while dragging.

### 382fa57 — feat: Add new audio effects and monitoring features
- Refactor track processing around a shared `createTrackGraph` factory (Input → Distortion → EQ → Compressor → Fader → Panner → sends) used by both the live context and offline export.
- Add per-track `distortion` (WaveShaper), per-clip `detune` (semitones+cents in `ClipInspector`), `recordingLatency` compensation, and `inputMonitoring` through a monitor gain node.
- Rewrite `db.ts` on the `idb` library with a typed schema; add a RAF-driven `Playhead` decoupled from React renders.

### 3cb7cf3 — feat: Add inspectors, settings dialog, export, and visualizations
- Introduce eleven components: `ClipInspector` (gain/speed/fades/mute/color/reverse/normalize), `MasterInspector` with `VisualEQ`/`VisualCompressor` canvas curves, `SettingsDialog`, `ExportDialog` (master or stems), `ShortcutsDialog`, `SpectrumAnalyzer`, `TempoControl` (tap tempo), `TimeDisplay`, `StatusIndicator`.
- Expand state: `name`, `metronomeSound`, `countIn`, clip `muted`/`gain`, compressor `knee`/`attack`/`release`, tanpura `fineTune`.
- Engine adds click/hihat metronome voices from a shared noise buffer, `playCountIn`, per-clip gain/mute scheduling, `processAudioBuffer` (reverse/normalize), and stem export; App gains async autosave with save-status tracking.

### 6c7ea06 — feat: Add auto-speed matching for loops
- When adding a loop asset with known BPM, compute `speed = project.bpm / asset.bpm` and shrink the clip's timeline duration so loops land in sync.
- Add a `group` field to `AssetMetadata` (badge, searchable, editable) and a batch-edit modal after multi-file uploads.
- Validate URL imports are audio blobs, surface failures, list explicit file extensions for mobile, and rethrow descriptive `decodeAudioData` errors.

### fc21a30 — feat: Store and retrieve asset metadata
- Introduce `AssetMetadata` (name, type, instrument, key, bpm, tags, duration, dateAdded, fileType) and a new `asset_metadata` IndexedDB store (DB version 2).
- Rebuild `Library` as a tabbed Projects/Assets browser with search, filters, multi-file upload, URL import, inline metadata editing, preview, and delete.
- Add `handleAddAssetToProject` which places an asset clip at the playhead (creating a track if none exists) and switches to the arranger.

### 82ab97d — feat: Add per-clip playback speed and split arranger into panes
- Add a `speed` field to `Clip` applied as `source.playbackRate`, with loop detection, buffer offsets, trim deltas, and loop markers all converted between timeline and buffer seconds.
- Restructure the Arranger into a two-pane layout: fixed left track headers (synced via `translateY`) and a scrollable right timeline, fixing seek/marquee X-coordinate math.
- Load clip audio buffers concurrently in App before setting project state so waveforms render immediately on open.

### 6679d4c — feat(arranger): Add Quantize Start, Split Here, and Zoom to Fit
- Add clip context-menu actions "Quantize Start" (snap clip start to grid) and "Split Here" (split at the right-click position), plus a "Zoom to Fit" toolbar button.
- Rework test infrastructure: `fireEvent`/`waitFor` from `@testing-library/dom`, a global `getBoundingClientRect` mock in the Arranger suite, and a cross-track marquee-selection integration test.

### 1cd0037 — fix(audio): Keep beat clock running when metronome is disabled
- Stop the scheduler from bailing out entirely when the metronome is off; only gate `scheduleClick()`.
- The beat clock (`nextNoteTime`/`currentBeat`) now always advances with the transport, preventing a burst of stale catch-up clicks when the metronome is re-enabled mid-playback.

### e53e395 — feat: Implement clip splitting and background selection
- Add marquee (rubber-band) selection via Shift+drag or the multi-select toggle, selecting all clips intersecting the dragged rectangle (additive with Shift).
- Add `Cmd/Ctrl+B` to split all selected clips at the playhead (or all clips on the selected track when none are selected).
- Reuse the `handleSplit` implementation (two clips with 0.05s anti-click fades, buffer offset preserved) for both paths.

### 72f6283 — feat: Add support for project markers
- Introduce a `Marker` type (id, time, text, color) in `ProjectState.markers` with double-click-on-ruler creation, drag repositioning (snapped), and rename/delete via prompt.
- Migrate selection from `selectedClipId` to a `selectedClipIds` array with multi-select toolbar toggle and cmd/ctrl/shift modifiers, enabling group drag, delete, nudge, copy/paste, and duplicate.
- Note: several arranger toolbar controls (metronome toggle/volume, BPM display, zoom buttons) were removed in this pass.

### 9f541e1 — feat: Visualize loop points in arranger
- Add a `LoopMarkers` component rendering dashed lines with a Repeat icon wherever a looping clip's buffer wraps.
- Apply snap-grid quantization to the Split tool (bypassed with Shift, clamped inside the clip); dim/grayscale clips on muted or non-soloed tracks.

### 2bf23ca — feat: Add master EQ, track FX sends, and clip editing shortcuts
- Add a master EQ (low/mid/high on `ProjectState`) with lowshelf/peaking/highshelf filters between masterGain and the compressor, Mixer knobs, `setMasterEq`, and an offline-render mirror.
- Add per-track FX sends (`Track.sends` reverb/delay/chorus) with per-channel send-gain nodes, an FX Sends panel in `TrackInspector`, sync + offline rendering, and migration (sends now default to 0).
- Add clip shortcuts: `Cmd/Ctrl+C/V` copy/paste at playhead, `Cmd/Ctrl+D` duplicate, arrow-key nudge (Shift for coarse), and `Ctrl/Cmd+wheel` zoom in the Arranger.

### 866c555 — feat: Add per-track compressor to audio engine and inspector
- Add an optional per-track `compressor` block (enabled, threshold, ratio, attack, release) with a `DynamicsCompressorNode` inserted between EQ and fader; bypassed (0dB, 1:1) when disabled and mirrored in offline render.
- Seed tracks get instrument-specific defaults; new tracks and saved-project migration get conservative defaults.
- Expose a Dynamics panel (enable toggle, Thresh/Ratio knobs) in `TrackInspector`; add Mixer unit tests.

### 141bec5 — feat: Add master compressor and multi-project management
- Add a master compressor (`masterCompressor` threshold/ratio, −24dB/12:1 defaults) with Compress/Ratio knobs, `setMasterCompressor`, state sync/migration, and offline-render support.
- Add multi-project persistence: `getAllProjects`/`deleteProject` in `db.ts`, a Library rewrite with Projects/Assets tabs and a New Project card (`crypto.randomUUID`).
- Add a blinking visual-metronome dot in the header and MediaRecorder MIME detection for Safari.

### 0d8d9f4 — feat: Add audio level metering
- Insert `AnalyserNode`s into the graph — a master analyser between compressor and destination, and a post-fader analyser per track — with `getRMS`/`measureTrackLevel`/`measureMasterLevel`.
- Add a reusable `LevelMeter` component (RAF loop, green-yellow-red gradient, vertical or horizontal) beside Mixer faders, the Master knob, and in Arranger track headers.
- Add a metronome volume hover-slider (`setMetronomeVolume`) in the Arranger toolbar.

### d4e80f5 — feat: Unlock AudioContext on user gestures and rework scheduler
- Add `resumeContext()` to the engine and call it from user gesture handlers (App play/pause, Library preview) so audio unlocks reliably on iOS.
- Inline metronome, tanpura, and tabla scheduling in the realtime `scheduler()`, extracting `getTanpuraFreqs()`/`getTablaPattern()` helpers.
- Rewrite `playTablaHit` synthesis (key-tuned bayan swoop, triangle-wave dayan variants) and the offline `renderProject` graph (note: the chorus send was dropped from offline rendering here).

### 0572e10 — feat: Add clip coloring and track deletion
- Add per-clip colors from a `CLIP_COLORS` palette via context-menu swatches; clips fall back to track color when unset.
- Add track deletion from `TrackInspector` with a confirm dialog that also removes the track's clips and clears selection state.
- Add the Delete/Backspace shortcut for the selected clip (guarded while typing in inputs).

### 438aee6 — feat: Add Chorus effect and backing track button
- Add a Chorus effect (30ms delay modulated by a 1.5Hz LFO) and restructure the FX bus into a send/return architecture for reverb, delay (0.4 feedback), and chorus.
- Add a Chorus knob in the Mixer, `setReverbLevel`/`setChorusLevel` sync with effects migration, and a Backing popover in the Arranger hosting Tanpura/Tabla.
- Refactor `playTanpuraNote`/`playTablaHit` to accept any `BaseAudioContext` and extend offline export to render the FX bus and instruments.

### 0f55541 — feat(Arranger): Add track renaming functionality
- Add track renaming via a new `onRenameTrack` prop; double-clicking a track's name opens a `prompt()` and commits through `handleRenameTrack` in App.
- Add a Library unit test for loading and displaying mocked asset keys.

### ec95b09 — feat: Add library view and asset management
- Add a Library view listing stored audio assets via new `getAllAssetKeys`/`deleteAudioBlob` helpers, with in-app preview and confirm-guarded deletion.
- Wire it into App as a third nav option (mixer/arranger/library) including URL view-state.
- Make loop-region dragging bypass snapping with Shift (0.1s minimum length) and add zoom in/out buttons.

### 0b9d017 — feat: Persist Mixer tab in URL and mock AudioContext
- Persist the Mixer's Faders/Backing tab via the `mixerTab` URL param and `history.replaceState`.
- Expand Web Audio test mocks (`tests/setup.ts`) including an `OfflineAudioContextMock` with `startRendering`.
- Add unit tests for Tanpura and Tabla plus e2e coverage of the Backing tab and URL persistence.

### 9f5bcc2 — feat: Add Tanpura and Tabla instruments
- Add `TanpuraState`/`TablaState` types with Web Audio synthesis and schedulers (sawtooth+lowpass tanpura plucks; dayan/bayan oscillator hits for TeenTaal/Keherwa/Dadra).
- Surface `Tanpura.tsx` and `Tabla.tsx` controls in the Mixer via a new Faders/Backing tab switcher.
- Add URL-based view state (`?view=mixer|arranger`) and update the Arranger integration fixture.

### 54b92e4 — feat(a11y): Add keyboard/ARIA support to controls and headers
- Make `Knob` and `Fader` keyboard-accessible sliders: role, tabIndex, aria-value attributes, focus rings, and arrow-key adjustment (Shift for coarse, 1% fine).
- Make Arranger track headers keyboard-activatable buttons, close the context menu on Escape, and label the clip-fade SVG.
- Wrap App handlers in `useCallback` with explicit deps; apply Biome-driven fixes (parseInt radix, template literals).

### ca83604 — chore: Auto-fix and raise diagnostics limit in lint script
- Change `lint` to `biome check --max-diagnostics 1000 --fix` so a plain run applies safe fixes automatically and reports up to 1000 diagnostics.

### f73f1ff — chore: Update tooling and TS config
- Bump tsconfig target/lib from ES2020 to ES2024; disable `noUnusedLocals`/`noUnusedParameters` (deferred to Biome warnings).
- Switch biome scripts from `--write` to `--fix` and reformat tsconfig arrays.

### 7a4aeb2 — feat(arranger): Render playhead cap in ruler; migrate Biome config to v2
- Move the triangular playhead cap into the sticky ruler, leaving a plain glowing line in the track lanes so the cap scrolls with the ruler.
- Migrate `biome.json` to the 2.x schema: `organizeImports` as an assist action, `noUnusedVariables` warning, and the new `files.includes` syntax.

### d446b03 — feat(arranger): Add track reordering and clip context actions
- Add a `GripVertical` drag handle to reorder tracks via pointer events, backed by a new `moveItem` array utility with unit tests.
- Implement the previously stubbed clip context-menu actions: Duplicate, Rename (via prompt), and Delete.
- Give `Knob` and `Fader` a `defaultValue` prop with double-click-to-reset, wired in the Mixer.

### 4bdb95b — feat(app): Add spacebar play/pause shortcut and fix loop hitbox
- Refactor play/pause into a `togglePlay` callback with a `useEffect` driving the engine from `isPlaying` for reliable sync.
- Add a global Space shortcut (ignored in inputs) that toggles playback or stops a recording.
- Make the Arranger loop region pointer-interactive only when looping is enabled.

### 8241853 — feat: Add audio rendering and export functionality
- Add `AudioEngine.renderProject`: rebuilds the master/track chain on an `OfflineAudioContext`, schedules all clips, and encodes 16-bit PCM WAV via new `services/utils.ts` (interleave + RIFF/WAVE encoder).
- Add an Export button that downloads the rendered mix as a dated `.wav` with an exporting state.
- Make the Arranger responsive (dynamic header width, controls hidden on small screens) and cover the export flow in e2e tests.

### 158522b — chore: Configure Vite dev server for remote host access
- Bind the dev server to `0.0.0.0:5173` with an `allowedHosts` entry for `kabir.roomtolearn.org` so the app can be tested on remote/mobile devices.
- Alphabetize the esm.sh import map and switch the body background to the studio theme variable.

### 7678eb9 — feat: Integrate Tailwind CSS v4 with Vite
- Add `@tailwindcss/vite` and replace v3 `@tailwind` directives with `@import "tailwindcss"`.
- Move custom colors/shadows into `@theme` variables and convert utilities to `@utility` directives; drop PostCSS/autoprefixer.

### 8f3ce1b — refactor: Remove unused imports and dependencies
- Delete the unused legacy `Fader` implementation (keep the pointer-events `CustomFader`) and unused imports across audio, Knob, and Arranger.
- Clean tests to use destructured render results.

### a4a68d0 — build: Update dependencies to latest versions
- Update ranges: React 19.2.x, Vite 7.x, Vitest 4.x, Biome 2.x, Playwright 1.57, Tailwind 4.x, TypeScript 5.9, jsdom 27; add `trustedDependencies` for `@biomejs/biome` and `esbuild`.

### 4a4e86d — test: Add Arranger integration test and expand e2e navigation coverage
- Expand Playwright e2e into a full navigation flow (Mixer→Arranger, context menu, transport) with screenshots.
- Add a Vitest integration test for the Arranger with mocked audio service and Waveform canvas; add `public/manifest.webmanifest`, `sitemap.xml`, and type declarations.

### fc1159a — feat: Initialize project with modern tooling and PWA support
- Replace CDN dependencies with a real build pipeline: Vite + React + TypeScript + Tailwind/PostCSS + Biome, plus `vite-plugin-pwa` and a Netlify config with SPA redirects.
- Add Vitest unit tests (with Web Audio mocks) and Playwright e2e targeting mobile devices.
- Add `validate` scripts running lint, typecheck, tests, and build concurrently.

### be57935 — feat(arranger): Show live ghost clip while recording
- Render a growing red "Recording..." ghost clip on the selected track, extend the timeline during recording, and tighten auto-scroll to follow the playhead.
- Restore touch support lost in the layout rewrite: a 600ms long-press opening the clip context menu and the metronome toggle (Zap icon).
- Make beat/bar grid density conditional on zoom.

### 971ce9d — refactor(arranger): Migrate interactions to pointer events
- Convert all Arranger interaction handlers to Pointer Events with `setPointerCapture` and per-gesture `pointerId` tracking, serving mouse and touch from one code path.
- Reintroduce two-finger pinch-to-zoom (zoom cap 400), set `touch-action` appropriately, enlarge trim/fade hit areas, and add `overscroll-contain`.
- Bump `TRACK_HEIGHT` to 120 / `HEADER_WIDTH` to 160 and fix track-drop Y math for the 32px ruler.

### 00e08e1 — refactor(arranger): Rewrite layout with sticky headers; restyle clips
- Rewrite the Arranger from two panes into a single scroll container with sticky track headers/ruler corner (`HEADER_WIDTH` 180, `TRACK_HEIGHT` 110) and CSS-gradient grid lines.
- Restyle clips as dark per-track lanes with colored borders/headers; render fades as filled triangles.
- Switch `Waveform` to a filled mirrored polygon with abs-peak decimation and a `ResizeObserver`. Note: metronome toggle, pinch-zoom, long-press, and deselection were temporarily dropped here.

### 5ecc412 — feat: Add 3-band track EQ, inspector panel, and project persistence
- Upgrade track channels to full channel strips (input → lowshelf 320Hz → peaking 1kHz → highshelf 3.2kHz → gain → panner) with smoothed EQ sync.
- Add a `TrackInspector` modal (EQ knobs, pan, fader, mute/solo) opened via button or double-click on a track header.
- Activate persistence: load the saved project on mount (with EQ migration and blob rehydration) and auto-save 2s after changes. Note: Space/Delete shortcuts were temporarily removed.

### dcd6638 — feat: Add clip fades and undo/redo history
- Add `fadeIn`/`fadeOut` to `Clip`, applied via a per-source envelope `GainNode` with correct mid-fade playback ramps.
- Render SVG fade curves with draggable fade handles (clamped, non-overlapping); split clips get 0.05s anti-click fades.
- Introduce undo/redo: 20-deep past/future stacks via an `updateProject` wrapper, `Cmd/Ctrl+Z` (Shift for redo), and header buttons.

### 4e2f908 — feat: Add BPM-synced metronome and floating transport controls
- Add a `metronomeOn` flag and engine support: `metronomeGain`, oscillator clicks (1000Hz downbeat / 800Hz offbeat), and a 0.1s lookahead scheduler driven from App's animation-frame loop.
- Realign `nextNoteTime`/`currentBeat` on play so clicks stay beat-aligned.
- Add a metronome toggle in the toolbar and a floating glass transport pill (stop/record/play) at the bottom of the Arranger.

### 45b4e81 — feat: Add clip looping, context menu, and track type icons
- Implement smart clip looping: when a clip's content exceeds its buffer, enable `source.loop` over the full buffer and allow clips to be extended past the buffer end.
- Render repeated "ghost" waveforms for looped regions; add a clip context menu (right-click or 500ms long-press) with Duplicate and Delete.
- Add name-based track-type icons via a new `TrackIcon` component.

### be8401c — feat(Arranger): Improve waveform rendering and interaction
- Make the time ruler scrubbable (drag to seek continuously, Shift for grid snap) via a `calculateSeekTime` helper.
- Add preliminary two-finger pinch-to-zoom (zoom clamped 10–300) and touch-action classes.
- Clean up `Waveform` drawing math (empty-chunk guard, explicit yTop/yBottom).

### 21ecc5b — feat(arranger): Make grid, ruler, and snapping BPM-aware
- Rebuild `Arranger.tsx` (489 insertions), repairing the syntactically truncated file left by the previous commit.
- Derive `secondsPerBeat` from `project.bpm` (4/4 assumed) and apply beat-based snap options to moves, trims, seeks, and loop drags.
- Add a BPM input, a Bars.Beats.Sub position display, a bar-numbered ruler with strong/weak beat lines, and content-derived timeline width.

### 1056566 — fix(arranger): Base snap values on beats instead of seconds
- Redefine `SNAP_OPTIONS` in beats (1/16=0.25, 1/8=0.5, 1/4=1.0, Bar=4.0 under 4/4) and rename `snapGrid` to `snapBeatValue` with a quarter-note default.
- Note: this commit accidentally truncated `Arranger.tsx` after the `dragState` declaration (−420 lines), leaving the app unbuildable; the next commit restored the component.

### 25df06c — feat: Add clip selection, keyboard shortcuts, and snap grid to Arranger
- Add `selectedClipId` state threaded into the Arranger with a selection ring, auto-selection on record/upload/split, and background-click deselection.
- Add global shortcuts: Space toggles playback; Delete/Backspace removes the selected clip.
- Add a configurable snap grid (Off, 1/16, 1/8, 1/4, Bar; default 1/8) applied to moves, trims, and loop drags (Shift bypasses).

### fb742a8 — feat: Initialize project structure and core dependencies
- Establish the initial codebase (17 files, ~1650 lines): Vite + TypeScript + React 19 tooling, core domain types (`Clip`, `Track`, `ProjectState`, `ToolMode`), and the main UI (App, Arranger, Mixer, Fader, Knob, canvas `Waveform`).
- Add the `AudioEngine` singleton with a Web Audio graph (per-track gain/panner channels, master compressor, procedural impulse-response reverb, delay) and MediaRecorder-based recording.
- Add the IndexedDB persistence layer (`services/db.ts`) for audio blobs and projects, with playback/loop scheduling and clip drag/trim/split/erase workflows.

### da0802d — chore: Initialize repository with AI Studio README
- Add the "Built with AI Studio" boilerplate README; the project began as an AI Studio export scaffold before growing into the DAW codebase above.
