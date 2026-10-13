import { genericInput, genericTemplate } from './generic-template.js';
import { composeGeneric } from './generic-layout.js';
import { point, tangent, distance, signedArea, interiorsOverlap } from './geometry.js';
import { hostAt, approachFor, deriveWalls, deriveGuards } from './structure.js';
import { validateArchitecture } from './physical.js';
import { realizeWalls } from './walls.js';
import { fingerprint } from './determinism.js';
import { insetRegion, interiorAnchor, boundaryNetwork } from './polygon-regions.js';
import { generateGenericDesign as generateV2, importGenericDesign as importV2 } from './generic-v2.js';
export { genericTemplate } from './generic-template.js';

function realize(input, model, walls) {
  const D = input.dials, thickness = .15, half = thickness / 2, clearHeight = Math.round((2.4 + D.ceiling * .026) * 100) / 100;
  const plan = { schemaVersion: 'br.zone/0.3', kind: 'generated-generic', zoneId: 'generic-v3-' + input.seed,
    input: { zoneId: 'generic-v3-' + input.seed, seed: String(input.seed), generatorVersion: 3, profile: 'generic', config: { floorHeight: clearHeight, wallThickness: thickness, dials: D }, portRequirements: [] },
    conventions: { units: 'metres', axes: { horizontal: ['X', 'Y'], vertical: 'Z', handedness: 'right' }, outerWinding: 'counterclockwise', holeWinding: 'clockwise', coordinateQuantum: 1e-6 },
    walker: { radius: .3, headroom: 2.1 }, floors: [{ id: 'floor:0', index: 0, elevation: 0 }], spaces: [], surfaces: [], openings: [], verticalTraversals: [], protectedVoids: [], externalPorts: [], walls: [], guards: [], localConnections: [],
    layout: { ...model.layout, signature: { upperFloorIndex: 0 }, sourceTemplate: 'generic-v3' } };
  const spaces = new Map();
  for (const allocation of model.allocations) {
    const footprint = insetRegion(allocation.footprint, half);
    const anchor = interiorAnchor(footprint);
    const space = { id: allocation.id, label: allocation.label, role: allocation.role === 'quiet' ? 'private' : allocation.role === 'shared' ? 'public' : allocation.role,
      tags: ['generic', allocation.kind, allocation.cluster === null ? 'connecting-route' : 'cluster-' + allocation.cluster], playable: true, floorIndex: 0, elevation: 0, clearHeight, footprint, labelAnchor: anchor, clearVolumes: [{ footprint: structuredClone(footprint), minZ: 0, maxZ: clearHeight }] };
    plan.spaces.push(space); spaces.set(space.id, space);
    for (const kind of ['floor', 'ceiling']) plan.surfaces.push({ id: kind + ':' + space.id, kind, spaceId: space.id, elevation: kind === 'floor' ? 0 : clearHeight, thickness: .2, footprint: structuredClone(footprint) });
  }
  function opening(aId, bId, center, requested, required = true, boundaryId) {
    const a = spaces.get(aId), b = bId && spaces.get(bId), allocation = model.allocations.find(s => s.id === aId);
    // Choose a clear edge parallel to the real allocation host, then project
    // inward by half a wall. Bounding rectangles do not define the aperture.
    const edge = allocation.footprint.outer.find(e => {
      const v = tangent(e, .5), l = Math.hypot(...v), n = [-v[1] / l, v[0] / l];
      return Math.abs((center[0] - e.from[0]) * n[0] + (center[1] - e.from[1]) * n[1]) < 1e-5 && distance(e.from, center) + distance(center, e.to) < l + 1e-4;
    });
    if (!edge) throw new Error('Opening has no actual allocation host: ' + aId);
    const v = tangent(edge, .5), length = Math.hypot(...v), inward = [-v[1] / length, v[0] / length];
    const xy = point(center[0] + inward[0] * half, center[1] + inward[1] * half);
    // Width is bounded by both clear host spans, with corner and approach margins.
    let width = Math.min(requested, distance(edge.from, center) * 2 - .5, distance(edge.to, center) * 2 - .5);
    if (b) {
      const otherAllocation = model.allocations.find(s => s.id === bId), otherEdge = otherAllocation.footprint.outer.find(e => Math.abs((center[0] - e.from[0]) * inward[0] + (center[1] - e.from[1]) * inward[1]) < 1e-5 && distance(e.from, center) + distance(center, e.to) < distance(e.from, e.to) + 1e-4);
      if (!otherEdge) throw new Error('Opening lacks its opposite host: ' + bId);
      width = Math.min(width, distance(otherEdge.from, center) * 2 - .5, distance(otherEdge.to, center) * 2 - .5);
    }
    width = Math.floor(width * 100) / 100;
    if (width < .8) throw new Error('Opening cannot preserve walker clearance: ' + aId + '/' + bId);
    const first = hostAt(a, xy, width), approach = approachFor(a.footprint.outer[first.edgeIndex], xy, width, .6), hosts = [{ ...first, center: [...xy, 0] }];
    if (b) { const other = point(center[0] - inward[0] * half, center[1] - inward[1] * half); hosts.push({ ...hostAt(b, other, width), center: [...other, 0] }); }
    const o = { id: (b ? 'door:' : 'external:') + aId + ':' + (bId ?? plan.externalPorts.length), type: b ? 'local-passage' : 'external-door', hosts, center: [...xy, 0], tangent: approach.tangent, width, height: b && D.open >= 75 && width >= 2.2 ? clearHeight : 2.1, approachDepth: .6, direction: 'reversible', required, boundaryId };
    plan.openings.push(o); return { opening: o, approach };
  }
  for (const j of model.links) opening(j.a, j.b, j.center, j.width, j.required, j.boundaryId);
  for (const [i, e] of model.external.entries()) {
    const { opening: o, approach } = opening(e.space, null, e.center, 1, true, e.boundaryId);
    const req = { contractId: 'generic-port-' + i, portId: 'generic-port-' + i, role: i === 0 ? 'primary' : 'secondary', family: 'door', direction: 'reversible', floorIndex: 0, width: o.width, height: 2.1, approachDepth: .6 };
    plan.input.portRequirements.push(req); plan.externalPorts.push({ ...req, owningSpaceId: e.space, openingId: o.id, host: o.hosts[0], approach: approach.footprint, anchor: { position: o.center, forward: [-approach.inward[0], -approach.inward[1], 0], up: [0, 0, 1] } });
  }
  plan.boundaries = bindApertures(model.boundaries, plan.openings, plan.spaces, half);
  plan.walls = deriveWalls(plan); plan.guards = deriveGuards(plan);
  plan.diagnostics = validateArchitecture(plan, { checkCachedConnections: false });
  if (plan.diagnostics.errors.length) throw new Error(plan.diagnostics.errors.slice(0, 4).map(e => e.code + ': ' + e.entityId + ' ' + e.message).join('; '));
  if (walls) { plan.schemaVersion = 'br.zone/0.4'; realizeWalls(plan); plan.diagnostics = validateArchitecture(plan, { checkCachedConnections: false, checkWallRebuild: false }); }
  if (plan.diagnostics.errors.length) throw new Error(plan.diagnostics.errors.slice(0, 4).map(e => e.code + ': ' + e.entityId + ' ' + e.message).join('; '));
  plan.localConnections = structuredClone(plan.diagnostics.navigation.connections);
  const roomAreas = plan.spaces.filter(s => s.tags.includes('room')).map(s => signedArea(s.footprint.outer));
  Object.assign(plan.layout.metrics, { roomAreaMinM2: Math.min(...roomAreas), roomAreaMaxM2: Math.max(...roomAreas), cycleRank: plan.diagnostics.metrics.cycleRank });
  plan.layout.architecturalRules = [
    { id: 'room-program', name: 'Complete requested room program', kept: roomAreas.length === model.layout.requestedRooms },
    { id: 'ports', name: 'All requested exterior ports', kept: plan.externalPorts.length === plan.input.portRequirements.length },
    { id: 'physical-network', name: 'Every room reachable and returnable through physical apertures', kept: plan.diagnostics.navigation.unreachable.length === 0 && plan.diagnostics.navigation.noReturnPath.length === 0 },
    { id: 'budgets', name: 'Bounded generation and geometry', kept: plan.spaces.length <= 25 && plan.openings.length <= 128 },
    { id: 'support-program', name: 'Exact requested support program', kept: plan.spaces.filter(s => s.role === 'service').length === Math.floor(roomAreas.length * D.supportMix / 300) }
  ];
  if (plan.layout.architecturalRules.some(r => !r.kept)) throw new Error('Generic architectural contract failed.');
  plan.diagnostics.scope = 'Generic v3 concave polygon footprints, wall solids, supported apertures and local walker navigation';
  plan.diagnostics.warnings = [{ code: 'UNREAL_ADAPTER_PENDING', message: 'Full br.zone geometry is preserved. Unreal import and engine collision verification require the full geometry adapter.' }];
  plan.fingerprint = fingerprint(plan); return plan;
}

