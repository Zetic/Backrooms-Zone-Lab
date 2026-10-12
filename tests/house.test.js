import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateHouse, normalizeHouseInput, validateHouse } from '../src/house.js';
import { defaultPorts, canonicalExport } from '../src/zone.js';
import { deriveWalls } from '../src/structure.js';
import { canonicalStringify, fingerprint } from '../src/determinism.js';
import { signedArea } from '../src/geometry.js';
import { buildMesh } from '../src/mesh.js';
import { floorSvg } from '../src/render.js';

const topology = plan => fingerprint(plan.localConnections.map(c => [c.from, c.to, c.kind, c.direction]));
const gallery = generateHouse({ profile: 'gallery-house', seed: '2' });
const mansion = generateHouse({ profile: 'atrium-mansion', seed: '1' });

test('generated houses have complete functional programs and physical access', () => {
  for (const plan of [gallery, mansion]) {
    assert.equal(plan.kind, 'generated-house'); assert.equal(plan.schemaVersion, 'br.zone/0.3');
    assert.equal(plan.diagnostics.status, 'architecture-valid'); assert.deepEqual(plan.diagnostics.errors, []);
    assert.deepEqual(validateHouse(plan), plan.diagnostics);
    assert.equal(plan.generation.status, 'accepted');
    assert.equal(plan.diagnostics.navigation.reachable.length, plan.spaces.length);
    assert.equal(plan.diagnostics.navigation.returnable.length, plan.spaces.length);
    assert.ok(plan.diagnostics.metrics.cycleRank >= 1);
    assert.ok(plan.layout.program.some(room => room.type === 'kitchen'));
    assert.ok(plan.layout.program.some(room => room.type === 'living'));
    assert.equal(plan.externalPorts.length, 3); assert.ok(plan.externalPorts.some(p => p.floorIndex > 0));
  }
});

test('seed diversity changes actual graph structure and vertical composition', () => {
  for (const profile of ['gallery-house', 'atrium-mansion']) {
    const plans = Array.from({ length: 12 }, (_, seed) => generateHouse({ profile, seed }));
    plans.forEach(plan => assert.deepEqual(plan.diagnostics.errors, []));
    assert.ok(new Set(plans.map(topology)).size >= 6, profile);
    assert.ok(new Set(plans.map(p => p.spaces.length)).size >= 4, profile);
    assert.ok(new Set(plans.map(p => p.verticalTraversals.length)).size >= 2, profile);
    assert.ok(new Set(plans.map(p => p.layout.signature.shape)).size >= 2, profile);
    assert.ok(plans.some(p => Math.abs(p.layout.orientationDegrees) % 90 !== 0));
    if (profile === 'atrium-mansion') assert.deepEqual(new Set(plans.map(p => p.layout.signature.upperFloorIndex)), new Set([1, 2]));
  }
});

test('both profiles support two/three storeys and adaptive stair core lengths', () => {
  for (const profile of ['gallery-house', 'atrium-mansion']) for (const storeys of [2, 3]) for (const floorHeight of [2.6, 4.2]) {
    const plan = generateHouse({ profile, seed: 'configuration', config: { storeys, floorHeight } });
    assert.deepEqual(plan.diagnostics.errors, [], `${profile}/${storeys}/${floorHeight}`);
    assert.equal(plan.floors.length, storeys);
    for (const stair of plan.verticalTraversals) {
      assert.ok(Math.abs(stair.target.position[2] - stair.source.position[2] - floorHeight) < 1e-5);
      assert.equal(stair.treads.length, Math.ceil(floorHeight / .18));
    }
  }
});

test('same normalized tuple repeats independent of prior runs and global RNG', () => {
  const input = { profile: 'atrium-mansion', seed: 'repeat' }, first = generateHouse(input);
  generateHouse({ profile: 'gallery-house', seed: 'unrelated' });
  const original = Math.random;
  try { Math.random = () => { throw new Error('Global random state accessed'); }; assert.equal(canonicalExport(generateHouse({ ...input, portRequirements: defaultPorts().reverse() })), canonicalExport(first)); }
  finally { Math.random = original; }
  const clone = structuredClone(first), hash = clone.fingerprint; delete clone.fingerprint;
  assert.equal(fingerprint(clone), hash);
});

