# Solid walls and clear floor space — br.zone/0.4

The default generated houses now use generator 4 and schema `br.zone/0.4`. This extension reserves physical wall space during composition, exports exact wall solids with independent side finish slots, and validates supported passages through those walls. The archived v1 studies, v2 reference, and explicit generator-3 houses retain their original canonical behavior.

## Clear floor allocation

A room's `footprint` is its clear usable floor, with gallery/shaft holes excluded. `usableFloor` identifies the actual floor surface and its net `areaM2`. Walls occupy separately reserved space outside that footprint; adding thickness never subtracts wall area from the declared room floor.

`wallThickness` accepts 0.1–0.4 m, default 0.2 m. The director separates adjoining clear boundaries by that distance. Wing partitions select clear depths before reserving separator gaps; the overall block grows to accommodate them. Extra unused separator allowances enlarge the last room rather than reducing other rooms. Hall/core/conservatory offsets also reserve the necessary thickness. Tests compare the same composition at minimum and maximum thickness and require every allocated room area to remain at least as large.

Door thresholds lie on two distinct clear-room faces, rather than a shared zero-thickness plane. `openings[].hosts[].center` records each threshold. The opening's primary `center` equals its first host threshold. `passages[]` describes the full-width/full-height tunnel across the wall, including a 0.2 m supporting floor slab. Passage area is separate from each room's usable area.

For external doors, the port anchor lies at the **outer wall face**, `passage.to`. The room-side aperture center and inward approach remain on the clear-room face. This gives an engine realizer an actual outside threshold for remote pairing. Remote arrival geometry and world pairing remain deferred.

## Physical wall contract

| Field | Meaning |
| --- | --- |
| `input.config.wallThickness` | Physical separator/exterior thickness, metres |
| `geometryContract` | Clear-room footprint semantics, outside placement, join/predicate conventions, authoritative wall solid array |
| `spaces[].usableFloor` | Owning floor surface ID and verified clear area |
| `walls[]` | Room-boundary host semantics and aperture references, retained for physical navigation |
| `wallBodies[]` | Non-overlapping wall extrusions with exact line/arc footprints, floor index, vertical interval, and nominal thickness |
| `wallBodies[].sides[]` | Stable exposed side IDs, actual boundary edge, owner, material slot and UV mapping |
| `materials[]` | Independent room-side finish slots and texture keys; default exterior/reveal bindings |
| `passages[]` | Real threshold endpoints, width, height, exact floor footprint, floor thickness and clear vertical interval |

Exact convex outer envelopes use parallel line offsets, increased arc radii, and circular exterior corner joins. The planar arrangement splits analytic boundaries at intersections, forms the union of envelopes, and subtracts all clear-room interiors and applicable door tunnels. This merges overlapping corner/junction reservations into one physical mass. Thickness is nominal across straight walls; joined corners can occupy a wider diagonal envelope. Concave outer offsets are unsupported and reject explicitly.

Wall bodies are partitioned at aperture-height changes. A storey's wall solids extend to the next floor elevation, while clear room headroom ends below its slab. The renderer emits only exposed boundaries and caps, subtracting adjacent visible wall bands. Shared boundaries no longer render overlapping room-colored wall planes. Room and passage slabs also omit their hidden contact faces at door thresholds.

Coordinates retain the 1 µm quantum and 10 µm predicate tolerance. V4 wall arrangements use distance-based tangent normalization and endpoint splitting for near-coincident boundaries. The legacy intersection mode remains available to preserve v1–v3 fingerprints. The arrangement has an explicit 5,000-source-edge bound.

## Side finishes and UVs

Each room-facing original boundary has its own material slot, `finish:<spaceId>:<edgeIndex>`. Opposite sides of a shared wall therefore have separate bindings, including when both rooms have the same semantic role. Exposed fragment IDs also remain available for finer realizer overrides. The default exterior finish is a shared placeholder; reveals have opening-specific bindings.

UVs use actual distance along the boundary and height in metres, with 1 m repeats by default. `uOffset` and `uDirection` retain orientation across boundary fragments, including reversed hole boundaries and exact arcs. Rendered wall triangles carry their side/material IDs and UV coordinates. Texture assets and sampling remain engine/viewer responsibilities; the lab currently displays diagnostic colors.

## Validation and floor controls

Independent validation reconstructs the solid union, aperture cuts, side ownership, and UV slots from actual clear geometry. It checks usable area claims, passage dimensions/support, host elevations/positions, material references, and existing physical navigation. Changing a wall into clear space, altering its thickness/vertical range, assigning an incorrect side slot, or removing passage support invalidates the plan; cached connections cannot certify it.

Sticky **Floor down** and **Floor up** buttons select one floor in both the 3D view and floor diagrams. Buttons stop at ground/top bounds. Existing whole-building, gallery cutaway, and stacked-plan selectors remain available. Floor navigation never changes exported geometry or fingerprint. The wall-thickness control and shared URLs retain the physical configuration and explicit generator version; `generator=3` selects the archived thin-boundary houses.

The solid batch covers 64 default houses plus 16 boundary combinations: both profiles, two/three storeys, minimum/maximum rise, and minimum/maximum thickness. Two v4 canonical examples, five floor diagrams and two cutaways are committed. Automated browser/GPU interaction checks remain unavailable; raster review and Node geometry/controller tests establish data behavior, not live GPU performance.

Wall geometry is a finite architectural contract. Structural engineering, load-bearing analysis, runtime collision/player controllers, engine navmeshes, texture assets, and infinite-world/portal integration remain deferred.
