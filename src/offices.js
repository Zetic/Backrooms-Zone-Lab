// Full office realization: rotated department footprints, real thresholds and clear floors.
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/offices.js';
import { polygon, q, point, signedArea, interiorsOverlap } from './geometry.js';
import { hostAt, approachFor, deriveWalls, deriveGuards } from './structure.js';
import { validateArchitecture } from './physical.js';
import { realizeWalls } from './walls.js';
import { fingerprint } from './determinism.js';
const api = globalThis.ZoneExchange;
export const officeTemplate = () => api.templates.find(t => t.id === 'offices');
// Convex offset places wall mass outside actual clear floor, including chamfered corners.
function inset(vertices, amount) {
  const shifted = vertices.map((a, i) => {
    const b = vertices[(i + 1) % vertices.length], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d);
    return { p: [a[0] - d[1] / l * amount, a[1] + d[0] / l * amount], d };
  });
  return shifted.map((b, i) => {
    const a = shifted[(i + shifted.length - 1) % shifted.length], cross = a.d[0] * b.d[1] - a.d[1] * b.d[0];
    const delta = [b.p[0] - a.p[0], b.p[1] - a.p[1]], t = (delta[0] * b.d[1] - delta[1] * b.d[0]) / cross;
    return point(a.p[0] + t * a.d[0], a.p[1] + t * a.d[1]);
  });
}
export function generateOfficeDesign(spec, { angled = true, walls = true } = {}) {
  const model = officeTemplate().design(spec);
  if (model.error) throw new Error(model.error);
  const { zone, layout } = model, thickness = .15, half = thickness / 2;
  const plan = { schemaVersion: 'br.zone/0.3', kind: 'generated-office', zoneId: zone.id,
    input: { zoneId: zone.id, seed: String(spec.seed), generatorVersion: 3, profile: 'offices', config: { floorHeight: 3, wallThickness: thickness, angled, dials: zone.source.dials }, portRequirements: [] },
    conventions: { units: 'metres', axes: { horizontal: ['X', 'Y'], vertical: 'Z', handedness: 'right' }, outerWinding: 'counterclockwise', holeWinding: 'clockwise', coordinateQuantum: 1e-6 },
    walker: { radius: .3, headroom: 2.1 }, floors: [{ id: 'floor:0', index: 0, elevation: 0 }], spaces: [], surfaces: [], openings: [], verticalTraversals: [], protectedVoids: [], externalPorts: [], walls: [], guards: [], localConnections: [],
    layout: { signature: { upperFloorIndex: 0 }, wingCount: layout.wings.length, orientation: angled ? 'angled-independent-wings' : 'orthogonal-independent-wings', wings: [], architecturalRules: zone.rules, sourceTemplate: 'offices-v3' } };
  const transforms = new Map(), rootJoins = new Map();
  const headings = [45, 135, 0, 180], corners = ['hub-ne', 'hub-nw', 'hub-east', 'hub-west'];
  const signs = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const w of layout.wings) {
    let transform;
    if (w.parentWing !== null) transform = transforms.get('wing-' + w.parentWing);
    else if (!angled) transform = p => point(p[0] * .5, p[1] * .5);
    else {
      const heading = headings[w.index] * Math.PI / 180, delta = heading - w.frame.dir * Math.PI / 2;
      const [sx, sy] = signs[w.index], gate = w.index < 2 ? [(layout.cx + .7 * layout.hw) * sx * .5, (layout.cy + .7 * layout.hw) * sy * .5] : [(layout.cx + layout.hw) * (w.index === 2 ? 1 : -1) * .5, 0];
      const advance = Math.min(layout.wings.length, 4) >= 3 ? (w.index < 2 ? Math.max(...layout.wings.flatMap(w => w.rooms.map(r => r.depth))) + layout.hw : 0) : Math.floor(zone.source.dials.strange * (100 - zone.source.dials.cohesion) / 500);
      const origin = [gate[0] + Math.sin(heading) * layout.hw / 4, gate[1] - Math.cos(heading) * layout.hw / 4];
      transform = p => { const x = (p[0] - w.frame.x) * .5, y = (p[1] - w.frame.y) * .5;
        const u = x * Math.cos(w.frame.dir * Math.PI / 2) + y * Math.sin(w.frame.dir * Math.PI / 2), extra = u >= .25 ? advance * .5 : 0;
        return point(origin[0] + x * Math.cos(delta) - y * Math.sin(delta) + extra * Math.cos(heading), origin[1] + x * Math.sin(delta) + y * Math.cos(delta) + extra * Math.sin(heading)); };
      rootJoins.set(w.group, { parent: corners[w.index], gate });
    }
    transforms.set(w.group, transform); plan.layout.wings.push({ id: w.group, parentWing: w.parentWing, headingDegrees: angled ? (w.parentWing === null ? headings[w.index] : headings[w.parentWing] + 90) : w.frame.dir * 90, rooms: w.rooms });
  }
  const move = (id, p) => (transforms.get(layout.groups[id]) ?? (p => point(p[0] * .5, p[1] * .5)))(p);
  const spaces = new Map();
  for (const s of zone.spaces) {
    const r = s.rect; let vertices = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]].map(p => p.map(v => v * .5));
    if (angled && /^hub-(ne|nw|se|sw)$/.test(s.id)) {
      const suffix = s.id.slice(4), sx = suffix.includes('e') ? 1 : -1, sy = suffix.includes('n') ? 1 : -1, cut = layout.hw * .6;
      vertices = [[layout.cx, layout.cy], [layout.cx + layout.hw, layout.cy], [layout.cx + layout.hw, layout.cy + layout.hw - cut], [layout.cx + layout.hw - cut, layout.cy + layout.hw], [layout.cx, layout.cy + layout.hw]].map(p => [p[0] * sx * .5, p[1] * sy * .5]);
      if (signedArea(polygon(vertices).outer) < 0) vertices.reverse();
    }
    const floor = inset(vertices, half).map(p => layout.groups[s.id] === 'hub' ? p : move(s.id, p.map(v => v * 2)));
    const footprint = polygon(floor), clearHeight = s.ceiling / 100;
    const anchor = floor.reduce((p, v) => [p[0] + v[0] / floor.length, p[1] + v[1] / floor.length], [0, 0]).map(q);
    const room = { id: s.id, label: s.title, role: ['hall', 'exit'].includes(s.role) ? 'circulation' : s.role === 'reception' || s.role === 'meeting' ? 'public' : ['office', 'work', 'conference', 'team'].includes(s.role) ? 'private' : 'service', tags: ['office', s.role, layout.groups[s.id]], playable: true, floorIndex: 0, elevation: 0, clearHeight, footprint, labelAnchor: anchor, clearVolumes: [{ footprint: structuredClone(footprint), minZ: 0, maxZ: clearHeight }] };
    plan.spaces.push(room); spaces.set(room.id, room);
    for (const kind of ['floor', 'ceiling']) plan.surfaces.push({ id: kind + ':' + room.id, kind, spaceId: room.id, elevation: kind === 'floor' ? 0 : clearHeight, thickness: .2, footprint: structuredClone(footprint) });
  }
  function opening(aId, bId, allocation, width, inwardOverride) {
    const a = spaces.get(aId), b = bId && spaces.get(bId);
    // Find the matching clear edge nearest the allocated threshold. Inset keeps its normal.
    const edges = a.footprint.outer.map((e, i) => { const dx = e.to[0] - e.from[0], dy = e.to[1] - e.from[1], len = Math.hypot(dx, dy), inward = [-dy / len, dx / len]; const at = [allocation[0] + inward[0] * half, allocation[1] + inward[1] * half]; return { i, inward, at, error: Math.abs((at[0] - e.from[0]) * dy - (at[1] - e.from[1]) * dx) / len }; }).filter(e => !inwardOverride || e.inward.every((v, i) => Math.abs(v - inwardOverride[i]) < 1e-5)).sort((a, b) => a.error - b.error || a.i - b.i);
    let hosts, xy, approach;
    for (const candidate of edges) {
      xy = point(...candidate.at);
      try { const first = hostAt(a, xy, width); approach = approachFor(a.footprint.outer[first.edgeIndex], xy, width, .6); hosts = [{ ...first, center: [...xy, 0] }]; if (b) { const other = point(xy[0] - approach.inward[0] * thickness, xy[1] - approach.inward[1] * thickness); hosts.push({ ...hostAt(b, other, width), center: [...other, 0] }); } break; } catch { hosts = null; }
    }
    if (!hosts) throw new Error('Office threshold cannot be realized: ' + aId + '/' + bId);
    const id = (b ? 'door:' : 'external:') + aId + (b ? ':' + bId : ':' + plan.externalPorts.length);
    const o = { id, type: b ? 'local-passage' : 'external-door', hosts, center: [...xy, 0], tangent: approach.tangent, width, height: Math.min(2.1, a.clearHeight, b?.clearHeight ?? 3), approachDepth: .6, direction: 'reversible' };
    plan.openings.push(o); return { opening: o, approach };
  }
  for (const j of zone.joins) {
    const a = zone.spaces.find(s => s.id === j.a), b = zone.spaces.find(s => s.id === j.b), wall = api.shared(a, b);
    let aId = a.id, bId = b.id, p = wall.axis === 'x' ? [(wall.low + wall.high) / 2, wall.plane] : [wall.plane, (wall.low + wall.high) / 2];
    const wing = layout.wings.find(w => w.parentWing === null && ((j.a === w.parentId && j.b.startsWith(w.group + '-hall-')) || (j.b === w.parentId && j.a.startsWith(w.group + '-hall-'))));
    if (wing && angled) { const root = rootJoins.get(wing.group); if (aId === wing.parentId) aId = root.parent; else bId = root.parent; p = root.gate; }
    else p = move(a.id, p);
    const corner = /^hub-(ne|nw|se|sw)$/.test(aId) || /^hub-(ne|nw|se|sw)$/.test(bId);
    opening(aId, bId, p, corner ? 1 : j.mode === 'door' ? 1 : 1.4);
  }
  // Shared core extends into the protected central gap between the department arms.
  // This full-design programme is explicit; it is never silently flattened into v1 rectangles.
  if (angled) {
    const start = (layout.cy + layout.hw) * .5, end = start + 16;
    function common(id, label, vertices, role, tag) {
      const footprint = polygon(inset(vertices, half));
      if (plan.spaces.some(s => interiorsOverlap(s.footprint, footprint))) throw new Error(id + ': shared core collides with a department.');
      const anchor = vertices.reduce((p, v) => [p[0] + v[0] / vertices.length, p[1] + v[1] / vertices.length], [0, 0]);
      const s = { id, label, role, tags: ['office', tag, 'shared-core'], playable: true, floorIndex: 0, elevation: 0, clearHeight: 2.7, footprint, labelAnchor: anchor, clearVolumes: [{ footprint: structuredClone(footprint), minZ: 0, maxZ: 2.7 }] };
      spaces.set(id, s); plan.spaces.push(s);
      for (const kind of ['floor', 'ceiling']) plan.surfaces.push({ id: kind + ':' + id, kind, spaceId: id, elevation: kind === 'floor' ? 0 : 2.7, thickness: .2, footprint: structuredClone(footprint) });
    }
    common('shared-core-hall-0', 'Shared facilities', [[-1, start], [1, start], [1, start + 8], [-1, start + 8]], 'circulation', 'hall');
    common('shared-core-hall-1', 'Shared facilities', [[-1, start + 8], [1, start + 8], [1, end], [-1, end]], 'circulation', 'hall');
    opening('hub-north', 'shared-core-hall-0', [0, start], 1.2);
    opening('shared-core-hall-0', 'shared-core-hall-1', [0, start + 8], 1.4);
    for (const side of [-1, 1]) {
      let accepted;
      for (const width of [3, 2.5, 2]) {
        const vertices = side < 0 ? [[-1 - width, end - 4], [-1, end - 4], [-1, end], [-1 - width, end]] : [[1, end - 4], [1 + width, end - 4], [1 + width, end], [1, end]];
        const footprint = polygon(inset(vertices, half));
        if (!plan.spaces.some(s => interiorsOverlap(s.footprint, footprint))) { accepted = vertices; break; }
      }
      if (!accepted) throw new Error('Shared focus-room capacity cannot fit the full department footprints.');
      const id = 'shared-focus-' + (side < 0 ? 'west' : 'east');
      common(id, 'Focus / interview room', accepted, 'private', 'focus'); opening('shared-core-hall-1', id, [side, end - 2], 1);
    }
    let board;
    for (const width of [12, 10, 8, 6].filter(w => w <= 6 + 2 * Math.floor(zone.source.dials.size / 25))) {
      const vertices = [[-width / 2, end], [width / 2, end], [width / 2, end + 6 + Math.floor(zone.source.dials.size / 35)], [-width / 2, end + 6 + Math.floor(zone.source.dials.size / 35)]], footprint = polygon(inset(vertices, half));
      if (!plan.spaces.some(s => interiorsOverlap(s.footprint, footprint))) { board = vertices; break; }
    }
    if (!board) throw new Error('Shared boardroom cannot fit the full department footprints.');
    common('shared-boardroom', 'Boardroom / training', board, 'public', 'conference'); opening('shared-core-hall-1', 'shared-boardroom', [0, end], 1.4);
    plan.layout.sharedCore = ['shared-core-hall-0', 'shared-core-hall-1', 'shared-focus-west', 'shared-focus-east', 'shared-boardroom'];
    plan.layout.rectangularVariantDifferences = ['The rectangular variant has a separate orthogonal hub; the full angled design adds its central shared boardroom and focus-room cluster.'];
  }
  for (const [i, e] of zone.entrances.entries()) {
    const s = zone.spaces.find(s => s.id === e.space), r = s.rect;
    const p = move(s.id, [e.side === 'e' ? r[2] : e.side === 'w' ? r[0] : e.at, e.side === 'n' ? r[3] : e.side === 's' ? r[1] : e.at]);
    const { opening: o, approach } = opening(s.id, null, p, 1);
    const req = { contractId: 'office-port-' + i, portId: 'office-port-' + i, role: i === 0 ? 'primary' : 'secondary', family: 'door', direction: 'reversible', floorIndex: 0, width: 1, height: 2.1, approachDepth: .6 };
    plan.input.portRequirements.push(req); plan.externalPorts.push({ ...req, owningSpaceId: s.id, openingId: o.id, host: o.hosts[0], approach: approach.footprint, anchor: { position: o.center, forward: [-approach.inward[0], -approach.inward[1], 0], up: [0, 0, 1] } });
  }
  plan.walls = deriveWalls(plan); plan.guards = deriveGuards(plan);
  plan.diagnostics = validateArchitecture(plan, { checkCachedConnections: false });
  if (plan.diagnostics.errors.length) throw new Error(plan.diagnostics.errors.slice(0, 5).map(e => e.code + ': ' + e.entityId + ' ' + e.message).join('; '));
  if (walls) { plan.schemaVersion = 'br.zone/0.4'; realizeWalls(plan); plan.diagnostics = validateArchitecture(plan, { checkCachedConnections: false, checkWallRebuild: false }); }
  if (plan.diagnostics.errors.length) throw new Error(plan.diagnostics.errors.slice(0, 5).map(e => e.code + ': ' + e.entityId + ' ' + e.message).join('; '));
  const hallArea = plan.spaces.filter(s => s.tags.includes('hall')).reduce((sum, s) => sum + signedArea(s.footprint.outer), 0);
  const hallRule = plan.layout.architecturalRules.find(r => r.id === 'hall-share');
  Object.assign(hallRule, api.rule('hall-share', hallRule.name, hallArea / plan.diagnostics.metrics.netFootprintArea <= .4, Math.round(hallArea / plan.diagnostics.metrics.netFootprintArea * 100) + '% of the full clear floor is corridor.', [{ dial: 'sprawl', name: 'Sprawl', at: 35 }, { dial: 'strange', name: 'Strangeness', at: 30 }, { dial: 'wings', name: 'Wings', at: 40 }], zone.source.dials));
  if (plan.layout.architecturalRules.some(r => !r.kept && !r.relaxed)) throw new Error('Full office breaks an unrelaxed architectural rule.');
  plan.localConnections = structuredClone(plan.diagnostics.navigation.connections);
  plan.diagnostics.scope = 'Office v3 actual rotated floors, apertures, walls and local walker navigation';
  plan.diagnostics.warnings = [{ code: 'UNREAL_ADAPTER_PENDING', message: 'This is full br.zone design geometry. Unreal import/adapter support is pending; exit lobbies reserve connection points, not generated vertical stair flights.' }];
  plan.fingerprint = fingerprint(plan); return plan;
}
