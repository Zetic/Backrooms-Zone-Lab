# Generic v2: room clusters and exploration routes

Open [`generic.html`](../generic.html), or select **Generic zone v2** in the main workbench. `index.html?template=generic` now opens this full geometry generator; use `&version=1` to retain the previous rectangular template.

Use GitHub Pages or run `node scripts/serve.mjs` and open `http://127.0.0.1:8765/generic.html`. V2 uses local ES modules and workers; opening this page directly with `file://` is not supported.

Generic v2 generates one floor with unequal room clusters, actual angled walls, long connecting passages, branching routes, room chains and large interconnected chambers. Cluster interiors use coherent local frames; the complete zone does not occupy equal square tiles. Footprints, 15 cm wall solids, supported apertures, the 2D map, the 3D cutaway and the exported `br.zone/0.4` file share the same geometry.

## Explore and compare

- **Explored Backrooms:** mixed clusters and reaching routes, inspired by the mapped Backrooms reference.
- **Branching wings:** more small clusters, earlier offshoots and longer passages.
- **Interconnected chambers:** adjoining large chambers and densely connected subdivisions.
- **Long quiet passages:** fewer rooms, long routes and a required tree without optional loops.
- **Dense subdivisions:** compact uneven partitions and shared-wall routes.
- **Angled room chains:** staggered rooms, chamfered end rooms and 45-degree connecting junctions.

Drag the plan to pan, scroll to zoom and use **Fit plan** to reset. Select rooms to inspect actual clear floor area. Enable labels or open the 3D cutaway when useful. Seed and preset changes regenerate the layout. Slider edits disable exports while pending; release the slider to commit. A refused change retains the previous accepted plan and keeps exports disabled.

Open **Compare nine seeds** to generate physically checked comparisons at the current dials, page through seeds, select a sample or export a gallery SVG. Comparisons run in a separate cancellable worker. They are deliberately generated on demand; larger layouts and wall unions take longer. Mesh preparation runs off-thread when the cutaway is requested.

## Controls and contracts

| Group | Controls | Meaning |
| --- | --- | --- |
| Program | Room Count, Room scale, Room variety, Rooms per cluster | Exact 8–96 rooms; actual dimensions; uneven proportions and offsets; 2–10 rooms per grouping target |
| Architecture | Architecture variety and four recipe switches | Uneven partitioned groups, staggered chains, side-room passages and large shared chambers; all-disabled uses the documented partitioned fallback |
| Functions | Shared room mix, Support room mix | Seeded quiet/shared roles and exact support count up to one third of rooms; geometry does not depend on these role draws |
| Composition | Sprawl, Branching, Turning, Orientation variety, Cohesion | Outer-frontier preference, earlier-parent offshoots, physical bends, cardinal versus 45-degree cluster frames, adjoining versus passage-connected groups |
| Circulation | Corridor length, Corridor width, Secondary routes, Openness, External ports | Independent connecting-run length, 2–4 m target width, extra shared-wall loops, actual 1–2.8 m aperture targets, exact 1–8 external ports |
| Height | Ceiling height | Uniform 2.4–5 m clear headroom for the single generated floor |

Turning changes actual route geometry; Orientation variety permits 45-degree changes rather than merely rotating the displayed map. Within a cluster, rooms remain architecturally coherent. Cohesion changes attachment and passage length without stretching rooms. Direct attachments align to the chosen parent wall; long connections use two straight runs and a convex junction with actual hosted openings. Room variety never reduces required frontage below usable clearance. Available host edges can cap corridor or aperture width.

Loops are physically realizable additional wall apertures, both within clusters and between clusters that growth brings together. The control cannot force a shortcut through unrelated intervening geometry. Branching selects a preferred earlier cluster; bounded placement can use another parent when the preferred connection cannot fit. Requested room and exterior-port counts are never silently reduced.

## Implementation and verification

`src/generic-template.js` owns controls, presets and normalization. `src/generic-layout.js` composes the room program, preferred cluster parents, local connection trees and loops, and collision-free connecting routes. `src/generic.js` realizes clear footprints and opposite aperture hosts, constructs floors/ceilings and full wall solids, then validates the actual walker network. `src/generic-app.js` and its workers provide the workbench. No third-party runtime packages are needed.

