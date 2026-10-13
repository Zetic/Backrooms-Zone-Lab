import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/offices.js';
const api = globalThis.ZoneExchange, offices = api.templates.find(t => t.id === 'offices');
const preset = name => offices.presets.find(p => p.name === name).dials;

test('standard offices keep all conventions and contain a recognizable visitor/staff program', () => {
  for (const name of ['Standard office', 'Private practice', 'Open workplace', 'Department wings']) for (let seed = 1; seed <= 20; ++seed) {
    const z = offices.make({ seed, dials: preset(name) }); assert.ok(!z.error, z.error);
    const report = api.ruleReport(offices, z); assert.equal(report.kept, 19, JSON.stringify({ name, seed, report }));
    for (const role of ['reception', 'meeting', 'washroom', 'break', 'copy', 'server', 'store']) assert.ok(z.spaces.some(s => s.role === role));
    assert.equal(z.start.space, 'reception'); assert.equal(api.facts(z).floors.length, 1);
    assert.ok(z.entrances.some(e => e.title === 'Visitor entrance' && e.space === 'reception'));
  }
});
test('office presets express real openness, wings and permitted architectural breaks', () => {
  const privatePlan = offices.make({ seed: 1, dials: preset('Private practice') }), openPlan = offices.make({ seed: 1, dials: { ...preset('Private practice'), open: 100 } });
  assert.ok(privatePlan.spaces.filter(s => /^wing-\d+-room/.test(s.id) && ['office', 'work'].includes(s.role)).every(s => s.role === 'office'));
  assert.ok(openPlan.spaces.filter(s => /^wing-\d+-room/.test(s.id) && ['office', 'work'].includes(s.role)).every(s => s.role === 'work'));
  assert.ok(openPlan.joins.filter(j => j.mode === 'open').length > privatePlan.joins.filter(j => j.mode === 'open').length);
  const ordinary = offices.make({ seed: 1 }), spread = offices.make({ seed: 1, dials: preset('Department wings') });
  assert.equal(ordinary.spaces.filter(s => /^wing-\d+-exit$/.test(s.id)).length, 2); assert.ok(spread.spaces.some(s => s.id.startsWith('wing-2')));
  assert.ok(spread.spaces.length > ordinary.spaces.length);
  const wrong = offices.make({ seed: 1, dials: preset('Wrong workplace') }), r = api.ruleReport(offices, wrong);
  assert.ok(r.valid); assert.ok(r.broken.length >= 6); assert.ok(r.broken.every(r => r.relaxed));
  for (const id of ['dead-ends', 'loop', 'ceiling']) assert.ok(!r.rules.find(r => r.id === id).kept, id);
  assert.ok(api.validate(wrong).valid); assert.ok(wrong.joins.every(j => j.required));
});
test('mixed office shaping and every threshold remain repeatable and preserve unrelaxed rules', () => {
  for (const sprawl of [0, 34, 35, 64, 65, 84, 85, 100]) for (const strange of [0, 19, 20, 29, 30, 39, 40, 49, 50, 64, 65, 74, 75, 84, 85, 100]) for (const size of [0, 100]) {
    const spec = { seed: 7, dials: { size, sprawl, strange, open: strange % 2 ? 0 : 100 } }, z = offices.make(spec);
    assert.ok(!z.error, JSON.stringify({ spec, error: z.error })); assert.ok(api.ruleReport(offices, z).valid);
    assert.equal(api.serialize(z), api.serialize(offices.make(spec)));
    assert.ok(z.spaces.length <= 128 && z.joins.length <= 256);
  }
});
test('rule permissions cannot make a broken physical route valid', () => {
  const z = offices.make({ seed: 1, dials: preset('Wrong workplace') }), changed = structuredClone(z);
  changed.source.dials.strange = 0; changed.source.dials.sprawl = 0;
  assert.ok(!api.ruleReport(offices, changed).valid);
  const corridor = changed.spaces.find(s => s.id === 'wing-0-hall-0');
  changed.joins = changed.joins.filter(j => j.a !== corridor.id && j.b !== corridor.id);
  assert.ok(!api.validate(changed).valid);
});
test('office rule reports and canonical files ignore listing order and signed placement', () => {
  const z = offices.make({ seed: 29, dials: preset('After hours') }), reversed = structuredClone(z);
  reversed.spaces.reverse(); reversed.joins.reverse(); reversed.entrances.reverse();
  assert.equal(api.serialize(z), api.serialize(reversed)); assert.deepEqual(api.ruleReport(offices, z), api.ruleReport(offices, reversed));
  const shifted = structuredClone(z); for (const s of shifted.spaces) { s.rect = s.rect.map(n => n - 500); s.floor -= 290; }
  shifted.start.x -= 500; shifted.start.y -= 500; shifted.entrances.forEach(e => e.at -= 500);
  assert.ok(api.validate(shifted).valid); assert.deepEqual(api.ruleReport(offices, z), api.ruleReport(offices, shifted));
});
test('downloaded office source preserves presets, rule policy and reproducible geometry', () => {
  const isolated = { ...api, templates: [] }; vm.runInNewContext(api.exportTemplate(offices), { globalThis: { ZoneExchange: isolated } });
  for (const p of offices.presets) {
    const spec = { seed: 4294967295, dials: p.dials }, z = offices.make(spec), restored = isolated.templates[0].make(spec);
    assert.ok(!z.error, z.error); assert.equal(api.serialize(z), api.serialize(restored));
    assert.deepEqual(JSON.parse(JSON.stringify(isolated.ruleReport(isolated.templates[0], restored))), api.ruleReport(offices, z));
  }
});

