# Generic v2 full geometry update — October 13, 2026

The default Generic entry now uses `generic.html` and `generic-v2` generation. Unequal room programs, variable cluster outlines, 45-degree frames, real connecting runs/junctions and supported apertures are preserved in full `br.zone/0.4` exports. The old exchange generator is unchanged and available with `index.html?template=generic&version=1`.

V2 includes a larger 8–96-room program with separate circulation, independent route-length and orientation controls, physical loop opportunities, worker generation/cancellation, on-demand nine-seed comparisons and 3D, independently validated imports, and source ZIP regeneration. [Guide and verification](generic-template.md) · [example manifest](generic-v2-examples/manifest.json).

Browser checks cover full geometry and walker reach/return. Unreal import and engine verification remain pending. This is a single-floor layout pass; it does not claim new vertical connections or engine support.

---

# Implementation status

Package 0.11.0 provides a full geometry prototype at `gallery.html` and a checked rectangular exchange subset at `index.html`. The [design handoff](design-handoff.md) records the owner's goal: preserve the intended prototype and extend Unreal where transfer exposes missing capabilities. The [exchange contract](unreal-exchange.md) governs version 1 files; [transfer workflow](transfer-workflow.md) explains both paths. The existing house studies remain intact; Office v2 adds its own full geometry workbench and checked fixtures.

## Generic modular template — October 13

- Generic v1 adds 19 dials in program/composition/circulation/height groups, five module switches and eight presets. Four recipe builders create occupied adjoining clusters, corridor crosses, courtyard rings and shared halls. Exact room count supplies branch reach; Cohesion joins module boundaries without stretching rooms. Support grouping, seeded height variation, raised sections and external ports change actual exported geometry/program/contracts.
- `modules` and `ruleModules` are real registries included in downloadable source. Recipes must supply exact room quantities, declared circulation cost, occupied envelopes and four reserved edge frontages; registered rule evaluators check the resulting geometry and program. Independent physical validation remains mandatory. Source registration and re-export are exercised by an additional architecture/rule module test.
- The workbench adds grouped controls and module checkboxes, accepts `?template=generic`, and regenerates on slider release. Pending settings disable exports; presets, nine-seed comparisons, imports and standalone template/report downloads retain their checked behavior. Long gallery settings wrap within the SVG header.
- A 1,500-case mixed-control stress check passed; local generation averaged about 1.1 ms, excluding rendering and Unreal realization. All eight preset galleries and three Generic handoff zones are generated alongside the existing templates. Full geometry and native Unreal support are not established by this rectangular prototype.
- [Control guide, module contracts and rule extension workflow](generic-template.md). **126/126 Node tests pass**; all four templates pass 120/120 acceptance and 40/40 strict cases. Static build and generated handoff checks pass. Live browser/WebGL and native Unreal verification remain pending.

## Cohesion and Room Count pass — October 13

- House v3 and Office v3 add Cohesion and Room Count independently of room Size. Office Sprawl distributes available rooms into longer populated rows; House branch count is limited by the room program. Maximum cohesion suppresses row gaps and requires shared room partitions without stretching rooms. Ordinary presets use maximum cohesion. [Control semantics and same-seed comparisons](cohesion.md).
- Office has 19 rules, including exact department room count and maximum-cohesion adjacency. House has 16 rules, including room-partition adjacency. Both previous v2 sources are archived; existing generator identities are not silently reinterpreted. The full gallery-house director remains unchanged.
- Office geometry and 3D mesh preparation run in a cancellable module worker; the main thread uploads prepared buffers. Pending/failed requests preserve the accepted view and disable exports, and superseded requests cannot overwrite newer results. A real worker-thread test executes the browser worker, checks event-loop progress, buffer transfer, cancellation and error handling. Live browser/WebGL QA remains pending.
- Dial-interaction matrices cover both archetypes, shared partitions, fixed office room dimensions under Cohesion, constrained reach with fewer rooms, bounds, repeatability and imported-rule refusal. Updated full Office examples and six same-seed rectangular comparisons accompany regenerated preset galleries and audits. **119/119 Node tests pass**, including the actual worker module. All three portable templates pass 120/120 acceptance and 40/40 strict cases; current full Office examples contain 53, 85 and 98 spaces, all reachable and returnable.
- The optional Unreal physical harness continues to consume the rectangular subset. C++ generator parity remains a historical House v2 result; current House v3 needs a native port and rejects the old parity flag explicitly.

