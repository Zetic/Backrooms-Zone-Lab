# Carry the prototype design into Unreal

The owner's clarification on October 12, 2026 sets the direction: the browser prototypes the desired architecture, and transfer into the Unreal Zone Lab identifies what the importer or portable compiler needs next. Current engine or exchange-schema limits must not silently erase a chosen design.

## Preserve the design

The house full geometry workbench at `gallery.html` exports canonical `br.zone` JSON and a validation report. Keep that original file, its schema/generator versions, seed, profile, configuration and stable identities. It records line/arc footprints, wall and opening geometry, floors, voids, stairs and connections where the selected generator supplies them. Include the generator source and its local module dependencies, plans or screenshots, and notes on the qualities to preserve.

The rectangular page at `index.html` exports `backrooms-zone` version 1 and portable House/Level 0/Office templates. Optional outlines preserve design paths inside rectangular bounds; optional embedded rules record architectural diagnostics. Outlines still require an adapter and do not replace the richer `br.zone` contract. House v2 carries the local program/spine method with explicit rule relaxation; see [template authoring](template-authoring.md). This subset has 440 layouts checked against the portable C++ core, with House geometry/join parity against the local generator. Neither workbench has an Unreal runtime JSON loader yet. A valid browser export preserves a design; it does not establish that its Unreal realization is already implemented.

Do not rename `br.zone` as a version 1 exchange file or flatten its curves into rectangles to pass those checks. Keep a derived compatibility layout separate, with any deliberate design changes recorded and reviewed.

## Assess capabilities against the chosen prototype

| Prototype feature | Current evidence | Transfer work |
| --- | --- | --- |
| Rectangular rooms, joins and ramps | The version 1 harness validates the generated sample matrix against the portable core | Build the version 1 loader and walk imported zones |
| Round interiors | `TemplateRecipes.cpp::shapeInterior` builds faceted round faces as solid corner fills inside a square, leaving straight doorway flats | Map compatible intent deliberately; assess arbitrary arc footprints separately |
| Openings on curved faces | The shaped-interior connection path uses straight boundary flats; it does not establish curved-face door cutting | Preserve the requested opening and report the gap; implement and test it when a chosen prototype needs it |
| Arbitrary angles/arcs, gallery voids and explicit wall bodies | Preserved by the full geometry browser contract, but not represented by rectangular exchange version 1 | Add a dedicated adapter and the core geometry, ownership, clearance and support contracts required by the selected design |
| Materials and presentation | Browser design data may carry material assignments and UV intent | Bind to Unreal assets while preserving accepted physical geometry |

The existing round-interior recipe is evidence of curved architectural intent in the core. It is not evidence that every browser arc, wall body or opening already transfers directly. The rectangular file schema's restriction is also not evidence that Unreal cannot build curves.

## Resolve a transfer gap

For each selected prototype, compare its exported geometry and movement requirements with the importer and compiler. Report missing capabilities by stable space, edge, wall or opening identity, with the original requested geometry and the physical failure reason. Distinguish data that is represented, data the importer can read, geometry the compiler can realize, and movement verified in Unreal.

Extend the importer and portable compiler for the useful design, keeping determinism, canonical geometry, shared ownership, clearance, collision and Human outward/return traversal intact. A moved door, simplified curve or altered stair is a design change to review, not an unnoticed import repair. Required connections remain required; a blocker is reported rather than silently discarded.

Transfer fixed layouts first so they can be inspected and walked. Port the generator after that geometry contract is accepted, preserving explicit versions, stable identities, seed/dial decisions and bounded work. Compare representative seeds and complete journeys in Unreal. Keep the original prototype available throughout that process.

Office v2 has a dedicated `office.html` workbench with actual rotated clear floors, wall bodies and supported apertures. Preserve its full `br.zone/0.4` files. Its separately generated rectangular exchange is not an approximation to substitute for the angled design.
