# Prototype here, walk in Unreal

The default page implements the October 12, 2026 contract copied from the owner's `Tools/ZoneLabExchange.md` into [unreal-exchange.md](unreal-exchange.md). That document is the format authority. This workflow does not change the Unreal game, its world planner or its compiler.

## Use the lab

Open `index.html` directly from the downloaded repository folder. No server, install, build or network is required. House and Level 0 are finite templates, with an unsigned 32-bit seed and integer 0–100 dials. Each change regenerates immediately. A rejected configuration leaves the last accepted plan visible and disables export until the failure is resolved.

Choose a storey with the arrows or selector. Drag the plan to pan, scroll to zoom, and press F to fit. Page Up / Down changes storeys. Rectangles are allocations in 50 cm units; x is east, y is north. The upper end of a stair is drawn as a stairwell with no floor. Joins show the resolved mode, approximate placement, and required/optional status in a tooltip. Entrances are uncut opportunities, not graph edges.

Export `.zone.json` only after the checks pass. Use **Export plan .svg** on each storey, add a sentence in **notes** about what you like, and download the check report and template source. Templates depend on `exchange/stream.js` and `exchange/checks.js`; bring those shared files too. Use **Import** to reopen a zone without changing it. The exchange file is the save format. The JSON editor supports one-off rectangular layouts; edited generators are labelled as edited provenance and do not claim that the original template reproduces the change.

## The handoff

The repository includes [seven checked zones](exchange-examples/manifest.json), their eleven storey plans, both template files and shared core files in `docs/exchange-examples/`. Three seeds per template plus the documented small flat give a small review set. Regenerate with:

```sh
npm test
npm run batch:exchange
npm run build
```

The manifest records a SHA-256 of each exact UTF-8/LF file and the 120/120 result for each template. Node tooling is optional; the browser runs without it. `dist/` contains both workbenches and the example package when built. The browser's check-report action runs the same 120 configurations for the selected portable template.

## Unreal realization

**The Unreal file loader is not built yet.** Passing browser checks produces a file for that loader; it does not add an import button to Unreal today. This repository supplies an optional integration harness against the owner's existing portable core:

```powershell
npm run verify:unreal -- --core=C:/Dev/Backrooms/Source/Backrooms/Workshop
```

On Windows this builds with Visual Studio 2022 Community by default. Pass `--vcvars=<path>` for another installation. No Engine headers or Editor process are required. `--emit-only=true` generates `.verification/ZoneExchangeCheck.cpp` for another C++20 compiler. It embeds the actual exported rectangles/joins, realizes them through `LayOne`, `LayLink` and `Generate`, checks every join, Human outward/return reachability, reversed-list compiled digests, and the six shared random draws. It covers all 240 acceptance configurations, the documented flat and a negative-coordinate/negative-height case. Results and compiler details go under `.verification/` rather than into generated zone files.

The future loader should preserve zone/space ids, map `room` and `hall` to the `space` recipe, `stair` to `ramp` with `run = travel length - 4`, and use `foot` to orient it. It should apply the explicit heights, theme, roles and feature tags, realize joins using the compiler, and report required/optional failures. Zone placements, world graph connections, lighting, meshes and collision belong to Unreal. The harness is verification tooling, not a runtime JSON loader.

## Portable templates

Each template has one plain JavaScript file with `make({seed, dials})`. The shared stream exactly matches `Templates::Stream`, including unsigned multiplication. Choices use named draws, integer sizes/heights, complete sort orders and explicit work bounds. No template reads the DOM, a clock, random global state or another template's state. Classic-script registration supports both direct file opening and Node tests; it is not part of the C++ generator algorithm.

The new templates are versioned as `house-v1` and `level0-v1`, with `source.lab = "exchange-1"`. They are new exchange generators, not a compatibility promise for any earlier `br.zone` identity or a byte-for-byte port of the current Unreal templates. House follows the Unreal three-column arrangement. Level 0 uses bounded rectangular subdivision, a required spanning tree and optional loops, and selects the connected arrival component before forming its final exchange file. Generator changes require deliberate template provenance revisions; exchange `version: 1` is the data schema version.

## Limits of the prototype

- The browser verifies schema, grid, ids, overlap/stacking, stair endpoints/run, shared stretches, floor differences/common headroom, Human graph reach/return, start, entrances, counts and repeatability. Exported generated templates keep all rooms plain. Shapes/columns/dividers/screens in imported files are retained as hints with a physical-verification warning; browser topology cannot prove their exact opening clearance. Start rooms and stair landings must stay plain.
- Dimensions and area in the browser describe allocation. A 3-unit room has about 1.35 m clear width after the compiler's 15 cm wall mass. The compiler measures final usable supported floor, including its feature cuts. The browser does not manufacture a false exact usable-area figure.
- A wide join falls back to a door when only 4–5 units are shared. The plan reports this. Opening `at` is a hint; the compiler may slide it. New themes require notes and use an Unreal fallback; unknown roles remain descriptive.
- Stair runs also respect the current ramp recipe's 80-unit maximum (84 units including the two landings); an overlong imported stair is refused before export.
- Curves, arbitrary angles, explicit thick-wall solids, wall materials/UVs, holes/gallery meshes and non-Euclidean graphs from the old workbench cannot be silently rounded into exchange version 1. The [geometry studies](../gallery.html) remain available with unchanged generation and their own `br.zone` exports. They are useful research, but outside this transfer path.
- No furniture, physical walls/frames, lighting, 3D viewer, portal graph or proprietary browser save format is added to the exchange workbench. Unsupported ideas belong in `notes`, for deciding what to build next on the Unreal side.
