# Technical Preferences

<!-- Updated 2026-05-20 to reflect current Web Canvas prototype phase -->

## Engine & Language

- **Engine**: Web Canvas (HTML5 Canvas 2D + JavaScript) — Tier 1 prototype
- **Future Engine**: Godot 4.5.1 (planned Tier 3+ migration when scope outgrows Canvas)
- **Language**: JavaScript ES6+ (const/let, arrow functions, template literals, destructuring)
- **Rendering**: Canvas 2D API (GPU-accelerated via browser compositor)
- **Physics**: Custom 2.5D projection math (no physics engine — manual AABB collision)
- **Input**: DOM Keyboard events + Touch events (swipe detection via touchstart/touchend delta)

## Code Organization

- Single-file architecture (`src/index.html`) for Tier 1-2 prototyping
- Namespace: global `G` object for game state
- Constants: UPPER_SNAKE_CASE at module top
- Functions: camelCase — game systems (init, update, render) at module level
- Object pools: plain arrays for obstacles, coins, particles — no allocations in hot loop

## Input & Platform

- **Target Platforms**: Web (Desktop + Mobile)
- **Input Methods**: Keyboard (Arrow keys / Space) + Touch (swipe gestures)
- **Primary Input**: Keyboard (desktop) / Touch (mobile)
- **Gamepad Support**: None
- **Touch Support**: Full — swipe detection via touchstart/touchend coordinate delta
- **Platform Notes**: Single HTML file, zero build step. Runs directly in browser. Mobile via responsive viewport + touch-action:manipulation.

## Performance Budgets

- **Target Framerate**: 60fps
- **Frame Budget**: 16.6ms (target <8ms script time for mobile headroom)
- **Draw Calls**: Canvas 2D immediate mode — target <200 drawImage/text/fill calls per frame
- **Memory Ceiling**: 100MB (browser heap)

## Testing

- **Framework**: Vitest (Node.js test runner, zero-config for JS)
- **Test Location**: `tests/unit/`
- **Minimum Coverage**: Core logic (collision detection, scoring, obstacle generation) must have testable pure functions
- **Required Tests**: worldToScreen projection, laneX calculation, AABB collision, score/coin/distance math
- **Testable Pattern**: Extract pure math functions from game loop — no DOM/Canvas dependency

## Forbidden Patterns

- `new` in hot loops — use object pools (pre-allocated arrays, recycle dead objects)
- `JSON.parse`/`JSON.stringify` in `update()` — cache parsed config
- `localStorage.setItem` in hot path — debounce writes
- Hardcoding gameplay values in functions — use constants at module top
- `canvas.width = canvas.width` as clear hack (wastes GPU — use clearRect)
- `bind()` / `call()` / `apply()` in hot path — use arrow functions or direct calls

## Allowed Libraries / Addons

- **Vitest** (dev dependency, testing only)
- Game code: zero runtime dependencies

## Architecture Decisions Log

- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

- **Primary**: None (Web Canvas has no dedicated specialist — general-purpose agent handles all code)
- **Future**: godot-specialist (when migrating to Godot in Tier 3+)

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.html) | general-purpose |
| Game code (.js) | general-purpose |
| Game code (.css) | general-purpose |
| Test files (.test.js) | general-purpose |
| Design docs (.md) | general-purpose |
| Config (.json) | general-purpose |
