# Backrooms Zone Lab — Product Requirements and Architectural Design Brief

**Audience:** Autonomous implementation/work agent, technical reviewer, and future game-engine integrators  
**Status:** Initial project brief / implementation requirements  
**Proposed repository:** `Zetic/Backrooms-Zone-Lab` (new repository)  
**Primary reference:** [Zetic/Backrooms-Prototype-Map](https://github.com/Zetic/Backrooms-Prototype-Map)  
**Initial prototype:** A procedurally generated **multistory house** that constitutes **one complete, finite, explorable zone**.

> **Primary mandate:** Build a fast browser-based laboratory for **designing and validating interesting finite 3D architectural zones**. The generator must describe spaces and connections with engine-independent data, not Unreal-specific objects. Each generated result is one self-contained world **zone/level**; a zone may have multiple **floors/storeys**. In the final game, separate zones will be connected through a deterministic, non-Euclidean world graph. Do **not** implement that world graph or an Unreal portal renderer in the initial lab.

---

## 1. Vision and motivation

The final Backrooms game is intended to present an apparently infinite, explorable, deterministic world containing a huge diversity of architectural environments: houses, mansions, hotels, schools, offices, malls, pools, facilities, industrial voids, and surreal hybrid spaces.

The design has changed from **one spatially continuous infinite building** to **an infinite network of individually finite 3D zones**. These zones can be connected by transitions that do not preserve ordinary physical adjacency. A doorway in a house may lead to a hospital, a staircase landing may lead to a hotel, or a hatch may lead to a facility at a completely different apparent location. The game-world connections are real from the player's perspective, but the connected zones do not need to touch or even share a conventional world coordinate system.

This distinction unlocks more sophisticated **local architecture**. Instead of forcing all rooms into a global XY grid or a corridor backbone, each finite zone can be designed holistically: irregular footprints, angled wings, circular rooms, multistory halls, genuine voids, galleries, stair cores, hidden passages, loops, and extensive room relationships.

**Success is not a colorful map with labeled rectangles.** Success is a generated building with coherent spatial structure, surprising but credible traversal, physically possible internal connections, and enough character that exploring its rooms feels like exploring a deliberately designed place.

### Vocabulary (use consistently)

- **Zone / level:** One finite, independently generated architectural environment. The unit eventually connected into the infinite world. A single zone can be a small house or an enormous multistory facility.
- **Floor / storey:** A vertical layer within a zone. Do not confuse “three floors” with “three connected world levels.”
- **Space:** A room, corridor, stairwell, atrium, landing, gallery, balcony, shaft, or other architectural volume, with a semantic role and physical constraints.
- **Local connection:** A traversable relationship *within* one zone: doorway, open passage, stair, bridge, ramp, ladder, etc.
- **External port / zone connection:** A reserved and validated interface where a *future* zone graph may connect this zone to another zone, regardless of physical distance.
- **Zone plan:** A deterministic, engine-neutral description of the generated architecture and interfaces, suitable for inspection and implementation by different renderers.
- **Realizer:** A consumer that turns a zone plan into visible/playable geometry in a particular environment (browser, Unreal, Unity, Godot, etc.).

---

## 2. Project boundaries and non-goals

### The lab **must** do

1. Generate **one complete finite zone at a time** from a seed, architectural profile, configuration, and external-port requirements.
2. Begin with a **multistory house generator**; make it architectural and explorable rather than a narrow path with rooms attached.
3. Support genuine 3D spatial planning, including different floor elevations, room heights, stairs, openings, galleries, and protected voids.
4. Treat **arbitrary angles, polygons, and architectural circular arcs as foundational geometry**. They cannot be bolted onto a rectangle-only core later.
5. Define the layout in a **documented, versioned, engine-independent zone plan**.
6. Validate meaningful physical constraints and reachability, and make failures visible in the interface.
7. Provide a browser interface for rapid visual inspection, seed iteration, debugging, and exporting reproducible plans.
8. Preserve stable, deterministic identity for the zone's rooms, openings, connections, and exterior ports.

### The first lab **must not** require

- Unreal Engine, a `.uproject`, Unreal-specific geometry/components, Unity types, or Godot nodes.
- Runtime Nanite, collision meshes, texture assignments, lighting systems, AI agents, combat, audio, furnishing, or photorealistic art.
- Creation of a physical infinite world, global chunk streaming, cross-zone navigation, or a working Portal-style visual renderer.
- Full procedural generation of every imaginable room archetype or every exotic 3D surface on day one.
- Porting the existing infinite map generator as the new architecture's foundation.

**Future compatibility is a contract, not a mandate to build future systems now.** The first delivery is a strong, self-contained house-generation laboratory.

---

## 3. Future game architecture — why the zone interfaces matter

This section defines the **target connection model for the eventual Unreal game**. It is context for the lab's data contracts and architectural choices. It is **not** a request to implement a full multizone simulation in the prototype.

### 3.1 Infinite connected graph; finite physical environments

The final world consists of a deterministic, unbounded graph of zone identities and connections. Every graph node identifies a finite zone; every graph edge identifies a reciprocal pairing of connection ports. Graph adjacency **does not imply Euclidean spatial adjacency**. Separate zones may be instanced in isolated coordinates or loaded independently, then joined by a transition.

Global connectivity should be **guaranteed by construction**, not hoped for from random edges and not repaired by scanning a theoretically infinite world. The design established in earlier connectivity/portal research discussions is:

- Begin with a mathematically connected, implicitly addressable **required backbone** (for example, a deterministic lattice or parent-linked graph).
- Optionally add deterministic **shortcuts, loops, branches, and irregular thematic transitions**. An optional edge can increase diversity but must never be the sole reason a zone is globally connected.
- Bound the number of required external ports that a zone generator must realize, or otherwise assign a zone archetype with sufficient capacity. Do not create a graph degree the target zone cannot physically serve.
- Derive graph edges and their endpoint obligations from stable identifiers and hashes. Discovery or loading order must not change them.
- Do not infer a global connection merely from how two zones happen to be spatially placed.

A hidden mathematical backbone does not dictate architectural appearance. The player should not perceive a visible lattice unless a theme intentionally uses one.

**Connectivity precision:** Undirected/weak graph connectivity is not the same as player reachability through directed drops or one-way doors. The eventual design should retain a dependable **reversible/reachable core** for continued exploration and backtracking; one-way transitions can be added without undermining that core. Document directional traversal semantics explicitly.

### 3.2 Reciprocal connection contracts

For any world edge, both endpoints must independently derive an identical canonical edge identity and compatible obligations. The receiving zone must not have to exist first. No late neighbor-dependent guessing is allowed.

A future world graph supplies a zone with its **required external port contracts before local architecture is generated**. Relevant semantic properties include:

- Stable edge ID and endpoint/port ID.
- Port or traversal family: door, open passage, hatch, crawlspace, ladder, stair landing, elevator, vertical drop, etc.
- Approximate functional dimensions and required free approach/clearance; exact local placement is chosen by the zone.
- Traversal direction: reversible, entrance-only, exit-only, or another explicit rule.
- Optional constraints such as required floor region, public/service character, prominence, or theme-specific treatment.
- Local frame/anchor and intended arrival space, once the zone realizes the port.

The architectural director must place these ports on valid boundaries or transition sites, connect them to its internal navigable network, and export their finalized local frames. **Port identities and pairings do not change to solve local layout difficulties.** The director should resynthesize a local candidate or explicitly report inability to fulfill a contract.

The first prototype only needs to **accept, realize, inspect, and export external port requirements**. It must not invent remote destination geometry or pretend to validate another zone it has not generated.

### 3.3 Actual travel in Unreal (future integration)

The eventual Unreal runtime will manage:

1. Resolving a portal's world-edge identity to the destination zone and reciprocal port.
2. Loading/preparing the destination before transition, then streaming/culling zones according to residency and visibility needs.
3. Transforming player position and facing from the source port frame to the destination port frame; preserve or transform velocity according to traversal type and gameplay rules.
4. Managing overlap/crossing thresholds, collision, actor handoff, state persistence, save/load, and return journeys.
5. Rendering transitions in a way appropriate to the transition style.

**Visible, Portal-like through-the-door views are technically feasible**, for example using a secondary scene capture, render target, camera transform, and clipping at the destination portal plane. They are substantially more demanding than simple teleports: a visible remote zone needs residency and extra rendering; recursive views, physics through thresholds, actor straddling, illumination, and multiplayer add complexity. Do not assume every external door should use a fully visible seamless portal.

The game may use several transition presentations:

- **Occluded transition:** door opening/closing, corridor bend, stair landing, ventilation shaft, hatch, darkness, elevator, or other concealment.
- **Direct visible portal:** optional, specialized view-through connection, used selectively when justified.
- **One-way transition:** fall, drop, or other asymmetric travel; must be designed around directional reachability.

The **zone plan should provide geometric and semantic facts**, not prescribe the Unreal rendering technique. Actual portal rendering, coordinate-space hosting, and streaming are separate game-engine responsibilities.

### 3.4 Guarantees at two separate scales

- **Global guarantee (future):** Every zone address belongs to an intentionally connected, reciprocal world graph, with clearly defined directional traversal rules.
- **Local guarantee (lab now):** Within one generated zone, all required external ports and all designated playable spaces are physically reachable as appropriate, using actual validated openings and vertical traversals.

A successful graph algorithm does not establish local navigability; a visually convincing room plan does not establish global graph connectivity. Both must be independently testable.

---

## 4. Geometry and space model — foundational requirements

### 4.1 Engine-neutral coordinate conventions

The generator must use a documented, engine-neutral local coordinate convention, e.g. horizontal X/Y, vertical Z, dimensions in meters, and a specified handedness/orientation. Engine realizers can convert to their own coordinate conventions. Prefer quantized/canonical numeric representations for reproducible geometry; define tolerances and rounding explicitly rather than relying on an engine's floating-point behavior.

Rooms and substructures should support local transforms, so a wing can be designed in its own frame and placed at a non-cardinal angle without rewriting its grammar.

### 4.2 A real line-and-arc geometry foundation

The fundamental 2D boundary representation must support:

- Closed footprints made of straight segments **and exact circular-arc descriptions**.
- Arbitrary rotation, angled walls, irregular polygons, concave boundaries, and legitimate interior holes.
- Rectangles as a convenient special case, **not** the only primitive.
- Circular rooms, sectors, semicircular alcoves, curved corridors, rotundas, and connected wings at different orientations.
- Reliable geometric predicates for self-intersection, room overlap, containment, shared boundaries, opening placement, and minimum clearance.

**Do not confuse deliberate architectural roundness with arbitrary organic smoothing** or noisy blobs. Circular/sector geometry should retain its semantic shape in plan data. Tessellation is a renderer decision; the canonical data should not silently degrade a true arc into an undocumented polygon approximation.

The first prototype must demonstrate both **non-orthogonal walls** and **arc-based structures** in actual generated houses, not merely as isolated drawing examples.

### 4.3 True three-dimensional architecture

A room's shape cannot be modeled as an unrelated rectangle on each floor. Describe the occupied and free volumes and the spatial relationships between floors:

- Floors, ceilings, and variable-height walls/surfaces.
- Rooms spanning multiple storeys and ceilings with different elevations.
- Slab cutouts, stair shafts, tall clear volumes, balconies, overlooks, gallery edges, and guard locations.
- Physical stair/ramp/lift reservations, landings, width, headroom, and valid connections between walkable surfaces.
- Vertical stacking constraints: a lower-floor double-height space displaces conflicting upper-floor solids.
- Openings with real positions, orientation, dimensions, and approach space on both sides.

An upper gallery must be **actual walkable floor around a protected void**, not colored decoration over a full slab. A stair must reach the correct elevation with valid approach clearance, not merely connect two abstract graph nodes.

The common data model should be extensible to domes, vaulted ceilings, spiral stairs, and more elaborate 3D surfaces, but the first milestone does not require a complete general-purpose curved-surface modeling system.

### 4.4 Semantic architecture is separate from rendering

A room has a purpose, relationships, geometry, and constraints. It does not contain an Unreal mesh path or a particular renderer's component type. Architectures may expose optional semantic descriptors (e.g. `formal`, `service`, `grand`, `worn`, `industrial`, `victorian`, `liminal`) that future realizers can interpret differently.

Keep the base schema **simple enough to be consumed by Unreal, Unity, Godot, or a custom engine**, while preserving the spatial facts needed for collision, navigation, and construction later. Do not fill it with procedural mesh details, UVs, triangles, light fixtures, or prop catalogue references.

---

## 5. Generation philosophy — build a building, not a snake

The zone director should produce a **coherent architectural composition** rather than repeating rectangular territories or extending one mandatory hallway with leaf rooms.

Recommended conceptual stages (agent may choose implementation details):

1. Establish the profile and space program: what functions and major spatial experiences should exist.
2. Plan defining **signature spaces** (e.g. double-height foyer, central hall, staircase core, upper gallery, irregular wing).
3. Reserve the required 3D volumes and external connection contracts.
4. Construct a traversable **circulation backbone** with meaningful choices and vertical relationships.
5. Compose and subdivide wings and residual space into suitable rooms; honor functional adjacency and proportions.
6. Add loops, secondary paths, nonessential rooms, dead ends, hidden circulation, and measured Backrooms-style irregularity.
7. Realize precise surfaces, openings, and traversals; validate the actual space and port access before exporting.

A house should feel like a house—even when it becomes subtly wrong. Group kitchen/dining/pantry relationships; distribute bedrooms, bathrooms, utility rooms, and private/public circulation plausibly. But let architectural variations produce distinctly different outlines and routes.

**Do not force every space into one linear “main passage.”** A route can be a design device for particular levels, but the shared topology must allow multiple intersections, cycles, internal shortcuts, multiple stairs, and alternative routes.

**Do not bake specific content themes into the geometry kernel.** House generation is the first architectural director; hotels, hospitals, malls, and industrial facilities should be able to use the same geometric/constraint foundation with different composition strategies.

A hierarchy such as `zone → building/wings → floors/areas → spaces → openings` is a useful mental model, not a mandatory serialized object hierarchy. The agent should design clean abstractions suited to the constraints above.

---

## 6. First milestone: multistory house zone

### Required result

A user opens a GitHub Pages-compatible browser application, selects a seed and multistory house profile, and sees **one generated house-zone** in both 2D and 3D. They can inspect floors, move around the building, see real stairs and openings, highlight reachable spaces, examine any invalid geometry, and export the complete canonical zone plan. Changing the seed creates genuinely different but consistently valid houses.

### Core architectural capabilities

The first meaningful generated house must demonstrate:

- At least two storeys; support and showcase a **three-storey house/mansion-like profile**.
- A recognizable house room program with public, private, and service groupings.
- Multiple connected rooms per floor; at least one actual vertical circulation route reaching the upper floors.
- At least one **double-height signature space** with a protected opening and an **accessible upper gallery/balcony** overlooking it.
- A combination of **straight, angled, irregular, and/or curved architectural structures**. Some seeds should produce a non-cardinal wing or wall and a circular/semicircular/arc-based space or passage. These must participate in real geometry validation.
- Distinct connection choices inside the house: branches and dead ends are acceptable; demonstrate at least one **meaningful loop or alternative route** on supported profiles, not just one forced traversal chain.
- Physical openings (doors, passages) and stairs/landings with believable clearances.
- **One primary external port and at least two secondary external ports** as a useful house-profile default; allow configurable port requirements rather than hard-coded entry/exit labels. Demonstrate that external ports may occur on **different floors**, including an upper floor.
- Connectivity from required external ports to the intended internal traversable network. A port must not open into a wall, a void with no landing, or a sealed room.
- Distinctive output across seeds beyond simple room shuffling or recoloring.

The specific room counts, plot sizes, and architectural recipes are left to the implementation agent, provided the results achieve these characteristics and remain testable. Favor a **small set of well-executed sophisticated house profiles** over many superficial presets.

### Connectivity modeling inside the lab

Model a space-navigation graph derived from **actual openings, walkable areas, stairs, bridges, and other valid transitions**. Do not certify reachability simply because two room IDs were connected before geometry was constructed.

Store the semantic intent and the physical realization separately enough to detect disagreement. Every claimed traversable connection should identify its actual endpoints and convey its directionality, clearance, and spatial frame. Differentiate visibility adjacency (room overlooks atrium) from actual walkable adjacency (bridge, stairs, door).

All designated playable spaces should be reachable from the designated arrival port for this milestone, unless deliberately tagged as inaccessible scenery and explicitly excluded from the traversability guarantee. Validate return paths where an edge is meant to be reversible.

---

## 7. External connection contract required **now**

Although the lab generates only one zone, its external ports must be **first-class inputs and outputs**, because the future game will connect zones through them.

The generator should accept an abstract list of port requirements, with stable IDs and type/clearance/direction requirements. Its output should contain realized ports linked to the specific local space and to a concrete opening/landing/transition anchor. Port anchor includes position, forward orientation, usable approach side, footprint and vertical clearance in **zone-local coordinates**.

Do not hard-code “front door = entrance” and “back door = exit”; primary/secondary are descriptive roles, **not required travel directions**. A port may be reversible. The world graph will eventually decide what remote zone is on its other side.

The prototype may allow a user to choose and inspect port requirements, but it should not render a fake adjacent world as proof of correctness.

**Required failure behavior:** If a candidate cannot realize all required ports while meeting local geometry/navigation constraints, it is invalid. Regenerate with a deterministic, bounded strategy or return a readable failure; never silently drop or arbitrarily relocate a contract after publication.

---

## 8. Engine-independent zone-plan output

Define and document a **versioned serialization contract** (JSON is suitable for prototyping). Favor explicit stable identifiers, semantic entities, geometric facts, relationships, and traversal contracts.

At minimum, a serialized plan should represent:

| Group | Required information |
|---|---|
| Identity | `zoneId`, seed, generator/plan schema version, architectural profile, deterministic configuration |
| Spatial convention | Units, axes/handedness, angular representation, precision/tolerances |
| Spaces | Stable IDs, semantic role/tags, 2D footprint(s), orientation, elevation(s), clear volumes, optional parent/group association |
| Structural geometry | Floors, ceilings, walls/surfaces, protected voids, slab holes, galleries, guards where required |
| Openings | Stable IDs; host boundary/surface; location, width/height, type, linked spaces |
| Vertical traversals | Stair/ramp/ladder/etc. semantics, source/target walkable surfaces, elevation, width, landings, clearance/path |
| Local topology | Traversable connections, directionality, actual geometry references, reachability/validation data |
| External ports | Contract ID, port ID, semantic type, physical anchor/frame, clearance, directionality, owning space, validated access |
| Diagnostics | Errors, warnings, metrics/summary, canonical hash or other reproducibility fingerprint |

The exact names/schema are for the implementation agent to refine. Avoid overengineering the format before the geometry experiments prove what is needed; avoid underspecifying critical dimensions/relationships merely to keep the JSON short.

**Portable data is not automatically portable algorithms.** For now, the browser can generate the authoritative zone plan, and other engines can import/realize it. Later, seed-based native generation in multiple engines can use a shared portable core or verified cross-language implementations. Do not make a C++/WebAssembly port a prerequisite for the first browser milestone.

### Determinism requirements

- The same complete input tuple (`zoneId`, seed, generator version, profile, explicit port requirements, config) yields the same canonical plan.
- Results must not depend on traversal/load order, frame timing, browser redraws, global RNG, system time, or previous generated zones.
- Stable IDs should not depend accidentally on unordered iteration or rendering order.
- Canonical exports and fingerprints should remain consistent within a generator version; version changes that intentionally alter topology must be explicit.
- Deterministic retries/repairs are acceptable; silent nondeterministic fallback is not.

---

## 9. Browser design and usability

This is a **rapid architecture research workbench**, not an asset showcase. Prefer informative, responsive debug visualization over high-fidelity materials.

### Essential views

1. **Interactive 3D whitebox view:** Orbit/fly camera and zoom; enough geometry to understand room volume, walls, doors, openings, stairs, galleries, and vertical relationships. Color spaces by function or category, with legible selection feedback.
2. **2D floor plan inspection:** Select or scroll through individual floors; preserve useful physical scale and readable labels; do not shrink three floors side-by-side until labels become unreadable.
3. **Cutaway / floor isolation:** Hide selected floors, show vertical sections or cutaway levels, inspect voids, stair shafts, galleries and internal connectivity.
4. **Connectivity mode:** Highlight traversable connections, entrance ports, vertical transitions, unreachable rooms, and paths from selected entry points.
5. **Geometry diagnostics:** Explain collisions, invalid door placement, blocked clearance, unconnected traversals, missing port realizations, and rejected candidates.

### Controls and outputs

- Seed input, regeneration, selected architectural profile, floor/size/complexity settings appropriate to the current director.
- Optional geometry/shape-family toggles for controlled comparisons, not an overwhelming panel of arbitrary parameters.
- External port requirements view/editor sufficient for testing primary/secondary/upper-floor cases.
- Export/download of the **full zone plan JSON** and a concise validation report.
- Reproducible configuration encoded in a shareable URL where practical.
- GitHub Pages-compatible deployment with no game-engine installation. Automated build/deploy is acceptable if the developer experience is straightforward.

The 3D viewer does **not** need game-quality collisions or a full player controller, but must convey the physically intended spaces and connections. A simple optional first-person walkthrough is valuable only after the core geometry/viewer is reliable.

---

## 10. Validation and quality requirements

A candidate's graph, geometry, and user-facing rendering must agree. Build programmatic validation and tests from the beginning.

### Mandatory invariants

- Every footprint is well-formed; arcs, holes, and polygon boundaries have defined winding and tolerances.
- Spaces and solid volumes cannot overlap illegally; legal stacking is differentiated from actual collisions.
- Door/open-passage geometry lies on a valid boundary and provides appropriate approach space on both sides.
- Floors and ceilings respect protected voids; a two-storey open space cannot be accidentally filled by an upper room/slab.
- Walkable galleries/bridges have real supporting floor footprints; overlooking alone does not imply connectivity.
- Vertical connectors join valid elevations and include route width, landings, and clear headroom.
- Every required external port is present and reachable under its specified traversal direction.
- Designated playable rooms are reachable; no unintended isolated pockets or false geometric connections.
- The output is deterministic across repeated runs and independent of visualization modes.
- A bounded generation failure is reported explicitly, including why all candidates failed.

### Automated testing

- Unit tests for line/arc geometry and clearance predicates, including awkward angles, tangent edges, concave regions, circles/sectors, holes and near-degenerate conditions.
- Multi-seed house-generation tests across profiles, floor counts and port requirements.
- Tests that intentionally damage openings, stairs, landings, voids and contracts, and confirm validators reject them.
- Deterministic rerun and canonical-output tests.
- A batch/stress mode that reports generation time, rejected candidates and failure categories instead of silently hanging.
- Regression fixtures for a handful of representative seeds, including a non-orthogonal house, a curved/circular area, a three-storey gallery house, and upper-floor ports.

**Visual review is also necessary.** Passing geometry checks is not evidence of an interesting building. Include screenshots or saved examples of distinct seeds and inspect whether layouts exhibit architectural hierarchy, recognizable space programs, and meaningful exploration routes.

---

## 11. Existing prototype: reference and migration policy

Review but **do not overwrite** the current repository: [Backrooms-Prototype-Map](https://github.com/Zetic/Backrooms-Prototype-Map).

Valuable reference material:

- [`space.html`](https://github.com/Zetic/Backrooms-Prototype-Map/blob/main/space.html) and [`src/space/`](https://github.com/Zetic/Backrooms-Prototype-Map/tree/main/src/space): room-first house/mansion experiments.
- [PR #38](https://github.com/Zetic/Backrooms-Prototype-Map/pull/38): primary/secondary connection roles and mansion relationships.
- [PR #39](https://github.com/Zetic/Backrooms-Prototype-Map/pull/39): multistory passage endpoints, upper-floor connections, compact stair reservations, stacked floor inspection.
- [PR #40](https://github.com/Zetic/Backrooms-Prototype-Map/pull/40) and [`docs/space-heights.md`](https://github.com/Zetic/Backrooms-Prototype-Map/blob/main/docs/space-heights.md): real room heights, protected openings, galleries, stairs, landings, headroom, surface/void validation; current `br.space/0.4` data contract.
- [`docs/templates.md`](https://github.com/Zetic/Backrooms-Prototype-Map/blob/main/docs/templates.md): semantic room/connection/architectural template concepts.
- [`src/core.js`](https://github.com/Zetic/Backrooms-Prototype-Map/blob/main/src/core.js): deterministic seed/hash concepts.

**Reuse verified ideas, test cases and geometric utilities where they fit. Do not mechanically transplant architecture or assumptions.** In particular:

- Do not inherit the infinite XY territory/cell ownership and shared physical-boundary stitching as the zone foundation.
- Do not make a single linear main passage the only connectivity model.
- Do not inherit joined axis-aligned rectangles as the mandatory geometric primitive.
- Do not require external ports to sit along a physically adjacent global territory boundary.
- Do not couple the new engine-neutral schema to older exports merely for backward compatibility.

The old repo documents an experiment and offers regression examples; the new repo is a deliberate architecture reset.

---

## 12. Implementation sequence and acceptance gates

The agent should take ownership of practical implementation choices while preserving this brief's invariants. Suggested sequence:

### Phase 1 — New repository and geometry/zone contracts

**Deliver:** A clean browser-first project, documented conventions, canonical geometry model (line segments + circular arcs + irregular footprints), provisional zone/port schema, deterministic seed primitives, and basic geometry tests.

**Gate:** Arbitrarily rotated and curved footprints can be represented, drawn and validated correctly. Geometry can be exported without renderer-specific types.

### Phase 2 — Full 3D architectural composition

**Deliver:** Multistory floor/volume planning, openings, protected shafts/voids, stairs/landings, galleries, collision/clearance rules and actual walkable connectivity derivation.

**Gate:** A designed three-storey sample, including a true double-height room and upper gallery, passes geometry/traversal tests and is legible in the browser.

### Phase 3 — Procedural multistory house director

**Deliver:** Multiple coherent house variations from seed and profiles, room relationships, angular and curved architectural features, loops/branches, and realization of externally supplied ports on multiple floors.

**Gate:** A useful range of different seeds produces distinctive, validated houses; invalid requirements produce explicit diagnostic failure, not silent omission.

### Phase 4 — Browser workbench and quality hardening

**Deliver:** Clear 3D and 2D views, floor controls, cutaway, connectivity overlays, port inspectors, canonical JSON export, shareable seeds, stress/batch tests, and a working GitHub Pages deployment.

**Gate:** A reviewer with only a browser can regenerate a failing seed, understand why it failed, inspect an accepted level's traversal, and download a plan suitable for another renderer to consume.

A phased implementation is preferable to one enormous change. Keep existing phases independently demonstrable and do not disguise unfinished structural capabilities behind attractive visuals.

---

## 13. Definition of done — first useful prototype

The first useful delivery is accepted when a reviewer can:

1. Open the deployed Zone Lab in a browser and generate a **single finite house zone** from a seed.
2. Generate and examine a **three-floor** variant with functional room groupings, real stairs, a protected two-storey opening, and a usable upper gallery.
3. Inspect architecture containing **non-90-degree geometry and an intentionally circular/arc-based feature**, with the actual geometry model validating these shapes.
4. See meaningful internal route choices, not merely a line of rooms, and verify reachability/returnability where applicable.
5. Inspect at least **three explicit external port requirements** (one primary, two secondary), including a port located on an upper floor, and confirm they are realized and physically reachable.
6. Switch between readable floor plans, a 3D cutaway, and a connectivity/diagnostics view.
7. Export a standalone engine-independent plan with stable IDs, geometry, connections, ports, and versioning; generate the **same plan again** with the same inputs.
8. Run automated tests demonstrating geometry and navigation validity and showing informative failure for invalid plans.
9. See several seeds with **structural diversity** (layout, circulation, spatial hierarchy, footprint), not just surface or labeling changes.
10. Understand from the repository documentation which elements are already implemented versus intentionally deferred to future zones/Unreal integration.

---

## 14. Explicit future work — not first milestone

After the house lab is convincing, expand the shared foundation to other directors: hotel with multi-floor atrium and guest wings; mansion/estate with complex room hierarchy; industrial facility with vertical pits and catwalks; school, hospital, mall, poolrooms, or abstract liminal environment. Some archetypes may have substantially different architecture grammars while sharing spatial/connection primitives.

Then, in a **separate** world-connection effort:

1. Implement and prove the deterministic, connected implicit infinite zone graph.
2. Produce reciprocal connection contracts and stable world-edge IDs.
3. Supply those contracts to individual zone directors before generating local architecture.
4. Build a multizone integration test: three zones, multiple connections, at least one loop and a return trip.
5. In Unreal, construct zones from the engine-neutral data and implement transitions/streaming/state persistence.
6. Only then tackle optional seamless portal views and difficult cross-portal rendering/physics cases.

**The lab's responsibility is to produce excellent individually explorable levels with correct interfaces. The game's responsibility is to connect those levels into an infinite world.** Preserve that boundary.

---

## 15. Instructions to the implementation agent

- Treat this document as **requirements and boundaries**, not a line-by-line mandatory algorithm or technology prescription.
- Create the new Zone Lab project; leave the earlier prototype intact. Prefer a browser-native solution that runs on GitHub Pages. TypeScript/JavaScript is reasonable initially; use other tools when they demonstrably improve correctness and iteration.
- Begin with the house generator and real geometry/connection correctness. Resist broadening into many archetypes before the first is good.
- Make architecture **generative**, **physically credible**, **three-dimensional**, **non-rectilinear-capable**, **deterministic**, and **engine-independent**.
- Keep gameplay/world portal implementation out of the browser MVP, but honor required port contracts and prepare a useful portable export.
- Preserve meaningful multi-floor connections, loops, clearance and room relationships. Avoid “visual only” structures that cannot exist or be traversed in the eventual game.
- Include runnable tests, a deployed browser demo, representative seed examples, and a clear explanation of unresolved limitations.
- When forced to choose, prioritize **correct reusable architectural logic and inspectable generated levels** over visual polish or an Unreal-specific shortcut.

**Guiding principle:** *One sophisticated generated level at a time, with the right external interfaces, eventually forms an infinite network of sophisticated levels.*
