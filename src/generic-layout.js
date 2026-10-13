import '../exchange/stream.js';
import { point, polygon, bounds, signedArea, validateFootprint, distance, at, footprintSubset } from './geometry.js';
import { hostAt, approachFor } from './structure.js';
import { differenceUnion } from './solid-geometry.js';
import { boundaryNetwork, cleanPolygon, corridorRegion, insetRegion, interiorAnchor, isConcave, ordinal } from './polygon-regions.js';

// Grow a connected floor field, then divide its faces with shared cut paths.
// There are no physical parent rooms or secondary partition-wall objects.
export function composeGeneric({ seed, dials: D }, attempt = 0) {
  const random = name => globalThis.ZoneExchange.stream(seed, 'generic-v3/' + attempt, name) / 4294967296;
  const rooms = 8 + Math.floor(D.rooms * 16 / 100), topCount = Math.ceil(rooms / 2), bottomCount = rooms - topCount;
  const scale = 5 + D.scale * .055, length = Math.max(topCount, bottomCount) * scale;
  const width = 2 + D.hallWidth / 50, depth = scale * (1.1 + D.variety * .003);
  const bend = (2 + D.turns * .065) * (.7 + random('bend/depth') * .6) * (random('bend/sign') < .5 ? -1 : 1);
  const stations = [.14 + random('route/a') * .1, .38 + random('route/b') * .1, .6 + random('route/c') * .1, .84 + random('route/d') * .06];
  const path = D.turns === 0 ? [[0, 0], [length, 0]] : D.orientation === 0
    ? [[0, 0], [length * stations[0], 0], [length * stations[0], bend], [length * stations[2], bend], [length * stations[2], 0], [length, 0]]
    : [[0, 0], [length * stations[0], 0], [length * stations[1], bend], [length * stations[2], bend], [length * stations[3], 0], [length, 0]];
  const widths = path.map((_, i) => width * (1 + (D.orientation === 0 || i === 0 || i === path.length - 1 ? 0 : (random('width/' + i) - .5) * D.variety * .003)));
  const corridor = corridorRegion(path.map(p => point(...p)), widths), vertices = corridor.outer.map(e => e.from);
  // Horizontal end runs give two real cap edges; split the two side chains at them.
  const cap = vertices.findIndex((p, i) => Math.abs(p[0] - length) < 1e-5 && Math.abs(vertices[(i + 1) % vertices.length][0] - length) < 1e-5);
  if (cap < 0) throw new Error('Corridor lacks an end cap.');
  const lower = vertices.slice(0, cap + 1), upper = vertices.slice(cap + 1).reverse();
  const high = Math.max(...upper.map(p => p[1])) + depth, low = Math.min(...lower.map(p => p[1])) - depth;
  const jog = D.variety * .02 + .8;
  const exterior = (y, sign) => D.orientation === 0
    ? [[0, y], [length * .31, y], [length * .31, y + sign * jog], [length * .72, y + sign * jog], [length * .72, y], [length, y]]
    : [[0, y], [length * .31, y], [length * .31, y + sign * jog], [length * .72, y + sign * jog], [length * .87, y + sign * jog * .4], [length, y + sign * jog * .4]];
  const fields = [cleanPolygon(polygon([...upper, ...exterior(high, 1).reverse()])), cleanPolygon(polygon([...exterior(low, -1), ...lower.reverse()]))];
  let work = 0; const cuts = [];
  function usable(f) {
    if (f.outer.length > 32 || validateFootprint(f).length || signedArea(f.outer) < 10) return false;
    try { const clear = insetRegion(f, .075); interiorAnchor(clear); return clear.outer.every(e => distance(e.from, e.to) >= .5); } catch { return false; }
  }
  function divide(region, count, name) {
    if (count === 1) { if (!usable(region)) throw new Error('Room core is unusable.'); return [region]; }
    const b = bounds(region), leftCount = Math.floor(count / 2), ratio = leftCount / count;
    const horizontal = b.maxY - b.minY > (b.maxX - b.minX) * (1 + random(name + '/axis') * .3);
    const min = horizontal ? b.minY : b.minX, max = horizontal ? b.maxY : b.maxX;
    const crossMin = horizontal ? b.minX : b.minY, crossMax = horizontal ? b.maxX : b.maxY;
    const desired = min + (max - min) * ratio, span = crossMax - crossMin;
    for (let k = 0; k < 24; ++k) {
      ++work;
      const x = desired + (random(name + '/x/' + k) - .5) * scale * .4;
      const delta = (random(name + '/sign/' + k) < .5 ? -1 : 1) * (.8 + D.variety * .012) * (.6 + random(name + '/depth/' + k) * .8);
      const y = crossMin + span * (.35 + random(name + '/y/' + k) * .3);
      const y2 = D.orientation > 0 && random(name + '/angle/' + k) * 100 < D.orientation ? y + Math.abs(delta) * .65 : y;
      const map = p => horizontal ? point(p[1], p[0]) : point(...p);
      const cut = [[x, crossMin - 2], [x, y], [x + delta, y2], [x + delta, crossMax + 2]];
      const west = cleanPolygon(polygon([[min - 2, crossMin - 2], ...cut, [min - 2, crossMax + 2]].map(map)));
      const east = cleanPolygon(polygon([...cut.slice().reverse(), [max + 2, crossMin - 2], [max + 2, crossMax + 2]].map(map)));
      let A, B;
      try { A = differenceUnion([region], [east]); B = differenceUnion([region], [west]); } catch { continue; }
      if (A.length !== 1 || B.length !== 1 || A[0].holes.length || B[0].holes.length) continue;
      const a = cleanPolygon(A[0]), c = cleanPolygon(B[0]);
      if (!usable(a) || !usable(c) || (horizontal ? bounds(a).maxY - bounds(a).minY : bounds(a).maxX - bounds(a).minX) < Math.sqrt(leftCount) * 3.2 || (horizontal ? bounds(c).maxY - bounds(c).minY : bounds(c).maxX - bounds(c).minX) < Math.sqrt(count - leftCount) * 3.2) continue;
      // The two masks share precisely the same path; accepting a cut commits both faces.
      cuts.push({ id: name, path: cut.slice(1, -1).map(map), horizontal, angled: y2 !== y });
      return [...divide(a, leftCount, name + '/west'), ...divide(c, count - leftCount, name + '/east')];
    }
    throw new Error('No usable shared cut fits ' + name + '.');
  }
  const allocations = fields.flatMap((f, side) => divide(f, side === 0 ? topCount : bottomCount, 'field-' + side).map((footprint, i) => ({ id: 'field-' + side + '-room-' + i, label: 'Quiet room', role: 'quiet', kind: 'room', cluster: side, footprint })));
  allocations.push({ id: 'corridor', label: 'Winding passage', role: 'circulation', kind: 'hall', cluster: null, footprint: corridor });
  const boundaries = boundaryNetwork(allocations);
  const clear = new Map(allocations.map(a => [a.id, { id: a.id, footprint: insetRegion(a.footprint, .075) }]));
  const candidates = boundaries.filter(b => b.owners.length === 2 && b.length >= 1.7).map(b => ({ ...b, door: supportedDoor(b, clear, 1 + D.open * .018, random('door/offset/' + b.id)) })).filter(b => b.door);
  // Door location is a candidate on a shared span, never a room-centre connector.
  const links = [], parent = new Map(allocations.map(a => [a.id, a.id])), find = id => parent.get(id) === id ? id : find(parent.get(id));
  candidates.sort((a, b) => random('door/order/' + a.id) - random('door/order/' + b.id) || ordinal(a.id, b.id));
  const pairs = new Set();
  for (const b of candidates) {
    const [a, c] = b.owners.map(o => o.spaceId), key = [a, c].sort().join('/'), required = find(a) !== find(c);
    if (pairs.has(key) || !required && (D.loops === 0 || random('door/loop/' + b.id) * 100 > D.loops)) continue;
    links.push({ a, b: c, ...b.door, required, boundaryId: b.id });
    if (required) parent.set(find(a), find(c)); pairs.add(key);
  }
  if (allocations.some(a => find(a.id) !== find('corridor'))) throw new Error('No complete supported adjacency tree fits the room faces.');
  // A nonzero loop request must deliver a real cycle, even at a low probability.
  if (D.loops && links.every(l => l.required)) {
    const b = candidates.find(b => !pairs.has(b.owners.map(o => o.spaceId).sort().join('/')));
    if (!b) throw new Error('The room subdivision has no optional loop boundary.');
    links.push({ a: b.owners[0].spaceId, b: b.owners[1].spaceId, ...b.door, required: false, boundaryId: b.id });
  }
  const external = [], ports = 1 + Math.floor(D.exits * 7 / 100);
  const available = boundaries.filter(b => b.owners.length === 1 && b.length > 2).sort((a, b) => b.length - a.length || ordinal(a.id, b.id));
  for (const b of available) {
    const door = supportedDoor(b, clear, 1, random('external/' + b.id)); if (!door) continue;
    const center = door.center, space = b.owners[0].spaceId;
    if (external.some(p => p.space === space)) continue;
    external.push({ space, center, boundaryId: b.id }); if (external.length === ports) break;
  }
  if (external.length !== ports) throw new Error('Exterior ports do not fit the floor field.');
  const program = allocations.filter(s => s.kind === 'room').sort((a, b) => random('support/' + a.id) - random('support/' + b.id));
  program.forEach((s, i) => { s.role = i < Math.floor(rooms * D.supportMix / 300) ? 'service' : random('function/' + s.id) * 100 < D.publicMix ? 'shared' : 'quiet'; s.label = s.role === 'service' ? 'Support room' : s.role === 'shared' ? 'Shared room' : 'Quiet room'; });
  const extents = allocations.map(s => bounds(s.footprint));
  return { allocations, links, external, boundaries, layout: { requestedRooms: rooms, placementWork: work, cuts, corridorPath: path.map(p => point(...p)), corridorWidths: widths, regions: allocations.map(a => ({ id: a.id, footprint: a.footprint })),
    clusters: fields.map((_, i) => ({ id: 'field-' + i, recipe: 'shared-polygon-faces', rooms: i === 0 ? topCount : bottomCount, spaceIds: allocations.filter(a => a.cluster === i).map(a => a.id) })), routes: [{ id: 'corridor', spaceIds: ['corridor'], lengthM: path.slice(1).reduce((s, p, i) => s + distance(p, path[i]), 0) }],
    bound: { spaces: 25, links: 128, attempts: 4, cutCandidates: 24, roomEdges: 32 }, metrics: { clusterCount: 2, roomCount: rooms, concaveRooms: allocations.filter(a => a.kind === 'room' && isConcave(a.footprint)).length, polygonCorners: allocations.reduce((s, a) => s + a.footprint.outer.length, 0), sharedBoundaries: boundaries.filter(b => b.owners.length === 2).length, routeLengthM: path.slice(1).reduce((s, p, i) => s + distance(p, path[i]), 0), bentRoutes: path.length > 2 ? 1 : 0, headings: [...new Set(allocations.flatMap(a => a.footprint.outer.map(e => Math.round(Math.atan2(e.to[1] - e.from[1], e.to[0] - e.from[0]) * 180 / Math.PI))))].sort((a, b) => a - b), widthM: Math.max(...extents.map(b => b.maxX)) - Math.min(...extents.map(b => b.minX)), depthM: Math.max(...extents.map(b => b.maxY)) - Math.min(...extents.map(b => b.minY)) } } };
}

// Joint aperture refinement: slide along the actual atomic boundary, reduce its
// width if needed, and prove both approaches fit before the graph selects it.
function supportedDoor(boundary, clear, requested, draw) {
  const edge = { kind: 'line', from: boundary.from, to: boundary.to }, d = [edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]], l = Math.hypot(...d);
  const fractions = draw < .5 ? [.35, .65, .45, .55, .5, .25, .75] : [.65, .35, .55, .45, .5, .75, .25];
  for (const f of fractions) for (const factor of [1, .8, .6, .4]) {
    const center = point(...at(edge, f)), width = Math.floor(Math.min(requested * factor, 2 * Math.min(f, 1 - f) * l - .6) * 100) / 100;
    if (width < .8) continue;
    const supported = boundary.owners.every(owner => {
      const space = clear.get(owner.spaceId), inward = [-d[1] / l * owner.direction, d[0] / l * owner.direction];
      const xy = point(center[0] + inward[0] * .075, center[1] + inward[1] * .075);
      try { const host = hostAt(space, xy, width); return footprintSubset(space.footprint, approachFor(space.footprint.outer[host.edgeIndex], xy, width, .6).footprint); } catch { return false; }
    });
    if (supported) return { center, width, length: l };
  }
  return null;
}
