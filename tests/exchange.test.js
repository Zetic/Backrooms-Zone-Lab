import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/house.js';
import '../exchange/templates/level0.js';
import '../exchange/plan.js';
import { audit } from '../scripts/exchange.mjs';
const api = globalThis.ZoneExchange;
const flat = JSON.parse(await readFile(new URL('../exchange/flat.zone.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(flat);
function two(mode = 'door', floor = 0) {
  return { format: 'backrooms-zone', version: 1, id: 'test', name: 'Test', theme: 'residential', start: { space: 'a', x: -2, y: 2 },
    spaces: [{ id: 'a', title: 'A', kind: 'room', rect: [-4, 0, 0, 8], floor: 0, ceiling: 800 }, { id: 'b', title: 'B', kind: 'room', rect: [0, 0, 4, 8], floor, ceiling: 800 }],
    joins: [{ a: 'a', b: 'b', mode, required: true }], entrances: [{ title: 'West', space: 'a', side: 'w', at: 4 }] };
}
const fails = (z, code) => assert.ok(api.validate(z).errors.some(e => e.code === code), JSON.stringify(api.validate(z)));

test('exchange stream matches all six Unreal uint32 reference draws', () => {
  for (const [seed, path, name, expected] of [[1, '', '', 937033933], [1, 'zonelab/house', 'seed', 2761775253], [1, 'zonelab/level0', 'seed', 950527661], [42, 'attempt', '0', 2198064874], [4294967295, 'room/0,0,12,10', 'seed', 1657424870], [123456789, 'join/0,0,8,8/8,0,16,8', 'order', 25009617]]) assert.equal(api.stream(seed, path, name), expected);
});
test('worked Unreal example validates, round trips and ignores listing order', () => {
  assert.ok(api.validate(flat).valid); assert.equal(api.facts(flat).floors.length, 2);
  const z = copy(); z.spaces.reverse(); z.joins.reverse(); z.joins.forEach(j => { [j.a, j.b] = [j.b, j.a]; });
  assert.equal(api.serialize(z), api.serialize(flat)); assert.equal(api.serialize(JSON.parse(api.serialize(z))), api.serialize(z));
  const metadata = copy(); metadata.source.dials = JSON.parse('{"__proto__":10,"constructor":90}');
  assert.deepEqual(JSON.parse(api.serialize(metadata)).source.dials, metadata.source.dials);
});
test('each portable template passes the documented 120 cases twice and in reversed listing order', () => {
  for (const result of audit()) assert.equal(result.passed, 120, JSON.stringify(result.failures));
});
test('seed/dial bounds are explicit failures and one template does not affect another', () => {
  const [house, level0] = api.templates;
  const before = api.serialize(house.make({ seed: 4294967295 })); level0.make({ seed: 23 });
  assert.equal(before, api.serialize(house.make({ seed: 4294967295 })));
  for (const seed of [-1, 4294967296, 1.5, 'one']) assert.ok(house.make({ seed }).error);
  for (const size of [-1, 101, 1.5]) assert.ok(house.make({ seed: 1, dials: { size } }).error);
  assert.ok(house.make({ seed: 1, dials: { unknown: 20 } }).error);
  assert.ok(level0.make({ seed: 1, dials: { size: 100, scale: 0 } }).error);
});
test('signed coordinates and floor heights transfer without changing connections', () => {
  const z = copy(); for (const s of z.spaces) { s.rect = s.rect.map(n => n - 100); s.floor -= 580; }
  z.start.x -= 100; z.start.y -= 100; z.entrances.forEach(e => e.at -= 100);
  assert.ok(api.validate(z).valid); assert.deepEqual(api.facts(z).floors, [-580, -290]);
});
test('grid, ids, kind, ceilings and unknown geometry fields are rejected', () => {
  for (const [change, code] of [
    [z => z.spaces[0].rect[0] += 0.5, 'grid'], [z => z.spaces[0].floor = 1, 'grid'],
    [z => z.spaces[0].ceiling = 205, 'ceiling'], [z => z.spaces[0].rect[2] = 50, 'size'],
    [z => z.spaces[0].id = 'UpperCase', 'id'], [z => z.spaces[1].id = z.spaces[0].id, 'id'],
    [z => z.spaces[0].kind = 'polygon', 'kind'], [z => z.walls = [], 'field'], [z => z.version = 4, 'format'],
    [z => z.source.seed = 'text', 'source'], [z => z.spaces = Array(129).fill(z.spaces[0]), 'counts']
  ]) { const z = copy(); change(z); fails(z, code); assert.throws(() => api.serialize(z)); }
});
test('malformed untrusted files report failures without crashing the validator', () => {
  for (const z of [null, [], {}, { spaces: [null, []], joins: [null] }, { ...copy(), spaces: [null] }, { ...copy(), joins: [null] }, { ...copy(), entrances: [null] }]) assert.equal(api.validate(z).valid, false);
});
test('overlap includes stairwell height and enforces slab clearance', () => {
  const z = copy(); z.spaces.find(s => s.id === 'landing').floor = 280; fails(z, 'overlap');
  const b = copy(); b.spaces.find(s => s.id === 'bedroom').rect = [8, 4, 11, 15]; fails(b, 'overlap');
});
test('stairs reject missing head, short run, long-side joins and dressed landings', () => {
  for (const change of [z => z.joins.splice(5, 1), z => z.spaces.find(s => s.id === 'stairs').rect[3] = 17,
    z => z.spaces.find(s => s.id === 'stairs').rect[3] = 90,
    z => z.joins.push({ a: 'stairs', b: 'hallway', mode: 'open' }),
    z => z.spaces.find(s => s.id === 'landing').features = { divider: true }]) { const z = copy(); change(z); fails(z, 'stair'); }
});
test('join widths, fallback and equal-floor rules match the exchange contract', () => {
  const z = two('wide'); z.spaces[0].rect[3] = 4; z.spaces[1].rect[3] = 4; z.entrances[0].at = 2;
  const report = api.validate(z); assert.ok(report.valid); assert.equal(report.links[0].mode, 'door'); assert.ok(report.warnings.some(e => e.code === 'fallback'));
  for (const rise of [10, 20]) fails(two('door', rise), 'floors');
  const short = two(); short.spaces[0].rect[3] = 3; short.spaces[1].rect[3] = 3; short.entrances = []; fails(short, 'stretch');
  const duplicate = two(); duplicate.joins.push({ a: 'b', b: 'a', mode: 'door' }); fails(duplicate, 'join');
});
test('climb is two way; drop needs a separate return; views never count for reach', () => {
  for (const rise of [20, 110, -20, -110]) assert.ok(api.validate(two('climb', rise)).valid);
  for (const rise of [10, 120]) fails(two('climb', rise), 'floors');
  fails(two('drop', 120), 'reach'); fails(two('drop', -120), 'return'); fails(two('view'), 'reach');
  const z = two('drop', -120);
  z.spaces.push({ id: 'c', title: 'Return ledge', kind: 'room', rect: [-4, 8, 4, 12], floor: -60, ceiling: 800 });
  z.joins.push({ a: 'b', b: 'c', mode: 'climb' }, { a: 'c', b: 'a', mode: 'climb' }); assert.ok(api.validate(z).valid);
});
test('common headroom, start support and entrance free stretches are checked', () => {
  const z = two('climb', 110); z.spaces[0].ceiling = 200; fails(z, 'headroom');
  const start = copy(); start.start = { space: 'stairs', x: 9, y: 8 }; fails(start, 'start');
  const boundary = copy(); boundary.start.x = 14; fails(boundary, 'start');
  const e = two(); e.entrances[0].side = 'e'; fails(e, 'entrance');
  const partial = two(); partial.spaces[1].rect = [-8, 0, -4, 4]; partial.joins = [{ a: 'a', b: 'b', mode: 'door' }]; partial.entrances[0].at = 6; assert.ok(api.validate(partial).valid);
  partial.entrances[0].at = 4; fails(partial, 'entrance');
});
test('feature/theme hints preserve data and explicitly defer physical clearance', () => {
  const z = two(); z.spaces[1].rect[2] = 10; z.spaces[1].rect[3] = 8; z.spaces[1].features = { shape: 'L', columns: 1 };
  fails(z, 'features'); z.spaces[1].rect[1] = -2; assert.ok(api.validate(z).valid); assert.ok(api.validate(z).warnings.some(e => e.code === 'physical'));
  z.theme = 'office'; fails(z, 'theme'); z.notes = 'A new grey office theme.'; assert.ok(api.validate(z).valid);
});
test('SVG snapshots distinguish stair support from upper void and escape user labels', () => {
  const z = copy(); z.name = '<script>alert(1)</script>';
  assert.ok(api.plan(z, 0).includes('start')); assert.ok(api.plan(z, 290).includes('Stairwell')); assert.ok(api.plan(z, 290).includes('no floor here'));
  assert.ok(api.plan(z, 0).includes('&lt;script&gt;')); assert.ok(!api.plan(z, 0).includes('<script>'));
});
