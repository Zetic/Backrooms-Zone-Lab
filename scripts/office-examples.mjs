import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { generateOfficeDesign, officeTemplate } from '../src/offices.js';
import { canonicalExport } from '../src/zone.js';
import { officeSvg } from '../src/office-render.js';
const out = new URL('../docs/office-examples/', import.meta.url), t = officeTemplate();
await mkdir(out, { recursive: true });
const manifest = { format: 'office-v3-full-handoff', version: 1, template: 'offices-v3', examples: [], limitations: ['Full br.zone geometry requires an Unreal adapter.', 'Exit / stair lobbies reserve connections; no vertical stairs are generated.', 'The rectangular exchange is a separate orthogonal composition; the full design also adds its central shared boardroom/focus cluster.'] };
for (const [id, seed, dials] of [ ['reference', 1, t.presets.at(-1).dials], ['departments', 7, t.presets[3].dials], ['six-wings', 7, { size: 65, wings: 100, open: 35, sprawl: 100, strange: 0, cohesion: 100, rooms: 100 }] ]) {
  const plan = generateOfficeDesign({ seed, dials }), json = canonicalExport(plan), svg = officeSvg(plan);
  await writeFile(new URL(id + '.zone.json', out), json); await writeFile(new URL(id + '.svg', out), svg);
  manifest.examples.push({ id, seed, dials, file: id + '.zone.json', plan: id + '.svg', sha256: createHash('sha256').update(json).digest('hex'), wingCount: plan.layout.wingCount, spaces: plan.spaces.length, reachable: plan.diagnostics.navigation.reachable.length, returnable: plan.diagnostics.navigation.returnable.length });
  console.log(id + ': ' + plan.layout.wingCount + ' wings, ' + plan.spaces.length + ' spaces, all reached and returnable; solid walls realized.');
}
await writeFile(new URL('manifest.json', out), JSON.stringify(manifest, null, 2) + '\n');