## Office v2 pass — October 13

- Office v2 replaces serial bay extensions with 1–6 explicit independent department sections, functional room profiles, differently subdivided corridor sides and outer branch junctions. Sprawl controls length/separation independently of Wings. Seven presets include the reference-inspired two-wing floor.
- `office.html` provides true angled `br.zone/0.4` plans, 3D cutaways, clear floor measurements, wall thickness, supported door passages, per-side materials and versioned exports. The separate rectangular exchange remains the currently tested portable transfer subset. Exit/stair lobbies reserve interfaces; vertical flights and an Unreal full-geometry adapter are pending.
- Full examples contain two wings / 50 spaces, four wings / 81 spaces and six wings / 110 spaces, all reached and returnable. Their self-contained SVGs and canonical files are recorded in `docs/office-examples/manifest.json`.
- **112/112 Node tests pass**. Office v2 passes 120/120 acceptance and 40/40 strict cases. Mixed dials, all seven presets, exact counts/independent attachment, room-size diversity, physical route refusal, full rotated geometry, solid wall reconstruction and controller downloads/WebGL fallback are covered. Static build and regenerated handoffs pass.
- The angled solid wall example exposed a quantized line/arc ray-height mismatch in the shared containment predicate. A sub-tolerance ray offset after the boundary-distance check corrects it; prior geometry/house regressions and new full wall footprints pass.
- Full plans were rasterized and visually inspected. Live browser/WebGL testing could not execute in this environment; native Unreal compilation was not rerun. The old Office v1 native evidence below is historical.

## October 13 exchange update

- The updated October 12 exchange document is incorporated. Optional room `outline` paths/arcs and embedded zone `rules` are accepted without dropping older files. Outlines remain design data over rectangular allocations; warnings identify Unreal adapter work. The full geometry workbench is unchanged.
- House and Office generators embed rule reports; known imports/edits recompute them. Reports without an available rule evaluator remain preserved and labelled unverified. Canonical files sort reports by id; compiled physical digests remain geometry-only.
- The browser compares nine seeds at shared dials, pages groups, selects a full plan, marks presets, and downloads a standalone gallery SVG. The handoff includes thirteen nine-seed preset/default galleries, ten zone files and fourteen individual storey plans.
- All three templates pass 120/120 acceptance and 40/40 strict cases. Strict cases require every architectural rule to be kept and also check byte repetition, reversed listing order and round trips. Level 0 has no architectural rulebook. Browser and Node audits use the same implementation.
- Exchange-update verification baseline: **105/105 Node tests**, exchange batch and static build pass. Tests cover arc extrema/radius/closure/bounds, malformed metadata, canonical outline/report preservation, stale or forged imports, gallery pagination/selection/downloads and unsigned seed limits. A preset gallery SVG was rasterized and visually inspected.
- Live Chromium QA was attempted but could not run: no browser binary is installed, and the browser download was truncated. Desktop/mobile CSS, direct file opening and deployed Pages remain unverified in this environment; controller tests cover the new interaction paths. The local Unreal sources are unavailable, so native physical compilation was not rerun. The optional harness now includes strict cases by default; `--strict=false` reproduces the earlier sample matrix. Runtime loaders and outline adapters remain unbuilt.

## Unreal exchange status

