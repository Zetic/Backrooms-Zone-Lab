import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/house.js';
import '../exchange/templates/level0.js';
import '../exchange/templates/offices.js';
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
export function shapingCases() {
  const template = api.templates.find(t => t.id === 'house'), samples = [];
  for (const sprawl of [0, 20, 35, 45, 55, 70, 85, 100]) for (const strange of [0, 25, 45, 65, 85, 100]) for (let seed = 1; seed <= 4; ++seed)
    samples.push({ template, setting: 'sprawl-' + sprawl + '-strange-' + strange, spec: { seed, dials: { size: 60, sprawl, strange } } });
  for (const [i, preset] of template.presets.entries()) samples.push({ template, setting: 'preset-' + i, spec: { seed: 1, dials: preset.dials } });
  return samples;
}
export function officeCases() {
  const template = api.templates.find(t => t.id === 'offices'), samples = [];
  if (!template) return samples;
  for (const sprawl of [0, 50, 100]) for (const strange of [0, 30, 50, 65, 75, 100]) for (let seed = 1; seed <= 2; ++seed)
    samples.push({ template, setting: 'office-sprawl-' + sprawl + '-strange-' + strange, spec: { seed, dials: { size: 60, open: strange % 2 ? 0 : 100, sprawl, strange } } });
  for (const [i, preset] of template.presets.entries()) samples.push({ template, setting: 'office-preset-' + i, spec: { seed: 1, dials: preset.dials } });
  return samples;
}
export function audit() {
  const reports = api.templates.map(t => ({ template: api.templateKey(t), passed: 0, total: 120, failures: [] }));
  for (const sample of cases()) {
    const report = reports.find(r => r.template === api.templateKey(sample.template));
    try {
      const a = sample.template.make(sample.spec), b = sample.template.make(sample.spec);
      if (a.error || b.error) throw new Error(a.error ?? b.error);
      if (!api.ruleReport(sample.template, a).valid) throw new Error('unrelaxed architectural rule failed');
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
  for (const template of api.templates) for (const seed of template.id === 'offices' ? [1] : [1, 7, 29]) {
    const zone = template.make({ seed }); zones.push(zone);
  }
  const office = api.templates.find(t => t.id === 'offices');
  if (office) for (const name of ['Open workplace', 'Wrong workplace']) {
    const p = office.presets.find(p => p.name === name), zone = office.make({ seed: 1, dials: p.dials });
    zone.id += '-' + (name === 'Open workplace' ? 'open' : 'wrong'); zone.name += ' · ' + name;
    zones.push(zone);
  }
  zones.push(JSON.parse(await readFile(new URL('../exchange/flat.zone.json', import.meta.url), 'utf8')));
  const manifest = { format: 'backrooms-zone-handoff', version: 1, contract: '../unreal-exchange.md', templates: reports, zones: [],
    limitations: ['Unreal file loader is not implemented.', 'Browser checks do not resolve feature-dependent physical openings.', 'Plan floor allocation includes walls; Unreal measures usable support.', 'Full br.zone geometry preserves design intent for a dedicated Unreal adapter.'] };
  for (const zone of zones) {
    const file = zone.id + '.zone.json', serialized = api.serialize(zone);
    await writeFile(new URL(file, output), serialized);
    const plans = [];
    for (const floor of api.facts(zone).floors) {
      const name = zone.id + '-floor-' + floor + '.svg'; plans.push(name);
      await writeFile(new URL(name, output), api.plan(zone, floor));
    }
    const template = api.templates.find(t => api.templateKey(t) === zone.source?.template);
    manifest.zones.push({ file, sha256: createHash('sha256').update(serialized).digest('hex'), plans, notes: zone.notes,
      architecturalRules: template ? api.ruleReport(template, zone) : null });
  }
  await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
  for (const file of ['stream.js', 'checks.js', 'method.js', 'templates/house.js', 'templates/level0.js', 'templates/offices.js']) await cp(new URL('../exchange/' + file, import.meta.url), new URL(file.replace('templates/', ''), output));
  console.log('Handoff: ' + zones.length + ' zones, ' + manifest.zones.reduce((n, z) => n + z.plans.length, 0) + ' plan snapshots, template code, shared core and audit manifest in docs/exchange-examples/.');
}
if (process.argv[1] && new URL('file:///' + process.argv[1].replaceAll('\\', '/').replace(/^\//, '')).pathname === new URL(import.meta.url).pathname) await main();
