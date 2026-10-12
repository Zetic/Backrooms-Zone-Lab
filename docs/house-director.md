# Phase 3 house director

`house.js` produces finite `generated-house` plans with schema `br.zone/0.3` and generator version 3. The director selects intent and constructs candidates; physical validation reconstructs evidence from actual surfaces, doors, stairs, voids, and walker-clearance paths. An intended adjacency cannot substitute for a missing aperture.

## Input and deterministic search

```js
import { generateHouse } from './src/house.js';
const plan = generateHouse({
  profile: 'atrium-mansion', seed: '1', zoneId: 'procedural-house',
  config: { storeys: 3, floorHeight: 3.2, maxAttempts: 4 }
});
```

Profiles are `gallery-house` (two-storey default) and `atrium-mansion` (three-storey default). Both accept two or three storeys, rises from 2.6 to 4.2 m, and 1–6 attempts. Unsupported parameters reject before synthesis. External door contracts retain the v2 physical interface; at most eight are supported, on floor indices 0–2. A contract for an absent storey is retained and fails realization. Defaults include one incoming reversible primary door and two reversible secondary doors, one upstairs.

The normalized identity includes seed, zone ID, profile, generator version, configuration, and contract-ID-sorted requirements. Named RNG streams isolate each candidate and wing/storey. The candidate RNG key excludes `maxAttempts`: raising the budget extends the same sequence. The full exported input still includes the budget, so its fingerprint changes. Timing, view state, and global `Math.random` are absent from generation.

Each candidate constructs canonical geometry, derives walls/guards, and runs the physical and program validators. Only an error-free candidate is accepted. `localConnections` contains the validator's actual transitions. It is independently checked on replay, rather than used to establish reachability. Construction exceptions become `COMPOSITION_FAILED` rejections; physical failures retain typed error codes and a composition summary.

`generation` records `status`, `attemptsTried`, zero-based `acceptedAttempt` or null, and `candidateFailures`. Exhaustion retains the last constructed candidate (or an empty diagnostic plan if none was constructed), the complete input, and `GENERATION_EXHAUSTED`. Bounded retries do not prove that an impossible request has no solution in all architecture.

## Composition grammar

| Decision | Realized variation |
| --- | --- |
| Main block | Bounded width/depth choices and off-center signature opening |
| Each wing | Direct doors from main hall or a separate shared wing hall |
| Functional program | Optional pantry/utility, library/study, bedrooms/guest rooms/baths/dressing, studio/office |
| Room partitions | Minimum depths plus seeded weighted remaining depth |
| West footprints | Variable widths, rectangles, exact semicircular apses, angled bays |
| Conservatory | Optional canted footprint with actual direct dining passage |
| Signature | Rectangular, circular, or chamfered protected opening and two-storey clear-volume patch |
| Gallery elevation | Floor 2; mansion with three storeys can choose floor 3 instead |
| Vertical circulation | Main core plus optional service core; adaptive core length and separate flights between each floor pair |
| Orientation | 0, −15, 22.5, or 90 degrees applied to all canonical geometry |

This varies room counts, room relationships, door graphs, loop counts, stair counts, and the vertical location of the signature space. Rotation is additional variation: angled rooms and circular geometry exist intrinsically before the global rotation. Profiles share a construction grammar with different ranges/programs/probabilities; they are not independent general layout solvers.

Kitchen–dining and, when present, pantry–kitchen must have direct reversible physical passages. Optional ground-floor west passages and service stairs create further loops. All playable spaces must be accessible from the incoming port and returnable. At least one loop must survive physical reconstruction.

Program entries identify unique rooms, their function, wing, and floor. Validation checks actual role/tags/floor and net area. Minimum areas in m²: kitchen/dining/master/studio 12; living 16; library/bedroom/guestroom/office 10; study/conservatory 8; utility 6; pantry/bath/dressing 4. These are lab grammar bounds, not building-code certification.

## Physical realization

The signature lower hall has an ordinary-height peripheral region and a tall clear-volume patch exactly aligned with the protected void. Its low ceiling and the immediately upper gallery floor retain the actual hole; the high ceiling caps the tall patch. Guards follow the opening edge.

Straight stairs rise in any XY direction and Z. Each flight has a 1.2 m width, 0.28 m tread depth, a maximum intended 0.18 m riser, 1 m terminal landings, individual tread footprints/elevations, and 2.1 m headroom. Supported storey rises resize the core to fit. Every canonical tread, landing, endpoint, shaft, ceiling hole, and guard follows the same orientation. Physical validation reconstructs expected geometry independently and tests headroom/support and reachable landing approaches.

Exact arcs remain in canonical JSON and SVG plans. WebGL-only tessellation cannot alter validation or exports. `Through gallery floor` and `Top floor` resolve actual generated floor indices. Seed/profile/storeys/rise/contracts/search budget survive shared URLs; camera and visibility choices remain outside canonical identity.

## Evidence and limits

The default batch covers 64 seeds per profile. Gallery houses have 60 distinct transition graphs, 13–23 spaces, 1–2 stair flights, and cycle ranks 1–4. Mansions have 64 distinct graphs, 21–34 spaces, 2–4 flights, and cycle ranks 1–6. All three opening shapes and all four orientations occur; mansions place the gallery on both supported upper floors. Every sampled default candidate passes on its first attempt. This demonstrates the bounded grammar and these seeds, not arbitrary constraint coverage.

Eight boundary cases cover both profiles, two/three storeys, minimum/maximum rise, top-storey doors, and an entrance-only primary. Two expected failure cases cover an oversized door and an absent requested storey. Mutation tests independently break semantic adjacency, proportions, signature claims, and diagonal tread geometry. Three generated canonical examples, exact-arc floor diagrams, and cutaways are committed for review.

The walls remain semantic zero-thickness boundaries; slab thickness and stepped stair bodies are represented. Thick-wall solids, structural engineering, runtime collision/player controllers, engine navmeshes, switchback/spiral stairs, curved-wall doors, world pairing, infinite zone graphs, streaming, and portals are deferred. SVG review and Node controller/mesh tests do not establish browser/GPU behavior; automated browser infrastructure is unavailable in this environment.
