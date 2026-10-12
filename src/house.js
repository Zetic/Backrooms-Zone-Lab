import { fingerprint, stream, canonicalStringify } from './determinism.js';
import { realizeExternalPorts } from './architecture.js';
import { normalizeInput, defaultPorts } from './zone.js';
import { EPS, q, point, line, arc, circle, polygon, rectangle, transform, signedArea } from './geometry.js';
import { hostAt, approachFor, deriveWalls, deriveGuards } from './structure.js';
import { validateArchitecture } from './physical.js';

export const HOUSE_SCHEMA = 'br.zone/0.3';
export const HOUSE_GENERATOR = 3;
export const HOUSE_PROFILES = {
  'gallery-house': { name: 'Gallery house', defaultStoreys: 2, summary: 'Seeded public/private wings, curved and angled rooms, a double-height living hall, and an accessible upper gallery.' },
  'atrium-mansion': { name: 'Atrium mansion', defaultStoreys: 3, summary: 'Seeded multi-wing composition, richer room programs, varied gallery elevation, loops, and optional secondary vertical circulation.' }
};
const ROOM = {
  kitchen: ['Kitchen', 'service', 3], dining: ['Dining room', 'public', 3], pantry: ['Pantry', 'service', 1.6], utility: ['Utility room', 'service', 1.8],
  living: ['Living room', 'public', 4], library: ['Library', 'public', 3], study: ['Study', 'private', 2.5],
  bedroom: ['Bedroom', 'private', 2.5], guestroom: ['Guest bedroom', 'private', 2.4], bath: ['Bathroom', 'service', 2], master: ['Main bedroom', 'private', 3], dressing: ['Dressing room', 'private', 1.6], studio: ['Studio', 'private', 3], office: ['Office', 'private', 2.8]
};
const MIN_AREA = { kitchen: 12, dining: 12, pantry: 4, utility: 6, living: 16, library: 10, study: 8, bedroom: 10, guestroom: 10, bath: 4, master: 12, dressing: 4, studio: 12, office: 10, conservatory: 8 };
const CONVENTIONS = { units: 'metres', axes: { horizontal: ['X', 'Y'], vertical: 'Z', handedness: 'right' }, angles: 'degrees; positive counterclockwise in XY', coordinateQuantum: 1e-6, predicateTolerance: EPS, outerWinding: 'counterclockwise', holeWinding: 'clockwise' };
const rect = (x, y, w, d) => transform(rectangle(w, d), [x, y], 0);
export const reverseRing = ring => [...ring].reverse().map(edge => edge.kind === 'line' ? line(edge.to, edge.from) : arc(edge.center, edge.radius, edge.startDeg + edge.sweepDeg, -edge.sweepDeg));
const choose = (random, items) => items[Math.floor(random() * items.length)];
const grid = (random, low, high, quantum = .2) => q(low + Math.floor(random() * (Math.floor((high - low) / quantum + EPS) + 1)) * quantum);

export function normalizeHouseInput(raw = {}) {
  const profile = raw.profile ?? 'atrium-mansion';
  if (!Object.hasOwn(HOUSE_PROFILES, profile)) throw new Error('Unknown procedural house profile.');
  if (raw.generatorVersion !== undefined && raw.generatorVersion !== HOUSE_GENERATOR) throw new Error('Procedural houses require generator version 3.');
  const storeys = raw.config?.storeys ?? HOUSE_PROFILES[profile].defaultStoreys, maxAttempts = raw.config?.maxAttempts ?? 4;
  if (![2, 3].includes(storeys)) throw new Error('Procedural houses support two or three storeys.');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 6) throw new Error('Candidate limit must be an integer from 1 to 6.');
  const requests = structuredClone(raw.portRequirements ?? defaultPorts());
  if (!Array.isArray(requests)) throw new Error('House port requirements must be an array.');
  if (requests.some(p => p?.family !== 'door')) throw new Error('Procedural houses realize door contracts only.');
  const base = normalizeInput({ ...raw, zoneId: raw.zoneId ?? 'procedural-house', profile: 'angular', generatorVersion: 1, portRequirements: requests.map(p => p && ({ ...p, floorIndex: p.floorIndex === 2 ? 1 : p.floorIndex })) });
  const floorHeight = q(base.config.floorHeight);
  if (floorHeight < 2.6 || floorHeight > 4.2) throw new Error('Procedural house storey height must be 2.6–4.2 m.');
  return { ...base, generatorVersion: HOUSE_GENERATOR, profile, config: { floorHeight, storeys, maxAttempts }, portRequirements: requests.sort((a, b) => a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0) };
}