Placement uses named uint32 draws under a `generic-v2` namespace, stable IDs, a 150,000-step placement bound per attempt and at most four attempts. Geometry is capped at 512 spaces and 1,024 openings; the separate wall arrangement retains its 5,000-edge bound. Failed physical realization retries deterministically and ultimately refuses rather than exporting a graph with missing physical connections. The larger room program and separately allocated circulation replace v1's 48-room limit and shared 128-space budget.

Reports check the exact room/support/port programs, complete reach and return, and geometry budgets. Physical validation independently checks convex footprints, overlap, floors, headroom, opening approaches, wall apertures and local walker paths. Imports rebuild walls and navigation rather than trusting embedded reports. Imported fixed layouts retain their geometry; source regeneration is offered only for freshly generated layouts.

The generator ZIP contains the actual transitive module sources, `input.json`, `package.json` and `regenerate.mjs`. With Node 22 or newer, extract it and run `node regenerate.mjs` to reproduce the full export without installing dependencies. This is a full geometry generator bundle, not a classic rectangular exchange template.

Run `npm test`, `npm run examples:generic` and `npm run build`. The [nine-seed gallery](generic-v2-examples/nine-seeds.svg), three compressed full exports (`.zone.json.gz`, decompress before importing) and a [manifest](generic-v2-examples/manifest.json) preserve representative layouts and their measured room-area spread, cluster headings, branching, route lengths, loops and physical checks. Tests cover all presets across seeds, recipe masks, extreme widths/counts, determinism, damaged wall/door refusal, worker cancellation, controller pending/refused states and source-bundle regeneration.

## Transfer scope

This implementation preserves actual angled geometry under `br.zone/0.4`. It does not flatten the layout into rectangular exchange v1. Browser physical and navigation validation is implemented; Unreal runtime import, engine collision and engine walking still need the full geometry adapter. Vertical floors, stairs, material variation, furniture and annotations are separate work. V1 raised-section and courtyard controls remain available in their original generator below.

---

# Generic v1 rectangular prototype

Open [`index.html?template=generic&version=1`](../index.html?template=generic), or choose **Generic zone** in the workbench. The template combines occupied room groups into a finite zone using 19 dials, five module switches and eight presets. It is a reusable architectural experiment, with checked rectangular geometry and deterministic exports.

## Start exploring

- **Mixed zone:** combines several module recipes.
- **Compact clusters:** adjoining room partitions with secondary routes.
- **Branching wings:** longer corridor groups and offshoots supplied by more rooms.
- **Courtyard compound:** occupied bands and circulation around actual unbuilt courtyard space.
- **Shared halls:** large gathering rooms attached to smaller rooms.
- **Quiet passages:** enclosed rooms and required routes without optional cross-links.
- **Dispersed compound:** separated occupied groups connected by explicit halls.
- **Raised sections:** alternating floor levels connected by reversible climb passages.

Maximum Cohesion makes module envelopes touch; it does not enlarge rooms to bridge gaps. With fewer rooms there are fewer module groups and less available reach. Increase Room Count to supply longer branching compositions. Rooms per cluster controls whether that program becomes many small groups or fewer large groups. Exterior space between branches and intentional courtyards remains unbuilt.

Count and dimension labels show their actual mapped quantities; exported controls remain integers from 0 to 100. Slider labels update while dragging; release the control to generate the main plan and nine-seed comparison. Pending settings disable plan/gallery exports. Module checkboxes generate immediately. Select a seed card to inspect it, change floor with the up/down controls, and export the zone, plan, template source or check report.

## Controls

| Group | Controls | Effect |
| --- | --- | --- |
| Program | Room Count, Room scale, Room variety, Rooms per cluster | Exact 8–48 rooms; 12–18 m group envelopes; partition variation; 2–8-room grouping target |
| Functions | Shared room mix, Support room mix, Service centrality | Quiet/shared functions, exact support allocation up to one third of rooms, central versus peripheral support grouping |
| Composition | Sprawl, Branching, Turning, Cohesion, Module variety | Compact versus outward growth, active tips versus earlier offshoots, direction preference, touching versus separated groups, repeated versus mixed recipes |
| Circulation | Secondary routes, Corridor width, Openness, External ports | Optional additional routes, 2–4 m circulation widths, door/wide/open passages, exact 1–8 free exterior ports |
| Height | Ceiling height, Height variety, Raised sections | Headroom and seeded ten-centimetre variation; flat or 20–100 cm raised sections with compatible common headroom |
| Modules | Corridor crosses, Courtyard rings, Shared halls, Support groups, Secondary passages | Enable/disable actual recipe or program components |

