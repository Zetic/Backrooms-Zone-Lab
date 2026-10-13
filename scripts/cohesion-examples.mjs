import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/house.js';
import '../exchange/templates/offices.js';
import '../exchange/plan.js';
const api = globalThis.ZoneExchange, output = new URL('../docs/cohesion-examples/', import.meta.url);
await mkdir(output, { recursive: true });
const manifest = { seed: 7, size: 60, sprawl: 100, examples: [] };
for (const t of api.templates) for (const [name, rooms, cohesion] of [['few-cohesive', 0, 100], ['many-cohesive', 100, 100], ['many-dispersed', 100, 0]]) {
  const dials = { size: 60, sprawl: 100, rooms, cohesion, strange: 0, ...(t.id === 'offices' ? { wings: 20, open: 35 } : {}) }, zone = t.make({ seed: 7, dials });
  if (zone.error || !api.validate(zone).valid || !api.ruleReport(t, zone).valid) throw new Error(zone.error ?? 'Invalid cohesion example.');
  const file = t.id + '-' + name, json = api.serialize(zone), svg = api.plan(zone, 0);
  await writeFile(new URL(file + '.zone.json', output), json); await writeFile(new URL(file + '.svg', output), svg);
  const roomSpaces = zone.spaces.filter(s => s.kind === 'room'), shared = roomSpaces.filter(s => roomSpaces.some(p => p !== s && p.floor === s.floor && api.shared(s, p))).length;
  manifest.examples.push({ file: file + '.zone.json', plan: file + '.svg', template: api.templateKey(t), dials, roomSpaces: roomSpaces.length, roomsSharingPartitions: shared, sha256: createHash('sha256').update(json).digest('hex'), svgSha256: createHash('sha256').update(svg).digest('hex') });
}
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
console.log('Six same-seed interaction examples saved.');
