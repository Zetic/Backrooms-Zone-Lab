# JavaScript Zone Lab: what it needs to hand zones to Unreal

October 12, 2026. A trial, like the Unreal Zone Lab it feeds (`Source/Backrooms/Workshop/ZoneLab`).

**Owner clarification, October 12:** Prototype the intended architecture and preserve it in the handoff. The rectangular version 1 path below is the first checked transfer subset, not a design ceiling. Full geometry prototypes keep their original line/arc, wall, opening and traversal data for a dedicated adapter and any needed Unreal core extensions. Transfer gaps should guide work in the Unreal lab; geometry or required connections must not be silently simplified or dropped. The core already builds faceted round interiors with straight doorway flats; this does not establish arbitrary arc-footprint or curved-face opening support.

## Purpose

The browser lab is a fast place to invent zone layouts; Unreal stays the place that builds walls, doors, collision and lighting. The lab is useful only if what it produces can be taken into the Unreal Zone Lab without being redrawn by hand.

It hands back two things:

1. **Zone files** (`.zone.json`): one finished layout each, as rectangles and the connections between them. Unreal takes these in as fixed zones to walk. This is the quick path and the one to get working first.
2. **Template code** (one `.js` file per template): the generator that makes zones from a seed and dials, with its rules and presets. These are ported to C++ so the game can make endless variations. That only works if the code follows *Writing a template*. A template may have any dials it needs; the Unreal house (below) is the worked example.

This page is self-contained. Whoever builds the lab does not need the Unreal project.

The Unreal loader for version 1 zone files is not built yet. It will be written against this page, so the format below is the contract for that subset on both sides. The worked example has been run through the current compiler. Broader prototypes retain their own versioned design data until an adapter and any necessary compiler capabilities are built and verified.

## The model: what a zone is

A version 1 exchange zone is a set of rectangles on a grid plus a list of which rectangles connect. For this path, Unreal works out every wall, door frame, ceiling, light and collision box itself. This representation does not cover every intended prototype or every geometry capability already in the core.

- **Space**: one rectangle a player would name (a kitchen, a hallway, a pillar room). It has a floor height and a ceiling height. Spaces tile the ground edge to edge; the wall between two spaces is implied by their shared edge and has no rectangle of its own.
- **Join**: a request that two spaces sharing a wall be connected, and how (a door, a wide opening, no wall at all). Two spaces with no join between them get a solid wall.
- **Stair**: a special space that starts at one floor height and ends at another.
- **Entrance**: a stretch of the zone's outer wall where a connection to another zone could later be cut.
- **Start**: where a player is put down.

A zone has no position in the world and no fixed height. It is built in its own coordinates, and Unreal places it wherever a connection needs it.

The rectangular exchange page uses allocations and joins rather than explicit wall solids, door swings or wall segments. A full geometry prototype may use lines, arcs and wall bodies: preserve them in its design export and implement a suitable Unreal adapter instead of treating the design as non-transferable.

## Grid and geometry rules

These are the rules of the currently checked version 1 exchange subset. The exchange page must hold to them and check them (see *Checks before export*). A full geometry design outside this subset needs capability assessment and implementation during transfer, not automatic design rejection.

| Rule | Value |
| --- | --- |
| Plan unit | 1 unit = 50 cm. Every rectangle corner is a whole number of units. |
| Axes | x runs east, y runs north. Rectangles are `[x0, y0, x1, y1]` with `x1 > x0` and `y1 > y0`. Negative coordinates are allowed. |
| Rotation | Version 1 allocations are axis-aligned. Arbitrary angled or curved outlines remain in the full geometry handoff. |
| Heights | Centimetres, in steps of 10. A floor height may be negative. |
| Room size | Each side 3 to 40 units (1.5 m to 20 m). |
| Ceiling | 200 to 800 cm above the space's own floor. |
| Walls | 15 cm thick, centred on the shared edge. The lab never draws them; it only needs to know that a 3-unit room is about 1.35 m clear inside. |
| Overlap | Two spaces may not overlap in plan unless they are stacked clear of each other (next row). Touching edges is not overlap. |
| Stacking | One space may sit above another when its floor is at least the lower space's floor + ceiling + 40 cm. A 250 cm ceiling needs storeys 290 cm apart. |
| Size of a zone | At most 128 spaces and 256 joins. Any plan size within that. |
| Gaps | Ground covered by no space is solid. Gaps are fine and useful: they read as thick walls or blocks to walk around. |

Two spaces *share a wall* when an edge of one lies on an edge of the other and the two edges overlap along their length. The length of that overlap, in units, is the **shared stretch**. It decides which joins are possible.

## Spaces

Every space has a `kind`, which is what the plan colours by and what Unreal builds.

| Kind | What it is | Size limits |
| --- | --- | --- |
| `room` | A place a player would name. | Each side 3 to 40 units. |
| `hall` | Circulation: a hallway, a landing, an entry. Built exactly like a room; the kind only labels it. | Each side 3 to 40 units. |
| `stair` | Joins two floor heights. See *Vertical pieces*. | Width 3 to 8 units; length set by its rise. |

