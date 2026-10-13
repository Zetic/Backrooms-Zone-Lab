# Generic v3: shared polygon rooms

Open [the Generic workbench](../generic.html). Generation now creates a connected floor field and carves neighboring polygon faces together. Partitions are the shared boundaries of those faces, with one canonical boundary record and two owning sides. There is no enclosing physical room with a second layer of partition walls.

The first solver generates one neighborhood with 8–24 rooms (13 by default), one continuous corridor polygon, and physical doorways on actual shared spans. Rooms can have concave recesses, stepped arms, angled edges and multiple neighbors. Horizontal and vertical cuts vary independently rather than extending a global row/column grid. The corridor bends and widens as one region; it has no separate connector bars or octagonal junction rooms. Every generated room must be reachable and returnable by the 0.3 m radius, 2.1 m headroom walker.

## Controls

| Control | Behavior |
| --- | --- |
| Room count | Exactly 8–24 room faces; corridor is separate |
| Room scale | Floor-field dimensions before subdivision |
| Boundary variety | Cut depth, proportions, outer silhouette and corridor width variation |
| Angled walls | Slanted shared cuts and diagonal passage runs; zero uses orthogonal cuts/runs |
| Passage bends | Depth of the winding route; zero creates a straight route |
| Passage width | Base route allocation width of 2–4 m, before the 15 cm shared wall reservation; local width varies |
| Secondary routes | Additional physically supported shared-wall passages; zero is a tree, nonzero guarantees a cycle |
| Openness | Supported aperture width; sufficiently wide openings at high settings extend to the ceiling |
| Shared/support mix | Room functions assigned after geometry; support count is exact |
| External ports | Exactly 1–8 supported exterior interfaces |
| Ceiling height | Uniform 2.4–5 m clear height |

Old recipe switches, cluster placement, branching, sprawl and connector-length controls belong to [v2](generic-v2.md), and are not exposed as ineffective controls in this solver. The reduced room budget is explicit: this PR establishes the polygon neighborhood before composing larger zones.

## Construction and physical checks

1. A seeded route produces a variable-width, mitered corridor polygon. Its side boundaries define two connected floor fields with a stepped exterior silhouette.
2. Recursive cuts divide each field. A shared jog or angled path shapes both new room faces at once. Disconnected, holed, self-intersecting, small or collapsed candidates are rejected. Each split has at most 24 candidates, with at most four deterministic whole-layout attempts.
3. All room/corridor edges are split at shared endpoints and deduplicated into `boundaries`. Each record identifies its one or two owners, their actual edge indices, and aperture intervals. `layout.regions` preserves the authoritative allocation faces; groups are logical metadata only.
4. Door candidates slide along actual shared wall spans. Both clear host edges and both 0.6 m approach rectangles must fit before graph selection. A required spanning tree connects every face; optional apertures provide genuine alternate paths. Failed required connectivity refuses the layout.
5. Each allocation is inset by 7.5 cm to reserve half of a 15 cm wall. Floors, ceilings, clear volumes and navigation use that exact concave polygon. Mitered envelopes are unioned outside the clear floors and cut by full-thickness passages. Room-side finish surfaces and actual wall solids are derived views of these same boundaries, not separate wall categories.
6. Existing physical validation checks floors, host spans, approaches, headroom, passage support, wall solids and body-width local paths, including outward and return reachability. Import reconstructs the shared network, verifies floor insets and ownership, and independently rebuilds wall/navigation evidence.

The output remains full `br.zone/0.4` geometry with `generatorVersion: 3`. Coordinates are quantized to 1 micrometre and named seeded draws use the `generic-v3` namespace. Time measurements are UI/review metadata, excluded from the deterministic plan. Budgets are 25 spaces, 128 openings, 32 edges per room and the existing 5,000-edge wall arrangement limit.

## One seed at a time

The nine-seed gallery, second worker, comparison runner API and worker comparison operation have been removed from the Generic workbench. Generation runs in one cancellable worker. 3D preparation remains on demand. A completed request displays elapsed time for the selected seed, including worker transfer and display. A pending or refused change keeps the previous plan visible and disables exports.

`npm run examples:generic -- 1` generates one review seed: [plan](generic-v3-example/layout.svg), [manifest](generic-v3-example/manifest.json), and a compressed full export (`generic-v3-example/layout.zone.json.gz`; decompress before import). It does not generate a gallery. `npm run examples:generic:v2` explicitly regenerates the archived v2 examples.

## Replay and verification

New inputs default to v3. Passing `{ generatorVersion: 2, seed, dials }` to `generateGenericDesign` invokes the archived v2 generator; importing a v2 full export also invokes its independent validator. Existing v2 fixtures remain unchanged, with an exact archived-export replay test. Generator ZIPs include the selected version and transitive local dependencies, so replay requires Node 22+ and no packages.

Run `npm test` and `npm run build`. Coverage includes shared jog ownership, nonoverlapping concave floors, continuous bent corridors, offset apertures, exact program counts, presets/extreme widths, loops, damaged ownership/wall refusal, worker cancellation, controller exports and source ZIP reproduction. The review SVG is rasterized and inspected; live browser/WebGL and native Unreal verification are separate acceptance work.

## Scope of the next steps

This establishes polygon room faces and shared-wall ownership, rather than claiming the full reference's diversity. The route still crosses two side fields in one neighborhood. Whole-zone free-form packing, independently routed branches, obstacle-aware rerouting, holes, arbitrary topology-changing offsets and multi-floor generation remain future work. Local candidate refinement is bounded; there is no general global constraint optimizer yet. The next composition pass can connect several neighborhood fields through their reserved boundaries and jointly refine their corridor routes, using this polygon contract instead of rebuilding prefab rooms.

Unreal full-geometry import and engine collision verification remain pending.
