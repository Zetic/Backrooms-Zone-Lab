import { EPS, point, polygon, distance, tangent, bounds, contains, edgeDistance, signedArea, validateFootprint, footprintSubset } from './geometry.js';

export const ordinal = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => a.map((v, i) => v - b[i]);
export function lineIntersection(a, u, b, v) {
  const d = cross(u, v); if (Math.abs(d) < 1e-9) throw new Error('Parallel polygon corner.');
  const t = cross(sub(b, a), v) / d; return point(a[0] + t * u[0], a[1] + t * u[1]);
}
export function cleanPolygon(footprint) {
  if (footprint.holes.length) throw new Error('This room solver requires a simple connected region without holes.');
  let vertices = footprint.outer.map(e => point(...e.from));
  for (let pass = 0; pass < 3; ++pass) vertices = vertices.filter((p, i) => {
    const a = vertices[(i + vertices.length - 1) % vertices.length], b = vertices[(i + 1) % vertices.length];
    return distance(a, p) > EPS && Math.abs(cross(sub(p, a), sub(b, p))) > EPS * Math.max(1, distance(a, b));
  });
  if (signedArea(polygon(vertices).outer) < 0) vertices.reverse();
  return polygon(vertices);
}
export function isConcave(footprint) {
  const edges = footprint.outer;
  return edges.some((e, i) => cross(tangent(e, .5), tangent(edges[(i + 1) % edges.length], .5)) < -EPS);
}
export function insetRegion(allocation, amount) {
  if (!Number.isFinite(amount) || allocation.holes.length || allocation.outer.some(e => e.kind !== 'line')) throw new Error('Polygon offset requires a simple linear region.');
  const shifted = allocation.outer.map(e => {
    const d = tangent(e, .5), l = Math.hypot(...d);
    return { p: point(e.from[0] - d[1] / l * amount, e.from[1] + d[0] / l * amount), d };
  });
  const floor = polygon(shifted.map((b, i) => { const a = shifted[(i + shifted.length - 1) % shifted.length]; return lineIntersection(a.p, a.d, b.p, b.d); }));
  if (validateFootprint(allocation).length || validateFootprint(floor).length || (amount >= 0 && !footprintSubset(allocation, floor))) throw new Error('Wall thickness collapses or crosses a polygon room.');
  return floor;
}
export function interiorAnchor(footprint) {
  const b = bounds(footprint); let best = null, score = -Infinity;
  for (let y = 1; y < 10; ++y) for (let x = 1; x < 10; ++x) {
    const p = point(b.minX + (b.maxX - b.minX) * x / 10, b.minY + (b.maxY - b.minY) * y / 10);
    if (contains(footprint, p) !== 'inside') continue;
    const clearance = Math.min(...footprint.outer.map(e => edgeDistance(e, p)));
    if (clearance > score) { best = p; score = clearance; }
  }
  if (!best || score < .4) throw new Error('Polygon room has no usable interior core.');
  return best;
}

// One canonical wall network. Split room edges where another room's boundary
// ends, then publish each atomic boundary once with its owning room sides.
export function boundaryNetwork(allocations) {
  const all = allocations.flatMap(s => s.footprint.outer.map((edge, edgeIndex) => ({ s, edge, edgeIndex }))), segments = new Map();
  for (const { s, edge, edgeIndex } of all) {
    const d = tangent(edge, .5), length = Math.hypot(...d), u = d.map(v => v / length), cuts = [0, length];
    for (const other of all) for (const p of [other.edge.from, other.edge.to]) if (edgeDistance(edge, p) < EPS * 2) {
      const t = (p[0] - edge.from[0]) * u[0] + (p[1] - edge.from[1]) * u[1]; if (t > EPS && t < length - EPS) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; ++i) {
      if (cuts[i] - cuts[i - 1] < EPS * 2) continue;
      const a = point(edge.from[0] + u[0] * cuts[i - 1], edge.from[1] + u[1] * cuts[i - 1]), b = point(edge.from[0] + u[0] * cuts[i], edge.from[1] + u[1] * cuts[i]);
      const forward = a[0] < b[0] || a[0] === b[0] && a[1] < b[1], from = forward ? a : b, to = forward ? b : a;
      const key = JSON.stringify([from, to]);
      if (!segments.has(key)) segments.set(key, { from, to, owners: [], apertures: [] });
      const boundary = segments.get(key);
      if (!boundary.owners.some(o => o.spaceId === s.id)) boundary.owners.push({ spaceId: s.id, edgeIndex, direction: forward ? 1 : -1 });
    }
  }
  const result = [...segments.values()].sort((a, b) => a.from[0] - b.from[0] || a.from[1] - b.from[1] || a.to[0] - b.to[0] || a.to[1] - b.to[1]);
  result.forEach((s, i) => {
    s.id = 'boundary-' + i; s.length = distance(s.from, s.to); s.owners.sort((a, b) => ordinal(a.spaceId, b.spaceId));
    if (s.owners.length > 2 || s.owners.length === 2 && s.owners[0].direction === s.owners[1].direction) throw new Error('Polygon regions overlap or disagree on a shared wall.');
  });
  return result;
}

// A routed corridor is one polygon with a width profile, including its bends.
// Mitered side intersections replace separate connector/junction room pieces.
export function corridorRegion(path, widths) {
  if (path.length < 2 || path.length !== widths.length || widths.some(w => !Number.isFinite(w) || w <= 0)) throw new Error('Corridor needs a width at each route point.');
  const sides = [-1, 1].map(side => {
    const lines = path.slice(1).map((b, i) => {
      const a = path[i], d = sub(b, a), length = Math.hypot(...d); if (length < 1) throw new Error('Corridor segment is too short.');
      const n = [-d[1] / length * side, d[0] / length * side];
      const from = point(a[0] + n[0] * widths[i] / 2, a[1] + n[1] * widths[i] / 2), to = point(b[0] + n[0] * widths[i + 1] / 2, b[1] + n[1] * widths[i + 1] / 2);
      return { from, to, d: sub(to, from) };
    });
    return [lines[0].from, ...lines.slice(1).map((b, i) => lineIntersection(lines[i].from, lines[i].d, b.from, b.d)), lines.at(-1).to];
  });
  const region = cleanPolygon(polygon([...sides[0], ...sides[1].reverse()]));
  if (validateFootprint(region).length) throw new Error('Corridor route self-intersects.');
  return region;
}
