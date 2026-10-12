import { writeFile, mkdir } from 'node:fs/promises';
import { generateStudy, canonicalExport } from '../src/zone.js';
import { floorSvg } from '../src/render.js';
const output = new URL('../docs/examples/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [profile, seed] of [['angular', '287'], ['rotunda', '623'], ['gallery', '12345']]) {
  const plan = generateStudy({ profile, seed });
  await writeFile(new URL(`${profile}.json`, output), canonicalExport(plan));
  for (const floor of plan.floors) {
    let svg = floorSvg(plan, floor.index, { labels: true, clearance: true, voids: true, vertices: false, selected: '' });
    const attrs = {
      'space-path': 'fill="#324a54" stroke="#b0c7ce" stroke-width=".035"',
      'gallery': 'fill="#3a5550" stroke="#b1d4c8" stroke-width=".035"',
      'space-label': 'font-family="Arial,sans-serif" font-size=".5" fill="#e2eaea" text-anchor="middle"',
      'port-label': 'font-family="Arial,sans-serif" font-size=".35" fill="#e7ca80" text-anchor="middle"',
      'port-line': 'stroke="#e7ca80" stroke-width=".14"',
      'approach': 'fill="#e7ca80" fill-opacity=".08" stroke="#e7ca80" stroke-dasharray=".1 .1" stroke-width=".025"',
      'void-path': 'stroke="#ca8b8b" stroke-width=".03" stroke-dasharray=".15 .12"'
    };
    svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="550" ').replace(/class="([\w -]+)"/g, (_, names) => attrs[names.includes('gallery') ? 'gallery' : names.trim()] ?? '');
    await writeFile(new URL(`${profile}-floor-${floor.index + 1}.svg`, output), svg);
  }
}
console.log('Three reproducible plans and six exact-arc SVG plan examples written.');
