# 009 — Pointer Events as the single interaction path (after three arranger rewrites)

**Date / era**: layout rewrites (00e08e1 → 971ce9d → 82ab97d), consolidated in the `useArrangerInteraction` hook (9967abe).
**Status**: current.

## Context

The arranger went through three layouts in one day: two-pane (fixed headers + scrollable timeline) → single scroll container with sticky headers → back to two-pane (fixed header pane synced via `translateY`, chosen because sticky-in-scroll clipped the playhead cap and complicated pinch-zoom). Each rewrite maintained parallel mouse and touch handlers, and each rewrite silently dropped features (metronome toggle, pinch-zoom, long-press, background deselection) that then had to be consciously restored — one commit even shipped a truncated `Arranger.tsx`, leaving main briefly unbuildable.

## Decision

1. **One input API**: all interactions use Pointer Events with `setPointerCapture` and per-gesture `pointerId` tracking. One code path serves mouse, touch, and pen; gestures can't interfere (loop drag and clip drag are independent, not else-if chains).
2. **Touch affordances are explicit**: `touch-action: pan-x/pan-y` on the scroll container, `touch-none` on interactive elements, `overscroll-contain`, enlarged trim/fade hit targets, two-finger pinch-zoom (state, not touch-event refs), 600ms long-press for the context menu.
3. **Interaction logic lives in one hook**: `useArrangerInteraction` (~557 lines) owns every pointer behavior — clip move/trim/fade/gain/stretch drags, alt-drag duplicate, marquee selection, tool modes (`ToolMode`: POINTER, HAND, SPLIT, ERASER, AUTOMATION), loop/track/scrub drags, pinch-zoom, edge auto-scroll, and snap overlays. `Arranger.tsx` is layout + rendering only.

## Consequences

- Layout can change again without re-implementing gestures — the original pain point.
- Tool modes (`ToolMode`: SELECT, HAND, SPLIT, AUTOMATION, ...) switch behavior inside the hook; adding a tool means one place.
- Snap-aware quantize everywhere (`secondsPerBeat`-scaled grid; Shift bypasses), which fixed the long-standing "snap treated beats as seconds at BPM ≠ 60" bug class.
- Rule going forward: a layout rewrite must diff the interaction hook's feature set, not just the JSX.