export function generateGenericDesign(raw, { walls = true } = {}) {
  if (raw?.generatorVersion === 2) return generateV2(raw, { walls });
  if (raw?.generatorVersion !== undefined && raw.generatorVersion !== 3) throw new Error('Unsupported Generic generator version.');
  const input = genericInput(raw), failures = [];
  for (let attempt = 0; attempt < 4; ++attempt) {
    try { const model = composeGeneric(input, attempt); model.layout.attempt = attempt; return realize(input, model, walls); }
    catch (error) { failures.push('attempt ' + attempt + ': ' + error.message); }
  }
  throw new Error(genericTemplate.name + ': no attempt accepted. ' + failures.join(' | '));
}

export function importGenericDesign(raw) {
  if (raw?.input?.generatorVersion === 2) return importV2(raw);
  if (raw?.kind !== 'generated-generic' || raw.schemaVersion !== 'br.zone/0.4' || raw.input?.generatorVersion !== 3) throw new Error('Import requires a Generic v2 or v3 full geometry export.');
  const input = genericInput({ seed: Number(raw.input.seed), dials: raw.input.config?.dials });
  if (!Array.isArray(raw.spaces) || raw.spaces.length > 25 || !Array.isArray(raw.openings) || raw.openings.length > 128 || !Array.isArray(raw.wallBodies) || raw.wallBodies.length > 2048) throw new Error('Import exceeds the Generic geometry budget.');
  if (raw.spaces.some(s => !Array.isArray(s.footprint?.outer) || s.footprint.outer.length > 32 || s.footprint.holes?.length) || raw.wallBodies.reduce((n, b) => n + (b.footprint?.outer?.length ?? 0) + (b.footprint?.holes ?? []).reduce((m, r) => m + r.length, 0), 0) > 12000) throw new Error('Import exceeds the Generic boundary budget.');
  if (raw.input.config.wallThickness !== .15 || raw.input.config.floorHeight !== Math.round((2.4 + input.dials.ceiling * .026) * 100) / 100 || fingerprint(structuredClone(raw.walker)) !== fingerprint({ radius: .3, headroom: 2.1 }) || raw.floors?.length !== 1 || raw.floors[0].index !== 0 || raw.floors[0].elevation !== 0) throw new Error('Imported geometry changed the neighborhood physical contract.');
  const plan = structuredClone(raw), regions = plan.layout?.regions;
  if (!Array.isArray(regions) || regions.length !== plan.spaces.length || new Set(regions.map(r => r.id)).size !== regions.length) throw new Error('Canonical polygon regions are missing or duplicated.');
  for (const [i, r] of regions.entries()) {
    if (!r.footprint?.outer || r.footprint.outer.length > 32 || r.footprint.outer.some(e => e.kind !== 'line') || r.footprint.holes?.length) throw new Error('Invalid polygon region boundary.');
    const space = plan.spaces.find(s => s.id === r.id);
    if (!space || fingerprint(insetRegion(r.footprint, .075)) !== fingerprint(space.footprint)) throw new Error('Clear floor disagrees with its authoritative polygon region.');
    if (regions.slice(i + 1).some(b => interiorsOverlap(r.footprint, b.footprint))) throw new Error('Polygon regions overlap.');
  }
  const boundaries = bindApertures(boundaryNetwork(regions), plan.openings, plan.spaces, .075);
  if (fingerprint(boundaries) !== fingerprint(plan.boundaries)) throw new Error('Shared wall network or aperture ownership was modified.');
  const diagnostics = validateArchitecture(plan, { checkCachedConnections: false });
  if (diagnostics.errors.length) throw new Error(diagnostics.errors.slice(0, 5).map(e => e.code + ': ' + e.message).join('; '));
  const rooms = plan.spaces.filter(s => s.tags?.includes('room')), requested = 8 + Math.floor(input.dials.rooms * 16 / 100);
  if (rooms.length !== requested || plan.spaces.filter(s => s.role === 'service').length !== Math.floor(requested * input.dials.supportMix / 300) || plan.externalPorts.length !== 1 + Math.floor(input.dials.exits * 7 / 100)) throw new Error('Imported geometry does not match its recorded room, support or port program.');
  if (!plan.layout?.metrics || !Array.isArray(plan.layout.clusters) || !Array.isArray(plan.layout.architecturalRules)) throw new Error('Generic layout metadata is missing.');
  plan.boundaries = boundaries; plan.diagnostics = diagnostics; plan.diagnostics.scope = 'Imported Generic v3 independently checked polygon regions, shared boundaries, wall solids, apertures and navigation';
  plan.localConnections = structuredClone(diagnostics.navigation.connections);
  plan.layout.architecturalRules = [
    { id: 'room-program', name: 'Complete requested room program', kept: true },
    { id: 'ports', name: 'All requested exterior ports', kept: true },
    { id: 'physical-network', name: 'Every room reachable and returnable through physical apertures', kept: true },
    { id: 'budgets', name: 'Bounded generation and geometry', kept: true },
    { id: 'support-program', name: 'Exact requested support program', kept: true }
  ];
  plan.layout.metrics.roomCount = rooms.length;
  plan.layout.metrics.roomAreaMinM2 = Math.min(...rooms.map(s => signedArea(s.footprint.outer)));
  plan.layout.metrics.roomAreaMaxM2 = Math.max(...rooms.map(s => signedArea(s.footprint.outer)));
  plan.layout.metrics.cycleRank = diagnostics.metrics.cycleRank;
  plan.diagnostics.warnings = [{ code: 'UNREAL_ADAPTER_PENDING', message: 'Full geometry independently checked in the browser; Unreal runtime realization still requires its adapter.' }];
  delete plan.fingerprint; plan.fingerprint = fingerprint(plan); return plan;
}