test('wing count controls independent primary arms and outer branches without depending on Sprawl', () => {
  for (const [wings, expected] of [[0, 1], [20, 2], [40, 3], [60, 4], [80, 5], [100, 6]]) for (const sprawl of [0, 100]) {
    const model = offices.design({ seed: 7, dials: { size: 65, wings, sprawl, open: 35, strange: 0 } });
    assert.ok(!model.error, model.error); assert.equal(model.layout.wings.length, expected);
    const primary = model.layout.wings.filter(w => w.parentWing === null);
    assert.equal(primary.length, Math.min(expected, 4)); assert.equal(new Set(primary.map(w => w.parentId)).size, primary.length);
    assert.equal(model.zone.entrances.length, expected + 1); assert.ok(api.validate(model.zone).valid);
    assert.equal(model.zone.spaces.filter(s => /^wing-\d+-exit$/.test(s.id)).length, expected);
  }
});
test('room capacities change actual depth and frontage independently instead of repeating a common bay', () => {
  const z = offices.make({ seed: 7, dials: { ...preset('Reference floor'), open: 35 } });
  const rooms = z.spaces.filter(s => /^wing-\d+-room/.test(s.id)), area = s => (s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]);
  assert.ok(new Set(rooms.map(area)).size >= 5);
  const mean = role => { const list = rooms.filter(s => s.role === role); return list.reduce((n, s) => n + area(s), 0) / list.length; };
  assert.ok(mean('work') > mean('office') * 1.5);
  assert.ok(z.spaces.some(s => s.role === 'conference'));
  const model = offices.design({ seed: 7, dials: preset('Reference floor') });
  for (const w of model.layout.wings) {
    assert.ok(new Set(w.rooms.map(r => r.depth)).size >= 2);
    assert.ok(new Set(w.rooms.map(r => r.length)).size >= 2);
  }
});
test('old Office v1 template remains archived with its original regeneration identity', async () => {
  const { readFile } = await import('node:fs/promises');
  const isolated = { ...api, templates: [] };
  vm.runInNewContext(await readFile(new URL('../docs/template-reference/offices-v1.js', import.meta.url), 'utf8'), { globalThis: { ZoneExchange: isolated } });
  const old = isolated.templates[0].make({ seed: 1 }); assert.equal(old.source.template, 'offices-v1');
  assert.ok(api.validate(old).valid); assert.equal(offices.make({ seed: 1 }).source.template, 'offices-v3');
});
