// Canonical line/circular-arc kernel. Predicates never use renderer tessellation.
export const EPS = 1e-5;
export const RAD = Math.PI / 180;
export const q = n => Math.round(n * 1e6) / 1e6;
export const point = (x, y) => [q(x), q(y)];
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const modulo = (n, m) => ((n % m) + m) % m;
const finitePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
export const line = (from, to) => ({ kind: 'line', from, to });
export const arc = (center, radius, startDeg, sweepDeg) => ({ kind: 'arc', center, radius: q(radius), startDeg: q(startDeg), sweepDeg: q(sweepDeg) });
export function at(edge, t) {
  if (edge.kind === 'line') return edge.from.map((n, i) => n + t * (edge.to[i] - n));
  const angle = (edge.startDeg + edge.sweepDeg * t) * RAD;
  return [edge.center[0] + edge.radius * Math.cos(angle), edge.center[1] + edge.radius * Math.sin(angle)];
}
export function tangent(edge, t) {
  if (edge.kind === 'line') return sub(edge.to, edge.from);
  const a = (edge.startDeg + edge.sweepDeg * t) * RAD;
  const s = Math.sign(edge.sweepDeg);
  return [-Math.sin(a) * s, Math.cos(a) * s];
}
function arcParameter(edge, p) {
  const a = Math.atan2(p[1] - edge.center[1], p[0] - edge.center[0]) / RAD;
  const delta = edge.sweepDeg > 0 ? modulo(a - edge.startDeg, 360) : modulo(edge.startDeg - a, 360);
  if (distance(p, at(edge, 0)) <= EPS) return 0;
  if (distance(p, at(edge, 1)) <= EPS) return 1;
  return delta / Math.abs(edge.sweepDeg);
}
function onArc(edge, p) {
  const t = arcParameter(edge, p);
  return t >= -EPS && t <= 1 + EPS && Math.abs(distance(edge.center, p) - edge.radius) <= EPS;
}
function parameter(edge, p) {
  if (edge.kind === 'arc') return arcParameter(edge, p);
  const d = sub(edge.to, edge.from);
  return dot(sub(p, edge.from), d) / dot(d, d);
}
function intervalMidpoints(edge, otherEdges) {
  const cuts = [0, 1];
  for (const other of otherEdges) for (const p of intersections(edge, other).points) cuts.push(Math.max(0, Math.min(1, parameter(edge, p))));
  cuts.sort((a, b) => a - b);
  return cuts.slice(1).flatMap((hi, i) => hi > cuts[i] ? [at(edge, (cuts[i] + hi) / 2)] : []);
}

// Test each exact boundary interval between analytic intersections. This avoids
// missing a narrow concave notch between arbitrary sample points.
export function footprintSubset(container, candidate) {
  const containerEdges = [container.outer, ...container.holes].flat();
  const candidateEdges = [candidate.outer, ...candidate.holes].flat();
  function intervals(edge, otherEdges, predicate) {
    return intervalMidpoints(edge, otherEdges).every(predicate) && [0, 1].every(t => predicate(at(edge, t)));
  }
  if (!candidateEdges.every(edge => intervals(edge, containerEdges, p => contains(container, p) !== 'outside'))) return false;
  // Container holes or notches cannot intrude into the candidate interior.
  return containerEdges.every(edge => intervals(edge, candidateEdges, p => contains(candidate, p) !== 'inside'));
}
export function edgeDistance(edge, p) {
  if (edge.kind === 'line') {
    const d = sub(edge.to, edge.from);
    const t = Math.max(0, Math.min(1, dot(sub(p, edge.from), d) / dot(d, d)));
    return distance(p, at(edge, t));
  }
  const a = Math.atan2(p[1] - edge.center[1], p[0] - edge.center[0]);
  const radial = [edge.center[0] + edge.radius * Math.cos(a), edge.center[1] + edge.radius * Math.sin(a)];
  return onArc(edge, radial) ? Math.abs(distance(p, edge.center) - edge.radius) : Math.min(distance(p, at(edge, 0)), distance(p, at(edge, 1)));
}

