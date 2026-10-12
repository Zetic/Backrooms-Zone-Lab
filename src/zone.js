import { fingerprint, canonicalStringify, stream } from './determinism.js';
import { EPS, q, point, at, tangent, line, arc, rectangle, circle, polygon, transform, edgeDistance, validateFootprint, footprintSubset, interiorsOverlap, signedArea } from './geometry.js';

export const SCHEMA_VERSION = 'br.zone/0.1';
export const GENERATOR_VERSION = 1;
export const PROFILES = {
  angular: { name: 'Angled wing', summary: 'Rotated wing and concave service footprint. Independent geometry specimens.' },
  rotunda: { name: 'Rotunda & apse', summary: 'Exact circular arcs and a semicircular apse joined to straight walls.' },
  gallery: { name: 'Gallery & void', summary: 'An annular upper-floor slab with a protected central void. Stair access is pending Phase 2.' }
};
export const defaultPorts = () => [
  { contractId: 'required-primary', portId: 'port-primary', role: 'primary', family: 'door', direction: 'reversible', floorIndex: 0, width: 1.2, height: 2.2, approachDepth: 1.5 },
  { contractId: 'required-secondary', portId: 'port-secondary', role: 'secondary', family: 'door', direction: 'reversible', floorIndex: 0, width: 1, height: 2.2, approachDepth: 1.2 },
  { contractId: 'required-upper', portId: 'port-upper', role: 'secondary', family: 'door', direction: 'reversible', floorIndex: 1, width: 1, height: 2.2, approachDepth: 1.2 }
];

export function normalizeInput(raw = {}) {
  const input = {
    zoneId: raw.zoneId ?? 'geometry-study', seed: String(raw.seed ?? '12345'),
    generatorVersion: raw.generatorVersion ?? GENERATOR_VERSION,
    profile: raw.profile ?? 'gallery', config: { floorHeight: raw.config?.floorHeight ?? 3.2 },
    portRequirements: structuredClone(raw.portRequirements ?? defaultPorts())
  };
  if (typeof input.zoneId !== 'string' || !input.zoneId.trim() || input.zoneId.length > 120 || !input.seed.trim() || input.seed.length > 120) throw new Error('Zone ID and seed require nonempty bounded strings (maximum 120 characters).');
  if (input.generatorVersion !== GENERATOR_VERSION) throw new Error(`Unsupported generator version: ${input.generatorVersion}.`);
  if (!Object.hasOwn(PROFILES, input.profile)) throw new Error('Unknown geometry study profile.');
  if (!Number.isFinite(input.config.floorHeight) || input.config.floorHeight < 2.6 || input.config.floorHeight > 5) throw new Error('Floor height must be between 2.6 and 5 metres.');
  if (!Array.isArray(input.portRequirements) || input.portRequirements.length > 8) throw new Error('Port requirements must be an array with at most 8 contracts.');
  const seenIds = new Set(), seenPorts = new Set();
  for (const p of input.portRequirements) {
    if (!p || typeof p.contractId !== 'string' || !p.contractId.trim() || typeof p.portId !== 'string' || !p.portId.trim()) throw new Error('Every port requires contractId and portId.');
    if (seenIds.has(p.contractId) || seenPorts.has(p.portId)) throw new Error('Port and contract IDs must be unique.');
    seenIds.add(p.contractId); seenPorts.add(p.portId);
    if (!['primary', 'secondary'].includes(p.role) || !['reversible', 'entrance-only', 'exit-only'].includes(p.direction)) throw new Error('Invalid port role or traversal direction.');
    if (p.family !== 'door') throw new Error('Phase 1 realizes door contracts only; other families are unsupported.');
    if (![0, 1].includes(p.floorIndex)) throw new Error('Geometry studies have only floor indices 0 and 1.');
    if (![p.width, p.height, p.approachDepth].every(n => Number.isFinite(n) && n > 0 && n <= 20)) throw new Error('Port dimensions must be finite and positive (maximum 20 metres).');
  }
  input.portRequirements.sort((a, b) => a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0);
  return input;
}