**Theme.** A zone names one theme, and a space may override it. A theme sets the default ceiling, the door head and the finishes. Two exist today:

| Theme | Default ceiling | Door | Looks like |
| --- | --- | --- | --- |
| `backrooms` | 270 cm | 100 cm wide, 220 cm head | Yellow walls, carpet, panel lights |
| `residential` | 250 cm | 100 cm wide, 210 cm head | Painted walls, skirting, a ceiling light in each room |

A new theme is welcome: give it a name and describe it in the zone's `notes`. Unreal falls back to an existing one until the new look is built.

**Role.** What a space is for. Rules are written against roles, so give every space one. The roles the Unreal house uses:

| Role | Title | Kind | Finish in `residential` |
| --- | --- | --- | --- |
| `entry` | Entry hall | hall | wood |
| `hall`, `backhall`, `landing`, `uphall` | Hallway, Back hall, Landing, Upstairs hall | hall | wood |
| `stair` | Stairs | stair | wood |
| `living`, `dining`, `family`, `study`, `den` | Living room, Dining room, Family room, Study, Den | room | wood |
| `kitchen` | Kitchen | room | tile |
| `bath`, `ensuite`, `wc` | Bathroom, Main bathroom, WC | room | tile |
| `bedroom`, `main` | Bedroom, Main bedroom | room | carpet |
| `closet` | Walk-in closet | room | carpet |
| `utility`, `store` | Utility room, Store room | room | store-room floor |

Roles in `backrooms` change nothing visible yet. A role the lab invents (`garage`, `office`) is kept and ignored until Unreal has a finish for it; say what it is in `notes`.

**Title.** Free text shown to the player and on the plan ("Main bedroom"). Titles need not be unique; ids must be.

**Features.** Things standing inside a room. The lab asks for them by tag; Unreal decides exactly where they go from the space's seed. The lab may draw them as a hint but must not depend on their position.

| Feature | Values | Use when |
| --- | --- | --- |
| `shape` | `rect`, `L`, `T`, `U`, `ring` | Both sides at least 8 units; `ring` at least 12. The room keeps its rectangle for fitting; the cut-away part becomes solid. |
| `columns` | 0, 1 (grid), 2 (dense grid) | Narrow side at least 10 units. |
| `divider` | true / false | A partition across the room with a gap to pass. |
| `screen` | true / false | A short wall just inside one entrance. |

A shaped room no longer touches all of its rectangle's edges, so a join on the cut-away side can fail. Use `rect` for any room whose joins must not fail, such as the start room and anything a stair opens onto. Nothing may stand within 110 cm in front of an opening; Unreal moves an opening along the wall to find clear floor, and refuses the join if there is none.

## Connections

A join names two spaces and a mode. Unreal cuts the opening somewhere on their shared wall; the lab chooses the mode and may suggest a position.

| Mode | What is built | Shared stretch needed | Floors |
| --- | --- | --- | --- |
| `door` | A framed doorway 100 cm wide. | 4 units (2 m) | Equal |
| `wide` | A framed opening 300 cm wide, or 200 cm where 300 does not fit. | 8 units for 300 cm, 6 units for 200 cm | Equal |
| `open` | No wall along the whole shared stretch; the two spaces read as one. | 2 units | Equal |
| `climb` | A ledge to pull up onto or step down from. Two way. | 4 units | Differ by 20 to 110 cm |
| `drop` | A ledge to jump down from. One way, downward. | 4 units | Differ by 120 to 300 cm |
| `view` | A slot to look through, 30 cm high. Never passable; does not count as a connection. | 4 units | Any |

Rules that go with the table:

- **Fallback.** Unreal steps down when a mode does not fit: `open` becomes `wide`, `wide` becomes `door`. The lab's plan should show the mode that will actually be built, using the stretch lengths above.
- **Headroom.** Both spaces need at least 190 cm of height in common above the higher floor, or the opening becomes a crawl. Keep ceilings at 200 cm or more and this never matters.
- **Required or optional.** A join marked `required` must be cut or the whole zone is refused. An optional join that cannot be cut is dropped and reported. Mark as required only the joins that keep the zone in one piece.
- **Position.** A join may carry `at`, the zone coordinate (units) along the shared wall where the opening should be centred. It is a hint: Unreal uses the nearest clear spot, and the first loader may ignore it.
- **One join per pair** of spaces.
- **People first.** Every space must be reachable on foot from the start, and the start reachable back from every space. A `drop` is one way, so the space below it needs another way back up. A person cannot use a drop of more than 300 cm.

The mix of modes is most of a zone's character. The Unreal `level0` template joins nearly every neighbouring pair and makes most of them `open` or `wide`; the `house` uses `door` for private rooms and `wide` or `open` between the hall, living room and kitchen.

## Vertical pieces

A zone has no fixed storey height. Each space states its own floor height, and a storey is simply the spaces that share one. The lab should show one storey at a time, with a switch between them.

**Stairs.** A stair is a space of kind `stair` with three extra fields: `floor` (the height at its foot), `rise` (how far it climbs, cm) and `foot` (the side its bottom faces: `n`, `e`, `s` or `w`).