// Returns isolated intersection points and whether boundaries overlap in length.
export function intersections(a, b, stableTangencies = false) {
  if (a.kind === 'arc' && b.kind === 'line') return intersections(b, a, stableTangencies);
  let points = [], overlap = false;
  if (a.kind === 'line' && b.kind === 'line') {
    const r = sub(a.to, a.from), s = sub(b.to, b.from), d = sub(b.from, a.from);
    const denominator = cross(r, s);
    if (Math.abs(denominator) <= EPS * Math.max(distance(a.from, a.to), distance(b.from, b.to))) {
      if (Math.abs(cross(d, r)) <= EPS * distance(a.from, a.to)) {
        const rr = dot(r, r);
        const t0 = dot(d, r) / rr, t1 = t0 + dot(s, r) / rr;
        const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
        if (hi >= lo - EPS) points = [at(a, lo)];
        overlap = (hi - lo) * Math.sqrt(rr) > EPS;
      }
    } else {
      const t = cross(d, s) / denominator, u = cross(d, r) / denominator;
      if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) points = [at(a, t)];
    }
  } else if (a.kind === 'line') {
    const d = sub(a.to, a.from), f = sub(a.from, b.center);
    const A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - b.radius ** 2;
    let discriminant = B * B - 4 * A * C;
    // Quantized tangent joins can produce two artificial roots farther apart
    // than EPS. Apply the published distance tolerance before solving roots.
    const closest = at(a, -B / (2 * A));
    if (stableTangencies && Math.abs(distance(closest, b.center) - b.radius) <= EPS) discriminant = 0;
    const tolerance = EPS ** 2 * A;
    if (discriminant >= -tolerance) {
      discriminant = Math.max(0, discriminant);
      for (const t of [(-B - Math.sqrt(discriminant)) / (2 * A), (-B + Math.sqrt(discriminant)) / (2 * A)]) {
        const p = at(a, t);
        if (t >= -EPS && t <= 1 + EPS && onArc(b, p)) points.push(p);
      }
    }
  } else {
    const d = distance(a.center, b.center);
    if (d <= EPS && Math.abs(a.radius - b.radius) <= EPS) {
      points = [at(a, 0), at(a, 1), at(b, 0), at(b, 1)].filter(p => onArc(a, p) && onArc(b, p));
      // Split angular intervals at both arcs' endpoints; test each open interval.
      const angles = [...new Set([0, 360, modulo(a.startDeg, 360), modulo(a.startDeg + a.sweepDeg, 360), modulo(b.startDeg, 360), modulo(b.startDeg + b.sweepDeg, 360)])].sort((x, y) => x - y);
      overlap = angles.slice(1).some((end, i) => {
        const angle = (angles[i] + end) / 2 * RAD;
        const p = [a.center[0] + a.radius * Math.cos(angle), a.center[1] + a.radius * Math.sin(angle)];
        return onArc(a, p) && onArc(b, p);
      });
    } else if (d > EPS && d <= a.radius + b.radius + EPS && d >= Math.abs(a.radius - b.radius) - EPS) {
      const x = (a.radius ** 2 - b.radius ** 2 + d ** 2) / (2 * d);
      const h = Math.sqrt(Math.max(0, a.radius ** 2 - x ** 2));
      const ux = (b.center[0] - a.center[0]) / d, uy = (b.center[1] - a.center[1]) / d;
      for (const sign of [-1, 1]) {
        const p = [a.center[0] + x * ux - sign * h * uy, a.center[1] + x * uy + sign * h * ux];
        if (onArc(a, p) && onArc(b, p)) points.push(p);
      }
    }
  }
  return { points: points.filter((p, i) => !points.slice(0, i).some(other => distance(p, other) <= EPS)), overlap };
}

export function signedArea(ring) {
  return ring.reduce((sum, edge) => {
    if (edge.kind === 'line') return sum + cross(edge.from, edge.to) / 2;
    const a = edge.startDeg * RAD, b = (edge.startDeg + edge.sweepDeg) * RAD;
    const [cx, cy] = edge.center, r = edge.radius;
    return sum + (r * cx * (Math.sin(b) - Math.sin(a)) + r * cy * (Math.cos(a) - Math.cos(b)) + r * r * (b - a)) / 2;
  }, 0);
}