Module switches make recipes available; they do not force every cluster to use them. A corridor cross or courtyard needs at least four rooms. Narrow interiors cannot fit courtyards; large circulation recipes can be limited by the 128-space zone budget. The always-available adjoining-cluster recipe supplies compatible fallback geometry without dropping requested rooms. Increase Rooms per cluster or Room scale when larger modules cannot fit.

Raised sections are ledges with `climb` contracts. They are not stacked storeys, generated stair flights or a tested accessibility solution. This template uses the rectangular exchange contract; true angles/arcs, galleries and explicit wall solids belong in a subsequent full-geometry realizer. The prototype preserves which geometry it actually generates.

## Plug-in architecture modules

Source: [`exchange/templates/generic.js`](../exchange/templates/generic.js). Each entry in `generic.modules` names a builder method and declares minimum rooms, optional enabling control, optional interior-width minimum and extra circulation-space cost. Module selection checks compatibility and reserves circulation/connector budget before placement.

A builder receives this context:

| Member | Contract |
| --- | --- |
| `tile`, `hall`, `count` | Local envelope side, reserved connection width and exact room count, in 50 cm grid units |
| `room(rect, title?, role?)` | Add one allocated room with a stable module/recipe/room identity |
| `hallSpace(rect, title)` | Add declared circulation geometry |
| `partition(rect, count, path)` | Bounded integer subdivision preserving minimum sizes and exterior port frontage |
| `rooms(rects)` | Add a batch of room partitions |
| `bands(rects, path)` | Distribute the exact room program across four compatible bands |
| `voids` | Record local reserved courtyard rectangles for inspection |

Every recipe must fill its envelope, apart from its declared courtyard, produce exactly the allocated rooms and declared circulation count, and supply a full reserved frontage at the midpoint of all four envelope edges. Local shared-wall passages are then constructed and checked independently. Builders cannot replace missing physical connections with abstract graph edges.

The built-in `cluster`, `spine`, `court` and `hall` methods show four examples. A new recipe can reuse a builder or add another method, then register it in the catalog. Templates exported from the UI include the registry and all template methods; no external layout library is required.

## Plug-in rules

`generic.ruleModules` registers separate `programRules`, `moduleRules` and `movementRules` evaluators. Each evaluator receives the realized zone and normalized dials and returns `api.rule(...)` reports. Register another evaluator method to add an architectural policy. All registered bundles are evaluated after physical exchange validation; disabling an architectural recipe never disables physical checks.

The current 11 reports check exact room/support quantities, enabled recipes, envelope occupation and courtyard reservation, maximum cohesion, requested external ports, actual arrival ownership, optional-route policy, allowed level differences, headroom and plain geometry. Imports recompute these reports; embedded claims do not establish validity.

Change the generator version when module or rule behavior changes. Keep the previous source for regeneration. When copying this into a differently named template, rename the local `generic` binding and its references along with the template id, then register the new source in the workbench and exchange script.

## Verification and handoff

The [handoff manifest](exchange-examples/manifest.json) includes three checked Generic zones, floor plans, source and eight nine-seed preset galleries. `npm run batch:exchange` regenerates them and runs the shared 120-seed acceptance/40-seed strict audit. Strict settings keep every rule; modules are disabled and Cohesion is 100.

Tests cover all presets, all 32 module-switch combinations, mixed extreme controls, deterministic replay, exact room count, untouched room dimensions when Cohesion changes, real courtyard emptiness, raised-section headroom, signed translations, import refusal, grouped controls, pending exports, downloaded source and registration/re-export of an additional architecture/rule module.

Unreal runtime loading and native physical verification remain pending. Browser checks establish the documented rectangular subset; they do not establish full-geometry or engine runtime support.
