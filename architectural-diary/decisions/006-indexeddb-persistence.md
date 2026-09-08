# 006 — IndexedDB persistence: blobs + metadata + projects

**Date / era**: persistence era (5ecc412 → fc21a30 → 141bec5 → 382fa57 → be8e989).
**Status**: current.

## Context

A serverless DAW needs local storage for potentially hundreds of megabytes of audio. localStorage is far too small; IndexedDB is the only browser option with Blob capacity. Projects also needed to become multi-project, and imported assets needed searchable metadata.

## Decision

`services/db.ts` opens `PocketStudioDB` (version 2) on the `idb` library with a typed `DBSchema` and three object stores:

- `assets` — raw audio `Blob`s keyed by an opaque id (`bufferKey`); clips reference the key.
- `asset_metadata` — `AssetMetadata` records (name, type loop/oneshot/stem/song, instrument, group, key, bpm, tags, duration, dateAdded, fileType) keyed by the same id.
- `projects` — serialized `ProjectState` documents keyed by `id`.

Lifecycle: projects auto-save (debounced) with save-status surfaced in the UI; `deleteAudioBlob` removes blob + metadata in one transaction; `cleanupOrphanedAssets` deletes unreferenced raw recordings that lack metadata; `QuotaExceededError` is caught and surfaced as actionable UI messaging with an analytics event. Audio buffers are decoded once into the engine and rehydrated on project load (loaded concurrently before state commits, so waveforms render immediately).

## Consequences

- Multi-project management (ProjectsView, templates, duplicate) rides on `getAllProjects`/`deleteProject`.
- Auto-speed-matched loops work because BPM lives in metadata (`speed = project.bpm / asset.bpm`).
- Orphan discipline matters: recordings without metadata are considered deletable — any new asset-creating path must decide metadata-or-orphan explicitly.
- Schema changes bump `DB_VERSION` with an `upgrade()` path; project-shape changes need load-time migrations (several shipped: eq, sends, compressor, timeSignature).
