# 007 — Immer state with explicit undo transactions

**Date / era**: undo/redo introduced (dcd6638), extracted to a hook (a389952), Immer + explicit transactions (be8e989, 9967abe).
**Status**: current.

## Context

Undo/redo initially pushed a snapshot on every `updateProject` call. But drags emit dozens of updates per second — history filled with micro-states, and `structuredClone` of the whole project on every keystroke was wasteful. Users expect one undo step per gesture, not per mouse-move.

## Decision

`hooks/useProjectState.ts` keeps `project` plus `past`/`future` stacks (20 entries) and exposes:

- `updateProject(recipe)` — an Immer `produce` recipe (or partial object merge). Never pushes history.
- `commitTransaction()` — snapshots the current state onto `past` and clears `future`. Call it at gesture *start* (pointerdown for drags, before discrete edits).

The provider (`contexts/ProjectContext.tsx`) removed the raw `setProject` escape hatch so all mutations flow through the recipe API — history integrity is structural, not conventional. Immer replaced `structuredClone` because `produce` already yields safe immutable snapshots.

## Consequences

- One undo step per gesture; cheap snapshots; mutable-style ergonomics with immutable guarantees.
- Every new interaction must remember `commitTransaction()` or its edits become undo-merged with the previous step — the most common regression risk in this codebase.
- Automation/MIDI types (`MidiMapping`, `AutomationCurves`) slot into the same document; anything inside `ProjectState` is undoable and persisted for free.