test('raising search budget preserves the candidate sequence', () => {
  const low = generateHouse({ seed: 'budget', config: { maxAttempts: 1 } }), high = generateHouse({ seed: 'budget', config: { maxAttempts: 4 } });
  assert.deepEqual(low.spaces, high.spaces); assert.deepEqual(low.localConnections, high.localConnections);
  assert.notEqual(low.fingerprint, high.fingerprint); // Configuration still participates in identity.
  const ports = [{ ...defaultPorts()[0], width: 20 }];
  const failedLow = generateHouse({ seed: 'budget', portRequirements: ports, config: { maxAttempts: 1 } }), failedHigh = generateHouse({ seed: 'budget', portRequirements: ports, config: { maxAttempts: 3 } });
  assert.deepEqual(failedLow.generation.candidateFailures[0], failedHigh.generation.candidateFailures[0]);
});

test('unsatisfiable contracts preserve identity and exhaust a bounded deterministic search', () => {
  const requests = [{ ...defaultPorts()[0], width: 20 }], input = { seed: 'infeasible', config: { maxAttempts: 2 }, portRequirements: requests };
  const a = generateHouse(input), b = generateHouse(input);
  assert.equal(a.generation.status, 'failed'); assert.equal(a.generation.attemptsTried, 2);
  assert.equal(a.generation.candidateFailures.length, 2); assert.equal(a.generation.acceptedAttempt, null);
  assert.deepEqual(a.input.portRequirements, requests);
  assert.ok(a.diagnostics.errors.some(e => e.code === 'GENERATION_EXHAUSTED'));
  assert.ok(a.diagnostics.errors.some(e => e.code === 'PORT_UNREALIZED'));
  assert.equal(canonicalExport(a), canonicalExport(b)); assert.deepEqual(validateHouse(a), a.diagnostics);
});

test('third-floor requirement is fulfilled on a three-storey house and never dropped on two', () => {
  const ports = defaultPorts(); ports[2].floorIndex = 2;
  const three = generateHouse({ portRequirements: ports, config: { storeys: 3 } });
  assert.deepEqual(three.diagnostics.errors, []); assert.ok(three.externalPorts.some(p => p.floorIndex === 2));
  const two = generateHouse({ portRequirements: ports, config: { storeys: 2, maxAttempts: 1 } });
  assert.equal(two.diagnostics.status, 'invalid'); assert.equal(two.input.portRequirements[2].floorIndex, 2);
  assert.ok(two.diagnostics.errors.some(e => e.code === 'PORT_UNREALIZED'));
});

test('functional adjacency is independently required even if all rooms remain reachable', () => {
  const plan = structuredClone(mansion), kitchen = plan.layout.program.find(r => r.type === 'kitchen').spaceId, dining = plan.layout.program.find(r => r.type === 'dining').spaceId;
  plan.openings = plan.openings.filter(o => !(o.hosts.length === 2 && o.hosts.some(h => h.spaceId === kitchen) && o.hosts.some(h => h.spaceId === dining)));
  plan.walls = deriveWalls(plan); plan.layout.obligations = [];
  const physical = validateHouse(plan, { checkCachedConnections: false }); plan.localConnections = physical.navigation.connections;
  const checked = validateHouse(plan);
  assert.equal(checked.navigation.unreachable.length, 0);
  assert.ok(checked.errors.some(e => e.code === 'ROOM_RELATIONSHIP_MISSING'));
  assert.ok(checked.errors.some(e => e.code === 'RELATIONSHIP_CONTRACT_MISMATCH'));
});

test('room relabeling cannot substitute for required architectural proportions', () => {
  const plan = generateHouse({ profile: 'gallery-house', seed: '4' }), entry = plan.layout.program.find(room => {
    const s = plan.spaces.find(s => s.id === room.spaceId);
    return signedArea(s.footprint.outer) < 16;
  });
  assert.ok(entry);
  const space = plan.spaces.find(s => s.id === entry.spaceId); entry.type = 'living'; space.role = 'public'; space.tags.push('living');
  assert.ok(validateHouse(plan).errors.some(e => e.code === 'ROOM_PROPORTION_INVALID'));
});

