import { triangulate } from './mesh.js';

// Display projection only: heights, window sills and lintels are assumptions.
// No wall offset, rectangular approximation or invented navigation is used.
export function prepareResPlanPreview(plan, lowWalls = true) {
  const values = [], ids = new Map(plan.spaces.map((s, i) => [s.id, i + 1]));
  function triangle(points, color, id) {
    const u = points[1].map((v, i) => v - points[0][i]), v = points[2].map((n, i) => n - points[0][i]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(...normal);
    if (length < 1e-10) return;
    const pick = [(id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255];
    for (const p of points) values.push(...p, ...normal.map(n => n / length), ...color, ...pick);
  }
  function solid(f, low, high, color, id = 0) {
    const triangles = triangulate(f);
    for (const tri of triangles) triangle(tri.map(p => [...p, high]), color, id);
    if (high <= low) return;
    for (const ring of [f.outer, ...f.holes]) for (const edge of ring) {
      const a = [...edge.from, low], b = [...edge.to, low], c = [...edge.to, high], d = [...edge.from, high];
      triangle([a, b, c], color.map(c => c * .9), id); triangle([a, c, d], color.map(c => c * .9), id);
    }
  }
  for (const s of plan.spaces) solid(s.footprint, -.12, 0, s.role === 'service' ? [.66, .61, .49] : [.8, .72, .53], ids.get(s.id));
  const top = lowWalls ? 1.3 : plan.input.ceiling;
  for (const f of plan.features) {
    if (f.category === 'wall') solid(f.footprint, 0, top, [.48, .44, .34]);
    if (['door', 'front_door'].includes(f.category)) {
      solid(f.footprint, 0, .012, [.36, .65, .49]);
      if (top > 2.1) solid(f.footprint, 2.1, top, [.48, .44, .34]);
    }
    if (f.category === 'window') {
      solid(f.footprint, 0, Math.min(.9, top), [.48, .44, .34]);
      solid(f.footprint, Math.min(.9, top), Math.min(.92, top), [.4, .65, .72]);
      if (top > 2.1) solid(f.footprint, 2.1, top, [.48, .44, .34]);
    }
  }
  return { vertices: new Float32Array(values), lines: new Float32Array(0) };
}
