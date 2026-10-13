import '../exchange/stream.js';
import { point, polygon, transform, at, tangent, edgeDistance, distance, interiorsOverlap, bounds } from './geometry.js';

const rect = (x0, y0, x1, y1) => polygon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const heading = v => Math.atan2(v[1], v[0]) * 180 / Math.PI;
const normal = e => { const v = tangent(e, .5), length = Math.hypot(...v); return [v[1] / length, -v[0] / length]; };
const near = (a, b) => distance(a, b) < 2e-5;

// Actual coincident boundary spans, including rotated walls and partial overlaps.
export function sharedBoundary(a, b) {
  for (const ea of a.outer) for (const eb of b.outer) {
    if (ea.kind !== 'line' || eb.kind !== 'line') continue;
    const na = normal(ea), nb = normal(eb);
    if (Math.abs(na[0] + nb[0]) > 1e-5 || Math.abs(na[1] + nb[1]) > 1e-5) continue;
    const u = tangent(ea, .5), length = Math.hypot(...u), t = u.map(v => v / length);
    if (Math.abs((eb.from[0] - ea.from[0]) * na[0] + (eb.from[1] - ea.from[1]) * na[1]) > 1e-5) continue;
    const project = p => (p[0] - ea.from[0]) * t[0] + (p[1] - ea.from[1]) * t[1];
    const low = Math.max(0, Math.min(project(eb.from), project(eb.to))), high = Math.min(length, Math.max(project(eb.from), project(eb.to)));
    if (high - low >= 1.8) return { center: point(ea.from[0] + t[0] * (low + high) / 2, ea.from[1] + t[1] * (low + high) / 2), length: high - low };
  }
  return null;
}