export function ringContains(ring, p) {
  if (ring.some(e => edgeDistance(e, p) <= EPS)) return 'boundary';
  let crossings = 0;
  for (const e of ring) {
    if (e.kind === 'line') {
      if ((e.from[1] > p[1]) !== (e.to[1] > p[1])) {
        const x = e.from[0] + (p[1] - e.from[1]) * (e.to[0] - e.from[0]) / (e.to[1] - e.from[1]);
        if (x > p[0]) crossings++;
      }
    } else {
      // Monotonic y intervals avoid tangent/vertex double-counting.
      const cuts = [0, 1];
      for (const angle of [90, 270]) {
        const t = arcParameter(e, [e.center[0] + e.radius * Math.cos(angle * RAD), e.center[1] + e.radius * Math.sin(angle * RAD)]);
        if (t > EPS && t < 1 - EPS) cuts.push(t);
      }
      cuts.sort((a, b) => a - b);
      const dy = p[1] - e.center[1];
      if (Math.abs(dy) > e.radius) continue;
      const dx = Math.sqrt(Math.max(0, e.radius ** 2 - dy ** 2));
      for (let i = 1; i < cuts.length; i++) {
        const lo = cuts[i - 1], hi = cuts[i];
        if ((q(at(e, lo)[1]) > p[1]) === (q(at(e, hi)[1]) > p[1])) continue;
        for (const x of [e.center[0] - dx, e.center[0] + dx]) {
          const t = arcParameter(e, [x, p[1]]);
          if (t >= lo - EPS && t <= hi + EPS && x > p[0]) { crossings++; break; }
        }
      }
    }
  }
  return crossings % 2 ? 'inside' : 'outside';
}
export function contains(footprint, p) {
  const outer = ringContains(footprint.outer, p);
  if (outer !== 'inside') return outer;
  for (const hole of footprint.holes) {
    const result = ringContains(hole, p);
    if (result === 'boundary') return result;
    if (result === 'inside') return 'outside';
  }
  return 'inside';
}

export function validateFootprint(footprint, { stableTangencies = false } = {}) {
  const errors = [];
  if (!footprint || !Array.isArray(footprint.outer) || !Array.isArray(footprint.holes)) return ['Footprint requires outer and holes arrays.'];
  const rings = [footprint.outer, ...footprint.holes];
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r], label = r === 0 ? 'Outer ring' : `Hole ${r}`;
    if (!Array.isArray(ring) || ring.length < 2) { errors.push(`${label}: at least two edges required.`); continue; }
    const malformed = ring.some(e => !e || !['line', 'arc'].includes(e.kind) || (e.kind === 'line' ? !finitePoint(e.from) || !finitePoint(e.to) || distance(e.from, e.to) <= EPS : !finitePoint(e.center) || !Number.isFinite(e.radius) || e.radius <= EPS || !Number.isFinite(e.startDeg) || !Number.isFinite(e.sweepDeg) || Math.abs(e.sweepDeg) <= EPS || Math.abs(e.sweepDeg) > 180));
    if (malformed) { errors.push(`${label}: invalid/degenerate edge (arc sweep must be >0 and <=180 degrees).`); continue; }
    for (let i = 0; i < ring.length; i++) {
      if (distance(at(ring[i], 1), at(ring[(i + 1) % ring.length], 0)) > EPS) errors.push(`${label}: edge ${i} is disconnected.`);
      for (let j = i + 1; j < ring.length; j++) {
        const hit = intersections(ring[i], ring[j], stableTangencies);
        const shared = [];
        if (j === i + 1) shared.push(at(ring[i], 1));
        if (i === 0 && j === ring.length - 1) shared.push(at(ring[i], 0));
        if (hit.overlap || hit.points.some(p => !shared.some(s => distance(p, s) <= EPS))) errors.push(`${label}: edges ${i}/${j} self-intersect.`);
      }
    }
    const area = signedArea(ring);
    if (r === 0 ? area <= EPS ** 2 : area >= -(EPS ** 2)) errors.push(`${label}: wrong winding or zero area.`);
  }
  if (errors.length) return errors;
  for (let i = 1; i < rings.length; i++) {
    if (ringContains(rings[0], at(rings[i][0], 0)) !== 'inside') errors.push(`Hole ${i}: outside outer boundary.`);
    for (let j = 0; j < i; j++) {
      if (rings[i].some(a => rings[j].some(b => { const h = intersections(a, b, stableTangencies); return h.overlap || h.points.length; }))) errors.push(`Hole ${i}: touches/intersects ring ${j}.`);
      if (j > 0 && (ringContains(rings[j], at(rings[i][0], 0)) !== 'outside' || ringContains(rings[i], at(rings[j][0], 0)) !== 'outside')) errors.push(`Holes ${i}/${j}: nested or overlapping.`);
    }
  }
  return errors;
}