function partition(program, total, random) {
  const minimum = program.map(type => ROOM[type][2]), available = total - minimum.reduce((n, v) => n + v, 0);
  if (available < -EPS) throw new Error('Space program cannot fit its wing depth.');
  const weights = program.map(() => .5 + random()), sum = weights.reduce((n, v) => n + v, 0), cuts = [0];
  for (let i = 0; i < program.length; i++) cuts.push(i === program.length - 1 ? total : q(cuts.at(-1) + minimum[i] + available * weights[i] / sum));
  return cuts;
}

function westFootprint(right, y, width, depth, kind, tip) {
  if (kind === 'rect') return rect(right - width, y, width, depth);
  if (kind === 'apse') return { outer: [line([right, y], [right, q(y + depth)]), line([right, q(y + depth)], [q(right - width), q(y + depth)]), arc([q(right - width), q(y + depth / 2)], depth / 2, 90, 180), line([q(right - width), y], [right, y])], holes: [] };
  const inset = q(Math.min(.8, depth * .2));
  return polygon([[right, y], [right, q(y + depth)], [q(right - width), q(y + depth)], [q(right - width - tip), q(y + depth - inset)], [q(right - width - tip), q(y + inset)], [q(right - width), y]]);
}

export function composeHouse(input, attempt) {
  const randomKey = { ...input, config: { floorHeight: input.config.floorHeight, storeys: input.config.storeys } };
  const random = stream(randomKey, `house/composition/${attempt}`), mansion = input.profile === 'atrium-mansion';
  const thickness = input.config.wallThickness ?? 0;
  const height = input.config.floorHeight, storeys = input.config.storeys, risers = Math.ceil(height / .18), run = q(risers * .28);
  const width = mansion ? grid(random, 8.8, 10.8) : grid(random, 7.6, 9.6), baseDepth = mansion ? grid(random, 10.4, 12.4) : grid(random, 8.4, 10.2), depth = q(baseDepth + 3 * thickness);
  const eastRecipe = choose(random, ['rooms', 'hall']), westRecipe = choose(random, ['rooms', 'hall']);
  const eastHall = eastRecipe === 'hall' ? grid(random, 2.4, 3.2) : 0, westHall = westRecipe === 'hall' ? grid(random, 2.4, 3.2) : 0;
  const eastWidth = grid(random, 5.2, mansion ? 7.2 : 6.4), extraStair = random() < (mansion ? .65 : .25);
  const signatureLower = storeys === 3 && mansion && random() < .5 ? 1 : 0, signatureUpper = signatureLower + 1;
  const voidKind = choose(random, ['rectangular', 'circular', 'chamfered']), angle = choose(random, [0, 0, 0, -15, 22.5, 90]);
  const center = [q(width / 2 + grid(random, -.3, .3, .1)), q(depth / 2 + grid(random, -.3, .3, .1))];
  let voidFootprint;
  if (voidKind === 'circular') voidFootprint = transform(circle(q(Math.min(width, depth) * .27)), center, 0);
  else {
    const w = q(width - grid(random, 3.4, 4.2)), d = q(depth - grid(random, 3.8, 4.8)), x = q(center[0] - w / 2), y = q(center[1] - d / 2);
    if (voidKind === 'rectangular') voidFootprint = rect(x, y, w, d);
    else {
      const c = .6;
      voidFootprint = polygon([[q(x + c), y], [q(x + w - c), y], [q(x + w), q(y + c)], [q(x + w), q(y + d - c)], [q(x + w - c), q(y + d)], [q(x + c), q(y + d)], [x, q(y + d - c)], [x, q(y + c)]]);
    }
  }
  const coreWidth = Math.min(width, grid(random, 6.8, 8.2)), coreX = grid(random, 0, width - coreWidth, .1), coreDepth = q(run + 2.6 + grid(random, 0, 1.2));
  const eastStart = q(width + eastHall + (eastHall ? 2 : 1) * thickness);
  const cores = [{ name: 'main', x: coreX, y: q(depth + thickness), width: coreWidth, depth: coreDepth }];
  if (extraStair) cores.push({ name: 'service', x: q(eastStart + eastWidth - 5.2), y: q(depth + thickness), width: 5.2, depth: q(run + 2.8 + grid(random, 0, 1)) });
  const plan = {
    schemaVersion: HOUSE_SCHEMA, kind: 'generated-house', zoneId: input.zoneId, input,
    conventions: structuredClone(CONVENTIONS),
    walker: { radius: .3, headroom: 2.1 }, floors: Array.from({ length: storeys }, (_, index) => ({ id: `floor:${index}`, index, elevation: q(index * height) })),
    spaces: [], surfaces: [], openings: [], verticalTraversals: [], protectedVoids: [], externalPorts: [], walls: [], guards: [], localConnections: [],
    layout: { signature: { lowerFloorIndex: signatureLower, upperFloorIndex: signatureUpper, lowerSpaceId: `main:${signatureLower}`, upperSpaceId: `main:${signatureUpper}`, voidId: 'void:signature', shape: voidKind }, wings: { east: eastRecipe, west: westRecipe }, orientationDegrees: angle, verticalCoreCount: cores.length, program: [], obligations: [] }
  };
  const space = id => plan.spaces.find(s => s.id === id);
  function add(id, label, role, footprint, floorIndex, labelAnchor, type) {
    const elevation = q(floorIndex * height), clearHeight = q(height - .2);
    const value = { id, label, role, tags: ['procedural-house', ...(type ? [type] : [])], playable: true, floorIndex, elevation, clearHeight, footprint, labelAnchor, clearVolumes: [{ footprint: structuredClone(footprint), minZ: elevation, maxZ: q(elevation + clearHeight) }] };
    plan.spaces.push(value); return value;
  }
  function connect(from, to, xy, aperture = 1.2, obligation = false) {
    const a = space(from), b = space(to), first = hostAt(a, xy, aperture);
    const inward = approachFor(a.footprint.outer[first.edgeIndex], xy, aperture, .8).inward;
    const other = point(xy[0] - inward[0] * thickness, xy[1] - inward[1] * thickness);
    const hosts = [first, hostAt(b, other, aperture)];
    if (thickness) { hosts[0].center = [...point(...xy), a.elevation]; hosts[1].center = [...other, b.elevation]; }
    const id = `door:${from}:${to}`;
    plan.openings.push({ id, type: 'local-passage', hosts, center: [...point(...xy), a.elevation], tangent: approachFor(a.footprint.outer[hosts[0].edgeIndex], xy, aperture, .8).tangent, width: aperture, height: 2.2, approachDepth: .8, direction: 'reversible' });
    if (obligation) plan.layout.obligations.push({ id: `required:${id}`, type: 'direct-passage', from, to });
  }

  for (let floorIndex = 0; floorIndex < storeys; floorIndex++) {
    const footprint = rect(0, 0, width, depth);
    if (floorIndex === signatureUpper) footprint.holes = [reverseRing(voidFootprint.outer)];
    const signature = floorIndex === signatureLower, gallery = floorIndex === signatureUpper;
    const main = add(`main:${floorIndex}`, gallery ? 'Upper gallery' : signature ? floorIndex === 0 ? 'Double-height foyer' : 'Double-height grand hall' : floorIndex === 0 ? 'Reception hall' : 'Family lounge', gallery ? 'gallery' : floorIndex === 0 || signature ? 'public' : 'private', footprint, floorIndex, [q(width / 2), gallery ? .8 : q(depth / 2)], 'main-hall');
    if (signature) {
      main.clearHeight = q(2 * height - .2);
      main.clearVolumes.push({ footprint: structuredClone(voidFootprint), minZ: q((floorIndex + 1) * height - .2), maxZ: q((floorIndex + 2) * height - .2) });
      plan.surfaces.push({ id: `ceiling:${main.id}:low`, kind: 'ceiling', spaceId: main.id, elevation: q((floorIndex + 1) * height - .2), footprint: { outer: structuredClone(footprint.outer), holes: [reverseRing(voidFootprint.outer)] } }, { id: `ceiling:${main.id}:high`, kind: 'ceiling', spaceId: main.id, elevation: q((floorIndex + 2) * height - .2), footprint: structuredClone(voidFootprint) });
    } else plan.surfaces.push({ id: `ceiling:${main.id}`, kind: 'ceiling', spaceId: main.id, elevation: q(main.elevation + main.clearHeight), footprint: structuredClone(main.footprint) });
  }
  plan.protectedVoids.push({ id: 'void:signature', type: 'double-height', ownerSpaceId: `main:${signatureLower}`, footprint: structuredClone(voidFootprint), minZ: q((signatureLower + 1) * height - .2), maxZ: q((signatureLower + 2) * height - .2) });

  const eastRooms = new Map();
  for (let floorIndex = 0; floorIndex < storeys; floorIndex++) {
    for (const wing of ['east', 'west']) {
      const r = stream(randomKey, `house/${attempt}/${wing}/${floorIndex}`), recipe = wing === 'east' ? eastRecipe : westRecipe, hallWidth = wing === 'east' ? eastHall : westHall;
      let choices;
      if (floorIndex === 0 && wing === 'east') choices = [['kitchen', 'dining'], ['pantry', 'kitchen', 'dining'], ['pantry', 'kitchen', 'dining', 'utility']];
      else if (floorIndex === 0) choices = mansion ? [['living', 'library', 'study'], ['living', 'study']] : [['living', 'study']];
      else if (wing === 'east') choices = [['bedroom', 'guestroom', 'bath'], ['bedroom', 'bath'], ['bedroom', 'guestroom', 'bath', 'dressing']];
      else choices = [['master', 'dressing', 'bath'], ['studio', 'office'], ['bedroom', 'bath']];
      choices = choices.filter(program => program.reduce((n, type) => n + ROOM[type][2], 0) <= baseDepth - .1);
      const program = choose(r, choices), cuts = partition(program, baseDepth, r), records = [];
      const hallId = `hall:${wing}:${floorIndex}`;
      if (recipe === 'hall') {
        add(hallId, floorIndex === 0 ? `${wing === 'east' ? 'Service' : 'Public'} wing hall` : 'Private wing hall', 'circulation', rect(wing === 'east' ? width + thickness : -hallWidth - thickness, 0, hallWidth, depth), floorIndex, [wing === 'east' ? q(width + hallWidth / 2) : q(-hallWidth / 2), q(depth / 2)], 'wing-hall');
        connect(`main:${floorIndex}`, hallId, [wing === 'east' ? width : 0, q(depth / 2)], 1.6);
      }
      for (let index = 0; index < program.length; index++) {
        const type = program[index], [label, role] = ROOM[type], y = q(cuts[index] + index * thickness), d = q(cuts[index + 1] - cuts[index] + (index === program.length - 1 ? (4 - program.length) * thickness : 0)), roomWidth = wing === 'east' ? eastWidth : grid(r, 4.2, mansion ? 6.4 : 5.6), right = q(-hallWidth - (hallWidth ? 2 : 1) * thickness);
        const kind = wing === 'east' ? 'rect' : floorIndex === 0 && index === program.length - 1 ? 'angled' : floorIndex === 0 && index === 0 && voidKind !== 'circular' ? 'apse' : choose(r, ['rect', 'rect', 'apse']);
        const footprint = wing === 'east' ? rect(eastStart, y, roomWidth, d) : westFootprint(right, y, roomWidth, d, kind, grid(r, .8, 1.8));
        const id = `room:${wing}:${floorIndex}:${type}`, cx = wing === 'east' ? q(eastStart + roomWidth / 2) : q(right - roomWidth / 2), cy = q(y + d / 2);
        add(id, label, role, footprint, floorIndex, [cx, cy], type);
        plan.layout.program.push({ spaceId: id, type, wing, floorIndex });
        connect(recipe === 'hall' ? hallId : `main:${floorIndex}`, id, [wing === 'east' ? recipe === 'hall' ? width + thickness + hallWidth : width : recipe === 'hall' ? -thickness - hallWidth : 0, cy], ['pantry', 'dressing'].includes(type) ? 1 : 1.2);
        records.push({ id, type, y, depth: d, width: roomWidth });
      }
      for (let index = 1; index < records.length; index++) {
        const previous = records[index - 1], current = records[index], kitchenPair = floorIndex === 0 && wing === 'east' && (previous.type === 'kitchen' || current.type === 'kitchen');
        if (kitchenPair || (wing === 'west' && floorIndex === 0 && r() < .65)) connect(previous.id, current.id, [wing === 'east' ? q(eastStart + eastWidth / 2) : q(-hallWidth - (hallWidth ? 2 : 1) * thickness - Math.min(previous.width, current.width) / 2), q(current.y - thickness)], kitchenPair ? 1.4 : 1.2, kitchenPair);
      }
      if (wing === 'east') eastRooms.set(floorIndex, records);
      for (const s of plan.spaces.filter(s => s.floorIndex === floorIndex && (s.id.startsWith(`room:${wing}:`) || s.id === hallId))) plan.surfaces.push({ id: `ceiling:${s.id}`, kind: 'ceiling', spaceId: s.id, elevation: q(s.elevation + s.clearHeight), footprint: structuredClone(s.footprint) });
    }
  }

  // Add a true non-cardinal room, attached to the dining aperture, rather than
  // merely rotating a rectangular building or smoothing room outlines.
  if (random() < (mansion ? .8 : .6)) {
    const dining = eastRooms.get(0).find(room => room.type === 'dining'), x = q(eastStart + eastWidth + thickness), y = dining.y, d = dining.depth, reach = grid(random, 4, 6), skew = grid(random, .6, 1.4);
    const footprint = polygon([[x, y], [q(x + reach), q(y - skew)], [q(x + reach + .8), q(y + d - .3)], [x, q(y + d)]]);
    const room = add('conservatory', 'Angled conservatory', 'public', footprint, 0, [q(x + reach / 2), q(y + d / 2)], 'conservatory');
    connect(dining.id, room.id, [q(x - thickness), q(y + d / 2)], 1.4);
    plan.layout.program.push({ spaceId: room.id, type: 'conservatory', wing: 'east', floorIndex: 0 });
    plan.surfaces.push({ id: `ceiling:${room.id}`, kind: 'ceiling', spaceId: room.id, elevation: q(room.clearHeight), footprint: structuredClone(footprint) });
  }

  for (const core of cores) {
    const flightData = Array.from({ length: storeys - 1 }, (_, index) => {
      const x = q(core.x + (index === 0 ? 1 : core.width - 2.2)), y = q(core.y + 1), endY = q(y + run), sourceZ = q(index * height), targetZ = q((index + 1) * height);
      const id = `stair:${core.name}:${index}`;
      plan.verticalTraversals.push({ id, type: 'straight-stair', direction: 'reversible', width: 1.2, headroom: 2.1, riserCount: risers, riserHeight: q(height / risers), treadDepth: .28, source: { spaceId: `core:${core.name}:${index}`, surfaceId: `floor:core:${core.name}:${index}`, position: [q(x + .6), y, sourceZ] }, target: { spaceId: `core:${core.name}:${index + 1}`, surfaceId: `floor:core:${core.name}:${index + 1}`, position: [q(x + .6), endY, targetZ] }, landings: [{ kind: 'source', footprint: rect(x, q(y - 1), 1.2, 1), elevation: sourceZ }, { kind: 'target', footprint: rect(x, endY, 1.2, 1), elevation: targetZ }], treads: Array.from({ length: risers }, (_, step) => ({ footprint: rect(x, q(y + step * .28), 1.2, .28), elevation: q(sourceZ + height * (step + 1) / risers) })) });
      const shaft = rect(x, y, 1.2, run);
      plan.protectedVoids.push({ id: `void:${id}`, type: 'stair-shaft', footprint: shaft, minZ: sourceZ, maxZ: q(targetZ + 2.1) });
      return { index, shaft };
    });
    for (let floorIndex = 0; floorIndex < storeys; floorIndex++) {
      const footprint = rect(core.x, core.y, core.width, core.depth);
      footprint.holes = flightData.filter(flight => flight.index === floorIndex || flight.index + 1 === floorIndex).map(flight => reverseRing(flight.shaft.outer));
      const id = `core:${core.name}:${floorIndex}`;
      add(id, core.name === 'main' ? 'Main stair hall' : 'Service stair hall', 'circulation', footprint, floorIndex, [q(core.x + core.width / 2), q(core.y + core.depth / 2)], 'stair-hall');
      const owner = core.name === 'main' ? `main:${floorIndex}` : eastRooms.get(floorIndex).at(-1).id;
      connect(owner, id, [q(core.x + core.width / 2), q(core.y - thickness)], 1.4);
    }
    for (let floorIndex = 0; floorIndex < storeys; floorIndex++) {
      const current = space(`core:${core.name}:${floorIndex}`), next = space(`core:${core.name}:${floorIndex + 1}`), footprint = next?.footprint ?? rect(core.x, core.y, core.width, core.depth);
      plan.surfaces.push({ id: `ceiling:${current.id}`, kind: 'ceiling', spaceId: current.id, elevation: q(current.elevation + current.clearHeight), footprint: structuredClone(footprint) });
    }
  }
  plan.surfaces.push(...plan.spaces.map(s => ({ id: `floor:${s.id}`, kind: 'floor', spaceId: s.id, elevation: s.elevation, thickness: .2, footprint: structuredClone(s.footprint) })));

  // The zone-local orientation also rotates stairs, clear volumes and cutouts.
  // It participates in physical validation, not only in a display transform.
  const rotate = footprint => transform(footprint, [0, 0], angle), move = p => {
    const a = angle * Math.PI / 180, xy = point(p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a));
    return p.length === 3 ? [...xy, p[2]] : xy;
  };
  for (const s of plan.spaces) { s.footprint = rotate(s.footprint); s.labelAnchor = move(s.labelAnchor); s.clearVolumes.forEach(v => { v.footprint = rotate(v.footprint); }); }
  for (const s of plan.surfaces) s.footprint = rotate(s.footprint);
  for (const v of plan.protectedVoids) v.footprint = rotate(v.footprint);
  for (const stair of plan.verticalTraversals) { stair.source.position = move(stair.source.position); stair.target.position = move(stair.target.position); [...stair.landings, ...stair.treads].forEach(s => { s.footprint = rotate(s.footprint); }); }
  for (const opening of plan.openings) { opening.center = move(opening.center); opening.hosts.forEach(h => { if (h.center) h.center = move(h.center); }); const host = opening.hosts[0]; opening.tangent = approachFor(space(host.spaceId).footprint.outer[host.edgeIndex], opening.center, opening.width, opening.approachDepth).tangent; }
  plan.externalPorts = realizeExternalPorts(input, plan.spaces, plan.openings);
  plan.walls = deriveWalls(plan); plan.guards = deriveGuards(plan);
  return plan;
}

