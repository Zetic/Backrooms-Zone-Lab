# Phase 2 — physical reference architecture

The designed sample proves the next acceptance gate before introducing a procedural architectural director. Its topology is fixed. Seed, versions, profile, floor height, zone identity, and explicit port contracts still participate in deterministic identity.

## Composition

The ground-floor foyer has an 8 × 8 m footprint. A central 4 × 4 m patch extends through two storeys; the perimeter has a lower ceiling beneath the upper gallery. The gallery has an actual floor slab with that central hole and guards around its exposed edge. The top-floor lounge closes the tall space above its ceiling.

A service hall links kitchen and dining, which also share a real opening, forming a circulation loop. The foyer also connects to a lounge with an exact semicircular boundary. Kitchen connects to a non-cardinal winter garden. Upper floors group bedrooms, bathroom, studio, and private circulation.

An 8 × 8 m rear stair hall contains two separate 1.2 m lanes. Each flight uses `ceil(storeyHeight / 0.18)` risers and 0.28 m treads, joining a lower and upper 1 m-deep landing. The first climbs from floor 0 to 1; the second climbs from floor 1 to 2. Shafts are cut through the required floor and ceiling surfaces, with guard omissions only at actual stair arrival/departure thresholds. Sloping stair rails have independent canonical paths.

The footprint and lane placement support 2.8–3.6 m storey heights. The generator reports unsupported values rather than pretending to fit a larger flight into the same core.

## Physical validation

Validation independently checks:

1. Well-formed footprints and explicit floor/clear-volume relationships.
2. Disjoint occupied room volumes, slab thickness, ceiling planes, and protected double-height/shaft volumes.
3. Door apertures on real straight boundaries at compatible elevations, opposite local hosts, clear approach footprints, usable height, and matching wall cutouts.
4. Stair endpoint surfaces, supported landing footprints, actual tread count/dimensions/elevations, rise/run/slope, shaft clearance, and headroom against slabs, ceilings, and stair bodies.
5. Guards on exposed holes and correct stair-threshold exceptions.
6. External input contract preservation, boundary frames, local floor access, and absence of another local room on the outward side.
7. Body-width paths between every valid opening/landing terminal in a space.
8. Arrival reachability and returnability for every playable space and required external port.

Cached `localConnections` do not establish reachability. The checker rebuilds physical connections and compares them with the export. A removed door or stair leaves affected rooms unreachable even when a stale or fabricated edge claims they remain connected. One-way ascent can preserve forward reachability while failing the declared reversible exploration core; tests demonstrate this separately.

## Path witnesses

A walker has a 0.3 m radius and 2.1 m headroom. Local paths use a bounded visibility graph with candidates offset from floor boundary vertices and arcs. Each accepted line segment's capsule consists of a rectangle and two exact circles, tested analytically against the canonical floor, including holes. Deterministic shortest paths connect terminals within each room. Threshold crossings then connect rooms through valid apertures; valid flights connect actual landings.

These are navigation **witnesses for the reference sample**, not an engine navmesh, a continuous collision simulation, or a proof for arbitrary future building grammars. A failed bounded search reports an invalid layout even if a more general solver might find another route. Future directors should extend the validator when their geometry requires it.

## Rendering boundary

The WebGL realizer consumes plans and renders floor slabs, wall boundary surfaces with genuine aperture gaps/lintels, individual treads/risers, and gallery/shaft guards. It tessellates arcs in 3-degree increments only inside rendering code. Horizontal strips triangulate even-odd footprints, preserving actual gallery and stair holes.

Orbit, pan, zoom, picking, low-wall cuts, floor cutaways, ceilings, guards, and path overlays are view state. They do not alter the canonical plan or its fingerprint. Rendering is invalidated by input/view changes; no continuous generation or idle animation loop runs.

Wall records describe zero-thickness architectural boundary surfaces. Shared walls carry each room's host/aperture semantics; a later realizer may merge compatible surfaces and assign wall thickness. The current checker does not certify arbitrary thick-wall solids, load-bearing structure, engine collision, or a player controller.

The static cutaway SVG is a projected geometry review, with painter ordering; the interactive viewer uses the GPU depth buffer. GPU/browser interaction is an outstanding verification limit.
