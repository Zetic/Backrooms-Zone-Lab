import { canonicalStringify } from './determinism.js';
import { EPS, q, point, polygon, line, at, tangent, distance, edgeDistance, validateFootprint, footprintSubset, interiorsOverlap, signedArea } from './geometry.js';
import { approachFor, deriveWalls, deriveGuards, localCeiling, flightFrame, flightRect } from './structure.js';
import { WALKER, localWalkPaths, graphReachability } from './navigation.js';

const equal = (a, b) => canonicalStringify(a) === canonicalStringify(b);
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS * 2;
const zOverlap = (a0, a1, b0, b1) => Math.min(a1, b1) > Math.max(a0, b0) + EPS;
const xyz = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const nearFootprint = (a, b) => a.holes.length === b.holes.length && a.outer.length === b.outer.length && a.outer.every((edge, i) => edge.kind === 'line' && b.outer[i].kind === 'line' && distance(edge.from, b.outer[i].from) <= EPS * 2 && distance(edge.to, b.outer[i].to) <= EPS * 2);

// Rebuilds geometry and navigation evidence rather than trusting exported flags,
// cached space edges, or previous diagnostics.
export function validateArchitecture(plan, { checkCachedConnections = true } = {}) {
  const errors = [], add = (code, entityId, message) => errors.push({ code, entityId, message });
  const spaceMap = new Map(), surfaceMap = new Map(), openingMap = new Map(), terminals = new Map(), connections = [];
  const validVolumes = [];
  if (!equal(plan.walker, WALKER)) add('WALKER_CONTRACT_INVALID', 'walker', 'Phase 2 validates the declared 0.3 m radius / 2.1 m headroom walker.');
  const entityIds = new Set();
  for (const entity of [...plan.floors, ...plan.spaces, ...plan.surfaces, ...plan.openings, ...plan.walls, ...plan.guards, ...plan.verticalTraversals, ...plan.protectedVoids, ...plan.externalPorts]) {
    const id = entity.id ?? entity.portId;
    if (!id || entityIds.has(id)) add('DUPLICATE_ID', id ?? 'unknown', 'Each canonical entity needs a unique stable ID.');
    entityIds.add(id);
  }
  for (const s of plan.spaces) {
    const problems = validateFootprint(s.footprint);
    problems.forEach(message => add('FOOTPRINT_INVALID', s.id, message));
    if (problems.length) continue;
    spaceMap.set(s.id, s); terminals.set(s.id, []);
    if (!Number.isFinite(s.elevation) || !Number.isFinite(s.clearHeight) || s.clearHeight < WALKER.headroom || !Array.isArray(s.clearVolumes) || !s.clearVolumes.length) { add('VOLUME_INVALID', s.id, 'Playable space requires finite elevation, headroom, and clear-volume patches.'); continue; }
    for (const v of s.clearVolumes) {
      const issues = validateFootprint(v.footprint);
      issues.forEach(message => add('VOLUME_INVALID', s.id, message));
      if (!issues.length && Number.isFinite(v.minZ) && Number.isFinite(v.maxZ) && v.maxZ > v.minZ && footprintSubset(s.footprint, v.footprint)) validVolumes.push({ ...v, spaceId: s.id });
      else add('VOLUME_INVALID', s.id, 'Clear volume must be a valid positive extrusion inside its space.');
      if (v.minZ > s.elevation + EPS && !plan.protectedVoids.some(reserve => reserve.type === 'double-height' && reserve.minZ <= v.minZ + EPS && reserve.maxZ >= v.maxZ - EPS && footprintSubset(reserve.footprint, v.footprint))) add('VOID_MISSING', s.id, 'A raised clear-volume patch requires an explicit protected double-height void.');
    }
    if (!s.clearVolumes.some(v => near(v.minZ, s.elevation) && v.maxZ >= s.elevation + WALKER.headroom && !validateFootprint(v.footprint).length && footprintSubset(v.footprint, s.footprint)) || !near(s.clearHeight, Math.max(...s.clearVolumes.map(v => v.maxZ)) - s.elevation)) add('VOLUME_INVALID', s.id, 'Floor must be fully covered by a base headroom patch; maximum height must match its clear volumes.');
  }
  for (let i = 0; i < validVolumes.length; i++) for (let j = i + 1; j < validVolumes.length; j++) {
    const a = validVolumes[i], b = validVolumes[j];
    if (a.spaceId !== b.spaceId && zOverlap(a.minZ, a.maxZ, b.minZ, b.maxZ) && interiorsOverlap(a.footprint, b.footprint)) add('VOLUME_COLLISION', `${a.spaceId}/${b.spaceId}`, 'Different rooms occupy the same clear volume.');
  }
  for (const s of plan.surfaces) {
    const issues = validateFootprint(s.footprint);
    issues.forEach(message => add('SURFACE_INVALID', s.id, message));
    if (!spaceMap.has(s.spaceId) || !Number.isFinite(s.elevation) || !['floor', 'ceiling'].includes(s.kind) || (s.kind === 'floor' && (!Number.isFinite(s.thickness) || s.thickness <= 0))) add('SURFACE_INVALID', s.id, 'Surface requires a real owning space, finite elevation, and valid slab thickness.');
    if (issues.length) continue;
    surfaceMap.set(s.id, s);
    for (const volume of validVolumes) {
      const crosses = s.kind === 'floor' ? zOverlap(s.elevation - s.thickness, s.elevation, volume.minZ, volume.maxZ) : s.elevation > volume.minZ + EPS && s.elevation < volume.maxZ - EPS;
      if (crosses && interiorsOverlap(s.footprint, volume.footprint)) add('SURFACE_IN_CLEAR_VOLUME', s.id, `Surface obstructs ${volume.spaceId} clear volume.`);
    }
  }
  for (const s of spaceMap.values()) {
    const slab = surfaceMap.get(`floor:${s.id}`), floor = plan.floors.find(f => f.index === s.floorIndex);
    if (!slab || slab.spaceId !== s.id || !floor || !near(s.elevation, floor.elevation) || !near(slab.elevation, s.elevation) || !equal(slab.footprint, s.footprint)) add('FLOOR_INVALID', s.id, 'Playable space must match its actual floor surface and floor elevation.');
    if (localCeiling(s, s.footprint) - s.elevation < WALKER.headroom - EPS) add('HEADROOM_INVALID', s.id, 'Walkable floor lacks the declared walker headroom.');
    if (!plan.surfaces.some(surface => surface.kind === 'ceiling' && surface.spaceId === s.id)) add('CEILING_MISSING', s.id, 'Playable reference room requires explicit ceiling geometry.');
  }
  for (const reserve of plan.protectedVoids) {
    const issues = validateFootprint(reserve.footprint);
    issues.forEach(message => add('VOID_INVALID', reserve.id, message));
    if (!Number.isFinite(reserve.minZ) || !Number.isFinite(reserve.maxZ) || reserve.maxZ <= reserve.minZ) add('VOID_INVALID', reserve.id, 'Protected void requires a finite positive vertical interval.');
    if (issues.length) continue;
    for (const slab of surfaceMap.values()) {
      const crosses = slab.kind === 'floor' ? zOverlap(slab.elevation - slab.thickness, slab.elevation, reserve.minZ, reserve.maxZ) : slab.elevation > reserve.minZ + EPS && slab.elevation < reserve.maxZ - EPS;
      if (crosses && interiorsOverlap(slab.footprint, reserve.footprint)) add('VOID_FILLED', slab.id, `Surface fills ${reserve.id}.`);
    }
  }

  for (const opening of plan.openings) {
    const before = errors.length;
    if (!xyz(opening.center) || !Number.isFinite(opening.width) || opening.width < .8 || !Number.isFinite(opening.height) || opening.height < WALKER.headroom || !Number.isFinite(opening.approachDepth) || opening.approachDepth < .6 || !Array.isArray(opening.hosts) || opening.hosts.length !== (opening.type === 'external-door' ? 1 : 2)) { add('OPENING_INVALID', opening.id, 'Opening requires a finite physical aperture, usable approach depth, and correct host count.'); continue; }
    if (!(opening.type === 'external-door' ? ['reversible', 'entrance-only', 'exit-only'] : ['reversible', 'forward-only', 'reverse-only']).includes(opening.direction)) add('OPENING_INVALID', opening.id, 'Unknown traversal direction for this opening family.');
    const hosts = [], approaches = [];
    for (const h of opening.hosts) {
      const space = spaceMap.get(h.spaceId), edge = space?.footprint.outer[h.edgeIndex];
      if (!space || !edge || edge.kind !== 'line' || h.ring !== 'outer' || !near(space.elevation, opening.center[2])) { add('OPENING_HOST_INVALID', opening.id, 'Opening host must be a straight boundary at its actual floor elevation.'); continue; }
      const approach = approachFor(edge, opening.center, opening.width, opening.approachDepth);
      const ends = [-1, 1].map(sign => [opening.center[0] + sign * approach.tangent[0] * opening.width / 2, opening.center[1] + sign * approach.tangent[1] * opening.width / 2]);
      if (edgeDistance(edge, opening.center) > EPS || ends.some(p => edgeDistance(edge, p) > EPS)) add('OPENING_HOST_INVALID', opening.id, 'Aperture extends outside its host edge.');
      if (!footprintSubset(space.footprint, approach.footprint) || localCeiling(space, approach.footprint) - space.elevation < opening.height - EPS) add('OPENING_CLEARANCE_INVALID', opening.id, 'Approach or height is blocked on an owning side.');
      const wall = plan.walls.find(w => w.spaceId === space.id && w.host.edgeIndex === h.edgeIndex);
      if (!wall || !wall.openingIds.includes(opening.id)) add('OPENING_BLOCKED', opening.id, 'An owning wall does not contain the actual aperture.');
      hosts.push(space); approaches.push(approach);
    }
    if (hosts.length === 2 && (hosts[0].id === hosts[1].id || approaches[0].inward.some((n, i) => Math.abs(n + approaches[1].inward[i]) > EPS))) add('OPENING_HOST_INVALID', opening.id, 'Local opening must join different spaces on opposite boundary sides.');
    if (approaches[0] && !equal(opening.tangent, approaches[0].tangent)) add('OPENING_FRAME_INVALID', opening.id, 'Opening tangent does not match its first host.');
    if (errors.length !== before) continue;
    openingMap.set(opening.id, opening);
    hosts.forEach((s, index) => terminals.get(s.id).push({ id: `${opening.id}:${s.id}`, position: [...approaches[index].center, s.elevation] }));
    if (hosts.length === 2) connections.push({ id: `connection:${opening.id}`, kind: 'opening', geometryId: opening.id, from: hosts[0].id, to: hosts[1].id, direction: opening.direction });
  }

  const stairSolids = [], allReservations = [];
  for (const stair of plan.verticalTraversals) {
    const before = errors.length, source = spaceMap.get(stair.source?.spaceId), target = spaceMap.get(stair.target?.spaceId);
    const from = stair.source?.position, to = stair.target?.position;
    if (!source || !target || !xyz(from) || !xyz(to) || !near(from[2], source.elevation) || !near(to[2], target.elevation) || distance(from, to) <= EPS || to[2] <= from[2] || stair.type !== 'straight-stair' || !['reversible', 'forward-only', 'reverse-only'].includes(stair.direction)) { add('STAIR_ENDPOINT_INVALID', stair.id, 'Straight stairs must join real surfaces with nonzero horizontal run and increasing elevation.'); continue; }
    const sourceFloor = surfaceMap.get(stair.source.surfaceId), targetFloor = surfaceMap.get(stair.target.surfaceId);
    if (sourceFloor?.spaceId !== source.id || targetFloor?.spaceId !== target.id || sourceFloor?.kind !== 'floor' || targetFloor?.kind !== 'floor') add('STAIR_ENDPOINT_INVALID', stair.id, 'Stair endpoint surface references are not actual owning floors.');
    const rise = to[2] - from[2], { run, direction } = flightFrame(from, to);
    if (!Number.isFinite(stair.width) || stair.width < 1 || !Number.isFinite(stair.headroom) || stair.headroom < WALKER.headroom || !Number.isInteger(stair.riserCount) || stair.riserCount < 1 || stair.riserCount > 64 || !near(stair.riserHeight, rise / stair.riserCount) || stair.riserHeight > .2 || !near(stair.treadDepth, run / stair.riserCount) || stair.treadDepth < .26 || rise / run > Math.tan(40 * Math.PI / 180)) add('STAIR_DIMENSIONS_INVALID', stair.id, 'Stair width, rise, run, risers, treads, slope, or headroom is invalid.');
    if (!Array.isArray(stair.landings) || stair.landings.length !== 2 || !Array.isArray(stair.treads) || stair.treads.length !== stair.riserCount) { add('STAIR_GEOMETRY_INVALID', stair.id, 'Stair requires two landings and every actual tread.'); continue; }
    const expectedLandings = [flightRect([from[0] - direction[0], from[1] - direction[1]], stair.width, 1, direction), flightRect(to, stair.width, 1, direction)];
    for (let i = 0; i < 2; i++) {
      const owner = i === 0 ? source : target, landing = stair.landings[i], endpoint = i === 0 ? from : to;
      const issues = validateFootprint(landing.footprint);
      if (issues.length || !near(landing.elevation, endpoint[2]) || !nearFootprint(landing.footprint, expectedLandings[i]) || !footprintSubset(owner.footprint, landing.footprint) || localCeiling(owner, landing.footprint) - owner.elevation < stair.headroom - EPS) add('STAIR_LANDING_INVALID', stair.id, 'Landing must have full width/depth, actual support, and headroom at its endpoint.');
    }
    const reservations = [];
    for (let step = 0; step < stair.treads.length; step++) {
      const tread = stair.treads[step], expected = flightRect([from[0] + direction[0] * step * stair.treadDepth, from[1] + direction[1] * step * stair.treadDepth], stair.width, stair.treadDepth, direction), elevation = q(from[2] + rise * (step + 1) / stair.riserCount);
      const issues = validateFootprint(tread.footprint);
      if (issues.length || !nearFootprint(tread.footprint, expected) || !near(tread.elevation, elevation)) { add('STAIR_GEOMETRY_INVALID', stair.id, 'Tread position, dimensions, or elevation disagrees with the physical flight.'); continue; }
      reservations.push({ footprint: tread.footprint, minZ: tread.elevation, maxZ: tread.elevation + stair.headroom });
      allReservations.push({ stairId: stair.id, footprint: tread.footprint, minZ: tread.elevation, maxZ: tread.elevation + stair.headroom });
      stairSolids.push({ stairId: stair.id, footprint: tread.footprint, minZ: from[2], maxZ: tread.elevation });
    }
    for (const reservation of reservations) for (const surface of surfaceMap.values()) {
      const crosses = surface.kind === 'floor' ? zOverlap(surface.elevation - surface.thickness, surface.elevation, reservation.minZ, reservation.maxZ) : surface.elevation > reservation.minZ + EPS && surface.elevation < reservation.maxZ - EPS;
      if (crosses && interiorsOverlap(surface.footprint, reservation.footprint)) add('STAIR_HEADROOM_BLOCKED', stair.id, `Headroom intersects ${surface.id}.`);
    }
    if (errors.length !== before) continue;
    terminals.get(source.id).push({ id: `${stair.id}:source`, position: [q(from[0] - direction[0] * .5), q(from[1] - direction[1] * .5), from[2]] });
    terminals.get(target.id).push({ id: `${stair.id}:target`, position: [q(to[0] + direction[0] * .5), q(to[1] + direction[1] * .5), to[2]] });
    connections.push({ id: `connection:${stair.id}`, kind: 'stair', geometryId: stair.id, from: source.id, to: target.id, direction: stair.direction });
  }
  for (const solid of stairSolids) for (const volume of validVolumes) if (zOverlap(solid.minZ, solid.maxZ, volume.minZ, volume.maxZ) && interiorsOverlap(solid.footprint, volume.footprint)) add('STAIR_SOLID_COLLISION', solid.stairId, `Stair body obstructs ${volume.spaceId}.`);
  for (const reservation of allReservations) for (const solid of stairSolids) if (zOverlap(reservation.minZ, reservation.maxZ, solid.minZ, solid.maxZ) && interiorsOverlap(reservation.footprint, solid.footprint)) add('STAIR_HEADROOM_BLOCKED', reservation.stairId, `Headroom intersects the body of ${solid.stairId}.`);

  for (const req of plan.input.portRequirements) {
    const port = plan.externalPorts.find(p => p.contractId === req.contractId), opening = port && openingMap.get(port.openingId), owner = port && spaceMap.get(port.owningSpaceId);
    if (!port) { add('PORT_UNREALIZED', req.portId, 'Required external contract could not be realized.'); continue; }
    if (['portId', 'role', 'family', 'direction', 'floorIndex', 'width', 'height', 'approachDepth'].some(key => port[key] !== req[key])) add('PORT_CONTRACT_MISMATCH', req.portId, 'Realized port differs from its supplied contract.');
    if (!opening || !owner || opening.hosts.length !== 1 || opening.hosts[0].spaceId !== owner.id || owner.floorIndex !== req.floorIndex || opening.type !== 'external-door' || opening.width !== req.width || opening.height !== req.height || opening.direction !== req.direction || opening.approachDepth !== req.approachDepth) { add('PORT_HOST_INVALID', req.portId, 'Port lacks its actual compatible external aperture.'); continue; }
    const edge = owner.footprint.outer[opening.hosts[0].edgeIndex], expected = approachFor(edge, opening.center, opening.width, opening.approachDepth);
    if (!equal(port.approach, expected.footprint) || !equal(port.anchor.position, opening.center) || !equal(port.anchor.up, [0, 0, 1]) || port.anchor.forward.some((n, i) => Math.abs(n - (i === 2 ? 0 : -expected.inward[i])) > EPS)) add('PORT_FRAME_INVALID', req.portId, 'Port frame and local approach differ from their physical aperture.');
    const outward = approachFor(line(edge.to, edge.from), opening.center, opening.width, .8).footprint;
    if (plan.spaces.some(other => other.id !== owner.id && other.floorIndex === owner.floorIndex && interiorsOverlap(other.footprint, outward))) add('PORT_NOT_EXTERNAL', req.portId, 'External port opens into another local room.');
  }
  for (const port of plan.externalPorts) if (!plan.input.portRequirements.some(r => r.contractId === port.contractId)) add('PORT_UNEXPECTED', port.portId, 'External port has no supplied contract.');

  if (spaceMap.size === plan.spaces.length) {
    if (!equal(plan.walls, deriveWalls(plan))) add('WALL_GEOMETRY_MISMATCH', 'walls', 'Wall boundaries, heights, or apertures differ from their owning spaces/openings.');
    if (!equal(plan.guards, deriveGuards(plan))) add('GUARD_INVALID', 'guards', 'Every exposed slab/shaft edge needs its expected guard, except validated stair thresholds.');
  }
  const spacePaths = [];
  for (const s of spaceMap.values()) {
    const points = terminals.get(s.id);
    if (!points.length) { add('SPACE_NO_ACCESS', s.id, 'Playable space has no validated physical arrival.'); spacePaths.push({ spaceId: s.id, valid: false, paths: [] }); continue; }
    const witnesses = localWalkPaths(s.footprint, points, WALKER.radius);
    spacePaths.push({ spaceId: s.id, ...witnesses });
    if (!witnesses.valid) add('SPACE_PATH_BLOCKED', s.id, 'A walker-width path cannot connect all openings and landings inside the actual floor.');
  }
  const blockedSpaces = new Set(spacePaths.filter(p => !p.valid).map(p => p.spaceId));
  const usableConnections = connections.filter(e => !blockedSpaces.has(e.from) && !blockedSpaces.has(e.to)).sort((a, b) => a.id < b.id ? -1 : 1);
  if (checkCachedConnections && !equal(plan.localConnections, usableConnections)) add('CONNECTION_CACHE_MISMATCH', 'localConnections', 'Exported graph differs from physically derived navigation.');
  const arrival = plan.externalPorts.find(p => p.role === 'primary' && p.direction !== 'exit-only' && openingMap.has(p.openingId)) ?? plan.externalPorts.find(p => p.direction !== 'exit-only' && openingMap.has(p.openingId));
  if (!arrival) add('ARRIVAL_MISSING', 'externalPorts', 'At least one usable incoming external port is required.');
  const reach = graphReachability(plan.spaces.filter(s => s.playable).map(s => s.id), usableConnections, arrival?.owningSpaceId);
  reach.unreachable.forEach(id => add('SPACE_UNREACHABLE', id, 'Space is unreachable from the designated arrival.'));
  reach.noReturnPath.forEach(id => add('RETURN_PATH_MISSING', id, 'Space cannot return to the reversible arrival core.'));
  for (const p of plan.externalPorts) if (!reach.reachable.includes(p.owningSpaceId)) add('PORT_UNREACHABLE', p.portId, 'External port is not reachable through the local physical network.');
  const footprintArea = plan.spaces.reduce((n, s) => n + (spaceMap.has(s.id) ? signedArea(s.footprint.outer) + s.footprint.holes.reduce((a, ring) => a + signedArea(ring), 0) : 0), 0);
  return {
    status: errors.length ? 'invalid' : 'architecture-valid', scope: plan.kind === 'generated-house' ? 'Phase 3 generated architecture and declared walker navigation' : 'Phase 2 reference geometry and declared walker navigation', errors,
    warnings: [plan.kind === 'generated-house' ? { code: 'HOUSE_DIRECTOR_SCOPE', message: 'Generated houses use bounded architectural grammars, door ports, and straight stairs. Engine collision and structural support remain separate realization tasks.' } : { code: 'REFERENCE_LAYOUT', message: 'This is a designed reference house. Seed records identity; procedural layout diversity is pending Phase 3.' }],
    metrics: { spaces: plan.spaces.length, floors: plan.floors.length, arcs: plan.spaces.flatMap(s => [s.footprint.outer, ...s.footprint.holes].flat()).filter(e => e.kind === 'arc').length, stairs: plan.verticalTraversals.length, portsRequested: plan.input.portRequirements.length, portsRealized: plan.externalPorts.length, netFootprintArea: q(footprintArea), reachableSpaces: reach.reachable.length, cycleRank: plan.spaces.length ? Math.max(0, usableConnections.length - plan.spaces.length + 1) : 0 },
    reachability: errors.length ? 'failed' : 'validated', navigation: { ...reach, connections: usableConnections, spacePaths, walker: { ...WALKER } }
  };
}