test('incorrect gallery metadata, missing tall volume and false attempt claims fail', () => {
  const a = structuredClone(gallery); a.layout.signature.upperFloorIndex = 0;
  assert.ok(validateHouse(a).errors.some(e => e.code === 'SIGNATURE_INVALID'));
  const b = structuredClone(gallery), lower = b.spaces.find(s => s.id === b.layout.signature.lowerSpaceId);
  lower.clearVolumes.pop(); lower.clearHeight = b.input.config.floorHeight - .2;
  assert.ok(validateHouse(b).errors.some(e => e.code === 'SIGNATURE_INVALID'));
  const c = structuredClone(gallery); c.generation.attemptsTried = 0;
  assert.ok(validateHouse(c).errors.some(e => e.code === 'GENERATION_REPORT_INVALID'));
});

test('rotated treads remain physical and corrupted diagonal geometry is rejected', () => {
  assert.equal(gallery.layout.orientationDegrees, 22.5);
  const stair = gallery.verticalTraversals[0]; assert.ok(Math.abs(stair.target.position[0] - stair.source.position[0]) > 1);
  const damaged = structuredClone(gallery); damaged.verticalTraversals[0].treads[4].footprint.outer[0].from[0] += .15;
  assert.ok(validateHouse(damaged).errors.some(e => ['STAIR_GEOMETRY_INVALID', 'STAIR_HEADROOM_BLOCKED'].includes(e.code)));
});

test('arc geometry and non-cardinal architecture participate in every generated example', () => {
  for (const plan of [gallery, mansion]) {
    assert.ok(plan.diagnostics.metrics.arcs > 0);
    const rotation = plan.layout.orientationDegrees * Math.PI / 180;
    assert.ok(plan.spaces.flatMap(s => s.footprint.outer).some(edge => {
      if (edge.kind !== 'line') return false;
      const a = Math.atan2(edge.to[1] - edge.from[1], edge.to[0] - edge.from[0]) - rotation;
      return Math.abs(Math.sin(a * 2)) > .1;
    }));
  }
});

test('inspection selects actual top/gallery floors and cannot alter exports', () => {
  const elevated = generateHouse({ profile: 'atrium-mansion', seed: '0' }), before = canonicalExport(elevated);
  assert.equal(elevated.layout.signature.upperFloorIndex, 2);
  const view = buildMesh(elevated, { scope: 'gallery', navigation: true });
  assert.ok(view.faces.some(f => f.spaceId === elevated.layout.signature.upperSpaceId && f.category === 'floor'));
  const two = buildMesh(gallery, { scope: 'top' });
  assert.ok(two.faces.some(f => f.spaceId === 'main:1' && f.category === 'floor'));
  assert.ok(!two.faces.some(f => f.spaceId === 'main:0' && f.category === 'floor'));
  const svg = floorSvg(elevated, 2, { labels: true, navigation: true, voids: true });
  assert.ok(svg.includes('local-door')); assert.ok(svg.includes('guard-line'));
  assert.equal(canonicalExport(elevated), before);
});

test('invalid generation parameters fail before synthesis', () => {
  for (const input of [{ profile: 'hotel' }, { generatorVersion: 2 }, { config: { storeys: 4 } }, { config: { floorHeight: 4.5 } }, { config: { maxAttempts: 20 } }, { portRequirements: [{ ...defaultPorts()[0], floorIndex: 3 }] }]) assert.throws(() => normalizeHouseInput(input));
});

test('committed procedural examples repeat within generator version 3', async () => {
  for (const name of ['gallery-house-2', 'atrium-mansion-0', 'atrium-mansion-1']) {
    const stored = await readFile(new URL(`../docs/examples/${name}.json`, import.meta.url), 'utf8');
    assert.equal(canonicalExport(generateHouse(JSON.parse(stored).input)), stored);
  }
});
