import { EPS, at, tangent, point, distance, polygon, circle, transform, contains, footprintSubset } from './geometry.js';

export const WALKER = Object.freeze({ radius: 0.3, headroom: 2.1 });

export function segmentFootprint(a, b, width) {
  const length = distance(a, b), n = [-(b[1] - a[1]) / length * width / 2, (b[0] - a[0]) / length * width / 2];
  return polygon([point(a[0] - n[0], a[1] - n[1]), point(b[0] - n[0], b[1] - n[1]), point(b[0] + n[0], b[1] + n[1]), point(a[0] + n[0], a[1] + n[1])]);
}

export function walkSegmentFits(footprint, a, b, radius = WALKER.radius) {
  if (contains(footprint, a) !== 'inside' || contains(footprint, b) !== 'inside') return false;
  // A capsule is a rectangle and two exact discs, all checked analytically.
  if (!footprintSubset(footprint, transform(circle(radius), a, 0)) || !footprintSubset(footprint, transform(circle(radius), b, 0))) return false;
  return distance(a, b) <= EPS || footprintSubset(footprint, segmentFootprint(a, b, radius * 2));
}

function candidates(footprint, radius) {
  const points = [];
  for (const ring of [footprint.outer, ...footprint.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const edge = ring[i], previous = ring[(i + ring.length - 1) % ring.length];
      const p = at(edge, 0), a = tangent(previous, 1), b = tangent(edge, 0);
      const la = Math.hypot(...a), lb = Math.hypot(...b);
      const na = [-a[1] / la, a[0] / la], nb = [-b[1] / lb, b[0] / lb];
      const bisector = [na[0] + nb[0], na[1] + nb[1]], projection = bisector[0] * nb[0] + bisector[1] * nb[1];
      if (projection > EPS) points.push(point(p[0] + bisector[0] * radius * 1.5 / projection, p[1] + bisector[1] * radius * 1.5 / projection));
      if (edge.kind === 'arc') for (let step = 1; step < 8; step++) {
        const t = step / 8, p = at(edge, t), v = tangent(edge, t), len = Math.hypot(...v);
        points.push(point(p[0] - v[1] / len * radius * 1.5, p[1] + v[0] / len * radius * 1.5));
      }
    }
  }
  return points.filter(p => contains(footprint, p) === 'inside' && footprintSubset(footprint, transform(circle(radius), p, 0)));
}

// Bounded visibility search is a validation witness, not a room generator.
// Every accepted segment has exact capsule containment in the canonical floor.
export function localWalkPaths(footprint, terminals, radius = WALKER.radius) {
  if (!terminals.length) return { valid: true, paths: [] };
  const nodes = [...terminals.map(t => t.position.slice(0, 2)), ...candidates(footprint, radius)];
  const fits = nodes.map(p => contains(footprint, p) === 'inside' && footprintSubset(footprint, transform(circle(radius), p, 0)));
  const edges = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (fits[i] && fits[j] && (distance(nodes[i], nodes[j]) <= EPS || footprintSubset(footprint, segmentFootprint(nodes[i], nodes[j], radius * 2)))) { edges[i].push(j); edges[j].push(i); }
  }
  const parents = new Map([[0, null]]), costs = nodes.map((_, i) => i === 0 ? 0 : Infinity), visited = new Set();
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    visited.add(current);
    for (const next of edges[current]) {
      const cost = costs[current] + distance(nodes[current], nodes[next]);
      if (cost < costs[next] - EPS) { costs[next] = cost; parents.set(next, current); }
    }
  }
  const paths = terminals.map((terminal, index) => {
    if (!parents.has(index)) return { terminalId: terminal.id, reachable: false, points: [] };
    const indices = []; let current = index;
    while (current !== null) { indices.unshift(current); current = parents.get(current); }
    return { terminalId: terminal.id, reachable: true, points: indices.map(i => nodes[i]) };
  });
  const rootFits = fits[0];
  return { valid: rootFits && paths.every(p => p.reachable), paths };
}

export function graphReachability(nodes, edges, start) {
  const forward = new Map(nodes.map(id => [id, []])), backward = new Map(nodes.map(id => [id, []]));
  for (const edge of edges) {
    if (!forward.has(edge.from) || !forward.has(edge.to)) continue;
    if (edge.direction !== 'reverse-only') { forward.get(edge.from).push(edge.to); backward.get(edge.to).push(edge.from); }
    if (edge.direction !== 'forward-only') { forward.get(edge.to).push(edge.from); backward.get(edge.from).push(edge.to); }
  }
  function visit(adjacency) {
    const found = new Set(start && adjacency.has(start) ? [start] : []), queue = [...found];
    while (queue.length) for (const next of adjacency.get(queue.shift())) if (!found.has(next)) { found.add(next); queue.push(next); }
    return [...found].sort();
  }
  const reachable = visit(forward), returnable = visit(backward);
  return { arrivalSpaceId: start ?? null, reachable, returnable, unreachable: nodes.filter(id => !reachable.includes(id)), noReturnPath: nodes.filter(id => !returnable.includes(id)) };
}