function studySpaces(input) {
  const random = stream(input, 'geometry-study');
  const angle = q(15 + random() * 30), radius = q(2.5 + random() * 1.3);
  const floorHeight = input.config.floorHeight;
  const spaces = [];
  const add = (id, label, footprint, floorIndex = 0, role = 'specimen') => spaces.push({ id, label, role, tags: ['geometry-study'], playable: false, floorIndex, elevation: q(floorIndex * floorHeight), clearHeight: q(floorHeight - 0.2), footprint });
  add('study-hall', 'Rectilinear hall', rectangle(8, 6));
  if (input.profile === 'angular') {
    add('study-feature', `Angled wing · ${angle.toFixed(1)}°`, transform(rectangle(6, 4), [13, 0], angle));
    add('study-service', 'Concave service wing', transform(polygon([[0, 0], [6, 0], [6, 2], [3, 2], [3, 5], [0, 5]]), [-10, 0], 0));
  } else {
    add('study-feature', 'Semicircular apse', transform({ outer: [line([-radius, 0], [radius, 0]), arc([0, 0], radius, 0, 180)], holes: [] }, [13, 0], angle));
    add('study-service', 'Circular rotunda', transform(circle(radius), [-6, 3], 0));
  }
  if (input.profile === 'gallery') {
    const footprint = transform({ outer: circle(4.8).outer, holes: [[arc([0, 0], 2.3, 0, -180), arc([0, 0], 2.3, -180, -180)]] }, [4, 3], 0);
    add('study-gallery', 'Upper gallery slab', footprint, 1, 'gallery');
  }
  add('study-upper', 'Upper landing specimen', transform(rectangle(6, 4), [13, 10], 0), 1, 'landing');
  return spaces;
}

// Port realizations prove boundary placement + local rectangular approach only.
// They do not establish arrival reachability through the whole zone.
function realizePorts(input, spaces) {
  const ports = [], openings = [], failures = [];
  const used = new Set();
  for (const req of input.portRequirements) {
    let selected;
    for (const space of spaces.filter(s => s.floorIndex === req.floorIndex)) {
      for (let edgeIndex = 0; edgeIndex < space.footprint.outer.length; edgeIndex++) {
        const edge = space.footprint.outer[edgeIndex];
        if (edge.kind !== 'line' || used.has(`${space.id}/${edgeIndex}`)) continue;
        const p = at(edge, 0.5), v = tangent(edge, 0.5), length = Math.hypot(...v);
        if (length < req.width + 0.4 || req.height > space.clearHeight) continue;
        const u = v.map(n => n / length), inward = [-u[1], u[0]];
        const a = point(p[0] - u[0] * req.width / 2, p[1] - u[1] * req.width / 2);
        const b = point(p[0] + u[0] * req.width / 2, p[1] + u[1] * req.width / 2);
        const approach = polygon([a, b, point(b[0] + inward[0] * req.approachDepth, b[1] + inward[1] * req.approachDepth), point(a[0] + inward[0] * req.approachDepth, a[1] + inward[1] * req.approachDepth)]);
        if (validateApproach(space, edgeIndex, approach).length) continue;
        selected = { space, edgeIndex, p, u, inward, approach };
        break;
      }
      if (selected) break;
    }
    if (!selected) { failures.push({ code: 'PORT_UNREALIZED', entityId: req.portId, message: `No free straight boundary can satisfy ${req.contractId} on floor ${req.floorIndex + 1}.` }); continue; }
    const { space, edgeIndex, p, u, inward, approach } = selected;
    used.add(`${space.id}/${edgeIndex}`);
    const openingId = `opening:${req.portId}`;
    openings.push({ id: openingId, type: 'external-door', spaceId: space.id, host: { ring: 'outer', edgeIndex }, center: [q(p[0]), q(p[1]), space.elevation], width: req.width, height: req.height, tangent: u.map(q) });
    ports.push({ ...req, owningSpaceId: space.id, openingId, anchor: { position: [q(p[0]), q(p[1]), space.elevation], forward: [-q(inward[0]), -q(inward[1]), 0], up: [0, 0, 1], usableApproachSide: 'interior' }, approach, validation: { boundary: true, localClearance: true, zoneReachability: 'not-evaluated' } });
  }
  return { ports, openings, failures };
}

function validateApproach(space, edgeIndex, footprint) {
  const errors = validateFootprint(footprint);
  if (errors.length) return errors;
  if (!space.footprint.outer[edgeIndex] || !footprintSubset(space.footprint, footprint)) errors.push('Approach extends outside or crosses an owning-space boundary.');
  return errors;
}

