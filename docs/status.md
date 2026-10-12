# Implementation status

Phase 1 is the current review scope. The full house MVP described in [requirements](requirements.md) is not complete.

| Capability | Current state |
| --- | --- |
| Line/arc footprints; arbitrary rotations; concavity; holes | Implemented and tested |
| Winding, self-intersection, containment, overlap, local clearance | Implemented for building-scale extruded specimens; numeric limits documented |
| Seeded local RNG, canonical JSON, stable IDs, fingerprint | Implemented and tested |
| Provisional zone and door port contracts | Implemented; straight-wall doors only |
| Ground/upper floor inspection and gallery-hole specimen | Implemented as geometry studies |
| Editable external requirements; upper-floor ports | Implemented; local boundary/approach validity only |
| Protected void versus slab validation | Implemented and tested |
| Full zone/report export; reproducible URL | Implemented |
| Dependency-free static build and GitHub Pages workflow | Implemented; live deployment pending merge and hosting availability |
| Procedural multistory house | Pending Phase 3 |
| Real walls, stairs, landings, headroom, galleries with guards | Pending Phase 2 |
| Physically derived room navigation and reversible reachability | Pending Phase 2 |
| Interactive 3D/cutaway inspection | Pending Phase 2 |
| Browser interaction QA | Not performed in the implementation environment; browser-control infrastructure unavailable |
| Infinite zone graph, portal rendering, engine integrations | Intentionally deferred |

## Verification

The initial foundation has 24 automated tests. A 600-study batch covers 200 seeds per profile and reports explicit failures plus generation timings. Committed examples show angular, circular, and upper-gallery specimens with their canonical plans. SVG rendering tests confirm arcs and holes survive drawing and that view settings do not mutate plans.

Node tests and SVG examples do not establish browser interaction or visual layout correctness. The first deployed-browser review must check regeneration, responsive plan labels, keyboard selection, contract errors, plan/report downloads, link restoration, and visibility toggles.

## Next acceptance gate

Phase 2 must compose a designed three-storey sample whose actual openings, stairs, landings, double-height volume, and upper gallery agree with physically derived navigation. Its 3D viewer and floor inspection must expose the same facts. Only after that sample validates should procedural house recipes replace the isolated geometry studies.
