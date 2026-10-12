import { fingerprint } from './determinism.js';
import { defaultPorts, normalizeInput } from './zone.js';
import { EPS, q, point, line, arc, polygon, rectangle, transform, at, tangent, distance, edgeDistance, contains, footprintSubset, interiorsOverlap } from './geometry.js';
import { validateArchitecture } from './physical.js';
import { localCeiling, approachFor, hostAt, deriveWalls, deriveGuards } from './structure.js';
export { deriveWalls, deriveGuards } from './structure.js';

export const ARCHITECTURE_SCHEMA = 'br.zone/0.2';
export const ARCHITECTURE_GENERATOR = 2;
export const ARCHITECTURE_PROFILE = { name: 'Three-storey reference house', summary: 'A designed architectural sample with a double-height foyer, gallery, two stairs, curved lounge, and angled winter garden. Topology is fixed in Phase 2.' };
export const rectAt = (x, y, w, d) => transform(rectangle(w, d), [x, y], 0);
const holeRing = footprint => [...footprint.outer].reverse().map(e => line(e.to, e.from));

export function normalizeArchitectureInput(raw = {}) {
  if (raw.generatorVersion !== undefined && raw.generatorVersion !== ARCHITECTURE_GENERATOR) throw new Error('Reference architecture requires generator version 2.');
  if (raw.profile !== undefined && raw.profile !== 'reference-house') throw new Error('Unknown reference architecture profile.');
  const requests = structuredClone(raw.portRequirements ?? defaultPorts());
  if (!Array.isArray(requests)) throw new Error('Port requirements must be an array.');
  if (requests.some(p => p?.family !== 'door')) throw new Error('Reference architecture realizes door contracts only.');
  // Reuse Phase 1 input/identity validation without changing its v1 contract.
  const base = normalizeInput({ ...raw, generatorVersion: 1, profile: 'angular', zoneId: raw.zoneId ?? 'house-reference', portRequirements: requests.map(p => p && ({ ...p, floorIndex: p.floorIndex === 2 ? 1 : p.floorIndex })) });
  const height = q(base.config.floorHeight);
  if (height < 2.8 || height > 3.6) throw new Error('Reference house storey height must be 2.8–3.6 m to fit the designed stair core.');
  return { ...base, generatorVersion: ARCHITECTURE_GENERATOR, profile: 'reference-house', config: { floorHeight: height }, portRequirements: requests.sort((a, b) => a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0) };
}

function referenceSpaces(height, shafts) {
  const spaces = [], add = (id, label, role, footprint, floorIndex, labelAnchor) => {
    const elevation = q(height * floorIndex), clearHeight = q(height - .2);
    const space = { id, label, role, tags: ['reference-house'], playable: true, floorIndex, elevation, clearHeight, footprint, labelAnchor, clearVolumes: [{ footprint: structuredClone(footprint), minZ: elevation, maxZ: q(elevation + clearHeight) }] };
    spaces.push(space); return space;
  };
  const foyer = add('foyer', 'Double-height foyer', 'public', rectAt(0, 0, 8, 8), 0, [4, 4]);
  foyer.clearHeight = q(2 * height - .2);
  foyer.clearVolumes.push({ footprint: rectAt(2, 2, 4, 4), minZ: q(height - .2), maxZ: q(2 * height - .2) });
  add('ground-hall', 'Service hall', 'circulation', rectAt(8, 0, 3, 8), 0, [9.5, 4]);
  add('kitchen', 'Kitchen', 'service', rectAt(11, 0, 5, 4), 0, [13.5, 2]);
  add('dining', 'Dining room', 'public', rectAt(11, 4, 5, 4), 0, [13.5, 6]);
  add('lounge', 'Curved lounge', 'public', { outer: [line([0, 0], [0, 8]), line([0, 8], [-3, 8]), arc([-3, 4], 4, 90, 180), line([-3, 0], [0, 0])], holes: [] }, 0, [-3, 4]);
  add('winter-garden', 'Angled winter garden', 'public', polygon([[16, 0], [22, -2], [24, 4], [16, 4]]), 0, [20, 1.5]);
  for (const floorIndex of [0, 1, 2]) {
    const footprint = rectAt(0, 8, 8, 8);
    footprint.holes = (floorIndex === 0 ? [shafts[0]] : floorIndex === 1 ? shafts : [shafts[1]]).map(holeRing);
    add(`stair-core:${floorIndex}`, 'Stair hall', 'circulation', footprint, floorIndex, [4, 15.5]);
    if (floorIndex === 0) continue;
    const main = rectAt(0, 0, 8, 8);
    if (floorIndex === 1) main.holes = [holeRing(rectAt(2, 2, 4, 4))];
    add(floorIndex === 1 ? 'gallery' : 'upper-lounge', floorIndex === 1 ? 'Upper gallery' : 'Upper lounge', floorIndex === 1 ? 'gallery' : 'private', main, floorIndex, [4, 1]);
    add(`private-hall:${floorIndex}`, 'Private hall', 'circulation', rectAt(8, 0, 3, 8), floorIndex, [9.5, 4]);
    add(floorIndex === 1 ? 'bedroom:1' : 'studio', floorIndex === 1 ? 'Bedroom' : 'Studio', 'private', rectAt(11, 0, 5, 4), floorIndex, [13.5, 2]);
    add(floorIndex === 1 ? 'bathroom:1' : 'bedroom:2', floorIndex === 1 ? 'Bathroom' : 'Bedroom', floorIndex === 1 ? 'service' : 'private', rectAt(11, 4, 5, 4), floorIndex, [13.5, 6]);
  }
  return spaces;
}

