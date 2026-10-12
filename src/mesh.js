import { at, bounds } from './geometry.js';

export const COLORS = { public: [.44, .56, .6], private: [.49, .52, .68], service: [.59, .52, .38], circulation: [.38, .57, .53], gallery: [.42, .65, .55], specimen: [.4, .5, .56] };
export const sampleRing = ring => ring.flatMap(edge => Array.from({ length: edge.kind === 'arc' ? Math.ceil(Math.abs(edge.sweepDeg) / 3) : 1 }, (_, i) => at(edge, i / (edge.kind === 'arc' ? Math.ceil(Math.abs(edge.sweepDeg) / 3) : 1))));

// Rendering only: tessellated rings are partitioned into y-monotonic strips.
// Even-odd pairing includes holes; no triangles fill a gallery or stair void.
export function triangulate(footprint) {
  const rings = [footprint.outer, ...footprint.holes].map(sampleRing);
  const edges = rings.flatMap(points => points.map((p, i) => [p, points[(i + 1) % points.length]]));
  const ys = [...new Set(rings.flat().map(p => p[1]))].sort((a, b) => a - b), triangles = [];
  const xAt = (edge, y) => edge[0][0] + (y - edge[0][1]) * (edge[1][0] - edge[0][0]) / (edge[1][1] - edge[0][1]);
  const push = tri => {
    const a = tri[0], b = tri[1], c = tri[2];
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-10) triangles.push(tri);
  };
  for (let strip = 1; strip < ys.length; strip++) {
    const low = ys[strip - 1], high = ys[strip], mid = (low + high) / 2;
    if (high - low < 1e-10) continue;
    const crossing = edges.filter(([a, b]) => (a[1] > mid) !== (b[1] > mid)).sort((a, b) => xAt(a, mid) - xAt(b, mid));
    for (let i = 0; i < crossing.length - 1; i += 2) {
      const a = [xAt(crossing[i], low), low], b = [xAt(crossing[i + 1], low), low], c = [xAt(crossing[i + 1], high), high], d = [xAt(crossing[i], high), high];
      push([a, b, c]); push([a, c, d]);
    }
  }
  return triangles;
}