export function validatePlan(plan) {
  const errors = [], add = (code, entityId, message) => errors.push({ code, entityId, message });
  const validSpaces = [];
  for (const s of plan.spaces) {
    const problems = validateFootprint(s.footprint);
    problems.forEach(message => add('FOOTPRINT_INVALID', s.id, message));
    if (!Number.isFinite(s.elevation) || !Number.isFinite(s.clearHeight) || s.clearHeight <= 0) add('VOLUME_INVALID', s.id, 'Elevation and positive clear height must be finite.');
    if (!problems.length) validSpaces.push(s);
  }
  for (let i = 0; i < validSpaces.length; i++) for (let j = i + 1; j < validSpaces.length; j++) {
    const a = validSpaces[i], b = validSpaces[j];
    if (Math.min(a.elevation + a.clearHeight, b.elevation + b.clearHeight) > Math.max(a.elevation, b.elevation) + EPS && interiorsOverlap(a.footprint, b.footprint)) add('SPACE_OVERLAP', `${a.id}/${b.id}`, 'Clear volumes overlap in XY and Z.');
  }
  const ids = new Set();
  for (const entity of [...plan.floors, ...plan.spaces, ...plan.surfaces, ...plan.protectedVoids, ...plan.openings, ...plan.externalPorts]) {
    if (ids.has(entity.id ?? entity.portId)) add('DUPLICATE_ID', entity.id ?? entity.portId, 'Entity ID is repeated.');
    ids.add(entity.id ?? entity.portId);
  }
  for (const s of validSpaces) {
    const floor = plan.floors.find(f => f.index === s.floorIndex);
    const slab = plan.surfaces.find(surface => surface.kind === 'floor' && surface.spaceId === s.id);
    if (!floor || Math.abs(floor.elevation - s.elevation) > EPS || !slab || Math.abs(slab.elevation - s.elevation) > EPS || canonicalStringify(slab.footprint) !== canonicalStringify(s.footprint)) add('FLOOR_INVALID', s.id, 'Space requires a matching floor elevation and canonical floor surface.');
  }
  for (const req of plan.input.portRequirements) {
    const p = plan.externalPorts.find(p => p.contractId === req.contractId);
    if (!p) { add('PORT_UNREALIZED', req.portId, `Required contract ${req.contractId} is absent.`); continue; }
    const expected = ['contractId', 'portId', 'role', 'family', 'direction', 'floorIndex', 'width', 'height', 'approachDepth'];
    if (expected.some(k => p[k] !== req[k])) add('PORT_CONTRACT_MISMATCH', req.portId, 'Published port does not match its input contract.');
    const space = validSpaces.find(s => s.id === p.owningSpaceId);
    const opening = plan.openings.find(o => o.id === p.openingId);
    if (!space || !opening || opening.spaceId !== space.id || space.floorIndex !== req.floorIndex) { add('PORT_HOST_INVALID', req.portId, 'Port must reference its floor and actual owning opening.'); continue; }
    const edge = space.footprint.outer[opening.host.edgeIndex];
    if (!edge || edge.kind !== 'line') { add('PORT_HOST_INVALID', req.portId, 'Phase 1 openings require a straight outer boundary.'); continue; }
    if (edgeDistance(edge, opening.center) > EPS || Math.abs(opening.center[2] - space.elevation) > EPS || opening.width !== req.width || opening.height !== req.height || req.height > space.clearHeight) add('OPENING_INVALID', opening.id, 'Opening position/dimensions do not satisfy its boundary and contract.');
    if (p.anchor.position.some((v, i) => Math.abs(v - opening.center[i]) > EPS)) add('PORT_ANCHOR_INVALID', req.portId, 'Port frame and opening center disagree.');
    const v = tangent(edge, 0.5), len = Math.hypot(...v), u = v.map(n => n / len);
    const outward = [u[1], -u[0], 0];
    if (p.anchor.forward.some((v, i) => Math.abs(v - outward[i]) > EPS) || opening.tangent.some((v, i) => Math.abs(v - u[i]) > EPS)) add('PORT_FRAME_INVALID', req.portId, 'Port frame must face outward from its host boundary.');
    const ends = [-1, 1].map(sign => point(opening.center[0] + sign * u[0] * req.width / 2, opening.center[1] + sign * u[1] * req.width / 2));
    if (ends.some(end => edgeDistance(edge, end) > EPS)) add('OPENING_INVALID', opening.id, 'Opening extends beyond host edge.');
    const inward = [-outward[0], -outward[1]];
    const expectedApproach = polygon([ends[0], ends[1], point(ends[1][0] + inward[0] * req.approachDepth, ends[1][1] + inward[1] * req.approachDepth), point(ends[0][0] + inward[0] * req.approachDepth, ends[0][1] + inward[1] * req.approachDepth)]);
    if (canonicalStringify(expectedApproach) !== canonicalStringify(p.approach)) add('PORT_CLEARANCE_INVALID', req.portId, 'Approach must match the contract width/depth and host frame.');
    validateApproach(space, opening.host.edgeIndex, p.approach).forEach(message => add('PORT_CLEARANCE_INVALID', req.portId, message));
  }
  for (const p of plan.externalPorts) if (!plan.input.portRequirements.some(r => r.contractId === p.contractId)) add('PORT_UNEXPECTED', p.portId, 'Port lacks an input contract.');
  for (const reserve of plan.protectedVoids) {
    const issues = validateFootprint(reserve.footprint);
    issues.forEach(message => add('VOID_INVALID', reserve.id, message));
    if (!Number.isFinite(reserve.minZ) || !Number.isFinite(reserve.maxZ) || reserve.maxZ <= reserve.minZ) add('VOID_INVALID', reserve.id, 'Void requires a finite positive vertical interval.');
    if (!issues.length) for (const slab of plan.surfaces.filter(s => s.kind === 'floor')) if (slab.elevation >= reserve.minZ - EPS && slab.elevation < reserve.maxZ - EPS && interiorsOverlap(slab.footprint, reserve.footprint)) add('VOID_FILLED', slab.id, 'Floor slab fills protected void.');
  }
  const area = validSpaces.reduce((sum, s) => sum + signedArea(s.footprint.outer) + s.footprint.holes.reduce((n, h) => n + signedArea(h), 0), 0);
  return { status: errors.length ? 'invalid' : 'geometry-valid', scope: 'Phase 1 geometry and local port clearance only', errors, warnings: [{ code: 'NAVIGATION_PENDING', message: 'These are isolated geometry specimens. Physical stairs, inter-room openings, and whole-zone reachability are not implemented.' }], metrics: { spaces: plan.spaces.length, floors: plan.floors.length, arcs: plan.spaces.flatMap(s => [s.footprint.outer, ...s.footprint.holes].flat()).filter(e => e.kind === 'arc').length, portsRequested: plan.input.portRequirements.length, portsRealized: plan.externalPorts.length, netFootprintArea: q(area) }, reachability: 'not-evaluated' };
}

