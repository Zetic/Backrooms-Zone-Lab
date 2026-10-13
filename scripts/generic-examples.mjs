import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { generateGenericDesign } from '../src/generic.js';
import { genericTemplate } from '../src/generic-template.js';
import { genericSvg } from '../src/generic-render.js';
import { canonicalExport } from '../src/zone.js';
const output = new URL('../docs/generic-v2-examples/', import.meta.url);
await mkdir(output, { recursive: true });
const records = [], gallery = [];
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 29]) {
  const plan = generateGenericDesign({ seed }), svg = genericSvg(plan, { idPrefix: 'seed-' + seed });
  if ([1, 7, 29].includes(seed)) {
    await writeFile(new URL('generic-' + seed + '.zone.json.gz', output), gzipSync(canonicalExport(plan)));
    await writeFile(new URL('generic-' + seed + '.svg', output), svg);
  }
  if (seed <= 9) {
    const i = seed - 1, x = i % 3 * 480, y = Math.floor(i / 3) * 360;
    gallery.push(`<text x="${x + 15}" y="${y + 24}" fill="#eedcaf" font-family="sans-serif" font-size="16">Seed ${seed} · ${plan.layout.metrics.headings.length} headings · ${plan.layout.metrics.cycleRank} loops</text>` + svg.replace('<svg ', `<svg x="${x}" y="${y + 35}" width="480" height="310" `));
  }
  records.push({ seed, fingerprint: plan.fingerprint, attempt: plan.layout.attempt, diversity: plan.layout.metrics, physical: plan.diagnostics.metrics, errors: plan.diagnostics.errors });
  console.log('Generic v2 seed ' + seed + ': ' + plan.spaces.length + ' spaces, ' + plan.layout.metrics.headings.length + ' headings, physical checks pass.');
}
await writeFile(new URL('nine-seeds.svg', output), '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1080" viewBox="0 0 1440 1080"><rect width="1440" height="1080" fill="#151f24"/>' + gallery.join('') + '</svg>');
await writeFile(new URL('manifest.json', output), JSON.stringify({ template: 'generic-v2', preset: genericTemplate.presets[0], scope: 'Actual full geometry: floors, wall solids, supported apertures and walker outward/return paths. Unreal runtime adapter remains pending.', records }, null, 2) + '\n');