export function validateHouse(plan, options = {}) {
  const result = validateArchitecture(plan, options), add = (code, entityId, message) => result.errors.push({ code, entityId, message });
  if (!((plan.schemaVersion === HOUSE_SCHEMA && plan.input.generatorVersion === HOUSE_GENERATOR) || (plan.schemaVersion === 'br.zone/0.4' && plan.input.generatorVersion === 4)) || plan.kind !== 'generated-house') add('HOUSE_IDENTITY_INVALID', plan.zoneId, 'House requires its explicit schema and generator versions.');
  const signature = plan.layout.signature, lower = plan.spaces.find(s => s.id === signature.lowerSpaceId), upper = plan.spaces.find(s => s.id === signature.upperSpaceId), reserve = plan.protectedVoids.find(v => v.id === signature.voidId);
  if (!lower || !upper || !reserve || reserve.ownerSpaceId !== lower.id || upper.role !== 'gallery' || reserve.type !== 'double-height' || lower.floorIndex !== signature.lowerFloorIndex || upper.floorIndex !== signature.upperFloorIndex || upper.floorIndex !== lower.floorIndex + 1 || !upper.footprint.holes.some(hole => canonicalStringify(reverseRing(hole)) === canonicalStringify(reserve.footprint.outer)) || !lower.clearVolumes.some(v => v.minZ === reserve.minZ && v.maxZ === reserve.maxZ && canonicalStringify(v.footprint) === canonicalStringify(reserve.footprint))) add('SIGNATURE_INVALID', signature.voidId, 'Signature metadata must identify the real tall clear-volume patch, protected opening, and immediately upper gallery.');
  if (plan.floors.length !== plan.input.config.storeys || plan.floors.some(floor => Math.abs(floor.elevation - q(floor.index * plan.input.config.floorHeight)) > EPS)) add('HOUSE_CONFIG_MISMATCH', 'floors', 'Realized storeys and elevations must match the supplied house configuration.');
  const program = plan.layout.program;
  const seenProgram = new Set();
  for (const room of program) {
    const actual = plan.spaces.find(s => s.id === room.spaceId), expectedRole = room.type === 'conservatory' ? 'public' : ROOM[room.type]?.[1];
    if (!actual || !expectedRole || seenProgram.has(room.spaceId) || actual.role !== expectedRole || actual.floorIndex !== room.floorIndex || !actual.tags.includes(room.type)) { add('ROOM_PROGRAM_INVALID', room.spaceId, 'Realized room does not match its unique semantic program entry.'); continue; }
    seenProgram.add(room.spaceId);
    const area = signedArea(actual.footprint.outer) + actual.footprint.holes.reduce((n, ring) => n + signedArea(ring), 0);
    if (area < MIN_AREA[room.type] - EPS) add('ROOM_PROPORTION_INVALID', room.spaceId, 'Room floor area is below the architectural program minimum.');
  }
  const ground = type => program.find(room => room.type === type && room.floorIndex === 0)?.spaceId;
  const kitchen = ground('kitchen'), dining = ground('dining'), pantry = ground('pantry');
  const expectedRelations = kitchen && dining ? [{ id: `required:door:${kitchen}:${dining}`, type: 'direct-passage', from: kitchen, to: dining }] : [];
  if (pantry && kitchen) expectedRelations.push({ id: `required:door:${pantry}:${kitchen}`, type: 'direct-passage', from: pantry, to: kitchen });
  const sort = array => [...array].sort((a, b) => a.id < b.id ? -1 : 1);
  if (canonicalStringify(sort(plan.layout.obligations)) !== canonicalStringify(sort(expectedRelations))) add('RELATIONSHIP_CONTRACT_MISMATCH', 'layout.obligations', 'Declared adjacency obligations differ from the kitchen/dining/pantry program.');
  for (const requirement of expectedRelations) if (!result.navigation.connections.some(c => c.kind === 'opening' && c.direction === 'reversible' && ((c.from === requirement.from && c.to === requirement.to) || (c.to === requirement.from && c.from === requirement.to)))) add('ROOM_RELATIONSHIP_MISSING', requirement.id, 'Required functional adjacency lacks its actual direct reversible passage.');
  for (const type of ['kitchen', 'dining', 'living', 'bedroom', 'bath']) if (!program.some(room => room.type === type && plan.spaces.some(s => s.id === room.spaceId && s.tags.includes(type)))) add('ROOM_PROGRAM_MISSING', type, 'Required house function is absent from the realized program.');
  if (result.metrics.cycleRank < 1) add('CIRCULATION_LOOP_MISSING', 'localConnections', 'A supported house must realize at least one circulation loop.');
  if (options.checkGeneration !== false) {
    const report = plan.generation;
    const validReport = report && ['accepted', 'failed'].includes(report.status) && Number.isInteger(report.attemptsTried) && report.attemptsTried > 0 && report.attemptsTried <= plan.input.config.maxAttempts && Array.isArray(report.candidateFailures) && report.candidateFailures.length === (report.status === 'accepted' ? report.attemptsTried - 1 : report.attemptsTried) && report.candidateFailures.every((failure, i) => failure.attempt === i && failure.errors.length > 0) && (report.status === 'accepted' ? report.acceptedAttempt === report.attemptsTried - 1 : report.acceptedAttempt === null && report.attemptsTried === plan.input.config.maxAttempts);
    if (!validReport) add('GENERATION_REPORT_INVALID', 'generation', 'Candidate status, attempt counts, and deterministic rejection history disagree.');
    if (report?.status === 'failed') add('GENERATION_EXHAUSTED', 'generation', `No candidate satisfied the supplied inputs within ${report.attemptsTried} deterministic attempt(s).`);
  }
  result.metrics.bedrooms = program.filter(room => ['bedroom', 'guestroom', 'master'].includes(room.type)).length;
  if (result.errors.length) { result.status = 'invalid'; result.reachability = 'failed'; }
  return result;
}

