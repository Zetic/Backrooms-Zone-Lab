import { EPS, q, point, line, polygon, at, tangent, distance, edgeDistance, contains, interiorsOverlap } from './geometry.js';

export function localCeiling(space, footprint) {
  const relevant = space.clearVolumes.filter(v => interiorsOverlap(v.footprint, footprint));
  // The lowest cap in an approach is the usable headroom guarantee.
  const groundVolumes = relevant.filter(v => Math.abs(v.minZ - space.elevation) <= EPS);
  return groundVolumes.length ? Math.min(...groundVolumes.map(v => v.maxZ)) : space.elevation;
}

export function approachFor(edge, center, width, depth) {
  const v = tangent(edge, 0.5), length = Math.hypot(...v), u = v.map(n => n / length), inward = [-u[1], u[0]];
  const a = point(center[0] - u[0] * width / 2, center[1] - u[1] * width / 2);
  const b = point(center[0] + u[0] * width / 2, center[1] + u[1] * width / 2);
  return { footprint: polygon([a, b, point(b[0] + inward[0] * depth, b[1] + inward[1] * depth), point(a[0] + inward[0] * depth, a[1] + inward[1] * depth)]), center: point(center[0] + inward[0] * depth / 2, center[1] + inward[1] * depth / 2), tangent: u.map(q), inward: inward.map(q) };
}

export function hostAt(space, center, width) {
  const edgeIndex = space.footprint.outer.findIndex(edge => {
    if (edge.kind !== 'line' || edgeDistance(edge, center) > EPS) return false;
    const v = tangent(edge, .5), length = Math.hypot(...v), u = v.map(n => n / length);
    return [-1, 1].every(s => edgeDistance(edge, [center[0] + s * u[0] * width / 2, center[1] + s * u[1] * width / 2]) <= EPS);
  });
  if (edgeIndex < 0) throw new Error(`Reference opening does not fit ${space.id}.`);
  return { spaceId: space.id, edgeIndex, ring: 'outer' };
}

export function flightFrame(from, to) {
  const run = distance(from, to), direction = [(to[0] - from[0]) / run, (to[1] - from[1]) / run];
  return { run, direction, right: [direction[1], -direction[0]] };
}

export function flightRect(center, width, depth, direction) {
  const right = [direction[1], -direction[0]], half = width / 2;
  const a = point(center[0] - right[0] * half, center[1] - right[1] * half), b = point(center[0] + right[0] * half, center[1] + right[1] * half);
  return polygon([a, b, point(b[0] + direction[0] * depth, b[1] + direction[1] * depth), point(a[0] + direction[0] * depth, a[1] + direction[1] * depth)]);
}

export function deriveWalls(plan) {
  return plan.spaces.flatMap(space => space.footprint.outer.map((edge, edgeIndex) => {
    const p = at(edge, .5), v = tangent(edge, .5), length = Math.hypot(...v);
    const probe = [p[0] - v[1] / length * .01, p[1] + v[0] / length * .01];
    const caps = space.clearVolumes.filter(volume => Math.abs(volume.minZ - space.elevation) <= EPS && contains(volume.footprint, probe) !== 'outside').map(volume => volume.maxZ);
    return { id: `wall:${space.id}:${edgeIndex}`, kind: 'boundary-surface', spaceId: space.id, host: { ring: 'outer', edgeIndex }, edge: structuredClone(edge), minZ: space.elevation, maxZ: q(caps.length ? Math.min(...caps) : space.elevation + space.clearHeight), openingIds: plan.openings.filter(o => o.hosts.some(h => h.spaceId === space.id && h.edgeIndex === edgeIndex)).map(o => o.id).sort() };
  }));
}

export function deriveGuards(plan) {
  const guards = [];
  for (const surface of plan.surfaces.filter(s => s.kind === 'floor')) for (let ringIndex = 0; ringIndex < surface.footprint.holes.length; ringIndex++) {
    for (let edgeIndex = 0; edgeIndex < surface.footprint.holes[ringIndex].length; edgeIndex++) {
      const edge = surface.footprint.holes[ringIndex][edgeIndex];
      const isThreshold = plan.verticalTraversals.some(stair => [stair.source, stair.target].some(end => end.surfaceId === surface.id && edgeDistance(edge, end.position) <= EPS && distance(at(edge, 0), at(edge, 1)) <= stair.width + EPS));
      if (isThreshold) continue;
      guards.push({ id: `guard:${surface.id}:${ringIndex}:${edgeIndex}`, kind: 'slab-edge', surfaceId: surface.id, edge: structuredClone(edge), elevation: surface.elevation, height: 1.1 });
    }
  }
  for (const stair of plan.verticalTraversals) for (const side of [-1, 1]) {
    const { right } = flightFrame(stair.source.position, stair.target.position);
    guards.push({ id: `guard:${stair.id}:${side}`, kind: 'stair-rail', traversalId: stair.id, path: [stair.source.position, stair.target.position].map(p => [q(p[0] + side * stair.width / 2 * right[0]), q(p[1] + side * stair.width / 2 * right[1]), p[2]]), height: 1.1 });
  }
  return guards;
}

