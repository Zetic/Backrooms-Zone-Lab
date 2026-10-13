# Backrooms Zone Lab

Prototype finite zones in the browser and hand them to the Unreal Backrooms Zone Lab as **`backrooms-zone` version 1** files and portable template code. The format follows the owner's [ZoneLabExchange contract](docs/unreal-exchange.md).

Open **`index.html` directly** from the repository folder. No build, server, install, runtime dependency or network is needed. Select **House** or **Level 0**, change the seed and dials, inspect each storey, and export the checked `.zone.json` and its plan. Import files to reopen them; edit the exchange JSON for one-off layouts. A failed change preserves the last accepted plan and disables export.

The [transfer workflow](docs/transfer-workflow.md) explains the handoff. [Seven example zones, eleven plans, the templates and their 120-case reports](docs/exchange-examples/manifest.json) are ready under `docs/exchange-examples/`.

**The Unreal JSON loader is not built yet.** These files target the documented loader contract. The optional integration check realizes the actual exchange layouts through the existing portable Unreal compiler and verifies physical compilation, all joins, Human reach and return, and order independence. It does not implement the runtime loader.

## What crosses to Unreal

- Integer rectangles in **50 cm units**, floor/ceiling/rise in **10 cm steps**, stable semantic ids, theme and role names, feature requests.
- Shared-wall joins with movement modes, required/optional intent, start and uncut entrance opportunities.
- One plain JavaScript file per template, using the exact named uint32 `Templates::Stream` draw, whole-number decisions, complete sort orders and bounded work.
- Browser checks and a **120/120** seed/dial acceptance report per template; plan snapshots and notes on what the format cannot express.

Unreal builds the walls, doors, collision, lights and final usable floors. The lab reports allocation dimensions/area explicitly. It does not export wall solids, materials, meshes or a world graph.

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

## Earlier geometry research

The [geometry studies workbench](gallery.html) preserves the procedural gallery houses, atrium mansions, arbitrary angles/arcs, physical thick walls and 3D viewer. Its **`br.zone` files are a different format** and cannot be imported as rectangular exchange files. Its generation and regression examples remain unchanged. [Study documentation and verification commands](README-studies.md) describe that research separately.

`exchange/stream.js`, `exchange/checks.js` and `exchange/templates/` are portable core. `exchange/plan.js` and `exchange/app.js` handle drawing and interaction. [Current status](docs/status.md) records verification and the remaining integration limits.
