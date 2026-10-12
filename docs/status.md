# Implementation status

Phase 2 is the current review scope. The [complete procedural house milestone](requirements.md) remains unfinished.

| Capability | Current state |
| --- | --- |
| Line/arc footprints, rotation, concavity, holes | Implemented; Phase 1 behavior retained |
| Seeded identity, canonical JSON, stable IDs, fingerprints | Implemented; v1/v2 contracts coexist |
| Three-storey house composition | Designed reference sample, fixed topology |
| Double-height foyer and usable gallery around a real opening | Implemented in canonical surfaces and clear volumes |
| Door apertures and approach geometry | Implemented; straight boundaries only |
| Real stairs, treads, landings, risers, slope, headroom, shafts | Implemented for the two straight reference flights |
| Gallery/shaft edge guards and stair rails | Implemented and validated |
| Physical local navigation and return paths | Rebuilt from validated openings/stairs and exact body-width floor paths |
| Required external ports, including third-floor requests | Implemented, with local reachability checks |
| 3D whitebox, orbit/pan/zoom/picking, cutaways and floor views | Implemented using dependency-free WebGL |
| Navigation and diagnostics overlays | Implemented; geometry-derived paths rather than abstract room-centre edges |
| Plan/report downloads and reproducible URLs | Implemented; view settings excluded from canonical identity |
| Static build and Pages workflow | Implemented; deployment of each PR follows merge |
| Procedural house director and seed-driven topology diversity | Pending Phase 3 |
| Many room recipes, profile families, adaptive layout synthesis | Pending Phase 3 |
| Runtime collision/controller/navmesh and structural engineering | Deferred to realizers/future validation |
| Portal views, infinite zone graph, world streaming | Intentionally deferred |

## Verification

- 44 automated tests cover geometry, deterministic regressions, reference composition, physical navigation, malicious graph claims, deliberately damaged doors/stairs/slabs/guards, renderer data, and controller integration.
- The original 600-study batch covers 200 seeds across each Phase 1 profile.
- The architectural batch covers 12 combinations of supported rises, upper-floor port choices, and arrival direction requirements. This is a configuration test of fixed reference topology, not procedural diversity evidence.
- Canonical plans and rendered SVG floor diagrams/cutaway are committed for visual review.
- Controller tests use a minimal DOM adapter and unavailable-WebGL fallback. Mesh tests prove holes remain empty and views do not mutate exports.

Live browser interaction and GPU shader/picking QA are **not performed** in the implementation environment because browser-control infrastructure is unavailable. Static SVG review and Node tests establish data/geometry behavior, not live browser rendering. The deployed review must exercise WebGL orbit/pan/zoom, picking, resizing, cutaways, ceilings, keyboard controls, exports, clipboard/link restoration, and narrow-screen scrolling.

## Next acceptance gate

Phase 3 must replace fixed composition with a bounded deterministic house director. Vary room relationships, wings, footprints, signature spaces, circulation loops, and vertical composition while preserving the validated physical interfaces. Separate generation intent from physical evidence; reject candidates whose intended graph is not realizable. Preserve arc-based architecture and non-cardinal geometry in generated houses, rather than only geometry studies.
