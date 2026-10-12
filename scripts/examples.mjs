import { writeFile, mkdir } from 'node:fs/promises';
import { generateStudy, canonicalExport } from '../src/zone.js';
import { generateArchitecture } from '../src/architecture.js';
import { floorSvg } from '../src/render.js';
import { buildMesh, cameraMatrix } from '../src/mesh.js';
const output = new URL('../docs/examples/', import.meta.url);
await mkdir(output, { recursive: true });
function standalone(svg) {
  const attrs = {
    'space-path': 'fill="#324a54" stroke="#b0c7ce" stroke-width=".035"',
    'public': 'fill="#344d57" stroke="#b0c7ce" stroke-width=".035"',
    'private': 'fill="#44475e" stroke="#b4b6d2" stroke-width=".035"',
    'service': 'fill="#5a503c" stroke="#d1c09b" stroke-width=".035"',
    'circulation': 'fill="#35554c" stroke="#a4c9bc" stroke-width=".035"',
    'gallery': 'fill="#3a6552" stroke="#b1d4c8" stroke-width=".035"',
    'space-label': 'font-family="Arial,sans-serif" font-size=".5" fill="#e2eaea" text-anchor="middle"',
    'port-label': 'font-family="Arial,sans-serif" font-size=".35" fill="#e7ca80" text-anchor="middle"',
    'port-line': 'stroke="#e7ca80" stroke-width=".14"',
    'approach': 'fill="#e7ca80" fill-opacity=".08" stroke="#e7ca80" stroke-dasharray=".1 .1" stroke-width=".025"',
    'void-path': 'stroke="#ca8b8b" stroke-width=".03" stroke-dasharray=".15 .12"',
    'stair-tread': 'fill="#546c66" stroke="#afc6bc" stroke-width=".02"',
    'stair-label': 'font-family="Arial,sans-serif" font-size=".32" fill="#e7ecec" text-anchor="middle"',
    'door-gap': 'stroke="#151f24" stroke-width=".19"',
    'local-door': 'stroke="#93c9b2" stroke-width=".065"',
    'guard-line': 'stroke="#ddd2af" stroke-width=".07" fill="none"',
    'nav-path': 'fill="none" stroke="#8ed6bc" stroke-width=".06"'
  };
  return svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" ').replace(/class="([\w -]+)"/g, (_, names) => {
    const classes = names.split(' ');
    const key = classes.includes('space-path') ? classes.find(name => ['gallery', 'circulation', 'private', 'service', 'public'].includes(name)) ?? 'space-path' : classes.find(name => attrs[name]);
    return attrs[key] ?? '';
  });
}
const plans = [generateStudy({ profile: 'angular', seed: '287' }), generateStudy({ profile: 'rotunda', seed: '623' }), generateStudy({ profile: 'gallery', seed: '12345' }), generateArchitecture()];
for (const plan of plans) {
  const profile = plan.input.profile;
  await writeFile(new URL(`${profile}.json`, output), canonicalExport(plan));
  for (const floor of plan.floors) await writeFile(new URL(`${profile}-floor-${floor.index + 1}.svg`, output), standalone(floorSvg(plan, floor.index, { labels: true, clearance: true, voids: true, navigation: plan.kind === 'architecture-reference', vertices: false, selected: '' })));
}
// Static geometry-review image. GPU/browser interaction is verified separately.
const reference = plans.at(-1), mesh = buildMesh(reference, { scope: 'gallery', lowWalls: true, guards: true });
const matrix = cameraMatrix({ yaw: -.8, pitch: .8, target: [8.5, 7, 2.3], extent: 13, zoom: 1 }, 1000 / 650);
const project = p => [500 + (matrix[0] * p[0] + matrix[4] * p[1] + matrix[8] * p[2] + matrix[12]) * 500, 350 - (matrix[1] * p[0] + matrix[5] * p[1] + matrix[9] * p[2] + matrix[13]) * 325, matrix[2] * p[0] + matrix[6] * p[1] + matrix[10] * p[2] + matrix[14]];
const light = [0.4, -0.5, 0.9], norm = Math.hypot(...light);
const polygons = mesh.faces.map(face => {
  const points = face.points.map(project), brightness = .65 + .35 * Math.abs(face.normal.reduce((n, v, i) => n + v * light[i] / norm, 0));
  const color = '#' + face.color.map(c => Math.round(Math.min(1, c * brightness) * 255).toString(16).padStart(2, '0')).join('');
  return { depth: points.reduce((n, p) => n + p[2] / 3, 0), xml: `<polygon points="${points.map(p => p.slice(0, 2).map(v => v.toFixed(2)).join(',')).join(' ')}" fill="${color}" stroke="${color}" stroke-width=".25"/>` };
}).sort((a, b) => b.depth - a.depth).map(item => item.xml).join('\n');
const markers = mesh.lines.map(line => { const a = project(line.a), b = project(line.b); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#e7ca80" stroke-width="1.4"/>`; }).join('');
await writeFile(new URL('reference-house-cutaway.svg', output), `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="#131b1f"/><text x="30" y="35" fill="#e7ca80" font-family="Arial,sans-serif" font-size="18">PHASE 2 / THREE-STOREY REFERENCE HOUSE</text><text x="30" y="60" fill="#9baeb5" font-family="Arial,sans-serif" font-size="12">Ground + gallery floors · low-wall cutaway · ceilings hidden</text>${polygons}${markers}<text x="30" y="677" fill="#9baeb5" font-family="Arial,sans-serif" font-size="11">Static geometry review; the interactive viewer uses depth-tested WebGL.</text></svg>`);
console.log('Four canonical plans, nine floor plans, and the reference cutaway written.');