| Rule | Value |
| --- | --- |
| Rise | 10 to 1200 cm, in steps of 10. |
| Width | 3 to 8 units, across the direction of travel. |
| Length | 4 units of landing (2 at the foot, 2 at the head) plus the run. |
| Run | At least `rise / 29` units, rounded up, which keeps the slope to about 30 degrees. A 290 cm storey needs a run of 10 units, so a stair 14 units long. |
| Joins | One at the foot, to a space at `floor`. One at the head, to a space at `floor + rise`. Nothing joins its long sides. |
| Stairwell | The stair's rectangle is taken from its foot's floor up to its head's ceiling. No other space may overlap it in plan within that height. |

Unreal builds a stair as a ramp today and will build treads later. The lab should draw it as a stair either way; the data is the same.

**Small level changes without a stair.** Two neighbouring spaces whose floors differ by 20 to 110 cm can be joined by `climb`. A difference of 10 cm cannot be joined at all, so keep floor heights either equal or at least 20 cm apart.

**Pits and platforms.** A sunken or raised part of a room is its own space with its own floor height, joined to the room around it by `climb`, `drop` or a short stair. Remember the way back: a pit entered by `drop` needs a stair or a `climb` out.

**Tall rooms.** A room may have a ceiling up to 800 cm. A tall room beside a two-storey part of the zone can be joined at both levels, for example a door on the ground floor and a `view` slot or a `drop` from the storey above.

## The exchange file

One zone per file, named `<id>.zone.json`, UTF-8. This is version 1.

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | `"backrooms-zone"` | Always this. |
| `version` | `1` | Always this for now. |
| `id` | string | Lowercase letters, digits and hyphens. Unreal names each space `<zone id>/<space id>`. |
| `name` | string | Shown to people. |
| `theme` | string | `backrooms` or `residential`, or a new name described in `notes`. |
| `notes` | string, optional | What the place should feel like, and anything the format could not say. |
| `source` | object, optional | `{ "template", "seed", "dials", "lab" }`: what made this zone, so it can be made again. |
| `start` | object | `{ "space", "x", "y" }`: a space id and a point inside it, in units. |
| `spaces` | array | See below. Order does not matter; ids do. |
| `joins` | array | See below. |
| `entrances` | array, optional | `{ "title", "space", "side", "at" }`: an outer wall of a space (`n`, `e`, `s`, `w`) and the coordinate along it. |
| `rules` | array, optional | The template's rules as this zone stands against them: `{ "id", "name", "kept", "relaxed", "relaxedBy", "detail" }` (see *Rules*). Unreal recomputes its own; this is for comparing. |

A space:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Unique in the zone. Lowercase letters, digits and hyphens. Named for what the space is, not for its place in a list. |
| `title` | string | "Kitchen". |
| `kind` | string | `room`, `hall` or `stair`. |
| `rect` | `[x0, y0, x1, y1]` | Whole units. |
| `floor` | integer | Centimetres, a multiple of 10. A stair's is its foot. |
| `ceiling` | integer, optional | Centimetres above its floor. Left out: the theme's. |
| `role` | string, optional | One of the roles in *Spaces*, or the lab's own. |
| `theme` | string, optional | Overrides the zone's. |
| `features` | object, optional | `{ "shape", "columns", "divider", "screen" }`, any of them. |
| `outline` | array, optional | Design data: the space's real shape when it is not its rectangle. A closed path in units, each point `[x, y]` (fractions allowed), or `{ "arc": [cx, cy], "to": [x, y] }` for a circular arc to the next point. It must lie inside `rect`. The version 1 loader builds `rect` and keeps `outline` for the adapter that will build it; never drop it. |
| `rise` | integer, stairs only | Centimetres climbed. |
| `foot` | string, stairs only | `n`, `e`, `s` or `w`. |

A join: `{ "a", "b", "mode", "required", "at" }`. `a` and `b` are space ids; `mode` is from the table in *Connections*; `required` defaults to false; `at` is optional.

**A worked example.** A small flat on two storeys, 7 m by 11 m. It compiles as written: 12 spaces, 11 of 11 joins cut, 133 m² of floor, every space reached from the entry and back.

```
Ground floor (floor 0)                 Upstairs (floor 290)

y=22 +---------------+-----+-----+     +---------------+-----+-----+
     |               |cup- |     |     | Back bedroom  |land-|     |
y=18 |               |board|  H  |     |               |ing  |  U  |
     |   Kitchen     +-----+  a  |  y=16 +-------------+-----+  p  |
     |               |     |  l  |     |  Bathroom     |     |  s  |
     |               |  S  |  l  |  y=11 +-------------+ stair  t  |
y=10 +---------------+  t  |  w  |     |               | well|  a  |
     |               |  a  |  a  |     |               |     |  i  |
     |  Front room   |  i  |  y  |     |   Bedroom     |     |  r  |
     |               |  r  |     |     |               |     |  s  |
y=4  |               +-----+-----+     |               +-----+     |
     |               |   Entry   |     |               | hall  hall|
y=0  +---------------+-----------+     +---------------+-----+-----+
     x=0             x=8  x=11  x=14   x=0             x=8  x=11  x=14
```

