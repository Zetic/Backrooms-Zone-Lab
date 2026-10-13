# Generic zone prototype

Open [`index.html?template=generic`](../index.html?template=generic), or choose **Generic zone** in the workbench. The template combines occupied room groups into a finite zone using 19 dials, five module switches and eight presets. It is a reusable architectural experiment, with checked rectangular geometry and deterministic exports.

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