export function generateHouse(raw = {}) {
  const input = normalizeHouseInput(raw), failures = [];
  let plan;
  for (let attempt = 0; attempt < input.config.maxAttempts; attempt++) {
    try { plan = composeHouse(input, attempt); }
    catch (error) { failures.push({ attempt, errors: [{ code: 'COMPOSITION_FAILED', entityId: input.profile, message: error.message }] }); continue; }
    plan.diagnostics = validateHouse(plan, { checkCachedConnections: false, checkGeneration: false });
    plan.localConnections = structuredClone(plan.diagnostics.navigation.connections);
    if (!plan.diagnostics.errors.length) {
      plan.generation = { status: 'accepted', attemptsTried: attempt + 1, acceptedAttempt: attempt, candidateFailures: failures };
      plan.fingerprint = fingerprint(plan); return plan;
    }
    failures.push({ attempt, candidate: { orientationDegrees: plan.layout.orientationDegrees, galleryFloor: plan.layout.signature.upperFloorIndex, wings: structuredClone(plan.layout.wings), spaces: plan.spaces.length, stairs: plan.verticalTraversals.length }, errors: structuredClone(plan.diagnostics.errors) });
  }
  if (!plan) plan = { schemaVersion: HOUSE_SCHEMA, kind: 'generated-house', zoneId: input.zoneId, input, walker: { radius: .3, headroom: 2.1 }, conventions: structuredClone(CONVENTIONS), floors: Array.from({ length: input.config.storeys }, (_, index) => ({ id: `floor:${index}`, index, elevation: q(index * input.config.floorHeight) })), spaces: [], surfaces: [], openings: [], verticalTraversals: [], protectedVoids: [], externalPorts: [], walls: [], guards: [], localConnections: [], layout: { signature: { lowerFloorIndex: 0, upperFloorIndex: 1, lowerSpaceId: 'main:0', upperSpaceId: 'main:1', voidId: 'void:signature', shape: 'unrealized' }, wings: { east: 'unresolved', west: 'unresolved' }, verticalCoreCount: 0, program: [], obligations: [] } };
  plan.generation = { status: 'failed', attemptsTried: input.config.maxAttempts, acceptedAttempt: null, candidateFailures: failures };
  plan.diagnostics = validateHouse(plan);
  plan.fingerprint = fingerprint(plan); return plan;
}