```json
{
  "format": "backrooms-zone",
  "version": 1,
  "id": "flat",
  "name": "Small flat",
  "theme": "residential",
  "notes": "A narrow two-storey flat. The kitchen is reached only through the front room.",
  "source": { "template": "by-hand", "seed": 7, "dials": {}, "lab": "0.1" },
  "start": { "space": "entry", "x": 11, "y": 2 },
  "spaces": [
    { "id": "entry",        "title": "Entry",         "kind": "hall",  "rect": [8, 0, 14, 4],    "floor": 0 },
    { "id": "front",        "title": "Front room",    "kind": "room",  "rect": [0, 0, 8, 10],    "floor": 0, "role": "living" },
    { "id": "kitchen",      "title": "Kitchen",       "kind": "room",  "rect": [0, 10, 8, 22],   "floor": 0, "role": "kitchen" },
    { "id": "hallway",      "title": "Hallway",       "kind": "hall",  "rect": [11, 4, 14, 22],  "floor": 0 },
    { "id": "cupboard",     "title": "Cupboard",      "kind": "room",  "rect": [8, 18, 11, 22],  "floor": 0, "role": "store" }   ,
    { "id": "stairs",       "title": "Stairs",        "kind": "stair", "rect": [8, 4, 11, 18],   "floor": 0, "rise": 290, "foot": "s" },
    { "id": "landing",      "title": "Landing",       "kind": "hall",  "rect": [8, 18, 11, 22],  "floor": 290 },
    { "id": "uphall",       "title": "Upstairs hall", "kind": "hall",  "rect": [11, 0, 14, 22],  "floor": 290 },
    { "id": "uphall-front", "title": "Upstairs hall", "kind": "hall",  "rect": [8, 0, 11, 4],    "floor": 290 },
    { "id": "bedroom",      "title": "Bedroom",       "kind": "room",  "rect": [0, 0, 8, 11],    "floor": 290, "role": "bedroom" },
    { "id": "bathroom",     "title": "Bathroom",      "kind": "room",  "rect": [0, 11, 8, 16],   "floor": 290, "role": "bath" },
    { "id": "back-bedroom", "title": "Back bedroom",  "kind": "room",  "rect": [0, 16, 8, 22],   "floor": 290, "role": "bedroom" }
  ],
  "joins": [
    { "a": "entry",        "b": "front",        "mode": "door", "required": true },
    { "a": "entry",        "b": "stairs",       "mode": "open", "required": true },
    { "a": "entry",        "b": "hallway",      "mode": "open", "required": true },
    { "a": "front",        "b": "kitchen",      "mode": "wide", "required": true },
    { "a": "hallway",      "b": "cupboard",     "mode": "door", "required": true },
    { "a": "stairs",       "b": "landing",      "mode": "open", "required": true },
    { "a": "landing",      "b": "uphall",       "mode": "open", "required": true },
    { "a": "uphall",       "b": "uphall-front", "mode": "open", "required": true },
    { "a": "uphall-front", "b": "bedroom",      "mode": "door", "required": true },
    { "a": "bedroom",      "b": "bathroom",     "mode": "door", "required": true },
    { "a": "landing",      "b": "back-bedroom", "mode": "door", "required": true }
  ],
  "entrances": [
    { "title": "Front door", "space": "entry", "side": "s", "at": 11 }
  ]
}
```

Things to notice in it: the stair is 3 units wide and 14 long (a run of 10 for a rise of 290); the cupboard sits under the landing because their floors are 290 apart; nothing upstairs overlaps the stair's rectangle; the entry meets the front room along only 4 units, so that join can only be a door.

## Writing a template

A template is one function from a seed and dials to a zone in the exchange format, plus what describes it: its dials, its presets and its rules. It ports to C++ almost line by line if it is written the way the Unreal templates are.

```js
const house = {
  id: "house",
  name: "House",
  summary: "A home, from an ordinary two-storey house to a rambling one-storey spread.",
  dials: [
    { id: "size",    name: "Size",        low: "Modest",   high: "Large",     value: 40, help: "How large, and how many bedrooms (2 to 5)" },
    { id: "sprawl",  name: "Sprawl",      low: "Compact",  high: "Sprawling", value: 0,  help: "A box on two storeys, to one long storey" },
    { id: "strange", name: "Strangeness", low: "Expected", high: "Wrong",     value: 0,  help: "Every house rule kept, to none" }
  ],
  presets: [
    { name: "Suburban", dials: { size: 40, sprawl: 0,  strange: 0 } },
    { name: "Ranch",    dials: { size: 50, sprawl: 65, strange: 0 } }
  ],
  rules: [
    { id: "kitchen", name: "The kitchen opens onto the dining room", relaxedBy: { dial: "strange", from: 70 } },
    { id: "entry",   name: "The front door opens into an entry hall" }        // never relaxed
  ],
  // spec = { seed: 1, dials: { size: 40, sprawl: 0, strange: 0 } }. Returns a zone (with its rules report),
  // or { error: "why" }.
  make(spec) { /* ... */ }
};
```

### The random draw

