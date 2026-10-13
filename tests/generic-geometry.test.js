import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGenericDesign, importGenericDesign } from '../src/generic.js';
import { genericTemplate, genericInput } from '../src/generic-template.js';
import { composeGeneric } from '../src/generic-layout.js';
import { canonicalExport } from '../src/zone.js';
import { validateArchitecture } from '../src/physical.js';
import { validateFootprint, distance } from '../src/geometry.js';
import { genericSvg } from '../src/generic-render.js';
const small = { seed: 7, dials: { rooms: 0, orientation: 100, turns: 100, cohesion: 0 } };

test('Generic v2 realizes angled clear floors, supported wall apertures and reproducible full exports', () => {
  const p = generateGenericDesign(small), again = generateGenericDesign(small);
  assert.equal(canonicalExport(p), canonicalExport(again));
  assert.equal(p.schemaVersion, 'br.zone/0.4'); assert.equal(p.input.generatorVersion, 2);
  assert.equal(p.spaces.filter(s => s.tags.includes('room')).length, 8);
  assert.equal(validateArchitecture(p).errors.length, 0);
  assert.equal(p.diagnostics.navigation.returnable.length, p.spaces.length);
  assert.ok(p.spaces.some(s => s.footprint.outer.some(e => Math.abs(e.to[0] - e.from[0]) > .1 && Math.abs(e.to[1] - e.from[1]) > .1)));
  assert.ok(p.wallBodies.length); assert.ok(p.passages.length);
  for (const body of p.wallBodies) assert.deepEqual(validateFootprint(body.footprint, { stableTangencies: true }), []);
  for (const passage of p.passages) assert.ok(Math.abs(distance(passage.from, passage.to) - .15) < 2e-5);
  const svg = genericSvg(p); assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"')); assert.ok(svg.includes('wall-solid'));
  assert.ok(p.layout.metrics.roomAreaMaxM2 > p.layout.metrics.roomAreaMinM2 * 1.4);
});

test('all presets preserve the room program and physical outward/return paths across distinct seeds', () => {
  for (const preset of genericTemplate.presets) for (const seed of [1, 7, 29]) {
    const p = generateGenericDesign({ seed, dials: preset.dials }, { walls: false });
    assert.equal(p.spaces.filter(s => s.tags.includes('room')).length, 8 + Math.floor(preset.dials.rooms * 88 / 100));
    assert.equal(p.diagnostics.navigation.reachable.length, p.spaces.length);
    assert.equal(p.diagnostics.navigation.returnable.length, p.spaces.length);
    assert.ok(p.layout.architecturalRules.every(r => r.kept));
  }
});

test('module masks and mixed extreme settings keep exact rooms, usable doors and bounded generation', () => {
  const toggles = genericTemplate.dials.filter(d => d.type === 'toggle');
  for (let mask = 0; mask < 16; ++mask) {
    const dials = Object.fromEntries(toggles.map((d, i) => [d.id, mask >> i & 1 ? 100 : 0]));
    const p = generateGenericDesign({ seed: mask, dials: { ...dials, rooms: 0, scale: 0, variety: 100, hallWidth: 100, open: 100, exits: 100, cohesion: mask % 3 * 50 } }, { walls: false });
    assert.equal(p.externalPorts.length, 8); assert.equal(p.diagnostics.errors.length, 0);
    assert.ok(p.layout.clusters.every(c => mask === 0 ? c.recipe === 'partitioned' : dials[c.recipe] === 100));
  }
  for (const seed of [0, 7, 12, 29, 4294967295]) {
    const p = generateGenericDesign({ seed, dials: { rooms: 100, scale: 0, variety: 100, hallWidth: 100, exits: 100, open: 100, cohesion: seed % 3 * 50 } }, { walls: false });
    assert.equal(p.spaces.filter(s => s.tags.includes('room')).length, 96); assert.ok(p.spaces.length <= 512); assert.ok(p.openings.length <= 1024);
  }
});

test('route length, branching, angle and loop controls change actual generated geometry', () => {
  const draw = (dials, seed = 7) => composeGeneric(genericInput({ seed, dials }));
  const settings = { rooms: 55, clusterSize: 40, cohesion: 0, branching: 0, turns: 100 };
  const short = draw({ ...settings, corridorLength: 0 }), long = draw({ ...settings, corridorLength: 100 });
  assert.ok(long.layout.metrics.routeLengthM > short.layout.metrics.routeLengthM * 2);
  const flat = draw({ ...settings, orientation: 0 }), angled = draw({ ...settings, orientation: 100 });
  assert.ok(flat.layout.clusters.every(c => c.headingDegrees % 90 === 0));
  assert.ok(angled.layout.clusters.some(c => c.headingDegrees % 90 !== 0));
  assert.ok(draw({ ...settings, branching: 100 }).layout.metrics.branchPoints > 0);
  const localSettings = { rooms: 0, clusterSize: 100, partitioned: 100, chains: 0, sideHalls: 0, chambers: 0 };
  assert.ok(draw({ ...localSettings, loops: 100 }).links.length > draw({ ...localSettings, loops: 0 }).links.length);
  const recipes = new Set(), headings = new Set(), shapes = new Set();
  for (let seed = 1; seed <= 9; ++seed) { const m = draw({}, seed); m.layout.clusters.forEach(c => { recipes.add(c.recipe); headings.add(c.headingDegrees); }); shapes.add(JSON.stringify(m.layout.routes)); }
  assert.equal(recipes.size, 4); assert.ok(headings.size >= 4); assert.equal(shapes.size, 9);
});

test('imports rebuild physical evidence and reject altered apertures or wall solids', () => {
  const p = generateGenericDesign(small), loaded = importGenericDesign(JSON.parse(canonicalExport(p)));
  assert.equal(loaded.diagnostics.errors.length, 0); assert.deepEqual(loaded.spaces, p.spaces);
  const forgedReport = structuredClone(p); forgedReport.diagnostics.errors = []; forgedReport.openings[0].hosts[0].center[0] += 1;
  assert.throws(() => importGenericDesign(forgedReport), /PASSAGE|OPENING/);
  const movedWall = structuredClone(p); movedWall.wallBodies.pop();
  assert.throws(() => importGenericDesign(movedWall), /WALL_SOLID_MISMATCH/);
  assert.throws(() => generateGenericDesign({ seed: 1.5 }), /unsigned 32-bit/);
  assert.throws(() => generateGenericDesign({ seed: 0, dials: { scale: 101 } }), /whole number/);
});
