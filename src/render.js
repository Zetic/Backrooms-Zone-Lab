import { at, bounds } from './geometry.js';

// SVG uses true circular arcs. Flipping the drawing group keeps +Y upward.
export function ringPath(ring) {
  const start = at(ring[0], 0);
  return `M ${start[0]} ${start[1]} ` + ring.map(e => {
    const end = at(e, 1);
    return e.kind === 'line' ? `L ${end[0]} ${end[1]}` : `A ${e.radius} ${e.radius} 0 ${Math.abs(e.sweepDeg) > 180 ? 1 : 0} ${e.sweepDeg > 0 ? 1 : 0} ${end[0]} ${end[1]}`;
  }).join(' ') + ' Z';
}
export const footprintPath = f => [f.outer, ...f.holes].map(ringPath).join(' ');
export const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function floorSvg(plan, floorIndex, options) {
  const spaces = plan.spaces.filter(s => s.floorIndex === floorIndex), boxes = spaces.map(s => bounds(s.footprint));
  if (!spaces.length) return '<svg class="floor-map" viewBox="0 0 10 5"><text x="1" y="2" fill="#9baeb5" font-size=".3">No complete spaces on this floor.</text></svg>';
  const minX = Math.min(...boxes.map(b => b.minX)) - 2, maxX = Math.max(...boxes.map(b => b.maxX)) + 2;
  const minY = Math.min(...boxes.map(b => b.minY)) - 2, maxY = Math.max(...boxes.map(b => b.maxY)) + 2;
  const grid = `grid-${floorIndex}`, hatch = `hatch-${floorIndex}`;
  const paths = spaces.map(s => `<path data-space="${escapeHtml(s.id)}" tabindex="0" role="button" aria-label="Inspect ${escapeHtml(s.label)}" class="space-path ${escapeHtml(s.role)} ${plan.diagnostics.navigation?.unreachable.includes(s.id) ? 'unreachable' : ''} ${s.id === options.selected ? 'selected' : ''}" d="${footprintPath(s.footprint)}" fill-rule="evenodd"><title>${escapeHtml(s.label)}</title></path>`).join('');
  const vertices = options.vertices ? spaces.map(s => [s.footprint.outer, ...s.footprint.holes].flat().map(e => { const p = at(e, 0); return `<circle cx="${p[0]}" cy="${p[1]}" r=".07" fill="#e7ca80"/>`; }).join('')).join('') : '';
  const labels = options.labels ? spaces.map(s => {
    const b = bounds(s.footprint), x = s.labelAnchor?.[0] ?? (b.minX + b.maxX) / 2, y = s.labelAnchor?.[1] ?? (s.role === 'gallery' ? b.minY + (b.maxY - b.minY) * .15 : (b.minY + b.maxY) / 2);
    const straight = s.footprint.outer.filter(edge => edge.kind === 'line');
    const labelEdge = s.role === 'gallery' ? straight[0] : straight.reduce((best, edge) => !best || Math.hypot(edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]) > Math.hypot(best.to[0] - best.from[0], best.to[1] - best.from[1]) ? edge : best, null);
    let rotation = labelEdge ? -Math.atan2(labelEdge.to[1] - labelEdge.from[1], labelEdge.to[0] - labelEdge.from[0]) * 180 / Math.PI : 0;
    if (rotation < -90) rotation += 180; if (rotation > 90) rotation -= 180;
    return `<text class="space-label" x="${x}" y="${-y}" transform="rotate(${rotation} ${x} ${-y})">${escapeHtml(s.label)}</text>`;
  }).join('') : '';
  const ports = plan.externalPorts.filter(p => p.floorIndex === floorIndex);
  const approaches = options.clearance ? ports.map(p => `<path class="approach" d="${footprintPath(p.approach)}"/>`).join('') : '';
  const openings = ports.map(p => { const o = plan.openings.find(o => o.id === p.openingId), [x, y] = o.center, [ux, uy] = o.tangent; return `<line class="port-line" x1="${x - ux * o.width / 2}" y1="${y - uy * o.width / 2}" x2="${x + ux * o.width / 2}" y2="${y + uy * o.width / 2}"/>`; }).join('');
  const portLabels = options.labels ? ports.map(p => { const [x, y] = p.anchor.position, f = p.anchor.forward; return `<text class="port-label" x="${x + f[0] * .65}" y="${-(y + f[1] * .65)}">${escapeHtml(p.role)} · ${escapeHtml(p.portId)}</text>`; }).join('') : '';
  const voids = options.voids ? plan.protectedVoids.filter(v => plan.floors[floorIndex].elevation >= v.minZ && plan.floors[floorIndex].elevation < v.maxZ).map(v => `<path class="void-path" fill="url(#${hatch})" d="${footprintPath(v.footprint)}"/>`).join('') : '';
  const localOpenings = Array.isArray(plan.walls) ? plan.openings.filter(o => o.type === 'local-passage' && o.center[2] === plan.floors[floorIndex].elevation).map(o => {
    const [x, y] = o.center, [ux, uy] = o.tangent, w = o.width / 2;
    return `<line class="door-gap" x1="${x - ux * w}" y1="${y - uy * w}" x2="${x + ux * w}" y2="${y + uy * w}"/><line class="local-door" x1="${x - ux * w}" y1="${y - uy * w}" x2="${x + ux * w}" y2="${y + uy * w}"/>`;
  }).join('') : '';
  const stairs = plan.verticalTraversals.filter(stair => plan.spaces.find(s => s.id === stair.source?.spaceId)?.floorIndex === floorIndex || plan.spaces.find(s => s.id === stair.target?.spaceId)?.floorIndex === floorIndex);
  const stairShapes = stairs.map(stair => stair.treads.map(tread => `<path class="stair-tread" d="${footprintPath(tread.footprint)}"/>`).join('')).join('');
  const stairLabels = options.labels ? stairs.map(stair => {
    const x = (stair.source.position[0] + stair.target.position[0]) / 2, y = -(stair.source.position[1] + stair.target.position[1]) / 2;
    let rotation = -Math.atan2(stair.target.position[1] - stair.source.position[1], stair.target.position[0] - stair.source.position[0]) * 180 / Math.PI;
    if (rotation < -90) rotation += 180; if (rotation > 90) rotation -= 180;
    return `<text class="stair-label" x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})">${plan.spaces.find(s => s.id === stair.source.spaceId).floorIndex === floorIndex ? 'UP' : 'DOWN'} · ${stair.riserCount} risers</text>`;
  }).join('') : '';
  const guardLines = plan.guards?.filter(g => g.kind === 'slab-edge' && plan.surfaces.find(s => s.id === g.surfaceId)?.elevation === plan.floors[floorIndex].elevation).map(g => `<path class="guard-line" d="${ringPath([g.edge]).replace(/ Z$/, '')}"/>`).join('') ?? '';
  const navPaths = options.navigation && plan.diagnostics.navigation ? plan.diagnostics.navigation.spacePaths.filter(p => spaces.some(s => s.id === p.spaceId)).flatMap(p => p.paths.filter(w => w.reachable && w.points.length > 1).map(w => `<path class="nav-path" d="M ${w.points.map(pt => `${pt[0]} ${pt[1]}`).join(' L ')}"/>`)).join('') : '';
  const crossings = options.navigation && plan.diagnostics.navigation ? plan.diagnostics.navigation.connections.filter(c => c.kind === 'opening').map(connection => {
    const opening = plan.openings.find(o => o.id === connection.geometryId);
    if (!opening || opening.center[2] !== plan.floors[floorIndex].elevation) return '';
    const endpoints = opening.hosts.map(host => plan.diagnostics.navigation.spacePaths.find(paths => paths.spaceId === host.spaceId)?.paths.find(w => w.terminalId === `${opening.id}:${host.spaceId}`)?.points.at(-1));
    return endpoints.every(Boolean) ? `<path class="nav-path" d="M ${endpoints.map(pt => `${pt[0]} ${pt[1]}`).join(' L ')}"/>` : '';
  }).join('') : '';
  return `<svg class="floor-map" viewBox="${minX} ${-maxY} ${maxX - minX} ${maxY - minY}" aria-label="Floor ${floorIndex + 1} geometry plan">
    <defs><pattern id="${grid}" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#283b43" stroke-width=".015"/></pattern><pattern id="${hatch}" width=".28" height=".28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2=".28" stroke="#ac727255" stroke-width=".05"/></pattern></defs>
    <rect x="${minX}" y="${-maxY}" width="${maxX - minX}" height="${maxY - minY}" fill="#151f24"/>
    <rect x="${minX}" y="${-maxY}" width="${maxX - minX}" height="${maxY - minY}" fill="url(#${grid})"/>
    <g transform="scale(1,-1)">${paths}${voids}${stairShapes}${approaches}${localOpenings}${openings}${guardLines}${navPaths}${crossings}${vertices}</g>${labels}${portLabels}${stairLabels}
    <g transform="translate(${minX + .6},${-minY - .6})"><path d="M 0 0 L 5 0 M 0 -.12 L 0 .12 M 5 -.12 L 5 .12" stroke="#9baeb5" stroke-width=".04"/><text y="-.25" x="2.5" text-anchor="middle" fill="#9baeb5" font-size=".28">5 m</text></g>
  </svg>`;
}
