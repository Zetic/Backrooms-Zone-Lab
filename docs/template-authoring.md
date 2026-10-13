# Make a new zone template

The local Unreal Zone Lab's House v2 establishes the method: **program → composition and circulation → required openings → physical validation → architectural rules**. A template makes a whole finite zone from an explicit seed and a small set of dials. Start with a recognizable archetype; dials deliberately relax its conventions. A preset is a bookmark of dial values, not a separate generator.

The browser now implements this method in `exchange/method.js`, with House v2 as the worked example. The full geometry prototype remains a valid design handoff; the checked rectangular page is the first realized subset. Curves or other missing capabilities must remain in the exported design and guide Unreal work; see [design handoff](design-handoff.md).

## Start tomorrow

1. Copy [template-starter.js](template-starter.js) to `exchange/templates/office.js`. Rename its `starter` binding, references and `id` to `office`, and choose a name and explicit version. Use a simple lowercase JavaScript identifier for the template binding/id; space ids may contain hyphens.
2. Load the new file after `stream.js`, `checks.js` and `method.js` in `index.html`. Add the same import in `scripts/exchange.mjs`. Registration makes its dials and presets appear automatically; it enters the 120-case acceptance and 40-case strict audits automatically.
3. Define the program: what spaces exist, their semantic roles, normal counts and relationships. Choose a few dials that explain the architecture, rather than an independent random knob for every dimension.
4. Build an accepted composition and its circulation. Plan usable approaches before making required joins. Use bounded alternatives or reject with a named reason; never discard a required edge to make a result pass.
5. Write the archetype's rules in `rules(zone, dials)`. State precisely which dial and threshold permits each convention to break. An empty rulebook is valid for a template that has none yet; do not copy house-specific rules into unrelated archetypes.
6. Compare seeds at fixed dial settings and inspect complete journeys. Run `npm test`, `npm run batch:exchange` and `npm run build`, then the portable Unreal check when its sources are available. Walk selected layouts in Unreal after importing or porting them.

The starter is runnable: an arrival room, work room and store. Ordinarily storage opens from arrival; at Strangeness 50 it opens from the work room instead. Both variants retain real shared walls and required connectivity. Tests audit all 120 configurations and verify that the changed convention is reported as permitted.

## The template contract

Metadata: `id`, `version`, `name`, `summary`, `dials`, optional `presets`, `attempts` and `workLimit`. Each dial records `id`, `name`, `help`, `low`, `high` and its default `value` (0–100). A preset supplies a complete dial map.

`make(spec)` calls `api.generateTemplate(template, spec, build)`. The attempt's build callback gets validated `seed`, `dials`, `attempt`, `pick(name, lo, hi)`, `chance(name, percent)` and `step(n)`. The shared seed derivation and named draws match the local Unreal House. Call `step` during searches, retries and recursion; also give loops and recursive depth explicit local bounds. House has 16 attempts, 20 placement tries per hall item, one level of side-hall recursion and a 20,000-step budget. Generation returns a zone or an explicit error; it never changes the last accepted UI plan.

Separate program, geometry, connections and presentation decisions with meaningful draw names. Do not read the DOM, time, UI selection, another template's state or global random state. Work with integer 50 cm plan units and 10 cm heights for version 1. Match C++ integer division explicitly with truncation where needed. Sort outputs with complete, locale-independent comparisons. Keep identity roles stable; an accepted revision changes provenance rather than reinterpreting an old generator.

`api.rule(id, name, kept, detail, relaxations, dials)` produces the rule report. A relaxation is `{dial: 'strange', name: 'Strangeness', at: 50}`; multiple entries mean any one can permit the break. A rule with no relaxations is always required. A permitted rule **may** break; it need not break for every seed. Reports distinguish kept, broken, permitted, failure detail and the permitting threshold. The method rejects a broken rule with no applicable permission.

Rule reports are regenerated from the accepted zone and recorded dials. Version 1 exchange files now embed them in optional `rules`, as well as check reports and handoff manifests. Canonical JSON sorts reports by id; they do not alter physical geometry or the portable compiled digest. Known imports/edits recompute them; unknown reports remain explicitly unverified. They are shown for edited/imported current-version designs as well. An older generator version remains a fixed import; the new template must not claim to regenerate it. The previous browser House v1 source is archived in `template-reference/house-v1.js`.

