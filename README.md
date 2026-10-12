# Backrooms Zone Lab

A browser laboratory for deterministic, engine-independent finite architectural zones. The initial implementation is **Phase 1: geometry and zone contracts**. It is not yet a procedural house generator.

The [requirements](docs/requirements.md) define the full multistory house milestone and the later game integration boundary. The earlier `Backrooms-Prototype-Map` repository is not modified.

## Current workbench

- Exact line and circular-arc boundaries, rotated/concave footprints, and interior holes.
- Separate ground/upper-floor plans, space inspection, external door contracts, and clearance overlays.
- Analytic boundary intersections and containment, winding/self-intersection validation, XY/Z overlap diagnostics, and protected-void checks.
- Engine-independent `br.zone/0.1` plans, stable semantic IDs, canonical JSON, and reproducibility fingerprints.
- Seed/profile controls, contract editing, full plan/report downloads, and URL-encoded reproducible inputs.

Geometry examples are deliberately separate specimens. External ports currently prove boundary placement and **local** approach clearance. Their whole-zone reachability is `not-evaluated`. The interface and exported diagnostics preserve that distinction.

## Run and verify

Requires Node 22 or newer; there are no npm dependencies.

```sh
npm test
npm run batch -- 200
npm run build
```

Serve the repository root or `dist/` with any static HTTP server. ES modules require HTTP; opening `index.html` directly as a `file:` URL is unsupported. GitHub Pages can host the generated `dist/` unchanged, including under a repository subpath.

To refresh the committed plan examples:

```sh
node scripts/examples.mjs
```

## Review examples

| Study | Seed | Canonical plan | Floor plan |
| --- | --- | --- | --- |
| Angled wing | 287 | [JSON](docs/examples/angular.json) | [Ground](docs/examples/angular-floor-1.svg) |
| Rotunda and apse | 623 | [JSON](docs/examples/rotunda.json) | [Ground](docs/examples/rotunda-floor-1.svg) |
| Gallery with hole | 12345 | [JSON](docs/examples/gallery.json) | [Upper](docs/examples/gallery-floor-2.svg) |

## GitHub Pages

The deployment workflow builds and publishes on pushes to `main`; the checks workflow also validates pull requests. Once this change is merged, enable **Settings → Pages → Source: GitHub Actions** if it is not already enabled, then run **Deploy Zone Lab** or push to `main`.

Repository visibility and account entitlements affect Pages availability. The repository was private at initialization. The workflow does not change visibility or Pages settings. A deployment is not claimed until GitHub reports success.

## Architecture and next phase

`src/geometry.js` is a renderer-independent line/arc kernel. `src/determinism.js` owns canonical JSON and scoped RNG. `src/zone.js` owns input contracts, specimens, local port realization, and plan validation. `src/render.js` consumes plans as SVG; `src/app.js` manages browser controls. Rendering cannot mutate canonical output.

Phase 2 adds physical multistory composition: actual walls/openings, stairs and landings, headroom, protected double-height spaces, gallery guards, physically derived navigation, and a 3D inspector. Phase 3 introduces the procedural house director. Phase 4 completes the useful house workbench and deployment acceptance gates.

See [implementation status](docs/status.md), [zone-plan contract](docs/zone-plan.md), and [geometry conventions](docs/geometry.md) for current limits. Full world graphs, streaming, and Unreal portal rendering remain outside this lab.