function referenceOpenings(spaces) {
  const openings = [], space = id => spaces.find(s => s.id === id);
  function connect(from, to, xy, width = 1.2) {
    const a = space(from), b = space(to);
    const hosts = [a, b].map(s => hostAt(s, xy, width));
    openings.push({ id: `door:${from}:${to}`, type: 'local-passage', hosts, center: [...xy, a.elevation], tangent: approachFor(a.footprint.outer[hosts[0].edgeIndex], xy, width, .8).tangent, width, height: 2.2, approachDepth: .8, direction: 'reversible' });
  }
  connect('foyer', 'lounge', [0, 4], 1.8);
  connect('foyer', 'ground-hall', [8, 4], 1.6);
  connect('foyer', 'stair-core:0', [4, 8], 1.6);
  connect('ground-hall', 'kitchen', [11, 2]);
  connect('ground-hall', 'dining', [11, 6]);
  connect('kitchen', 'dining', [13.5, 4]);
  connect('kitchen', 'winter-garden', [16, 2], 1.4);
  for (const f of [1, 2]) {
    const main = f === 1 ? 'gallery' : 'upper-lounge', first = f === 1 ? 'bedroom:1' : 'studio', second = f === 1 ? 'bathroom:1' : 'bedroom:2';
    connect(main, `stair-core:${f}`, [4, 8], 1.6);
    connect(main, `private-hall:${f}`, [8, 4], 1.4);
    connect(`private-hall:${f}`, first, [11, 2]);
    connect(`private-hall:${f}`, second, [11, 6]);
  }
  return openings;
}

function referenceStairs(height, count, run) {
  return [0, 1].map(index => {
    const x = index === 0 ? 2 : 4.8, minZ = q(height * index), maxZ = q(height * (index + 1)), endY = q(9 + run);
    return {
      id: `stair:${index}`, type: 'straight-stair', direction: 'reversible', width: 1.2, headroom: 2.1, riserCount: count, riserHeight: q(height / count), treadDepth: .28,
      source: { spaceId: `stair-core:${index}`, surfaceId: `floor:stair-core:${index}`, position: [q(x + .6), 9, minZ] },
      target: { spaceId: `stair-core:${index + 1}`, surfaceId: `floor:stair-core:${index + 1}`, position: [q(x + .6), endY, maxZ] },
      landings: [{ kind: 'source', footprint: rectAt(x, 8, 1.2, 1), elevation: minZ }, { kind: 'target', footprint: rectAt(x, endY, 1.2, 1), elevation: maxZ }],
      treads: Array.from({ length: count }, (_, step) => ({ footprint: rectAt(x, q(9 + step * .28), 1.2, .28), elevation: q(minZ + height * (step + 1) / count) }))
    };
  });
}