export function bounds(footprint) {
  const pts = [];
  for (const e of footprint.outer) {
    pts.push(at(e, 0), at(e, 1));
    if (e.kind === 'arc') for (const a of [0, 90, 180, 270]) {
      const p = [e.center[0] + e.radius * Math.cos(a * RAD), e.center[1] + e.radius * Math.sin(a * RAD)];
      if (onArc(e, p)) pts.push(p);
    }
  }
  return { minX: Math.min(...pts.map(p => p[0])), maxX: Math.max(...pts.map(p => p[0])), minY: Math.min(...pts.map(p => p[1])), maxY: Math.max(...pts.map(p => p[1])) };
}
export function transform(footprint, origin, angleDeg) {
  const a = angleDeg * RAD;
  const move = p => point(origin[0] + p[0] * Math.cos(a) - p[1] * Math.sin(a), origin[1] + p[0] * Math.sin(a) + p[1] * Math.cos(a));
  const ring = edges => edges.map(e => e.kind === 'line' ? line(move(e.from), move(e.to)) : arc(move(e.center), e.radius, e.startDeg + angleDeg, e.sweepDeg));
  return { outer: ring(footprint.outer), holes: footprint.holes.map(ring) };
}
export const polygon = vertices => ({ outer: vertices.map((p, i) => line(p, vertices[(i + 1) % vertices.length])), holes: [] });
export const rectangle = (width, depth) => polygon([[0, 0], [width, 0], [width, depth], [0, depth]]);
export const circle = radius => ({ outer: [arc([0, 0], radius, 0, 180), arc([0, 0], radius, 180, 180)], holes: [] });

// Positive-area overlap, allowing coincident/tangent boundaries. Analytic contacts
// plus interior probes resolve local sides within the published tolerance.
export function interiorsOverlap(a, b) {
  const A = bounds(a), B = bounds(b);
  if (A.maxX <= B.minX + EPS || B.maxX <= A.minX + EPS || A.maxY <= B.minY + EPS || B.maxY <= A.minY + EPS) return false;
  const edgesA = [a.outer, ...a.holes].flat(), edgesB = [b.outer, ...b.holes].flat();
  if (edgesA.some(edge => intervalMidpoints(edge, edgesB).some(p => contains(b, p) === 'inside')) || edgesB.some(edge => intervalMidpoints(edge, edgesA).some(p => contains(a, p) === 'inside'))) return true;
  const witness = p => contains(a, p) === 'inside' && contains(b, p) === 'inside';
  for (const edge of [...edgesA, ...edgesB]) for (const t of [0.25, 0.5, 0.75]) {
    const p = at(edge, t), v = tangent(edge, t), len = Math.hypot(...v);
    for (const sign of [-1, 1]) if (witness([p[0] - sign * v[1] / len * EPS * 8, p[1] + sign * v[0] / len * EPS * 8])) return true;
  }
  for (const ea of edgesA) for (const eb of edgesB) for (const p of intersections(ea, eb).points) {
    for (let i = 0; i < 16; i++) if (witness([p[0] + Math.cos(i * Math.PI / 8) * EPS * 8, p[1] + Math.sin(i * Math.PI / 8) * EPS * 8])) return true;
  }
  return false;
}
