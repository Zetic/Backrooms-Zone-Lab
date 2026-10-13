# Sprawl, Cohesion and Room Count

Office v3 and the rectangular House v3 template solve these controls together. Size sets room capacities; Room Count supplies the program; Sprawl arranges it into longer branches; Cohesion controls the amount of unallocated spacing between rooms.

| Setting | Outcome |
| --- | --- |
| High Sprawl, high Cohesion, few rooms | Shorter populated branches; no extra room size is invented to satisfy reach |
| High Sprawl, high Cohesion, many rooms | Longer populated branches with shared room partitions |
| High Sprawl, low Cohesion | More separation and single-sided or dispersed stretches |

The controls are integer values from 0 to 100. Cohesion 100 is an enforced shared-wall condition. Intermediate values reduce gaps in whole grid steps. Circulation, necessary junction clearances and exterior space between wings remain intentional. Different room depths can shape the exterior; Cohesion does not stretch rooms into a common envelope or close every courtyard.

## Program quantity

- **Offices:** Room Count selects 4–14 department rooms per wing. Five/six-wing layouts cap this at 8 per wing to stay within the zone's 128-space limit. Reception, shared services, circulation, exits and the full design's shared core are additional spaces. Sprawl shifts the available room allocation toward a longer row; at minimum room count the row distribution stays compact even at maximum Sprawl. Room dimensions use role, Size, Openness, Strangeness and named seed draws, independently of Cohesion. Increasing Cohesion never stretches a matching department room.
- **House:** Room Count supplies the normal bedroom program and additional study/den rooms. Family/study/dining/suite requests now use this control rather than Size. Mandatory household facilities, optional fits and Strangeness affect the final total. The single-storey branch budget is capped at `1 + floor(Room Count / 25)`; Sprawl can request fewer branches, and physical acceptance can choose another bounded candidate. Maximum Cohesion suppresses room-row gaps, empty side halls and collision-driven gaps between consecutive rooms, and requires every room to share a partition with another room.

The House grammar retains its two-storey/single-storey transition at Sprawl 55. Branching is not a promise of monotonically increasing bounding-box area. More rooms supply actual branch reach instead of inflating individual room dimensions.

## Same-seed comparisons

These checked rectangular plans all use seed 7, Size 60, Sprawl 100 and Strangeness 0. Offices has two wings and Openness 35. The files contain complete dial settings and recomputed rule reports.

| Template | Few rooms, cohesive | Many rooms, cohesive | Many rooms, dispersed |
| --- | --- | --- | --- |
| Office | [Plan](cohesion-examples/offices-few-cohesive.svg) | [Plan](cohesion-examples/offices-many-cohesive.svg) | [Plan](cohesion-examples/offices-many-dispersed.svg) |
| House | [Plan](cohesion-examples/house-few-cohesive.svg) | [Plan](cohesion-examples/house-many-cohesive.svg) | [Plan](cohesion-examples/house-many-dispersed.svg) |

[Manifest and partition metrics](cohesion-examples/manifest.json). Run `npm run examples:cohesion` to reproduce the six plans and exchanges.

## Workbenches and identities

The controls are available for House and Offices at `index.html`, and for the angled full Office at `office.html`. The independent gallery-house/atrium-mansion director at `gallery.html` retains its existing storey/geometry controls and generator identities; it has no Sprawl dial.

Current portable identities are `house-v3` and `offices-v3`; the full Office input also uses generator version 3. Exchange schema version 1 and full schema `br.zone/0.4` are unchanged. [House v2](template-reference/house-v2.js) and [Office v2](template-reference/offices-v2.js) are archived with their original identities. Older imports remain fixed designs and their unavailable evaluators remain unverified.

Full Office synthesis, wall unions, navigation checks, SVG creation and 3D mesh packing run in a cancellable module worker. While a request is pending, the accepted view remains visible and downloads disable. Only the latest successful request replaces it. Cutaway changes request/cache prepared meshes rather than rebuilding geometry on the UI thread. Environments without Worker support retain a synchronous fallback. Serve `office.html` over HTTP or static hosting.
