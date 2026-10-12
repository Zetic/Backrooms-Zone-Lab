# Zone plan contract — br.zone/0.1

This provisional version captures the Phase 1 geometry studies. It is an engine-independent JSON contract, not an Unreal/Unity/Godot asset description. Additive and breaking changes will be versioned as real architectural composition is introduced.

## Identity and canonical export

`kind` is `geometry-study`; it must not be interpreted as a playable house. `zoneId` and `input` identify the complete request: string seed, generator version, profile, configuration, and explicit external-port requirements. Required contracts are sorted by `contractId` before generation. Their list order has no semantic meaning.

Object keys are lexically sorted. Array order is retained. Only finite JSON values are accepted; negative zero exports as zero. `fingerprint` is a 16-digit FNV-1a 64-bit hash over UTF-8 canonical JSON of the plan **without** its fingerprint property, including its deterministic diagnostics. It is a reproducibility checksum, not a security primitive. Time, browser view state, and generation duration are not serialized.

Geometry is rounded to a 0.000001 metre/degree quantum; predicates use a 0.00001 metre tolerance. JavaScript generation is authoritative in this phase. Cross-language equivalence is not promised until verified implementations or a shared generator exist.

## Geometry

| Entity | Representation |
| --- | --- |
| Point | `[x, y]`, metres |
| Line | `{ "kind": "line", "from": [x,y], "to": [x,y] }` |
| Arc | `{ "kind": "arc", "center": [x,y], "radius": r, "startDeg": a, "sweepDeg": s }` |
| Footprint | `{ "outer": [edges], "holes": [[edges], ...] }` |
| Space | Stable ID, role/tags/label, floor index, elevation, clear height, footprint, `playable: false` |
| Floor surface | Stable ID, owning space, elevation, exact footprint |
| Protected void | Stable ID, footprint, half-open vertical range `[minZ, maxZ)` |

Horizontal X/Y and vertical Z form a right-handed frame. Positive angles turn counterclockwise in XY. The outer ring is counterclockwise, holes clockwise. All rings close within tolerance. Arc sweeps satisfy `0 < abs(sweepDeg) <= 180`; a full circle uses two 180-degree arcs. Exact arcs remain in the export; a realizer may tessellate them for its own rendering.

The current spaces are constant-height extrusions. Slabs are semantic zero-thickness walkable surfaces; thickness, wall solids, ceilings, guards, and stairs are subsequent contract extensions.

## External requirements and realizations

Each input contract supplies:

```json
{
  "contractId": "required-upper",
  "portId": "port-upper",
  "role": "secondary",
  "family": "door",
  "direction": "reversible",
  "floorIndex": 1,
  "width": 1,
  "height": 2.2,
  "approachDepth": 1.2
}
```

Role (`primary`/`secondary`) is independent from direction (`reversible`/`entrance-only`/`exit-only`). Phase 1 accepts at most eight door contracts on floors 0 or 1. Unsupported families and floors fail explicitly. Contract/port IDs must be unique. Dimensions must be finite and positive, at most 20 m. The input is retained even when realization fails.

Realized ports preserve the contract properties and reference an `owningSpaceId` and actual `openingId`. An opening references a straight outer-ring `edgeIndex`, center `[x,y,z]`, boundary tangent, width, and height. The port anchor contains position, outward forward vector, up vector `[0,0,1]`, and `usableApproachSide: interior`. Its rectangular `approach` footprint extends inward from the threshold for the required depth. Host placement, dimensions, frame consistency, containment, and space clear height are checked independently of stored validation flags.

Selection is deterministic: sorted contracts, semantic space order, then boundary edge order. There is at most one port per straight edge. Curved-wall ports, non-door families, and alternative search/repair are not implemented. A failure is reported as `PORT_UNREALIZED`, never silently omitted from requirements.

Only the **local interior approach** is checked. Remote arrival geometry and world edge pairing are intentionally unspecified. `validation.zoneReachability` is `not-evaluated`.

## Diagnostics and future fields

`diagnostics.status` is `geometry-valid` or `invalid`. It does not certify a navigable building. Errors carry a code, entity reference, and readable message; warnings identify unimplemented navigation. Metrics include floor/space/arc counts, requested/realized ports, and net footprint area.

`localConnections` and `verticalTraversals` are empty arrays in this version. Consumers must not infer connections from touching specimens, identical floor indices, or a successful geometry status. Future physically validated transitions will populate these fields.
