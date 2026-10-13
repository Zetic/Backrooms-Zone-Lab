# Offices

Select **Offices** in the default workbench. The **Standard office** preset generates reception and visitor meetings at the front, a circulation loop around shared services, and staff workplaces outside the corridors. Washrooms, a break room, a copy room, a server room and a supply store form a clear support group. The start and visitor entrance belong to reception; a staff entrance is recorded where a free stretch of the rear wall allows it.

This is an architectural room/circulation prototype. The rooms have stable functional roles; furniture and detailed presentation can follow. It uses the current rectangular exchange subset and the existing Backrooms finish fallback. It does not alter the retained full geometry workbench or require future office designs to stay rectangular.

## Dials

| Dial | Effect |
| --- | --- |
| Size | Five to eight workplace/service bays, with larger room allocations as it rises |
| Openness | Private offices become workplace bays; neighbouring open bays join without walls. Direct corridor access remains unless Strangeness permits a chain |
| Sprawl | A department wing at 35, a turning second leg at 65, a third at 85. Turns fit against actual accepted footprints and preserve useful gaps |
| Strangeness | Progressively permits elongation, excess circulation, interrupted loops and empty corridor ends, repeated support rooms, misplaced functions, room-to-room access and ceiling changes |

Each result comes from the seed and these four dials. A preset supplies dial values rather than another generator. The six starting points are Standard office, Private practice, Open workplace, Department wings, After hours and Wrong workplace. The first four keep every architectural rule when Strangeness is zero. Sprawl alone creates a larger but still understandable workplace.

## How it becomes wrong

At 20, proportions may stray. At 30, corridor widths and empty stretches may grow. At 40, an unexpected wing can appear, the circulation loop can be interrupted and a hall can run beyond the last room. At 50, support rooms can repeat. At 65, meeting rooms can appear inside staff areas and a server room can take a visitor-facing position. At 75, workplaces can be reached through other workplaces. At 85, ceilings may vary between rooms.

A permission is not a demand: different seeds may keep different conventions at the same dial setting. Before a later permission is reached, earlier mutations preserve that rule. In particular, repeating rooms at 50 does not move meeting rooms into staff areas before 65, and moving the server room preserves the supply store.

**Wrong workplace** combines high Sprawl and Strangeness. Seed 1 keeps six of the sixteen rules: the workplace still has reception, essential functions and a usable connected floor, but conventional access, proportions, circulation and repetition have changed. The sidebar names each broken convention and the threshold that permits it. **After hours** provides an intermediate comparison.

## Architectural rules

These are this template's conventions, distinct from the physical validator.

| Rule | Permission to break |
| --- | --- |
| Start belongs to reception | Never |
| Visitor entrance opens into reception | Never |
| Workplaces and all five shared services exist | Never |
| Visitor meetings open directly from reception | Strangeness 65 |
| Reception connects to meetings/circulation, not staff services | Strangeness 65 |
| Each workplace opens from circulation | Strangeness 75 |
| Shared services open from a corridor | Strangeness 65 |
| One clear group of shared services | Strangeness 50 |
| One to three meeting rooms | Strangeness 50 |
| Work/meeting rooms have conventional proportions | Strangeness 20 |
| Corridors occupy no more than 30% of floor allocation | Sprawl 35 or Strangeness 30 |
| Corridor widths remain at 2–2.5 m | Strangeness 30 |
| No empty corridor end beyond the last room | Strangeness 40 |
| Circulation has a loop without crossing workplaces | Strangeness 40 |
| Consistent ceiling heights | Strangeness 85 |
| The office occupies one floor level | Never |

All planned joins are required. The generator either fits the complete candidate or reports a named failure; dials do not permit overlaps, disconnected rooms, loss of Human reach/return or an invalid opening. A wing tries two complete orientations and rolls back a rejected proposal without moving accepted architecture. Twelve bounded attempts and a 12,000-step budget limit work.

## Examples and transfer

The handoff includes three office examples: [Standard office](exchange-examples/offices-1.zone.json), [Open workplace](exchange-examples/offices-1-open.zone.json) and [Wrong workplace](exchange-examples/offices-1-wrong.zone.json), each with a floor plan and diagnostic rules in the [manifest](exchange-examples/manifest.json). Their fixed ids/names identify the review examples; source seed/dials reproduce their geometry.

`source.template` is `offices-v1`, distinct from exchange schema version 1. Export `offices.js` with `stream.js`, `checks.js` and `method.js`. Semantic roles and original design intent cross to the future Unreal loader; named convention reports are now embedded in optional `rules` as well as the manifest; they do not change physical geometry. There is no local C++ Office generator or runtime JSON loader yet. The physical integration check compiles the exported room and opening data through the existing portable core.

Validation covers 120 acceptance configurations, all presets across multiple seeds, 256 mixed configurations at every dial threshold, repeatability, list order, translated coordinates/heights, physical refusal, and downloaded-template/controller round trips. The native check covers 164 cases: 120 Office configurations, 36 mixed cases, six presets, a negative-coordinate/height Office and the documented flat. Every join is accepted, Human outward/return traversal passes, compiled digests ignore listing order and all six stream draws match.

```powershell
npm test
npm run batch:exchange
npm run build
npm run verify:unreal -- --core=C:/Dev/Backrooms/Source/Backrooms/Workshop --templates=offices
```

`--templates` restricts the optional native harness to the named comma-separated template ids; omit it to include all templates. To create another archetype, follow [template authoring](template-authoring.md).