function externalPorts(input, spaces, openings) {
  const ports = [], reserved = new Set(openings.flatMap(o => o.hosts.map(h => `${h.spaceId}/${h.edgeIndex}`)));
  for (const requirement of input.portRequirements) {
    let found;
    for (const s of spaces.filter(s => s.floorIndex === requirement.floorIndex)) {
      for (let edgeIndex = 0; edgeIndex < s.footprint.outer.length; edgeIndex++) {
        const edge = s.footprint.outer[edgeIndex];
        if (edge.kind !== 'line' || reserved.has(`${s.id}/${edgeIndex}`) || distance(edge.from, edge.to) < requirement.width + .4) continue;
        const center = at(edge, .5), approach = approachFor(edge, center, requirement.width, requirement.approachDepth);
        if (!footprintSubset(s.footprint, approach.footprint) || localCeiling(s, approach.footprint) - s.elevation < requirement.height - EPS) continue;
        const outward = approachFor(line(edge.to, edge.from), center, requirement.width, .8).footprint;
        if (spaces.some(other => other.id !== s.id && other.floorIndex === s.floorIndex && interiorsOverlap(outward, other.footprint))) continue;
        found = { s, edgeIndex, center, approach }; break;
      }
      if (found) break;
    }
    if (!found) continue; // Validator retains and reports the unfulfilled input.
    const { s, edgeIndex, center, approach } = found, openingId = `opening:${requirement.portId}`;
    reserved.add(`${s.id}/${edgeIndex}`);
    openings.push({ id: openingId, type: 'external-door', hosts: [{ spaceId: s.id, edgeIndex, ring: 'outer' }], center: [q(center[0]), q(center[1]), s.elevation], tangent: approach.tangent, width: requirement.width, height: requirement.height, approachDepth: requirement.approachDepth, direction: requirement.direction });
    ports.push({ ...requirement, openingId, owningSpaceId: s.id, anchor: { position: [q(center[0]), q(center[1]), s.elevation], forward: [-approach.inward[0], -approach.inward[1], 0], up: [0, 0, 1], usableApproachSide: 'interior' }, approach: approach.footprint });
  }
  return ports;
}

export function generateArchitecture(raw = {}) {
  const input = normalizeArchitectureInput(raw), height = input.config.floorHeight, count = Math.ceil(height / .18), run = q(count * .28);
  const shafts = [rectAt(2, 9, 1.2, run), rectAt(4.8, 9, 1.2, run)];
  const spaces = referenceSpaces(height, shafts), openings = referenceOpenings(spaces), verticalTraversals = referenceStairs(height, count, run);
  const surfaces = spaces.map(s => ({ id: `floor:${s.id}`, kind: 'floor', spaceId: s.id, elevation: s.elevation, thickness: .2, footprint: structuredClone(s.footprint) }));
  for (const s of spaces) {
    if (s.id === 'foyer') {
      surfaces.push({ id: 'ceiling:foyer:low', kind: 'ceiling', spaceId: s.id, elevation: q(height - .2), footprint: { outer: structuredClone(s.footprint.outer), holes: [holeRing(rectAt(2, 2, 4, 4))] } }, { id: 'ceiling:foyer:high', kind: 'ceiling', spaceId: s.id, elevation: q(2 * height - .2), footprint: rectAt(2, 2, 4, 4) });
    } else {
      const nextCore = spaces.find(next => next.id === `stair-core:${s.floorIndex + 1}`);
      const footprint = s.id.startsWith('stair-core:') ? nextCore?.footprint ?? rectAt(0, 8, 8, 8) : s.footprint;
      surfaces.push({ id: `ceiling:${s.id}`, kind: 'ceiling', spaceId: s.id, elevation: q(s.elevation + s.clearHeight), footprint: structuredClone(footprint) });
    }
  }
  const plan = {
    schemaVersion: ARCHITECTURE_SCHEMA, kind: 'architecture-reference', zoneId: input.zoneId, input,
    conventions: { units: 'metres', axes: { horizontal: ['X', 'Y'], vertical: 'Z', handedness: 'right' }, angles: 'degrees; positive counterclockwise in XY', coordinateQuantum: 1e-6, predicateTolerance: EPS, outerWinding: 'counterclockwise', holeWinding: 'clockwise' },
    walker: { radius: .3, headroom: 2.1 }, floors: [0, 1, 2].map(index => ({ id: `floor:${index}`, index, elevation: q(index * height) })), spaces, surfaces, openings, verticalTraversals,
    protectedVoids: [{ id: 'void:foyer', type: 'double-height', footprint: rectAt(2, 2, 4, 4), minZ: q(height - .2), maxZ: q(2 * height - .2) }, ...shafts.map((footprint, index) => ({ id: `void:stair:${index}`, type: 'stair-shaft', footprint, minZ: q(index * height), maxZ: q((index + 1) * height + 2.1) }))],
    externalPorts: [], walls: [], guards: [], localConnections: []
  };
  plan.externalPorts = externalPorts(input, spaces, openings);
  plan.walls = deriveWalls(plan); plan.guards = deriveGuards(plan);
  // Physical validation derives connections; cached claims are then checked by
  // a second validation pass, so no intended edge can create reachability.
  plan.diagnostics = validateArchitecture(plan, { checkCachedConnections: false });
  plan.localConnections = structuredClone(plan.diagnostics.navigation.connections);
  plan.diagnostics = validateArchitecture(plan);
  plan.fingerprint = fingerprint(plan);
  return plan;
}
