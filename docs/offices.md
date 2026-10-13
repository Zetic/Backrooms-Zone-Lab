# Office v3: functional rooms and independent wings

Office v3 replaces the repeated room-strip layout with a visitor/service hub and independently attached department spines. The reference photograph guides the two angled arms, central shared facilities and a boardroom/focus cluster, small offices beside larger team rooms, and exit lobbies. It is a procedural interpretation, not a traced replica.

## Inspect the reference

Open [the angled Office workbench](../office.html). It defaults to **Reference floor**, seed 1. The plan and 3D cutaway use actual angled room footprints, clear floors, 15 cm wall mass and supported apertures. Room selection reports clear floor area. The same controls are available in the [rectangular exchange](../index.html), which produces a separate orthogonal layout for the tested version 1 transfer path.

The full workbench uses ES modules: serve it with `node scripts/serve.mjs` or GitHub Pages. The classic rectangular exchange still runs directly from a file. The full page exports original `br.zone/0.4` geometry, an embedded-style SVG and a physical validation report. It also offers the separate rectangular layout; it never exports bounding rectangles as if they realize the angled design.

## Controls

| Dial | Architectural effect |
| --- | --- |
| Size | Role-specific capacity/dimension ranges |
| Wings | Exactly 1 at 0–19, 2 at 20–39, 3 at 40–59, 4 at 60–79, 5 at 80–99, 6 at 100 |
| Openness | Changes enclosed offices into larger team workplaces, including their floor allocation |
| Room Count | 4–14 department rooms per wing; 4–8 with five/six wings to retain bounded zone size |
| Cohesion | Suppresses row gaps and empty tails; 100 requires contiguous room partitions |
| Sprawl | Concentrates available rooms into longer populated rows; lower cohesion allows extra spacing |
| Strangeness | Permits named convention breaks; never permits overlap or disconnected required movement |

A wing is an independently organized department spine, not a turn in an existing corridor. The first four arms attach at distinct hub gates. Wings five and six branch from outer junctions of the first two arms. Wing count is a required architectural rule. The central circulation loop does not count as another wing. One wing yields one department spine attached to that hub.

The angled layout uses northeast/northwest arms first, resembling the reference. Further independent arms leave east and west gates; outer branches inherit their parent’s orientation. Larger multi-arm layouts reserve necessary junction clearance; only the diagonal primary arms receive an additional approach offset, so cardinal arms do not collide with the outer branches. High Sprawl therefore does not select the wing count.

## Room program and geometry

The central cluster contains washrooms, break room, copy room, server room and supply storage. Reception buffers visitor meetings from staff circulation. The full design extends the shared core into the space between angled arms, with a boardroom/training room and focus/interview rooms. This additional program and the separate rectangular variant are recorded explicitly in the full export. Departments mix private offices, team workplaces, team meetings and a lounge; each side is laid independently. Cohesion 100 packs consecutive rooms against shared partitions without changing their capacities or dimensions. Unequal depths may shape the exterior boundary; circulation and exterior space between wings remain intentional.

| Function | Ordinary allocation range before bounded seed variation |
| --- | --- |
| Private office | 3–4.5 m frontage × 3–5 m depth |
| Team workplace | 6–9 m frontage × 5–8 m depth |
| Team meeting | 4.5–7 m frontage × 4–6 m depth |
| Department lounge | 4–6 m frontage × 3.5–5.5 m depth |
| Repeated copy/storage, when permitted | Smaller 2–3 m frontages and 2–4 m depths |

Named draws can add up to 1 m to these dimensions. These are allocations on the rectangular exchange; full geometry reports actual clear floor after walls. Room capacity is represented by dimensional profiles, not furniture placement or a code-compliant occupancy calculation.

Opposite room rows can have different cuts, depths and program mixes. Long corridors split only where every required room retains at least 2 m of opening frontage. Larger team rooms change the footprint itself. End lobbies provide independent external connection opportunities. **No vertical stair flights are generated in this pass:** the exit/stair lobby is a reserved interface.

The checked model remains a bounded grammar. It does not implement a general shell-fitting solver, arbitrary departmental adjacency graph, furniture layout, or the infinite world graph.

## Presets and conventions

Seven presets: Standard office, Private practice, Open workplace, Department wings, After hours, Wrong workplace and Reference floor. Ordinary presets retain all **19 rules**. Wrong workplace seed 1 permits several deviations; every broken convention is explicitly permitted.

Rules also check the exact department program count and maximum-cohesion shared room partitions. Rules cover visitor arrival and buffering, essential services, visitor meetings, circulation access, repetition, room proportions, a conventional corridor share of at most 40%, corridor width, empty ends, the circulation loop, ceiling/floor consistency, and the exact wing count. Increased Wings may permit a higher corridor share from 40; Sprawl from 35 and Strangeness from 30 also permit it. Full geometry recomputes its actual clear-floor corridor share after angled approach reservation.

## Handoff and verification

- [Full examples](office-examples/manifest.json): reference (2 wings), departments (4), and six-wing composition. All actual spaces have outward and return walker paths, solid walls, supported door passages, per-side finishes, explicit clear floors, and required ports. Their self-contained plans are [reference.svg](office-examples/reference.svg), [departments.svg](office-examples/departments.svg), and [six-wings.svg](office-examples/six-wings.svg).
- [Rectangular examples](exchange-examples/manifest.json): current Office v3 files and seven nine-seed preset galleries, with 120/120 acceptance and 40/40 strict reports.
- `offices-v3` is distinct from exchange schema version 1. The previous [Office v1 source](template-reference/offices-v1.js) remains archived. Old files remain fixed imports. Both [Office v1](template-reference/offices-v1.js) and [Office v2](template-reference/offices-v2.js) sources retain their regeneration identities; v3 does not recompute their old rules.
- Tests cover explicit wing counts, independent roots, room-size diversity, functional size separation, canonical repeatability, bounds, physical refusal, angled full-floor movement, wall reconstruction, actual overlaps, 3D mesh construction and controller exports/fallback.

Run `npm test`, `npm run batch:exchange`, `npm run examples:offices`, and `npm run build`. The optional portable C++ harness consumes the rectangular v3 cases; it was generated here, but native compilation was not rerun because local Unreal sources are unavailable. The earlier 164-case native Office v1 evidence remains historical and does not verify this v3 generator. Full geometry still requires an Unreal adapter. Live browser/WebGL QA remains unavailable in this environment.

## Cohesion and interaction

[Dial interaction and six checked comparisons](cohesion.md) cover fewer/more rooms and cohesive/dispersed sprawl. Room Count and Cohesion are also available in the rectangular House template. The full Office controller uses a module worker for geometry and prepared 3D buffers; superseded jobs are terminated, exports disable while pending, and only the latest result is accepted. Without worker support a synchronous fallback retains functionality. Worker execution and mesh buffer transfer are covered by a real worker-thread test; live browser/WebGL QA remains pending.
