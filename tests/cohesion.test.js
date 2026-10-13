import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/house.js';
import '../exchange/templates/offices.js';
const api = globalThis.ZoneExchange, house = api.templates.find(t => t.id === 'house'), office = api.templates.find(t => t.id === 'offices');
const make = (t, dials, seed = 7) => { const z = t.make({ seed, dials: { size: 60, strange: 0, ...(t === office ? { wings: 20, open: 35 } : {}), ...dials } }); assert.ok(!z.error, z.error); return z; };
const rooms = z => z.spaces.filter(s => s.kind === 'room');
const reach = z => Math.max(...z.spaces.map(s => s.rect[2])) - Math.min(...z.spaces.map(s => s.rect[0])) + Math.max(...z.spaces.map(s => s.rect[3])) - Math.min(...z.spaces.map(s => s.rect[1]));
const adjacent = z => rooms(z).filter(s => rooms(z).some(p => p !== s && p.floor === s.floor && api.shared(p, s))).length;

test('room quantity supplies cohesive sprawl while too few rooms constrain reach in both archetypes', () => {
  for (const t of [house, office]) {
    const few = make(t, { rooms: 0, cohesion: 100, sprawl: 100 }), many = make(t, { rooms: 100, cohesion: 100, sprawl: 100 });
    assert.ok(rooms(many).length > rooms(few).length); assert.ok(reach(many) > reach(few) * 1.5);
    assert.equal(adjacent(few), rooms(few).length); assert.equal(adjacent(many), rooms(many).length);
    const dispersed = make(t, { rooms: 0, cohesion: 0, sprawl: 100 });
    assert.ok(reach(dispersed) > reach(few)); assert.ok(adjacent(dispersed) < adjacent(few));
  }
});
test('Cohesion closes allocation gaps without enlarging any matching office room', () => {
  const loose = make(office, { rooms: 70, cohesion: 0, sprawl: 100 }), tight = make(office, { rooms: 70, cohesion: 100, sprawl: 100 });
  const dimensions = s => [s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]];
  for (const s of rooms(tight).filter(s => /^wing-/.test(s.id))) assert.deepEqual(dimensions(s), dimensions(loose.spaces.find(p => p.id === s.id)));
  assert.ok(reach(loose) > reach(tight));
  const low = office.design({ seed: 7, dials: { rooms: 0, cohesion: 100, sprawl: 0 } }), high = office.design({ seed: 7, dials: { rooms: 0, cohesion: 100, sprawl: 100 } });
  assert.ok(!low.error && !high.error); assert.deepEqual(low.layout.wings.map(w => w.length), high.layout.wings.map(w => w.length));
});
test('room count is independent of Size and both dial combinations remain bounded, physical and reproducible', () => {
  for (const t of [house, office]) for (const cohesion of [0, 50, 100]) for (const count of [0, 50, 100]) for (const sprawl of [0, 55, 100]) for (const size of [0, 100]) {
    const dials = { size, cohesion, rooms: count, sprawl };
    const a = make(t, dials), b = make(t, dials);
    assert.ok(api.validate(a).valid); assert.ok(api.ruleReport(t, a).valid); assert.ok(a.spaces.length <= 128 && a.joins.length <= 256);
    assert.equal(api.serialize(a), api.serialize(b));
    if (t === office) assert.equal(a.spaces.filter(s => /^wing-\d+-room/.test(s.id)).length, 2 * (4 + Math.floor(count / 10)));
  }
});
test('maximum office cohesion is checked on imported geometry, not trusted from dial metadata', () => {
  const z = make(office, { cohesion: 100, rooms: 40, sprawl: 100 }), room = z.spaces.find(s => s.id === 'wing-0-room-0-1');
  room.rect[0] += 1; room.rect[2] += 1;
  assert.equal(api.ruleReport(office, z).rules.find(r => r.id === 'cohesion').kept, false);
});
test('previous house and office v2 sources remain reproducible under their recorded identities', async () => {
  for (const id of ['house', 'offices']) {
    const apiCopy = { ...api, templates: [] };
    vm.runInNewContext(await readFile(new URL(`../docs/template-reference/${id}-v2.js`, import.meta.url), 'utf8'), { globalThis: { ZoneExchange: apiCopy } });
    const t = apiCopy.templates[0], z = t.make({ seed: 7 });
    assert.ok(!z.error); assert.equal(z.source.template, id + '-v2'); assert.equal(api.serialize(z), api.serialize(t.make({ seed: 7 })));
  }
});
