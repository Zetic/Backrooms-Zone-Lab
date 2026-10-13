import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/generic.js';
const api = globalThis.ZoneExchange, t = api.templates.find(t => t.id === 'generic');
const defaults = Object.fromEntries(t.dials.map(d => [d.id, d.value]));
const design = (dials = {}, seed = 7) => { const m = t.design({ seed, dials: { ...defaults, ...dials } }); assert.ok(!m.error, m.error); return m; };

test('generic presets keep exact programs, enabled modules, full occupied envelopes and actual route contracts', () => {
  assert.equal(t.dials.filter(d => d.type !== 'toggle').length, 19); assert.equal(t.dials.filter(d => d.type === 'toggle').length, 5);
  const recipes = new Set();
  for (const preset of t.presets) for (let seed = 1; seed <= 9; ++seed) {
    const m = design(preset.dials, seed), z = m.zone;
    assert.ok(api.validate(z).valid); assert.ok(api.ruleReport(t, z).rules.every(r => r.kept));
    assert.equal(z.spaces.filter(s => s.kind === 'room').length, 8 + Math.floor(preset.dials.rooms * 40 / 100));
    m.layout.modules.forEach(m => recipes.add(m.recipe)); assert.ok(z.spaces.length <= 128 && z.joins.length <= 256);
  }
  assert.deepEqual([...recipes].sort(), ['cluster', 'court', 'hall', 'spine']);
});
test('mixed generic settings and all 32 module switch combinations remain bounded and reproducible', () => {
  for (let seed = 0; seed < 250; ++seed) {
    const dials = Object.fromEntries(t.dials.map(d => [d.id, d.type === 'toggle' ? api.stream(seed, 'stress', d.id) % 2 * 100 : [0, 10, 50, 90, 100][api.stream(seed, 'stress', d.id) % 5]]));
    const a = design(dials, seed).zone, b = design(dials, seed).zone;
    assert.equal(api.serialize(a), api.serialize(b)); assert.ok(api.validate(a).valid);
  }
  const toggles = t.dials.filter(d => d.type === 'toggle');
  for (let mask = 0; mask < 32; ++mask) {
    const dials = Object.fromEntries(toggles.map((d, i) => [d.id, mask >> i & 1 ? 100 : 0]));
    const m = design({ ...dials, rooms: 100, clusterSize: 100, scale: 0, hallWidth: 100, cohesion: 0, sprawl: 100, loops: 100 });
    assert.ok(api.validate(m.zone).valid); assert.ok(api.ruleReport(t, m.zone).valid);
    assert.ok(m.layout.modules.every(m => m.recipe !== 'court'), 'Narrow interiors explicitly fall back to compatible modules.');
  }
});
test('Cohesion changes explicit connectors rather than room dimensions and room supply bounds sprawling reach', () => {
  const settings = { spines: 0, courts: 0, halls: 0, rooms: 80, clusterSize: 20, sprawl: 100, branching: 0, turns: 0 };
  const tight = design({ ...settings, cohesion: 100 }), loose = design({ ...settings, cohesion: 0 });
  assert.equal(tight.zone.spaces.filter(s => s.id.startsWith('connector-')).length, 0);
  assert.ok(loose.zone.spaces.some(s => s.id.startsWith('connector-')));
  const dimensions = s => [s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]];
  for (const s of tight.zone.spaces) assert.deepEqual(dimensions(s), dimensions(loose.zone.spaces.find(p => p.id === s.id)));
  const few = design({ ...settings, rooms: 0 }), many = design({ ...settings, rooms: 100 });
  assert.ok(many.layout.modules.length > few.layout.modules.length);
  const extent = m => Math.max(...m.layout.modules.map(m => m.envelope[2])) - Math.min(...m.layout.modules.map(m => m.envelope[0]));
  assert.ok(extent(many) > extent(few) * 2);
});
test('courtyards are genuinely unoccupied and raised sections have reversible climb joins with sufficient headroom', () => {
  const court = design({ ...t.presets[3].dials });
  const voids = court.layout.modules.flatMap(m => m.voids); assert.ok(voids.length);
  for (const r of voids) assert.ok(court.zone.spaces.every(s => !(r[0] < s.rect[2] && s.rect[0] < r[2] && r[1] < s.rect[3] && s.rect[1] < r[3])));
  const raised = design({ levelChange: 100, ceiling: 0, heightVariety: 100 });
  assert.deepEqual(api.facts(raised.zone).floors, [0, 100]); assert.ok(raised.zone.joins.some(j => j.mode === 'climb'));
  assert.ok(raised.zone.spaces.every(s => s.ceiling >= 300)); assert.ok(api.validate(raised.zone).valid);
});
test('rules derive program and envelope validity from imports and are invariant under signed translation', () => {
  const m = design(), changed = structuredClone(m.zone), first = changed.spaces.find(s => s.kind === 'room');
  first.rect[2] -= 1;
  assert.equal(api.ruleReport(t, changed).rules.find(r => r.id === 'module-contracts').kept, false);
  const translated = structuredClone(m.zone);
  translated.spaces.forEach(s => { s.rect = s.rect.map(v => v - 200); s.floor -= 580; }); translated.start.x -= 200; translated.start.y -= 200; translated.entrances.forEach(e => e.at -= 200);
  const relabelled = structuredClone(m.zone); relabelled.spaces.forEach(s => { s.title = 'Renamed room'; });
  assert.deepEqual(api.ruleReport(t, relabelled), api.ruleReport(t, m.zone));
  assert.ok(api.validate(translated).valid); assert.deepEqual(api.ruleReport(t, translated), api.ruleReport(t, m.zone));
});
test('downloaded generic source reproduces all controls and accepts registered architecture and rule modules', () => {
  const copied = { ...api, templates: [] };
  vm.runInNewContext(api.exportTemplate(t), { globalThis: { ZoneExchange: copied } });
  const g = copied.templates[0];
  for (const preset of t.presets) assert.equal(api.serialize(t.make({ seed: 4294967295, dials: preset.dials })), copied.serialize(g.make({ seed: 4294967295, dials: preset.dials })));
  // A plug-in can supply a new recipe using the same envelope/program/port protocol.
  g.modules.push({ id: 'studio', name: 'Studio groups', minimumRooms: 2, extraSpaces: 0, builder: 'studio' });
  g.studio = g.hall;
  g.ruleModules.push({ id: 'studio-policy', evaluator: 'studioRules', required: true });
  g.studioRules = function(zone) { return [api.rule('studio-policy', 'Studio groups are present', zone.spaces.some(s => /-studio-/.test(s.id)))]; };
  const spec = { seed: 7, dials: { ...defaults, spines: 0, courts: 0, halls: 0, moduleMix: 0 } }, z = g.make(spec);
  assert.ok(!z.error, z.error); assert.ok(z.spaces.some(s => /-studio-/.test(s.id))); assert.ok(copied.ruleReport(g, z).valid);
  const reloaded = { ...api, templates: [] }; vm.runInNewContext(api.exportTemplate(g), { globalThis: { ZoneExchange: reloaded } });
  assert.equal(api.serialize(z), api.serialize(reloaded.templates[0].make(spec)));
});
