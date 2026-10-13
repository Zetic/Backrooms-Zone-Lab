# ResPlan random floor-plan template

Open [ResPlan](../resplan.html), or choose **ResPlan · random real floor plan** in the main Template selector. The page immediately loads a real residential layout. **Random floor plan** changes the selection seed; the same seed, source revision and filters select the same source ID. An optional plan ID pins a layout. Uniform scale, rotation, mirroring and preview ceiling height change presentation without selecting another plan.

The bundled collection has **128 plans sampled from 17,000**, in four lazy JSON shards (about 3 MB total). It works on GitHub Pages or `node scripts/serve.mjs`, with no Python or live dataset connection. Generation and mesh preparation run in a cancellable module worker. Pending/refused changes disable exports and retain the previous drawing.

This is a template for sampling existing architecture. It does not synthesize new layouts or compose residences into the sprawling nonresidential map in the earlier reference.

## Geometry and dimensions

Concave rooms, holes and multipart components are preserved. Each functional polygon becomes a space with a stable category/component ID. Source walls, doors, front doors, windows, stairs and outdoor features remain separate. The template uses contours rather than bounding rectangles; it adds no artificial corridors or room stretching.

Although the upstream README describes metric coordinates, the pinned pickle stores normalized drawing coordinates. For example, plan `14433` has an inner width of 256 source units and reported `area` 120.7739, without a metres-per-coordinate field. This importer explicitly estimates scale:

```
metresPerSourceUnit = sqrt(reported area / source inner polygon area)
metric XY = (source XY - source inner minimum XY) * metresPerSourceUnit
```

This assumes the `area` field is m²; it is **not surveyed geometry**. `net_area` is not used for calibration. Missing/implausible area is refused unless an explicit `--metres-per-unit` override is supplied. Presentation scale multiplies every feature uniformly, including openings and walls.

`sourceRecord` keeps original float64 coordinates. The converter also makes display contours with topology-preserving simplification within **0.1 mm at calibrated scale**. Display coordinates are quantized to 1 µm; consecutive segments shorter than the kernel's 10 µm tolerance are removed. Reflection restores outer/hole winding. Existing-kernel precision diagnostics are recorded; source tracing slivers may trigger them even when original Shapely polygons are valid. They are not silently repaired into different architecture.

## Export and handoff

**Export .resplan.json** writes self-contained `br.resplan-zone/1` source imports:

| Field | Content |
| --- | --- |
| `source` | Source ID, revision, archive SHA-256, attribution, license and modifications |
| `sourceRecord` | Original polygons, optional display contours, origin and calibration |
| `input` | Seed, pin, filters, scale, rotation, reflection and assumed ceiling |
| `spaces` / `features` | Metric display contours with concavity, holes and component IDs |
| `importDiagnostics` | Source-only state, precision issues and uncompiled assumptions |
| `fingerprint` | Replay identity of source, record and controls |

Reimport regenerates geometry and diagnostics from the embedded record. Edited preview geometry or claimed physical validity are discarded. The collection is not required to reopen an export. Shared page URLs include the selected source ID; custom collections must be loaded again to use their IDs. SVGs embed provenance and include visible attribution and an **estimated m** scale bar.

This distinct source format is **not an accepted `br.zone/0.4` or rectangular exchange zone**. Door widths, clearances, source artefacts, guards, ports and stairs need a physical compiler. Window relations and room adjacency are never promoted into movement connections. The 3D preview extrudes source polygons with assumed height, 2.1 m lintels and 0.9 m window sills; source stairs stay flat. Unreal collision and walkability have not been verified. A future adapter should compile the actual contours and openings, then validate them.

## Convert or refresh the collection

Only conversion needs Python, `numpy` and `shapely>=2`:

```sh
python -m pip install numpy 'shapely>=2'
git clone https://github.com/m-agour/ResPlan.git /path/to/ResPlan
git -C /path/to/ResPlan checkout e2b78fe069aee1ab1e1828a612743f308e3c32a7

# Reproduce the bundled sample: 128 plans, seed 5058, 32 per shard.
python scripts/convert-resplan.py /path/to/ResPlan/ResPlan.zip \
  --revision e2b78fe069aee1ab1e1828a612743f308e3c32a7 --output data/resplan

# Convert all eligible records into a separate local collection.
python scripts/convert-resplan.py /path/to/ResPlan/ResPlan.zip \
  --revision e2b78fe069aee1ab1e1828a612743f308e3c32a7 \
  --count 0 --shard-size 256 --output /path/to/resplan-full
```

Use **Load converted collection folder** to select `resplan-full`. Only the selected shard is read, with a four-shard cache; the browser never reads the pickle. Catalog/shard schemas, IDs, coordinate budgets and shard SHA-256 are checked. Keep catalog and shards together. Catalog filenames are restricted to `plans-NNNN.json`. The full collection can be large; it is not included in this repository.

The converter reads the geometry-only pickle/ZIP with a restricted unpickler allowing only Shapely's WKB decoder and NumPy scalar/dtype constructors. It does not execute upstream utilities. Invalid polygons, unsupported geometry, missing scale or oversized records are refused and recorded. Sample mode replaces refused records to reach the requested count; full mode reports its actual accepted count. `--metres-per-unit 0.05` overrides area calibration. Repeat `--exclude-id ID` for removed source IDs. Refresh into a new folder, then replace catalog and shards together.

## License and verification

Adapted from [m-agour/ResPlan](https://github.com/m-agour/ResPlan), **The ResPlan Authors**, commit `e2b78fe069aee1ab1e1828a612743f308e3c32a7`, under **CC BY 4.0** within the scope of the upstream [LICENSE](https://github.com/m-agour/ResPlan/blob/e2b78fe069aee1ab1e1828a612743f308e3c32a7/LICENSE). A [license copy](../data/resplan/LICENSE.txt) is bundled. Changes: JSON conversion, explicit scale calibration, display cleanup and presentation transforms. The converter/template are newly written; no upstream utility implementation is vendored.

Retain attribution, source ID, license link and modifications when redistributing. Follow the upstream [takedown policy](https://github.com/m-agour/ResPlan/blob/e2b78fe069aee1ab1e1828a612743f308e3c32a7/TAKEDOWN.md); exclude removed IDs and refresh when the release changes.

```sh
node --test tests/resplan*.test.js
npm run examples:resplan
npm run build
```

Tests cover the bundled records, shard hashes/loading, replay, filters, concavity/holes/reflection, malformed input, reimport regeneration, worker cancellation and finite preview buffers. [Nine actual source layouts](resplan-examples/nine-plans.svg) show the architectural variation.