export function buildMesh(plan, options = {}) {
  const faces = [], { scope = 'gallery', lowWalls = true, ceilings = false, walls = true, guards = true, selected } = options;
  const visible = index => scope === 'all' || scope === 'top' ? scope === 'all' || index === 2 : index <= (scope === 'ground' ? 0 : 1);
  const getSpace = id => plan.spaces.find(s => s.id === id);
  const baseColor = id => id === selected ? [.89, .75, .43] : COLORS[getSpace(id)?.role] ?? COLORS.specimen;
  function face(points, spaceId, category, color = baseColor(spaceId)) {
    const u = points[1].map((v, i) => v - points[0][i]), v = points[2].map((n, i) => n - points[0][i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(...n);
    if (length < 1e-10) return;
    faces.push({ points, spaceId, category, color, normal: n.map(x => x / length) });
  }
  const quad = (points, id, category, color) => { face([points[0], points[1], points[2]], id, category, color); face([points[0], points[2], points[3]], id, category, color); };
  function floor(footprint, elevation, id, category, thickness = 0) {
    const triangles = triangulate(footprint);
    triangles.forEach(tri => face(tri.map(p => [...p, elevation]), id, category));
    if (!thickness) return;
    triangles.forEach(tri => face([...tri].reverse().map(p => [...p, elevation - thickness]), id, `${category}-underside`, baseColor(id).map(c => c * .75)));
    for (const ring of [footprint.outer, ...footprint.holes]) {
      const sampled = sampleRing(ring);
      sampled.forEach((a, i) => { const b = sampled[(i + 1) % sampled.length]; quad([[...a, elevation], [...b, elevation], [...b, elevation - thickness], [...a, elevation - thickness]], id, `${category}-edge`, baseColor(id).map(c => c * .8)); });
    }
  }
  for (const surface of plan.surfaces) if (visible(getSpace(surface.spaceId)?.floorIndex) && (surface.kind === 'floor' || ceilings)) floor(surface.footprint, surface.elevation, surface.spaceId, surface.kind, surface.thickness ?? 0);
  if (walls) for (const wall of plan.walls) {
    const owner = getSpace(wall.spaceId);
    if (!visible(owner.floorIndex)) continue;
    const maxZ = lowWalls ? Math.min(wall.maxZ, wall.minZ + 1.3) : wall.maxZ;
    const cuts = [0, 1], apertures = [];
    if (wall.edge.kind === 'line') for (const id of wall.openingIds) {
      const opening = plan.openings.find(o => o.id === id);
      if (!opening) continue;
      const delta = wall.edge.to.map((x, i) => x - wall.edge.from[i]), length = Math.hypot(...delta);
      const t = ((opening.center[0] - wall.edge.from[0]) * delta[0] + (opening.center[1] - wall.edge.from[1]) * delta[1]) / length ** 2;
      const lo = Math.max(0, t - opening.width / length / 2), hi = Math.min(1, t + opening.width / length / 2);
      cuts.push(lo, hi); apertures.push({ lo, hi, bottom: opening.center[2], top: opening.center[2] + opening.height });
    }
    if (wall.edge.kind === 'arc') for (let i = 1; i < Math.ceil(Math.abs(wall.edge.sweepDeg) / 3); i++) cuts.push(i / Math.ceil(Math.abs(wall.edge.sweepDeg) / 3));
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i] - cuts[i - 1] < 1e-10) continue;
      const a = at(wall.edge, cuts[i - 1]), b = at(wall.edge, cuts[i]), mid = (cuts[i - 1] + cuts[i]) / 2;
      const opening = apertures.find(o => mid > o.lo && mid < o.hi);
      const sections = opening ? [[wall.minZ, Math.min(maxZ, opening.bottom)], [Math.max(wall.minZ, opening.top), maxZ]] : [[wall.minZ, maxZ]];
      for (const [low, high] of sections) if (high > low + 1e-8) quad([[...a, low], [...b, low], [...b, high], [...a, high]], wall.spaceId, 'wall', baseColor(wall.spaceId).map(c => c * 1.12));
    }
  }
  for (const stair of plan.verticalTraversals) {
    const source = getSpace(stair.source.spaceId), target = getSpace(stair.target.spaceId);
    if (scope === 'top' ? !visible(target.floorIndex) : !visible(source.floorIndex) || !visible(target.floorIndex)) continue;
    for (const tread of stair.treads) floor(tread.footprint, tread.elevation, stair.source.spaceId, 'stair', tread.elevation - stair.source.position[2]);
  }
  function bar(a, b, id, category) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), thickness = .035;
    const n = length ? [-dy / length * thickness, dx / length * thickness, 0] : [thickness, 0, 0];
    const offsets = [n, [0, 0, thickness], n.map(x => -x), [0, 0, -thickness]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad([a.map((v, k) => v + offsets[i][k]), b.map((v, k) => v + offsets[i][k]), b.map((v, k) => v + offsets[j][k]), a.map((v, k) => v + offsets[j][k])], id, category, [.77, .81, .78]);
    }
  }
  if (guards) for (const guard of plan.guards) {
    let segments, id;
    if (guard.kind === 'slab-edge') {
      const surface = plan.surfaces.find(s => s.id === guard.surfaceId), owner = getSpace(surface.spaceId);
      if (!visible(owner.floorIndex)) continue;
      id = owner.id;
      const count = guard.edge.kind === 'arc' ? Math.ceil(Math.abs(guard.edge.sweepDeg) / 3) : Math.ceil(Math.hypot(at(guard.edge, 1)[0] - at(guard.edge, 0)[0], at(guard.edge, 1)[1] - at(guard.edge, 0)[1]) / .8);
      segments = Array.from({ length: count + 1 }, (_, i) => [...at(guard.edge, i / count), guard.elevation]);
    } else {
      const stair = plan.verticalTraversals.find(s => s.id === guard.traversalId);
      if (!stair || !visible(getSpace(stair.target.spaceId).floorIndex) || (scope !== 'top' && !visible(getSpace(stair.source.spaceId).floorIndex))) continue;
      id = stair.source.spaceId;
      segments = Array.from({ length: 9 }, (_, i) => guard.path[0].map((v, k) => v + (guard.path[1][k] - v) * i / 8));
    }
    segments.forEach((p, i) => {
      bar(p, [p[0], p[1], p[2] + guard.height], id, 'guard');
      if (i) bar([segments[i - 1][0], segments[i - 1][1], segments[i - 1][2] + guard.height], [p[0], p[1], p[2] + guard.height], id, 'guard');
    });
  }
  const lines = [];
  if (options.navigation) {
    for (const paths of plan.diagnostics.navigation.spacePaths) {
      const space = getSpace(paths.spaceId);
      if (!visible(space.floorIndex)) continue;
      for (const witness of paths.paths) for (let i = 1; i < witness.points.length; i++) lines.push({ a: [...witness.points[i - 1], space.elevation + .08], b: [...witness.points[i], space.elevation + .08], color: [.53, .93, .76] });
    }
    for (const connection of plan.diagnostics.navigation.connections.filter(c => c.kind === 'opening')) {
      const opening = plan.openings.find(o => o.id === connection.geometryId);
      if (!opening || !visible(getSpace(opening.hosts[0].spaceId).floorIndex)) continue;
      const endpoints = opening.hosts.map(host => plan.diagnostics.navigation.spacePaths.find(paths => paths.spaceId === host.spaceId)?.paths.find(w => w.terminalId === `${opening.id}:${host.spaceId}`)?.points.at(-1));
      if (endpoints.every(Boolean)) lines.push({ a: [...endpoints[0], opening.center[2] + .08], b: [...endpoints[1], opening.center[2] + .08], color: [.53, .93, .76] });
    }
    for (const stair of plan.verticalTraversals) if (visible(getSpace(stair.source.spaceId).floorIndex) && visible(getSpace(stair.target.spaceId).floorIndex)) lines.push({ a: stair.source.position.map((x, i) => i === 2 ? x + .08 : x), b: stair.target.position.map((x, i) => i === 2 ? x + .08 : x), color: [.91, .77, .43] });
  }
  for (const port of plan.externalPorts) if (visible(getSpace(port.owningSpaceId).floorIndex)) {
    const opening = plan.openings.find(o => o.id === port.openingId), [x, y, z] = opening.center, [ux, uy] = opening.tangent, w = opening.width / 2;
    const corners = [[x - ux * w, y - uy * w, z], [x + ux * w, y + uy * w, z], [x + ux * w, y + uy * w, z + opening.height], [x - ux * w, y - uy * w, z + opening.height]];
    corners.forEach((a, i) => lines.push({ a, b: corners[(i + 1) % 4], color: [.95, .8, .44] }));
  }
  return { faces, lines };
}

