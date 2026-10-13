# Implementation status

Package 0.5.0 provides a full geometry prototype at `gallery.html` and a checked rectangular exchange subset at `index.html`. The [design handoff](design-handoff.md) records the owner's goal: preserve the intended prototype and extend Unreal where transfer exposes missing capabilities. The [exchange contract](unreal-exchange.md) governs version 1 files; [transfer workflow](transfer-workflow.md) explains both paths. Full geometry generation and fixtures remain unchanged.

## Unreal exchange status

- `index.html` uses local classic scripts and no runtime dependencies/build step. House and Level 0 use the exact Unreal uint32 named draw, integer grid/heights/dials, stable space ids and bounded attempts.
- Browser checks cover exchange schema/grid, ids/counts, overlaps/stacking, stair endpoints/run, joins/fallback/floors/headroom, Human graph reach/return, start and free entrances. Feature-dependent physical clearance remains Unreal's responsibility and is explicitly flagged. Generated templates keep all rooms plain.
- Seed stepping/random, per-template dials/reset, storey switching, pan/zoom/fit, import/export, notes, editable JSON, rejected-change preservation, disabled invalid exports, template/check downloads and SVG snapshots are implemented. Earlier shared study URLs redirect to `gallery.html`.
- Both templates pass **120/120** documented configurations, with byte repeatability, reversed-list canonical exports and round trips. The seven-zone handoff includes eleven storey plans, template code, core files, notes and a SHA-256/audit manifest.
- The existing portable C++ compiler accepted **242/242** layouts: all 240 acceptance configurations, the documented flat and a negative-coordinate/negative-height case. Every join was accepted, Human outward/return reachability passed, reversed-list compiled digests agreed and all six stream vectors matched. Evidence is produced by `npm run verify:unreal -- --core=<portable-core>` under ignored `.verification/`.
- Verification: **85/85 Node tests**, all existing geometry/reference/house/wall batches, the exchange batch and static build pass. Desktop browser checks over loopback HTTP cover template/storey changes, imports, invalid-edit preservation/export refusal, all four downloads, actual downloaded JSON/JS/report consistency, pan/zoom/Fit and keyboard storey switching, with no console errors. Direct `file://` browser testing is blocked by the automation URL policy; local classic-script execution/assets and offline template export are verified by the controller tests. Deployed Pages and narrow-screen browser acceptance remain unverified.
- **The Unreal JSON file loaders are still unbuilt.** Version 1 checks establish the rectangular subset only. Full `br.zone` plans preserve curves, explicit wall geometry and materials for a dedicated adapter and gap-driven Unreal work. The existing core has faceted round interiors with openings on straight flats; arbitrary curved footprints and curved-face openings are not established by these checks.

## Full geometry prototypes

| Capability | Current state |
| --- | --- |
| Line/arc footprints, rotation, concavity, holes | Implemented; Phase 1 behavior retained |
| Seeded identity, canonical JSON, stable IDs, fingerprints | Implemented; v1/v2/v3/v4 contracts coexist |
| Procedural house director | Bounded two-profile grammar with deterministic candidate rejection |
| Seed-driven room programs and topology | Implemented; wing recipes, partitions, direct passages, loops, optional rooms and stair cores |
| Two/three-storey composition | Both generated profiles support either count |
| Double-height signature and usable upper gallery | Real protected hole/clear volume; mansions vary gallery elevation |
| Curved and non-cardinal architecture | Exact apses/voids, angled bays/conservatories, rotated physical stairs |
| Physical wall solids, side finish slots and UVs | Implemented in v4; wall union occupies reserved space outside clear floors |
| Explicit usable floor area | Verified against actual room floor and holes |
| Door apertures, tunnels and support | Straight boundaries; full-thickness supported passages, outer-face external anchors |
| Real stairs, treads, landings, headroom, shafts | Adaptive straight flights with arbitrary horizontal orientation |
| Gallery/shaft guards and stair rails | Implemented and validated |
| Physical local navigation and return paths | Rebuilt from actual openings/stairs and exact body-width floor paths |
| Required external ports, including third-floor requests | Implemented; absent-storey/unsatisfiable requests remain visible failures |
| Program relationships and proportions | Independent kitchen/dining/pantry passage and minimum-area checks |
| 3D whitebox, orbit/pan/zoom/picking, cutaways and floor views | Dependency-free WebGL; scope follows actual gallery/top floor |
| Navigation and diagnostics overlays | Geometry-derived paths, composition summaries, deterministic rejection traces |
| Floor up/down navigation | Sticky controls synchronize one-floor 3D and SVG views; bounded at ground/top |
| Downloads and reproducible URLs | Implemented, including storeys/search budget/thickness/generator; view settings excluded from identity |
| Static build and Pages workflow | Implemented; deployment follows merge |
| Fixed reference and original studies | Preserved with unchanged canonical v3/v2/v1 examples |
| General layout solver, additional profile grammars | Beyond this bounded Phase 3 implementation |
| Workbench hardening and browser acceptance | Phase 4 |
| Runtime collision/controller/navmesh and structural engineering | Deferred to realizers/future validation |
| Portal views, infinite zone graph, world streaming | Intentionally deferred |

## Verification

- 69 automated tests cover geometry/determinism, fixed-reference regressions, generated-house diversity and configuration bounds, physical navigation, corrupted geometry and semantic obligations, render data, and controller integration.
- The original batch covers 600 studies (200 seeds per Phase 1 profile).
- The reference batch covers 12 combinations of rise, upper-floor ports, and arrival direction; its topology remains fixed.
- The procedural batch covers 128 default houses: 60 gallery-house and 64 mansion transition graphs; all validate. It also checks eight boundary configurations and two required failures.
- The wall batch covers 64 houses and 16 boundary configurations; all validate on the first attempt.
- Nine canonical plans, twenty-two SVG floor diagrams, and six static cutaways are committed. Generated examples were rasterized and visually inspected for floor holes, stair alignment, labels, and cutaway framing.
- Controller tests use a minimal DOM adapter and unavailable-WebGL fallback. Mesh tests verify actual selected floors, holes, and invariant exports.

Automated browser interaction and GPU shader/picking QA are **not performed** because browser-control infrastructure is unavailable. Static SVG review and Node tests establish data/geometry behavior. Deployed review must exercise orbit/pan/zoom, picking, resizing, generated gallery/top cutaways, ceilings, keyboard controls, exports, clipboard/link restoration, and narrow-screen scrolling.

## Next acceptance gate

Phase 4 hardens the workbench and its acceptance workflow: profile/configuration controls, seed browsing, reproducible failure inspection, export review, and deployed desktop/mobile browser checks. Additional room/profile families and repair strategies may extend the grammar after the present physical contracts pass review. Infinite-world integration remains deferred.