Every random choice is a named, stateless draw: a function of a seed, a path and a name. This is the Unreal side's `Templates::Stream`, and this JavaScript gives the same numbers:

```js
// Unsigned 32-bit throughout.
function mix(s) {
  s = (s ^ (s >>> 16)) >>> 0; s = Math.imul(s, 0x7feb352d) >>> 0;
  s = (s ^ (s >>> 15)) >>> 0; s = Math.imul(s, 0x846ca68b) >>> 0;
  return (s ^ (s >>> 16)) >>> 0;
}
function stream(seed, path, name) {          // path and name: plain ASCII
  let h = mix((seed ^ 0x9e3779b9) >>> 0);
  for (let i = 0; i < path.length; ++i) { h = (h ^ path.charCodeAt(i)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
  h = mix((h ^ 0x85ebca6b) >>> 0);
  for (let i = 0; i < name.length; ++i) { h = (h ^ name.charCodeAt(i)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
  return mix((h ^ 0xc2b2ae35) >>> 0);
}
```

Check the lab's copy against these before trusting it:

| Call | Result |
| --- | --- |
| `stream(1, "", "")` | 937033933 |
| `stream(1, "zonelab/house", "seed")` | 2761775253 |
| `stream(1, "zonelab/level0", "seed")` | 950527661 |
| `stream(42, "attempt", "0")` | 2198064874 |
| `stream(4294967295, "room/0,0,12,10", "seed")` | 1657424870 |
| `stream(123456789, "join/0,0,8,8/8,0,16,8", "order")` | 25009617 |

How the Unreal templates use it: a seed for the zone, a stream per attempt, and every draw of an attempt named under the template's family.

```js
const zoneSeed = stream(spec.seed, "zonelab/" + this.id, "seed");
for (let attempt = 0; attempt < 16; ++attempt) {
  const d = draws(stream(zoneSeed, "attempt", String(attempt)), this.id);
  // ... decide the program, arrange it, ask for the openings, check the rules; return the zone if it passes.
}
return { error: "no attempt was accepted" };
```

### Building blocks

The Unreal house is built from a few small pieces. The same pieces in JavaScript make a template easy to port, because each has a C++ twin of the same name. This JavaScript was run beside its C++ twin and gave identical output (`Saved/M3/ZoneLabJs` in the project).

```js
// Draws: every choice of one attempt, by name.
function draws(s, family) {
  return {
    pick:   (name, lo, hi) => hi <= lo ? lo : lo + stream(s, family, name) % (hi - lo + 1),
    chance: (name, percent) => stream(s, family, name) % 100 < percent
  };
}

// Rooms in a row filling a strip exactly. Each slot { role, lo, hi, optional, absorb } is drawn between lo
// and hi; while the row is too long, optional slots are dropped from its end and then slots shrink towards lo;
// while it is too short, slots grow towards hi (round from a drawn one), then an absorbing slot past hi by at
// most 6. Sets each slot's len; false when no fit is found.
function fit(slots, total, d, name) {
  let sum = 0;
  slots.forEach((sl, k) => { sl.len = d.pick(name + "/" + k + "/" + sl.role, sl.lo, sl.hi); sum += sl.len; });
  while (sum > total) { let drop = -1; for (let k = slots.length - 1; k >= 0 && drop < 0; --k) if (slots[k].optional) drop = k;
                        if (drop < 0) break; sum -= slots[drop].len; slots.splice(drop, 1); }
  while (sum > total) { let any = false; for (let k = slots.length - 1; k >= 0 && sum > total; --k) if (slots[k].len > slots[k].lo) { --slots[k].len; --sum; any = true; } if (!any) break; }
  if (sum > total || slots.length === 0) return false;
  const n = slots.length, start = d.pick(name + "/grow", 0, n - 1);
  while (sum < total) { let any = false; for (let i = 0; i < n && sum < total; ++i) { const sl = slots[(start + i) % n]; if (sl.len < sl.hi) { ++sl.len; ++sum; any = true; } } if (!any) break; }
  for (const sl of slots) while (sum < total && sl.absorb && sl.len < sl.hi + 6) { ++sl.len; ++sum; }
  return sum === total;
}

// Frames: an origin and a direction (0 north, 1 east, 2 south, 3 west); u runs along it, v to its left.
// A hall is laid in a frame: the hall at v 0..hw, rooms on its left at v > hw and on its right at v < 0.
const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];
const leftOf = d => (d + 3) & 3, rightOf = d => (d + 1) & 3;
function uv(f, u0, u1, v0, v1) {             // the rectangle u0..u1 along, v0..v1 to the left: [x0, y0, x1, y1]
  const l = leftOf(f.dir);
  const ax = f.x + u0 * DX[f.dir] + v0 * DX[l], ay = f.y + u0 * DY[f.dir] + v0 * DY[l];
  const bx = f.x + u1 * DX[f.dir] + v1 * DX[l], by = f.y + u1 * DY[f.dir] + v1 * DY[l];
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}
function move(f, u, v) { const l = leftOf(f.dir); return { x: f.x + u * DX[f.dir] + v * DX[l], y: f.y + u * DY[f.dir] + v * DY[l], dir: f.dir }; }
// The frame of the hall that leaves the end of a hall `length` long and hw wide, by its left side (turn 1)
// or right side (turn 2), nextWide wide. Rooms on that side of the first hall stop nextWide short of its end.
function turned(f, length, hw, turn, nextWide) {
  if (turn === 1) { const m = move(f, length, hw); return { x: m.x, y: m.y, dir: leftOf(f.dir) }; }
  const m = move(f, length - nextWide, 0); return { x: m.x, y: m.y, dir: rightOf(f.dir) };
}
```