function bindApertures(network, openings, spaces, half) {
  const result = structuredClone(network);
  for (const o of openings) {
    const b = result.find(b => b.id === o.boundaryId), owners = o.hosts.map(h => h.spaceId).sort();
    if (!b || owners.join('/') !== b.owners.map(h => h.spaceId).sort().join('/')) throw new Error('Opening lacks canonical shared-boundary ownership: ' + o.id);
    const host = o.hosts[0], s = spaces.find(s => s.id === host.spaceId), edge = s?.footprint.outer[host.edgeIndex];
    if (!edge) throw new Error('Opening host edge is missing.');
    const d = tangent(edge, .5), l = Math.hypot(...d), center = point(host.center[0] + d[1] / l * half, host.center[1] - d[0] / l * half);
    const u = [(b.to[0] - b.from[0]) / b.length, (b.to[1] - b.from[1]) / b.length], t = (center[0] - b.from[0]) * u[0] + (center[1] - b.from[1]) * u[1];
    if (Math.abs((center[0] - b.from[0]) * u[1] - (center[1] - b.from[1]) * u[0]) > 2e-5 || t - o.width / 2 < .2 || t + o.width / 2 > b.length - .2) throw new Error('Aperture lies outside its shared wall span.');
    b.apertures.push({ openingId: o.id, fromM: t - o.width / 2, toM: t + o.width / 2 });
  }
  for (const b of result) b.apertures.sort((a, c) => a.fromM - c.fromM);
  return result;
}