- `index.html` uses local classic scripts and no runtime dependencies/build step. House, Level 0 and Offices use the exact Unreal uint32 named draw, integer grid/heights/dials, stable space ids and bounded attempts.
- Browser checks cover exchange schema/grid, ids/counts, overlaps/stacking, stair endpoints/run, joins/fallback/floors/headroom, Human graph reach/return, start and free entrances. Feature-dependent physical clearance remains Unreal's responsibility and is explicitly flagged. Generated templates keep all rooms plain.
- Seed stepping/random, per-template dials/reset, storey switching, pan/zoom/fit, import/export, notes, editable JSON, rejected-change preservation, disabled invalid exports, template/check downloads and SVG snapshots are implemented. Earlier shared study URLs redirect to `gallery.html`.
- All three templates pass **120/120** documented configurations, with byte repeatability, reversed-list canonical exports and round trips. The ten-zone handoff includes fourteen storey plans, template code, core files, notes and a SHA-256/audit manifest.
- House v2 ports the local program/spine grammar with Size/Sprawl/Strangeness, six presets and 15 named rules. Shared `method.js` separates physical validity from permitted architectural rule breaks, bounds attempts/work, and regenerates diagnostic rule reports and embeds them in optional `rules` without changing physical geometry. Presets and rules are visible in the UI and retained in template/check downloads. [Template authoring](template-authoring.md) and the audited runnable starter provide the starting point for new archetypes; the local C++ reference and previous browser House v1 source are archived under `template-reference/`.
- The House/Level 0 baseline portable C++ check accepted **440/440** layouts: 240 acceptance cases, 192 mixed Sprawl/Strangeness cases, six presets, the documented flat and a negative-coordinate/negative-height case. Every join was accepted, Human outward/return reachability passed, reversed-list compiled digests agreed and all six stream vectors matched. With `--lab-parity=true`, all **318 House cases** also match the local House v2's accepted rectangles, floors/ceilings and physical join contracts. The harness now includes registered templates by default; `--templates=house,level0` reproduces that baseline. Office evidence is recorded separately below.
- Previous verification baseline: **99/99 Node tests**, the exchange batch and static build pass. House shaping tests cover Sprawl 54/55, strict/relaxed rules, translated coordinates/heights, work exhaustion, reversed-list diagnostics, starter audit and downloaded-template reproduction. Offices adds preset/program tests, 256 mixed threshold configurations, actual openness/wing changes, rule gating, signed placement, physical refusal and controller export/import checks. A shared-method test verifies that a richer representation is preserved and validated by its own supplied physical checker. Existing geometry/reference/house/wall generators are unchanged. Earlier desktop HTTP checks covered generation, imports, invalid-edit refusal, downloads and plan controls. Direct `file://` browser automation is blocked by the URL policy; local classic assets/offline exports have controller coverage. Deployed Pages and narrow-screen acceptance remain unverified.
- **The Unreal JSON file loaders are still unbuilt.** Version 1 checks establish the rectangular subset only. Full `br.zone` plans preserve curves, explicit wall geometry and materials for a dedicated adapter and gap-driven Unreal work. The existing core has faceted round interiors with openings on straight flats; arbitrary curved footprints and curved-face openings are not established by these checks.
- The House v2 HTTP browser check verifies compact/sprawling presets, 15/15 and 10/15 rule summaries, explicit permitted-break explanations, storey controls and actual template/report downloads. The downloaded template reproduces the selected preset, and the report carries all 15 rules and its 120/120 audit. No console warnings/errors were recorded. A compact evidence record is in [template-reference/verification.json](template-reference/verification.json).
- **Historical Offices v1** adds Size, Openness, Sprawl and Strangeness, six presets and sixteen named conventions. Standard/private/open/department presets keep all rules; Wrong workplace seed 1 keeps six, with every break permitted. The separate native Office check passes **164/164** cases (120 acceptance, 36 mixed, six presets, signed Office and documented flat), every required join, Human reach/return, reversed-list digests and stream vectors. Browser checks verify selection, three presets, rule explanations and actual JS/report downloads without console warnings/errors. [Office guide](offices.md); [verification record](offices-verification.json). A native Office generator and runtime loader remain future work.

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