Two more the house uses, described rather than given:

- **A hall with things along it.** Lay each side's things in order from the start of the hall; a thing that would stand on something already laid moves along one unit at a time (at most 20) and fails the attempt if it never fits. Then the hall's length is the longer side (plus the next hall's width on the side it turns to), and the hall itself must stand clear. A hall longer than 36 units is laid as pieces joined by `open`, cut where every room keeps 4 units of wall on the piece it opens off. Things are rooms, a gap (hall with nothing off it), a suite (a bedroom with its closet beside it next to the hall and its bathroom behind) and a branch (a side hall laid the same way, its rooms starting past the first hall's rooms).
- **Taking back.** When something fails part way, remove what that step added and try the next option. Never leave half a hall in the plan.

### Rules

A rule is a named check the template keeps, written against roles and joins. Rules are what make the strict end of a template look like the real thing, and what the dials are allowed to loosen.

- Each rule has an `id`, a `name` a person can read, and optionally `relaxedBy`: the dial and value from which it may be broken.
- `make` checks every rule on the zone it made. A rule broken but not relaxed fails the attempt and the next is tried. Rules relaxed by the dials are still checked and reported, so the lab can show what the dials let go.
- The zone's `rules` report lists every rule with `kept`, `relaxed` and, when broken, a `detail` naming the space ("Living room is 4 by 9.5 m").
- A template with its dials at their strict end keeps every rule on every seed. That is checked over 40 seeds before export.

Good rules are about relationships, not exact sizes: what opens onto what, what is on which floor, what share of the floor halls take, whether you can walk round in a loop. Rules about size give a range or a proportion.

### Dials

A dial moves a template away from its plain version in one direction. Design them like this:

1. **Start from the strict template.** Make it convincing with every rule kept before adding dials.
2. **Each dial loosens named rules in a fixed order**, written down as a table of thresholds (below). That way any setting can be explained by which rules are off.
3. **Keep dials independent.** Sprawl (how far the house spreads) and Strangeness (how wrong it is) are separate, so a rambling but sensible farmhouse and a small but wrong house are both reachable.
4. **A dial may switch arrangements at a threshold** (two storeys to one at Sprawl 55), but between thresholds it should change things continuously: sizes, counts, chances.
5. **Presets** name points worth pointing at. They are plain dial values, nothing more.
6. **Judge the middles.** Look at nine seeds at once (the gallery) at a few settings between presets, not just the ends.

### The worked example: the Unreal house

The house is decided in the order an architect works: what rooms it has, how they are arranged about a spine (entry, then the rooms everyone shares, then halls with the private rooms off them), where each opening goes, and then the rules.

| Dial | Value | What happens |
| --- | --- | --- |
| Size | 0 to 100 | 2 bedrooms, 3 from 17, 4 from 50, 5 from 84; a dining room from 25 (by chance below); a WC from 35 in a two-storey house; a study from 45; a family room from 60; a main bathroom from 3 bedrooms, a second family bathroom from 4. |
| Sprawl | 0 to 29 | A box on two storeys: a centre hall with the stair beside it, a back hall behind the stair that closes a loop through the kitchen. Shared rooms on the ground floor, all on one side of the hall or living and dining rooms either side of the entry; bedrooms upstairs, each with a closet where it fits. The box grows a little as the dial rises. |
| | 30 | A one-storey wing grows from the back of the hall and takes a den. |
| | 40 | The main bedroom suite moves into the wing. |
| | 48 | The wing turns. |
| | 55 to 100 | One storey: through the entry into the living room, through that into the dining room with the kitchen beside it, then halls that turn (alternately left and right), with bedrooms and bathrooms off them and the suite at the end. 1 hall at 55, up to 4 at 100, more of them with rooms on one side only. |
| Strangeness | 20 | Rooms stray from their proportions. |
| | 30 | Halls widen and run on past their rooms. |
| | 40 | Halls branch; an odd wing grows from even a compact house. |
| | 50 | Rooms repeat (extra bathrooms, store rooms). |
| | 55 | Branches may lead nowhere. |
| | 60 | Halls may turn the same way twice, so the house doubles back. |
| | 70 | Rooms turn up in the wrong places: a kitchen off a hall, a bathroom off the living room. |
| | 75 to 85 | Extra bedrooms, a second kitchen or living room; bedrooms open through bedrooms; ceilings change height from room to room. |

Its rules, and what relaxes them:

| Rule | Relaxed by |
| --- | --- |
| The front door opens into an entry hall | never |
| The stair rises from a hall to a landing | never |
| The living room, dining room and kitchen are on the ground floor | never |
| The kitchen opens onto the dining room | Strangeness 70 |
| The living and dining rooms open into each other, or off the same hall | Strangeness 70 |
| Every bedroom opens off a hall or landing | Strangeness 85 |
| No bedroom opens onto the entry, living room, dining room or kitchen | Strangeness 70 |
| Bathrooms open off a hall, never onto the living room, dining room or kitchen | Strangeness 70 |
| The main bathroom opens only from the main bedroom | Strangeness 70 |
| One kitchen, one living room, and bathrooms to suit the bedrooms | Strangeness 50 |
| Every room is a usable size and shape for what it is (least width and most elongation per role) | Strangeness 20 |
| Halls take no more than a quarter of the floor | Sprawl 30 or Strangeness 30 |
| No hall leads nowhere (the entry's other way out is the front door) | Strangeness 40 |
| The house is a box, or a box with a wing (rooms cover 70% of the ground they stand in) | Sprawl 30 or Strangeness 40 |
| The ground floor can be walked round in a loop | Sprawl 55 or Strangeness 40 |

Presets: Suburban (40, 0, 0), Family home (75, 35, 0), Ranch (50, 65, 0), Rambling (85, 95, 15), Not quite right (45, 20, 55), Backrooms house (70, 90, 95), as size, sprawl, strangeness.

### The rules of portable code

1. **Only `stream` decides.** No `Math.random`, no dates or clocks, nothing read from the page.
2. **Name a draw for what it decides**, not for when it happens: `"living/len"`, `"halls/2/turn"`, `"room/" + x0 + "," + y0`, never a running counter. Then changing one part of a template does not reshuffle the rest.
3. **Whole numbers in every decision.** Sizes are units, heights are centimetres. To turn a dial into a size use `lo + Math.round((hi - lo) * dial / 100)` with `hi >= lo`. Divide only non-negative whole numbers, with `Math.floor`.
4. **Sort with a complete order.** Every comparator must break ties down to something unique (the rectangle's coordinates, the id). JavaScript's sort keeps ties in place and C++'s does not.
5. **Loop over arrays in a stated order.** Never let the order of an object's keys, a `Set` or a `Map` decide anything.
6. **Bound every loop.** A fixed number of attempts, a fixed number of tries per room. On failure return `{ error }` naming the cause; never drop a required join quietly.
7. **Pure.** The same `spec` gives a byte-identical file, however often and in whatever order templates are run.
8. **Plain code.** One file per template, plain functions and arrays, no libraries, no classes, nothing asynchronous.
9. **Dials are whole numbers 0 to 100** with a default. A dial may switch arrangement at a stated threshold; between thresholds it changes sizes, counts and chances.
10. **Stable ids.** A space's id says what it is (`kitchen`, `bedroom-2`), so the same space keeps its id when other spaces come and go.
11. **Keep the start room, stair landings and anything a required join depends on plain** (`shape: "rect"`, no columns), so those joins cannot fail.
12. **Rules are code too.** Write each rule as a function of the zone made (spaces, roles, joins), not of the template's intentions, so Unreal can run the same check on the same zone.

## Checks before export

The lab must run these on every zone and refuse to export one that fails, saying which check and which space or join. They are the Unreal compiler's rules; a zone that passes them here should compile there.

1. **Grid.** Every coordinate a whole number; every side 3 to 40 units; every floor and rise a multiple of 10; every ceiling 200 to 800.
2. **Ids.** Unique, lowercase letters, digits and hyphens. Every join, entrance and the start name a space that exists.
3. **Overlap.** For every pair of spaces whose rectangles overlap in plan, one must stand clear above the other: upper floor at least lower floor + lower ceiling + 40. A stair counts as reaching from its floor to its floor + rise + ceiling.
4. **Stairs.** Width 3 to 8; length = run + 4 with run at least `ceil(rise / 29)`; `foot` on a short side; exactly one join at the foot to a space at `floor` and one at the head to a space at `floor + rise`.
5. **Joins.** The two spaces share a wall. The shared stretch is long enough for the mode. Floors are equal for `door`, `wide` and `open`, and differ by the right amount for `climb` and `drop`. One join per pair.
6. **Reach.** From the start's space, following joins (never `view`; `drop` only downward), every space is reached. From every space the start's space is reached.
7. **Start.** Inside its space, which is a `room` or `hall`.
8. **Entrances.** On a side of the space with no other space beyond it at that floor, with at least 4 units of free wall.
9. **Counts.** At most 128 spaces and 256 joins.
10. **Same again.** Making the zone twice from the same spec gives the same file, byte for byte.
11. **Rules.** Every rule the dials do not relax is kept.
12. **Outline.** Where a space has an `outline`, it is closed and lies inside `rect`.

For a template, also run the checks over seeds 1 to 40 with the dials at their defaults, all at 10 and all at 90 (120 zones), and over seeds 1 to 40 with every dial at its strict end, where every rule must be kept. Show how many passed. The Unreal templates are held to all of them; the house is also swept over Sprawl and Strangeness (`Tools/ZoneLabCheck.cpp`).

## The lab's screen

The Unreal Zone Lab is the model: one sidebar, one plan. What the browser lab needs:

- **A template list**, a **seed** (type, step up and down, random) and the chosen template's **dials** with a reset. Every change makes the zone again at once.
- **The plan**: spaces coloured by kind, their titles, the joins drawn on the shared walls and told apart by mode, the entrances and the start marked, a scale bar. Drag to move, wheel to zoom, a key to fit.
- **A storey switch** when the zone has more than one floor height. A stair shows on the storey it starts on and as a stairwell on the one it reaches.
- **Facts**: footprint in metres, floor area, counts of rooms, halls and stairs, counts of joins by mode.
- **Presets** as buttons under the dials, the one the dials stand at marked.
- **The rules**, always visible: each rule with a mark for kept or broken, and for a broken one what broke it and the dial setting that lets it.
- **A gallery**: nine seeds side by side with the same dials (seeds 1 to 9, 10 to 18, ...), each with its spaces and how many rules it lets go; click to choose a seed. This is how a dial's middle is judged.
- **The checks**, always visible: pass, or the list of failures with the space or join named and highlighted on the plan.
- **Export** of the zone shown (`<id>.zone.json`), enabled only when the checks pass, and **import** of a zone file to look at it again.

Worth having if time allows: editing by hand (drag a rectangle's edge on the grid, add or remove a space, click a shared wall to change its join), which makes one-off zones possible without writing a template; and exporting a batch of seeds at once.

Build it as a single page with no build step and no dependencies, so it runs from a file on any machine. Keep the templates, the checks and the `stream` function apart from the drawing code: those three are what crosses to Unreal.

## What the lab should not do

- **Walls, doors and frames as geometry** in the version 1 file. Rooms are rectangles and joins; a room's real shape goes in `outline`.
- **Simplify a shape to fit version 1.** Angled and curved rooms are welcome as design: give them an `outline` (and their rectangle as the bound) rather than squaring them off. Unreal builds the rectangle until the adapter exists.
- **Furniture and props.** Say what a room is with `role` and `title`; say what it should hold in `notes`.
- **Lighting and materials.** A theme name is enough.
- **Joining zones to each other.** Mark entrances; the zone graph and the transitions (passages, portal doors, ramps, drops) are Unreal's.
- **A 3D view.** The walk happens in Unreal.
- **Its own save format.** The exchange file is the save.

## What to bring back

1. **Zone files**: a handful you like (three to ten) rather than hundreds, each passing the checks, with a line in `notes` on what you like about it.
2. **Template files**: the `.js` for each template, written as in *Writing a template*, with its dials, presets and rules, its 120-seed result and its strict result.
3. **Gallery pictures** of each template at each preset, so the port can be compared seed by seed.
4. **A picture of each plan**, so the import can be checked against what you saw.
5. **The lab itself**, so its zones can be made again.
6. **What the format could not say**: kinds of space, features, joins or themes you wanted and had to leave out. This is as useful as the zones, because it says what to build next on the Unreal side.

## Browser implementation notes — October 13, 2026

The default exchange workbench accepts these optional additions without changing schema version 1. Older files without `rules` or `outline` remain valid. Full `br.zone` geometry remains a separate richer contract; outlines do not encode wall solids, holes, opening geometry or traversals.

- **Outline convention:** start with `[x, y]`, then straight endpoints or `{arc: [cx, cy], to: [x, y]}`. Explicitly return to the first point (a closing arc is allowed). Arcs use the shorter circular sweep; a 180-degree tie goes counterclockwise in XY. Represent a full circle with two semicircular arcs; split longer sweeps into smaller arcs. Endpoints must share the same nonzero radius. At most 256 nodes are accepted per space. The complete arc, including its extrema, must lie in `rect`. Fractions are preserved exactly in JSON; geometric tolerance is 1e-7 plan units for bounds and relative radius agreement. A dashed gold outline shows the preserved design over its rectangular allocation. These checks do not establish outline support, opening clearance or actual-shape navigation in Unreal.
- **Rule reports:** generated House and Office files embed their reports in `rules`; canonical JSON sorts them by id. Report `relaxedBy` is explanatory text; imported `{dial, from}` descriptions are also retained. Physical geometry and the portable compiler digest do not change. On import/edit, a known current-version template recomputes reports from geometry and recorded dials rather than trusting old flags. Reports from unavailable templates are retained and labelled unverified. Broken, unrelaxed external reports are refused. Files without a report remain supported.
- **Strict audit:** each template is checked at 40 strict seeds in addition to the 120 acceptance configurations, with repeats, reordered lists and canonical round trips. Strict defaults to zero for each dial; templates may specify a numeric `strict` value per dial when the strict end is different. Every strict rule must be kept, even if its policy would permit a break. Level 0 currently has no architectural rulebook, so its strict rule condition is vacuous.
- **Seed gallery:** compare nine consecutive seeds at the current template/dials, page the groups, select a seed, and export the group as a standalone SVG. Cards use the selected floor where it exists and the lowest floor otherwise. Imported one-off edits remain in the main plan; gallery cards show generated designs. Selected presets are marked.

No runtime Unreal loader or curved-shape adapter is implemented by this browser update.