export function generateStudy(raw) {
  const input = normalizeInput(raw), spaces = studySpaces(input);
  const { ports, openings } = realizePorts(input, spaces);
  const plan = {
    schemaVersion: SCHEMA_VERSION, kind: 'geometry-study', zoneId: input.zoneId, input,
    conventions: { units: 'metres', axes: { horizontal: ['X', 'Y'], vertical: 'Z', handedness: 'right' }, angles: 'degrees; positive counterclockwise in XY', coordinateQuantum: 1e-6, predicateTolerance: EPS, outerWinding: 'counterclockwise', holeWinding: 'clockwise' },
    floors: [0, 1].map(index => ({ id: `floor:${index}`, index, elevation: q(index * input.config.floorHeight) })),
    spaces, surfaces: spaces.map(s => ({ id: `floor:${s.id}`, kind: 'floor', spaceId: s.id, elevation: s.elevation, footprint: structuredClone(s.footprint) })),
    protectedVoids: input.profile === 'gallery' ? [{ id: 'void:gallery', footprint: transform(circle(2.3), [4, 3], 0), minZ: input.config.floorHeight, maxZ: q(input.config.floorHeight * 2) }] : [],
    openings, verticalTraversals: [], localConnections: [], externalPorts: ports
  };
  plan.diagnostics = validatePlan(plan);
  plan.fingerprint = fingerprint(plan);
  return plan;
}

export function canonicalExport(plan) { return canonicalStringify(plan) + '\n'; }