export function sceneBounds(plan) {
  const boxes = plan.spaces.map(s => bounds(s.footprint));
  return { min: [Math.min(...boxes.map(b => b.minX)), Math.min(...boxes.map(b => b.minY)), 0], max: [Math.max(...boxes.map(b => b.maxX)), Math.max(...boxes.map(b => b.maxY)), Math.max(...plan.spaces.map(s => s.elevation + s.clearHeight))] };
}

export function cameraBasis(yaw, pitch) {
  return { right: [-Math.sin(yaw), Math.cos(yaw), 0], up: [-Math.sin(pitch) * Math.cos(yaw), -Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch)], direction: [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)] };
}

export function cameraMatrix(camera, aspect) {
  const { right, up, direction } = cameraBasis(camera.yaw, camera.pitch), vertical = camera.extent / camera.zoom, horizontal = vertical * aspect, depth = 100;
  const rowX = right.map(v => v / horizontal), rowY = up.map(v => v / vertical), rowZ = direction.map(v => -v / depth);
  const dot = row => row.reduce((n, v, i) => n + v * camera.target[i], 0);
  return new Float32Array([rowX[0], rowY[0], rowZ[0], 0, rowX[1], rowY[1], rowZ[1], 0, rowX[2], rowY[2], rowZ[2], 0, -dot(rowX), -dot(rowY), -dot(rowZ), 1]);
}
