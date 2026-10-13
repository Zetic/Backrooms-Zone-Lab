import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/house.js';
const api = globalThis.ZoneExchange, house = api.templates.find(t => t.id === 'house');

test('House v2 preserves the local six presets and named-rule policy', () => {
  const expected = [22, 25, 15, 19, 25, 30];
  for (const [i, p] of house.presets.entries()) {
    const z = house.make({ seed: 1, dials: p.dials });
    assert.ok(!z.error, z.error); assert.equal(z.spaces.length, expected[i]);
    assert.equal(z.source.template, 'house-v2');
    const r = api.ruleReport(house, z); assert.equal(r.rules.length, 15); assert.ok(r.valid);
    for (const id of ['entry', 'stair', 'ground']) assert.ok(r.rules.find(r => r.id === id).kept);
    if (p.dials.strange === 0 && p.dials.sprawl === 0) assert.equal(r.kept, 15);
  }
});
test('House shaping matrix is reproducible, respects unrelaxed rules and switches storeys at 55', () => {
  for (const sprawl of [0, 20, 35, 45, 54, 55, 70, 85, 100]) for (const strange of [0, 25, 45, 65, 85, 100]) for (let seed = 1; seed <= 4; ++seed) {
    const spec = { seed, dials: { size: 60, sprawl, strange } }, z = house.make(spec);
    assert.ok(!z.error, JSON.stringify({ spec, error: z.error }));
    assert.equal(api.facts(z).floors.length, sprawl < 55 ? 2 : 1);
    assert.equal(z.spaces.filter(s => s.kind === 'stair').length, sprawl < 55 ? 1 : 0);
    assert.ok(api.ruleReport(house, z).valid);
    assert.equal(api.serialize(z), api.serialize(house.make(spec)));
    const reversed = structuredClone(z); reversed.spaces.reverse(); reversed.joins.reverse(); reversed.entrances.reverse();
    assert.deepEqual(api.ruleReport(house, reversed), api.ruleReport(house, z));
  }
});
test('dials permit architectural deviation without permitting physical failure', () => {
  const relaxed = house.make({ seed: 1, dials: house.presets.at(-1).dials }), r = api.ruleReport(house, relaxed);
  assert.ok(r.broken.length >= 1); assert.ok(r.broken.every(r => r.relaxed));
  const strict = structuredClone(relaxed); strict.source.dials.strange = 0; strict.source.dials.sprawl = 0;
  assert.ok(!api.ruleReport(house, strict).valid);
  const t = { ...house, id: 'bad', name: 'Bad', attempts: 2 };
  assert.ok(api.generateTemplate(t, { seed: 1, dials: t.presets.at(-1).dials }, () => { const z = structuredClone(relaxed); z.spaces[0].rect[2] = z.spaces[0].rect[0]; return z; }).error);
  assert.ok(api.generateTemplate(t, { seed: 1 }, d => { d.step(20001); return relaxed; }).error);
  assert.ok(api.generateTemplate({ ...t, workLimit: NaN }, { seed: 1 }, () => relaxed).error);
  assert.ok(api.generateTemplate(t, { seed: 1 }, d => { d.step(-1); return relaxed; }).error);
});
test('architectural rules are invariant under signed coordinate and floor translation', () => {
  const z = house.make({ seed: 7 }), translated = structuredClone(z);
  for (const s of translated.spaces) { s.rect = s.rect.map(n => n - 200); s.floor -= 580; }
  translated.start.x -= 200; translated.start.y -= 200; translated.entrances.forEach(e => e.at -= 200);
  assert.ok(api.validate(translated).valid);
  assert.deepEqual(api.ruleReport(house, translated), api.ruleReport(house, z));
});
test('the shared method preserves richer geometry and delegates to its physical validator', () => {
  const t = { id: 'curve', name: 'Curve', version: 1, attempts: 1, dials: [],
    rules(zone) { return [api.rule('arc', 'Preserve the requested curved boundary', zone.arc.radius === 7)]; } };
  const design = { arc: { radius: 7, sweep: 90 }, opening: { edge: 'arc', required: true } };
  const built = api.generateTemplate(t, { seed: 1 }, () => structuredClone(design), zone => ({ valid: zone.opening.required, errors: [] }));
  assert.deepEqual(built, design);
  assert.ok(api.generateTemplate(t, { seed: 1 }, () => structuredClone(design), () => ({ valid: false, errors: [{ message: 'Curved-face opening not realized.' }] })).error.includes('Curved-face opening'));
});
test('the runnable starter and downloaded House preserve rules and reproduce their outputs', async () => {
  const isolated = { ...api, templates: [] };
  vm.runInNewContext(await readFile(new URL('../docs/template-starter.js', import.meta.url), 'utf8'), { globalThis: { ZoneExchange: isolated } });
  const starter = isolated.templates[0];
  for (const value of [null, 10, 90]) for (let seed = 1; seed <= 40; ++seed) {
    const dials = Object.fromEntries(starter.dials.map(d => [d.id, value ?? d.value])), z = starter.make({ seed, dials });
    assert.ok(!z.error, z.error); assert.ok(isolated.ruleReport(starter, z).valid);
    assert.equal(isolated.serialize(z), isolated.serialize(starter.make({ seed, dials })));
    if (dials.strange >= 50) assert.ok(isolated.ruleReport(starter, z).broken.some(r => r.id === 'store-access' && r.relaxed));
  }
  const loaded = { ...api, templates: [] };
  vm.runInNewContext(api.exportTemplate(house), { globalThis: { ZoneExchange: loaded } });
  for (const p of house.presets) {
    const z = house.make({ seed: 7, dials: p.dials }), copied = loaded.templates[0].make({ seed: 7, dials: p.dials });
    assert.equal(api.serialize(z), api.serialize(copied));
    assert.deepEqual(JSON.parse(JSON.stringify(loaded.ruleReport(loaded.templates[0], copied))), api.ruleReport(house, z));
  }
});
