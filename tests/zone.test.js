import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalStringify, fingerprint, stream } from '../src/determinism.js';
import { generateStudy, validatePlan, normalizeInput, defaultPorts, canonicalExport } from '../src/zone.js';
import { rectangle } from '../src/geometry.js';
import { floorSvg } from '../src/render.js';
import { readFile } from 'node:fs/promises';

test('canonical JSON sorts keys, preserves arrays, and rejects nonfinite values', () => {
  assert.equal(canonicalStringify({ z: 1, a: { d: -0, b: [2, 1] } }), '{"a":{"b":[2,1],"d":0},"z":1}');
  for (const value of [NaN, Infinity, undefined, { a: undefined }]) assert.throws(() => canonicalStringify(value));
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
  assert.notEqual(fingerprint('é'), fingerprint('e'));
});
test('local RNG streams repeat and do not share consumption state', () => {
  const a = stream({ seed: 'x' }, 'wing'), b = stream({ seed: 'x' }, 'wing'), other = stream({ seed: 'x' }, 'ports');
  assert.equal(a(), b()); other(); other();
  assert.equal(a(), b());
  assert.notEqual(stream({ seed: 'x' }, 'wing')(), stream({ seed: 'x' }, 'ports')());
});
test('same input yields identical plans independent of preceding generation and contract order', () => {
  const a = canonicalExport(generateStudy({ seed: 'stable' }));
  for (let i = 0; i < 10; i++) generateStudy({ seed: i, profile: 'angular' });
  assert.equal(a, canonicalExport(generateStudy({ seed: 'stable', portRequirements: defaultPorts().reverse() })));
});
test('seed, zone identity, profile, dimensions, and port contracts participate in identity', () => {
  const a = generateStudy({ seed: 'base' });
  for (const changes of [{ seed: 'different' }, { zoneId: 'another' }, { profile: 'rotunda' }, { config: { floorHeight: 3.8 } }, { portRequirements: [] }]) assert.notEqual(a.fingerprint, generateStudy({ seed: 'base', ...changes }).fingerprint);
  const copied = structuredClone(a), stored = copied.fingerprint; delete copied.fingerprint;
  assert.equal(stored, fingerprint(copied));
});
test('multi-seed studies validate with explicit unevaluated reachability', () => {
  for (const profile of ['angular', 'rotunda', 'gallery']) for (let seed = 0; seed < 40; seed++) {
    const p = generateStudy({ profile, seed });
    assert.deepEqual(p.diagnostics.errors, [], `${profile}/${seed}`);
    assert.equal(p.diagnostics.status, 'geometry-valid');
    assert.equal(p.diagnostics.reachability, 'not-evaluated');
    assert.equal(p.externalPorts.length, 3);
    assert.ok(p.externalPorts.some(p => p.floorIndex === 1));
    assert.equal(p.kind, 'geometry-study');
  }
});
test('invalid inputs reject explicitly instead of being ignored', () => {
  for (const raw of [{ seed: '' }, { profile: 'house' }, { generatorVersion: 2 }, { config: { floorHeight: 1 } }, { portRequirements: {} }, { portRequirements: Array(9).fill(defaultPorts()[0]) }, { portRequirements: [{ ...defaultPorts()[0], width: -1 }] }, { portRequirements: [{ ...defaultPorts()[0], family: 'hatch' }] }, { portRequirements: [{ ...defaultPorts()[0], floorIndex: 2 }] }, { portRequirements: [defaultPorts()[0], defaultPorts()[0]] }]) assert.throws(() => normalizeInput(raw));
});
test('unsatisfiable contracts produce visible invalid plans and retain requirements', () => {
  const requirements = [{ ...defaultPorts()[0], width: 15 }];
  const p = generateStudy({ portRequirements: requirements });
  assert.equal(p.diagnostics.status, 'invalid');
  assert.deepEqual(p.input.portRequirements, requirements);
  assert.equal(p.externalPorts.length, 0);
  assert.ok(p.diagnostics.errors.some(e => e.code === 'PORT_UNREALIZED'));
});
test('roles do not imply traversal direction', () => {
  const requirements = defaultPorts(); requirements[0].direction = 'exit-only'; requirements[1].direction = 'entrance-only';
  const p = generateStudy({ portRequirements: requirements });
  assert.deepEqual(p.diagnostics.errors, []);
  assert.equal(p.externalPorts.find(p => p.role === 'primary').direction, 'exit-only');
});
test('damaged boundary positions, port frames, contracts, and approaches fail', () => {
  const cases = [
    [p => { p.openings[0].center[0] += 100; }, 'OPENING_INVALID'],
    [p => { p.externalPorts[0].anchor.position[0] += 1; }, 'PORT_ANCHOR_INVALID'],
    [p => { p.externalPorts[0].anchor.forward[0] += 1; }, 'PORT_FRAME_INVALID'],
    [p => { p.externalPorts[0].width += 1; }, 'PORT_CONTRACT_MISMATCH'],
    [p => { p.externalPorts[0].approach = rectangle(1, 1); }, 'PORT_CLEARANCE_INVALID'],
    [p => { p.externalPorts.pop(); }, 'PORT_UNREALIZED'],
    [p => { p.spaces[0].id = p.spaces[1].id; }, 'DUPLICATE_ID']
  ];
  for (const [damage, code] of cases) { const p = generateStudy({}); damage(p); assert.ok(validatePlan(p).errors.some(e => e.code === code), code); }
});
test('filled gallery void, missing floor, and overlapping volume fail', () => {
  const p = generateStudy({ profile: 'gallery' });
  const slab = p.surfaces.find(s => s.spaceId === 'study-gallery'); slab.footprint.holes = [];
  assert.ok(validatePlan(p).errors.some(e => e.code === 'VOID_FILLED'));
  assert.ok(validatePlan(p).errors.some(e => e.code === 'FLOOR_INVALID'));
  const q = generateStudy({ profile: 'gallery' }); q.surfaces.splice(0, 1);
  assert.ok(validatePlan(q).errors.some(e => e.code === 'FLOOR_INVALID'));
  const r = generateStudy({ profile: 'angular' }); r.spaces[1].footprint = structuredClone(r.spaces[0].footprint);
  assert.ok(validatePlan(r).errors.some(e => e.code === 'SPACE_OVERLAP'));
});
test('drawing retains SVG arcs and does not mutate canonical plan', () => {
  const p = generateStudy({ profile: 'gallery' }), before = canonicalExport(p);
  const svg = floorSvg(p, 1, { labels: true, clearance: true, voids: true, vertices: true, selected: 'study-gallery' });
  assert.ok(svg.includes('A 4.8 4.8'));
  assert.ok(svg.includes('fill-rule="evenodd"'));
  assert.ok(svg.includes('port-upper'));
  floorSvg(p, 0, { labels: false, clearance: false, voids: false, vertices: false });
  assert.equal(canonicalExport(p), before);
});
test('committed regression plans remain reproducible within generator version 1', async () => {
  for (const profile of ['angular', 'rotunda', 'gallery']) {
    const stored = await readFile(new URL(`../docs/examples/${profile}.json`, import.meta.url), 'utf8');
    const fixture = JSON.parse(stored);
    assert.equal(canonicalExport(generateStudy(fixture.input)), stored);
  }
});
