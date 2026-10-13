import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/templates/house.js';
import '../exchange/templates/level0.js';
import '../exchange/plan.js';

const api = globalThis.ZoneExchange;
export function cases() {
  const cases = [];
  for (const template of api.templates) for (const value of [null, 10, 90]) for (let seed = 1; seed <= 40; ++seed) {
    const spec = { seed, dials: Object.fromEntries(template.dials.map(d => [d.id, value ?? d.value])) };
    cases.push({ template, setting: value === null ? 'defaults' : String(value), spec });
  }
  return cases;
}
export function audit() {
  const reports = api.templates.map(t => ({ template: t.id + '-v1', passed: 0, total: 120, failures: [] }));
  for (const sample of cases()) {
    const report = reports.find(r => r.template === sample.template.id + '-v1');
    try {
      const a = sample.template.make(sample.spec), b = sample.template.make(sample.spec);
      if (a.error || b.error) throw new Error(a.error ?? b.error);
      if (api.serialize(a) !== api.serialize(b)) throw new Error('same-again mismatch');
      // Reordered input arrays and a round trip cannot alter the canonical file.
      const reordered = structuredClone(a); reordered.spaces.reverse(); reordered.joins.reverse(); reordered.entrances.reverse();
      if (api.serialize(a) !== api.serialize(reordered) || api.serialize(a) !== api.serialize(JSON.parse(api.serialize(a)))) throw new Error('order/round-trip mismatch');
      ++report.passed;
    } catch (error) { report.failures.push({ spec: sample.spec, error: error.message }); }
  }
  return reports;
}
async function main() {
  const reports = audit();
  for (const r of reports) console.log(`${r.template}: ${r.passed}/${r.total} · repeat, order and round-trip checks`);
  if (reports.some(r => r.failures.length)) { console.error(JSON.stringify(reports.filter(r => r.failures.length), null, 2)); process.exitCode = 1; return; }
  const output = new URL('../docs/exchange-examples/', import.meta.url);
  await mkdir(output, { recursive: true });
  const zones = [];
  for (const template of api.templates) for (const seed of [1, 7, 29]) {
    const zone = template.make({ seed }); zones.push(zone);
  }
  zones.push(JSON.parse(await readFile(new URL('../exchange/flat.zone.json', import.meta.url), 'utf8')));
  const manifest = { format: 'backrooms-zone-handoff', version: 1, contract: '../unreal-exchange.md', templates: reports, zones: [],
    limitations: ['Unreal file loader is not implemented.', 'Browser checks do not resolve feature-dependent physical openings.', 'Plan floor allocation includes walls; Unreal measures usable support.', 'The earlier br.zone geometry studies are a separate format.'] };
  for (const zone of zones) {
    const file = zone.id + '.zone.json', serialized = api.serialize(zone);
    await writeFile(new URL(file, output), serialized);
    const plans = [];
    for (const floor of api.facts(zone).floors) {
      const name = zone.id + '-floor-' + floor + '.svg'; plans.push(name);
      await writeFile(new URL(name, output), api.plan(zone, floor));
    }
    manifest.zones.push({ file, sha256: createHash('sha256').update(serialized).digest('hex'), plans, notes: zone.notes });
  }
  await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
  for (const file of ['stream.js', 'checks.js', 'templates/house.js', 'templates/level0.js']) await cp(new URL('../exchange/' + file, import.meta.url), new URL(file.replace('templates/', ''), output));
  console.log('Handoff: 7 zones, 11 plan snapshots, template code, shared checks/stream and audit manifest in docs/exchange-examples/.');
}
if (process.argv[1] && new URL('file:///' + process.argv[1].replaceAll('\\', '/').replace(/^\//, '')).pathname === new URL(import.meta.url).pathname) await main();
