# Backrooms Zone Lab

Prototype the architecture you want to walk in Unreal. Preserve the complete design and generator source in the handoff; extend the Unreal Zone Lab where a chosen prototype exposes a missing capability. The [design handoff](docs/design-handoff.md) describes this goal and the current integration gaps.

Use the [full geometry prototype](gallery.html) for curved/angled rooms, wall solids, galleries and a 3D view. Use the default rectangular exchange page for the currently tested **`backrooms-zone` version 1** subset, defined by the [ZoneLabExchange contract](docs/unreal-exchange.md). This subset is a first transfer path, not a limit on what may be designed.

Open **`index.html` directly** from the repository folder. No build, server, install, runtime dependency or network is needed. Select **House** or **Level 0**, change the seed and dials, inspect each storey, and export the checked `.zone.json` and its plan. Import files to reopen them; edit the exchange JSON for one-off layouts. A failed change preserves the last accepted plan and disables export.

The [transfer workflow](docs/transfer-workflow.md) explains the handoff. [Seven example zones, eleven plans, the templates and their 120-case reports](docs/exchange-examples/manifest.json) are ready under `docs/exchange-examples/`.

**The Unreal JSON loader is not built yet.** These files target the documented loader contract. The optional integration check realizes the actual exchange layouts through the existing portable Unreal compiler and verifies physical compilation, all joins, Human reach and return, and order independence. It does not implement the runtime loader.

## What crosses to Unreal

- Integer rectangles in **50 cm units**, floor/ceiling/rise in **10 cm steps**, stable semantic ids, theme and role names, feature requests.
- Shared-wall joins with movement modes, required/optional intent, start and uncut entrance opportunities.
- One plain JavaScript file per template, using the exact named uint32 `Templates::Stream` draw, whole-number decisions, complete sort orders and bounded work.
- Browser checks and a **120/120** seed/dial acceptance report per template; plan snapshots and notes on what the format cannot express.

In the rectangular exchange path, Unreal builds the walls, doors, collision, lights and final usable floors. That page reports allocation dimensions/area explicitly. Full geometry exports retain the prototype's richer geometry and connection intent for a dedicated Unreal adapter and any required core extensions.

## Optional tooling

Node 22 or newer; no npm packages to install.

```sh
npm test
npm run batch:exchange
npm run build
node scripts/serve.mjs
```

The server is optional and binds only to `127.0.0.1:8765`. `dist/` packages both workbenches for GitHub Pages. Static hosting preserves repository-subpath URLs. Pages publishes merged changes to `main` through the existing workflow.

With the owner's portable C++ sources and Visual Studio 2022 Community on Windows:

```powershell
npm run verify:unreal -- --core=C:/Dev/Backrooms/Source/Backrooms/Workshop
```

Logs and the generated harness go to ignored `.verification/`. See the transfer guide for other compiler paths.

## Full geometry prototypes

The [full geometry workbench](gallery.html) preserves the procedural gallery houses, atrium mansions, arbitrary angles/arcs, physical thick walls and 3D viewer. Its **`br.zone` files carry design intent** and need an Unreal adapter; they are not rectangular exchange files. Keep the original geometry when handing them over. [Prototype documentation and verification commands](README-studies.md) describe this workbench.

The Unreal core already builds round interiors using faceted corner fills and straight doorway flats. Openings on curved faces and general line/arc footprints need separate assessment and implementation. A rectangular schema restriction does not mean Unreal has no curved geometry support.

`exchange/stream.js`, `exchange/checks.js` and `exchange/templates/` are portable core. `exchange/plan.js` and `exchange/app.js` handle drawing and interaction. [Current status](docs/status.md) records verification and the remaining integration limits.