Physical checks always run first. `generateTemplate` defaults to the version 1 exchange validator; its fourth argument can supply a physical validator for another representation, returning `{valid, errors}`. The shared method preserves that representation and evaluates its rules with the requested dials. This extension point does not add a full-geometry import UI or establish new Unreal geometry support. Dials never permit overlap, invalid stairs, blocked required passages or loss of Human reach/return. Browser topology checks remain preliminary; Unreal's compiler and walking tests establish actual clearance, support and movement. For a richer geometry template, preserve the original representation and use its physical validator and a dedicated adapter; do not flatten it to satisfy version 1.

## House v3 and archived v2 reference

House v3 uses Size, Sprawl, Cohesion, Room Count and Strangeness and the six local presets: Suburban, Family home, Ranch, Rambling, Not quite right and Backrooms house. `template-reference/ZoneLabHouse-v2.cpp` snapshots the local source used for this port. The native C++ source and [archived browser v2](template-reference/house-v2.js) remain historical parity references. Current House v3 requires a native generator port for parity; the optional physical compiler check can still consume its rectangular exports. [Cohesion](cohesion.md) describes the new interaction.

Sprawl grows a wing at 30, moves the main bedroom downstairs at 40, turns the wing at 48, and switches from two storeys to one at **55**. This is a deliberate grammar switch. High sprawl adds turning halls and single-sided stretches; it is not a guarantee of a continuously increasing floor area.

Strangeness changes proportions from 20; hall excess from 30; branches and compactness/loop permissions from 40; repetition from 50; empty branches from 55; room-placement/privacy conventions from 70; extra bedrooms from 75; possible duplicate kitchens/living rooms from 80; bedroom chains and unstacked ceiling variation from 85. A failed placement can choose another bounded alternative or attempt, so a small dial change may change the whole accepted layout.

| House rule | Permission to break |
| --- | --- |
| Front entrance opens into an entry hall | Never |
| Stair starts in circulation and arrives at a landing | Never |
| Living, dining and kitchen are on the ground floor | Never |
| Kitchen opens onto dining | Strangeness 70 |
| Living and dining are adjacent or share a hall | Strangeness 70 |
| Bedrooms open from circulation | Strangeness 85 |
| Bedrooms stay away from entry/shared-room entrances | Strangeness 70 |
| Family bathrooms open from circulation, not shared rooms | Strangeness 70 |
| Ensuite opens only from the main bedroom | Strangeness 70 |
| One kitchen/living room, suitable bathroom counts | Strangeness 50 |
| Role-appropriate room sizes and proportions | Strangeness 20 |
| Halls occupy no more than 25% of floor allocation | Sprawl 30 or Strangeness 30 |
| Halls do not end with no onward room | Strangeness 40 |
| Ground-floor rooms fill at least 70% of their bounds | Sprawl 30 or Strangeness 40 |
| Ground floor has a circulation loop | Sprawl 55 or Strangeness 40 |

The house's rooms are still plain rectangles; Strangeness does not currently activate curved interiors. Stairs are ramps. Semantic roles stay in the exchange data: the loader's finish mapping should recognize `main → bedroom`, `ensuite/wc → bath` and `utility/store → storage`, while preserving their architectural identities.

## Evidence for a new template

Keep the separate 40-case strict audit (every rule kept, all dials zero unless a dial declares `strict`), the 120-case acceptance matrix (seeds 1–40 at defaults, all dials 10, all dials 90), same-input repeats, reversed-list/round-trip canonical exports, and tests that exercise every relaxation threshold and required convention. Add mixed-dial sweeps: setting all dials high or low cannot establish their interactions. Test the named presets, exhaustion of search bounds, negative coordinates/heights and actual physical transitions where used.

Export template source, `stream.js`, `checks.js`, `method.js`, accepted layouts, plans, notes and rule reports together. The browser template download includes its metadata, presets and rule evaluator. It needs all three shared files, including `method.js`.

With the local source and MSVC, use:

```powershell
npm run verify:unreal -- --core=C:/Dev/Backrooms/Source/Backrooms/Workshop --lab-parity=true
```

Without the local ZoneLab v2 sources, omit `--lab-parity=true` to verify compilation and Human traversal against the portable compiler alone. This harness is verification tooling; the runtime JSON loaders are still to be built.

The exchange subset can also preserve a space’s optional `outline` as design data. Follow the path/arc convention in [the exchange contract](unreal-exchange.md#browser-implementation-notes--october-13-2026); actual Unreal outline realization remains adapter work. Compare nine seeds at intermediate dial settings and export preset gallery pictures for the handoff.

Maximum cohesion is a geometry-derived rule, not a label attached to the chosen dial. Office checks consecutive room partitions and the requested departmental program count; House checks that every room shares a room partition. Strict audits set Cohesion to 100 explicitly.