export function composeGeneric({ seed, dials: D }, attempt = 0) {
  const random = name => globalThis.ZoneExchange.stream(seed, 'generic-v2/' + attempt, name) / 4294967296;
  const pick = (name, low, high) => low + Math.floor(random(name) * (high - low + 1));
  const chance = (name, value) => random(name) * 100 < value;
  let work = 0;
  const step = () => { if (++work > 150000) throw new Error('Generic placement work bound exceeded.'); };
  const rooms = 8 + Math.floor(D.rooms * 88 / 100), target = 2 + Math.floor(D.clusterSize * 8 / 100), count = Math.ceil(rooms / target);
  const counts = Array.from({ length: count }, (_, i) => Math.floor(rooms / count) + (i < rooms % count ? 1 : 0));
  const width = 2 + D.hallWidth / 50, allocations = [], links = [], clusters = [], routes = [], used = [];
  const enabled = ['partitioned', 'chains', 'sideHalls', 'chambers'].filter(id => D[id] >= 50);
  if (!enabled.length) enabled.push('partitioned');
  const repeated = enabled[pick('recipe/repeated', 0, enabled.length - 1)];
  const recipeOrder = [...enabled].sort((a, b) => random('recipe/order/' + a) - random('recipe/order/' + b) || a.localeCompare(b));
  const boxes = new WeakMap(), box = f => { if (!boxes.has(f)) boxes.set(f, bounds(f)); return boxes.get(f); };
  const boxesMeet = (a, b) => { const A = box(a), B = box(b); return A.minX <= B.maxX + 1e-5 && B.minX <= A.maxX + 1e-5 && A.minY <= B.maxY + 1e-5 && B.minY <= A.maxY + 1e-5; };
  const overlap = (a, b) => boxesMeet(a, b) && interiorsOverlap(a, b);

  function cluster(i) {
    const n = counts[i], recipe = chance('cluster/' + i + '/mix', D.moduleMix) ? recipeOrder[i % recipeOrder.length] : repeated;
    const spaces = [], joins = [];
    const size = (path, factor = 1) => Math.max(3.4, (4 + D.scale * .09) * factor * (1 + (random('cluster/' + i + '/' + path) * 2 - 1) * D.variety * .004));
    function add(fp, kind = 'room', role = 'quiet', label = 'Room') { const s = { id: 'cluster-' + i + '-' + kind + '-' + spaces.filter(s => s.kind === kind).length, cluster: i, kind, role, label, footprint: fp }; spaces.push(s); return s; }
    if (recipe === 'partitioned') {
      const columns = Math.min(n, pick('cluster/' + i + '/columns', 2, 3)), rows = Math.ceil(n / columns);
      const xs = [0], ys = [0];
      for (let c = 0; c < columns; ++c) xs.push(xs.at(-1) + size('column/' + c));
      for (let r = 0; r < rows; ++r) ys.push(ys.at(-1) + size('row/' + r));
      for (let r = 0, k = 0; r < rows; ++r) for (let c = 0; c < columns && k < n; ++c, ++k) add(rect(xs[c], ys[r] - ys[1] / 2, xs[c + 1], ys[r + 1] - ys[1] / 2));
    } else if (recipe === 'chains') {
      let x = 0, y = 0, depth = size('depth/0');
      for (let k = 0; k < n; ++k) {
        const length = size('length/' + k, k % 3 === 0 ? 1.5 : .8), next = size('depth/' + k);
        y += k ? (random('cluster/' + i + '/offset/' + k) * 2 - 1) * Math.max(0, Math.min(depth, next) - 2.4) / 2 * D.variety / 100 : 0;
        const fp = rect(x, y - next / 2, x + length, y + next / 2);
        // Chamfer the last far corner only: all required shared edges remain intact.
        if (k === n - 1 && D.orientation && D.variety >= 50) { const cut = Math.min(length, next) * .2; fp.outer = polygon([[x, y - next / 2], [x + length - cut, y - next / 2], [x + length, y - next / 2 + cut], [x + length, y + next / 2], [x, y + next / 2]]).outer; }
        add(fp); x += length; depth = next;
      }
    } else if (recipe === 'sideHalls') {
      let x = 0, k = 0;
      while (k < n) {
        const length = size('bay/' + k), hall = add(rect(x, -width / 2, x + length, width / 2), 'hall', 'circulation', 'Local passage');
        for (const side of [1, -1]) if (k < n) { const depth = size('room-depth/' + k, 1.1); add(side > 0 ? rect(x, width / 2, x + length, width / 2 + depth) : rect(x, -width / 2 - depth, x + length, -width / 2)); ++k; }
        x += length;
        void hall;
      }
    } else {
      const lengths = Array.from({ length: n - 1 }, (_, k) => size('small/' + k, .7)), length = lengths.reduce((s, v) => s + v, 0), depth = size('chamber', 1.8);
      add(rect(0, -depth / 2, length, depth / 2), 'room', 'shared', 'Interconnected chamber');
      let x = 0;
      for (let k = 0; k < lengths.length; ++k) { const l = lengths[k]; add(rect(x, depth / 2, x + l, depth / 2 + size('side/' + k, .7))); x += l; }
    }
    // Required spanning tree first; loops are physical extra apertures on actual shared walls.
    const pairs = [];
    for (let a = 0; a < spaces.length; ++a) for (let b = a + 1; b < spaces.length; ++b) { const wall = sharedBoundary(spaces[a].footprint, spaces[b].footprint); if (wall) pairs.push({ a, b, wall, priority: random('cluster/' + i + '/join/' + a + '/' + b) }); }
    pairs.sort((a, b) => a.priority - b.priority || a.a - b.a || a.b - b.b);
    const group = spaces.map((_, k) => k), find = k => group[k] === k ? k : find(group[k]);
    for (const p of pairs) { const a = find(p.a), b = find(p.b), required = a !== b; if (required || chance('cluster/' + i + '/loop/' + p.a + '/' + p.b, D.loops)) { joins.push({ a: spaces[p.a].id, b: spaces[p.b].id, ...p.wall, required }); group[a] = b; } }
    if (spaces.some((_, k) => find(k) !== find(0))) throw new Error('Cluster room program is disconnected.');
    return { recipe, spaces, joins, entry: spaces[0].id };
  }
  const moveModel = (m, origin, angle) => ({ ...m, spaces: m.spaces.map(s => ({ ...s, footprint: transform(s.footprint, origin, angle) })), joins: m.joins.map(j => ({ ...j, center: at(transform(polygon([j.center, [j.center[0] + 1, j.center[1]], [j.center[0], j.center[1] + 1]]), origin, angle).outer[0], 0) })) });
  function commit(m, i, origin, angle, parent) {
    allocations.push(...m.spaces); links.push(...m.joins);
    clusters.push({ id: 'cluster-' + i, recipe: m.recipe, rooms: counts[i], parent, origin: point(...origin), headingDegrees: Math.round(((angle % 360) + 360) % 360), spaceIds: m.spaces.map(s => s.id) });
  }
  function availablePorts(spaces = allocations, openingWidth = 1.2) {
    const candidates = [];
    for (const s of spaces) for (const [edgeIndex, e] of s.footprint.outer.entries()) {
      step(); const length = distance(e.from, e.to); if (length < openingWidth + .6) continue;
      const positions = [ .5, .3, .7 ];
      for (const fraction of positions) {
        const center = point(...at(e, fraction));
        if (Math.min(fraction, 1 - fraction) * length < openingWidth / 2 + .25) continue;
        if (used.some(p => p.space === s.id && distance(p.center, center) < openingWidth + .6)) continue;
        const exterior = transform(rect(0, -openingWidth / 2, .3, openingWidth / 2), center, heading(normal(e)));
        const blocked = allocations.some(other => other.id !== s.id && boxesMeet(exterior, other.footprint) && (other.footprint.outer.some(edge => edgeDistance(edge, center) < 1e-5) || overlap(exterior, other.footprint)));
        if (blocked) continue;
        candidates.push({ space: s.id, cluster: s.cluster, edgeIndex, center, length: 2 * Math.min(fraction, 1 - fraction) * length, angle: heading(normal(e)) });
      }
    }
    return candidates;
  }
  function addLink(a, b, center, length, required = true) { links.push({ a, b, center: point(...center), length, required }); used.push({ space: a, center }, { space: b, center }); }
  const first = cluster(0); commit(first, 0, [0, 0], 0, null);
  for (const j of links) used.push({ space: j.a, center: j.center }, { space: j.b, center: j.center });
  for (let i = 1; i < count; ++i) {
    const local = cluster(i), branch = chance('placement/' + i + '/branch', D.branching), preferredParent = branch && i > 1 ? pick('placement/' + i + '/parent', 0, i - 2) : i - 1;
    const choices = availablePorts(allocations.filter(s => s.cluster !== null));
    choices.forEach((p, k) => { const outward = Math.hypot(...p.center); p.score = (p.cluster === preferredParent ? 100000 : 0) + outward * (D.sprawl - 50) + random('placement/' + i + '/port/' + k) * 800; });
    choices.sort((a, b) => b.score - a.score || a.space.localeCompare(b.space) || a.edgeIndex - b.edgeIndex || a.center[0] - b.center[0]);
    let fitted = false;
    for (let k = 0; k < Math.min(choices.length, 120) && !fitted; ++k) {
      const p = choices[k], W = Math.min(width, p.length - .4), direct = chance('placement/' + i + '/direct', D.cohesion), turn = chance('placement/' + i + '/turn', D.turns);
      const angled = chance('placement/' + i + '/angle', D.orientation), sign = chance('placement/' + i + '/sign/' + k, 50) ? 1 : -1;
      // A direct join aligns to its parent wall. Bent links use real octagonal junctions.
      const delta = direct ? 0 : turn ? sign * (angled ? 45 : 90) : 0;
      let m, extra = [], attachments = [], routeLength = 0, angle = p.angle;
      if (direct) m = moveModel(local, p.center, angle);
      else {
        const R = Math.max(2.2, W / 2 + .65), a = R * Math.tan(Math.PI / 8), L = 1 + D.corridorLength * .18 + D.sprawl * .045, L2 = 1 + D.corridorLength * .12;
        const origin = p.center, map = v => { const rad = p.angle * Math.PI / 180; return point(origin[0] + v[0] * Math.cos(rad) - v[1] * Math.sin(rad), origin[1] + v[0] * Math.sin(rad) + v[1] * Math.cos(rad)); };
        const joint = [L + R, 0], rad = delta * Math.PI / 180, exit = [joint[0] + R * Math.cos(rad), joint[1] + R * Math.sin(rad)], end = [exit[0] + L2 * Math.cos(rad), exit[1] + L2 * Math.sin(rad)];
        const A = { id: 'route-' + i + '-in', kind: 'hall', role: 'circulation', label: 'Connecting passage', cluster: null, footprint: transform(rect(0, -W / 2, L, W / 2), origin, p.angle) };
        const B = { id: 'route-' + i + '-junction', kind: 'hall', role: 'circulation', label: delta ? 'Angled junction' : 'Passage junction', cluster: null, footprint: polygon([[-R, -a], [-a, -R], [a, -R], [R, -a], [R, a], [a, R], [-a, R], [-R, a]].map(v => map([joint[0] + v[0], v[1]]))) };
        const C = { id: 'route-' + i + '-out', kind: 'hall', role: 'circulation', label: 'Connecting passage', cluster: null, footprint: transform(rect(0, -W / 2, L2, W / 2), map(exit), p.angle + delta) };
        routeLength = L + L2 + 2 * R;
        angle += delta; m = moveModel(local, map(end), angle);
        if (delta) {
          extra = [A, B, C];
          attachments = [[p.space, A.id, origin, W], [A.id, B.id, map([L, 0]), W], [B.id, C.id, map(exit), W], [C.id, m.entry, map(end), W]];
        } else {
          // A straight run is one corridor, without a mandatory junction room.
          A.footprint = transform(rect(0, -W / 2, routeLength, W / 2), origin, p.angle); extra = [A];
          attachments = [[p.space, A.id, origin, W], [A.id, m.entry, map(end), W]];
        }
      }
      const proposed = [...extra, ...m.spaces];
      const collides = proposed.some(s => allocations.some(other => { step(); return overlap(s.footprint, other.footprint); })) || proposed.some((s, n) => proposed.slice(n + 1).some(other => overlap(s.footprint, other.footprint)));
      if (collides) continue;
      // Child entry must physically share the selected wall/last corridor, not just touch at a point.
      const entryHost = (extra.at(-1) ?? allocations.find(s => s.id === p.space)), entrySpace = m.spaces.find(s => s.id === m.entry);
      const shared = sharedBoundary(entryHost.footprint, entrySpace.footprint); if (!shared || edgeDistance(entrySpace.footprint.outer.find(e => edgeDistance(e, direct ? p.center : attachments.at(-1)[2]) < 1e-5) ?? entrySpace.footprint.outer[0], direct ? p.center : attachments.at(-1)[2]) > 1e-5) continue;
      allocations.push(...extra); commit(m, i, at(entrySpace.footprint.outer[0], 0), angle, p.cluster);
      for (const j of m.joins) used.push({ space: j.a, center: j.center }, { space: j.b, center: j.center });
      if (direct) addLink(p.space, m.entry, p.center, Math.min(p.length, shared.length));
      else for (const args of attachments) addLink(...args);
      routes.push({ id: 'route-' + i, parentCluster: p.cluster, targetCluster: i, direct, bendDegrees: delta, lengthM: routeLength, spaceIds: extra.map(s => s.id) }); fitted = true;
    }
    if (!fitted) throw new Error('No collision-free route fits cluster ' + i + ' within the placement bound.');
  }
  // Cross-cluster loops are extra physical shared-wall links where growth brought groups together.
  if (D.loops) for (let a = 0; a < allocations.length; ++a) for (let b = a + 1; b < allocations.length; ++b) {
    const A = allocations[a], B = allocations[b]; if (A.cluster === B.cluster || links.some(j => j.a === A.id && j.b === B.id || j.a === B.id && j.b === A.id)) continue;
    if (!boxesMeet(A.footprint, B.footprint)) continue;
    const shared = sharedBoundary(A.footprint, B.footprint);
    if (shared && chance('cross-loop/' + A.id + '/' + B.id, D.loops) && !used.some(p => [A.id, B.id].includes(p.space) && near(p.center, shared.center))) addLink(A.id, B.id, shared.center, shared.length, false);
  }
  const ports = availablePorts(allocations.filter(s => s.cluster !== null), 1), requestedPorts = 1 + Math.floor(D.exits * 7 / 100), external = [];
  ports.sort((a, b) => Number(b.cluster === 0) - Number(a.cluster === 0) || b.length - a.length || a.space.localeCompare(b.space) || a.edgeIndex - b.edgeIndex);
  for (const p of ports) { if (external.some(other => other.space === p.space && distance(other.center, p.center) < 1.6)) continue; external.push(p); if (external.length === requestedPorts) break; }
  if (external.length !== requestedPorts) throw new Error('The requested exterior ports do not fit free walls.');
  // Function draws never affect geometry or placement.
  const program = allocations.filter(s => s.kind === 'room'), support = Math.floor(rooms * D.supportMix / 300);
  const assigned = [...program].sort((a, b) => random('support/' + a.id) - random('support/' + b.id) || a.id.localeCompare(b.id));
  assigned.forEach((s, i) => { if (i < support) { s.role = 'service'; s.label = 'Support room'; } else if (s.role !== 'shared') { s.role = chance('function/' + s.id, D.publicMix) ? 'shared' : 'quiet'; s.label = s.role === 'shared' ? 'Shared room' : 'Quiet room'; } });
  const extents = allocations.map(s => box(s.footprint));
  return { allocations, links, external, layout: { clusters, routes, requestedRooms: rooms, placementWork: work, bound: { spaces: 512, links: 1024, attempts: 4 }, metrics: { clusterCount: clusters.length, roomCount: rooms, headings: [...new Set(clusters.map(c => c.headingDegrees))].sort((a, b) => a - b), recipes: [...new Set(clusters.map(c => c.recipe))].sort(), routeLengthM: routes.reduce((s, r) => s + r.lengthM, 0), bentRoutes: routes.filter(r => r.bendDegrees).length, branchPoints: clusters.filter(c => clusters.filter(child => child.parent === Number(c.id.split('-')[1])).length > 1).length, widthM: Math.max(...extents.map(b => b.maxX)) - Math.min(...extents.map(b => b.minX)), depthM: Math.max(...extents.map(b => b.maxY)) - Math.min(...extents.map(b => b.minY)) } } };
}
