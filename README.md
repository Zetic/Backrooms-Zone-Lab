# Backrooms Zone Lab

A browser laboratory for deterministic, engine-independent finite architectural zones. **Phase 3 adds two procedural house profiles with seed-driven room programs, circulation graphs, gallery placement, and stair cores.**

The [requirements](docs/requirements.md) define the complete house milestone and future world-integration boundary. The earlier `Backrooms-Prototype-Map` repository remains unchanged.

## Current workbench

- **Gallery house** defaults to two storeys; **Atrium mansion** defaults to three. Either supports two or three storeys and a 2.6–4.2 m rise.
- Seeded public/private/service programs, independently selected direct-room or hall wings, curved apses, angled bays, optional conservatories, and circulation loops.
- A real double-height signature space and accessible upper gallery; mansions can place this pair on either of two storey pairs.
- One or two stair cores, adaptive flight lengths, individual treads, landings, headroom, shaft holes, guards, and supporting floor surfaces.
- Actual local door apertures and configurable external door contracts, including upper-floor requests.
- Independent physical navigation, inward/return reachability, walker-width path witnesses, minimum room areas, and required kitchen/dining/pantry relationships.
- Bounded deterministic candidate search with explicit failure history; unsatisfied inputs remain in the exported plan.
- A depth-tested WebGL whitebox viewer with orbit, pan, zoom, space picking, cutaways, optional ceilings, guards, and validated paths; exact-arc stacked floor plans accompany it.
- Portable `br.zone/0.3` plans, canonical JSON, stable IDs, fingerprints, reproducible URLs, and full plan/report downloads.
- The fixed Phase 2 reference and Phase 1 geometry studies remain available with unchanged canonical v2/v1 examples.

This is a bounded two-profile grammar. It produces varied physical transition graphs; it does not synthesize arbitrary floor plans from unconstrained room lists.

## Run and verify

Node 22 or newer is required for tooling. There are no npm or CDN runtime dependencies.

```sh
npm test
npm run batch -- 200
npm run batch:architecture
npm run batch:houses
npm run build
```

Serve the repository root or `dist/` over static HTTP. Opening ES modules directly as a `file:` URL is unsupported. GitHub Pages hosts `dist/` unchanged, including under the repository subpath.

```sh
node scripts/examples.mjs
```

Refreshes seven canonical plans, seventeen floor diagrams, and four static cutaway geometry reviews.

## Review generated houses

![Atrium mansion with two stair cores](docs/examples/atrium-mansion-1-cutaway.svg)

| Example | Canonical plan | Floor views | Cutaway |
| --- | --- | --- | --- |
| Gallery house, seed 2: hall wings, circular gallery | [JSON](docs/examples/gallery-house-2.json) | [Ground](docs/examples/gallery-house-2-floor-1.svg), [gallery](docs/examples/gallery-house-2-floor-2.svg) | [View](docs/examples/gallery-house-2-cutaway.svg) |
| Atrium mansion, seed 0: direct rooms, gallery on floor 3 | [JSON](docs/examples/atrium-mansion-0.json) | [Ground](docs/examples/atrium-mansion-0-floor-1.svg), [middle](docs/examples/atrium-mansion-0-floor-2.svg), [gallery](docs/examples/atrium-mansion-0-floor-3.svg) | [View](docs/examples/atrium-mansion-0-cutaway.svg) |
| Atrium mansion, seed 1: two stair cores, gallery on floor 2 | [JSON](docs/examples/atrium-mansion-1.json) | [Ground](docs/examples/atrium-mansion-1-floor-1.svg), [gallery](docs/examples/atrium-mansion-1-floor-2.svg), [top](docs/examples/atrium-mansion-1-floor-3.svg) | [View](docs/examples/atrium-mansion-1-cutaway.svg) |
| Fixed three-storey reference | [JSON](docs/examples/reference-house.json) | [Ground](docs/examples/reference-house-floor-1.svg), [gallery](docs/examples/reference-house-floor-2.svg), [top](docs/examples/reference-house-floor-3.svg) | [View](docs/examples/reference-house-cutaway.svg) |

Cutaways are static geometry reviews from the same mesh-building code. Live interaction and GPU shader behavior require separate verification.

## Inspection controls

The default profile is **Atrium mansion**. Select a profile, seed, storey count, and rise; **Next seed** changes the architectural composition. **Through gallery floor** follows the generated signature elevation, and **Top floor** follows the actual storey count. Disable **Low wall cutaway** for complete wall height; enable ceilings to inspect caps. Drag to orbit, Shift-drag or right-drag to pan, scroll to zoom, and click a surface to select its space. Arrow keys rotate, `+`/`-` zoom, and `0` resets the camera.

**Validated paths** displays geometric witnesses through actual floors and door thresholds. These paths are validation/debug output rather than a game navigation mesh or player controller. The inspector identifies the declared walker: 0.3 m body radius and 2.1 m headroom. Composition diagnostics identify wing recipes, gallery shape, stair cores, and rejected candidate attempts.

External contracts use floor indices `0`, `1`, `2`; requesting floor `2` on a two-storey house fails explicitly. Shared URLs retain storeys and search budget. Programmatic generation accepts `maxAttempts` from 1 to 6, default 4. The fixed reference retains its 2.8–3.6 m rise range and fixed topology. Invalid plans can be exported with diagnostics for reproduction.

## GitHub Pages

The Pages workflow publishes changes merged to `main`. Use **Settings → Pages → Source: GitHub Actions** if hosting is not already configured. Workflows preserve existing hosting settings; PR creation does not deploy a change.

## Architecture and scope

`geometry.js` and `determinism.js` remain renderer-independent. `house.js` directs bounded composition; `architecture.js` retains the designed sample and shared external-port realization. `structure.js` derives boundary surfaces, apertures, and guards; `physical.js` reconstructs validation/navigation; `navigation.js` produces exact-clearance path witnesses. `mesh.js` tessellates only for rendering; `viewer3d.js` manages WebGL inspection. `render.js` supplies exact-arc SVG plans; `app.js` owns controls and exports.

The physical contract uses finite-thickness slabs, stepped stair bodies, and semantic zero-thickness wall boundary surfaces. Runtime collision, thick wall solids, structural support, navmeshes, and engine controllers are deferred. Automated browser/GPU interaction QA is unavailable in the implementation environment; controller and rendering-data checks do not replace it.

See [house director](docs/house-director.md), [physical architecture](docs/physical-architecture.md), [implementation status](docs/status.md), [zone-plan contract](docs/zone-plan.md), and [geometry conventions](docs/geometry.md). Phase 4 hardens the workbench and acceptance workflow. Infinite zone graphs, streaming, and portal rendering remain outside the lab.
