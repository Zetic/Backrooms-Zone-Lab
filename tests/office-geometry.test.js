import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOfficeDesign, officeTemplate } from '../src/offices.js';
import { validateArchitecture } from '../src/physical.js';
import { validateFootprint, ringContains, at, interiorsOverlap } from '../src/geometry.js';
import { buildMesh } from '../src/mesh.js';
import { canonicalExport } from '../src/zone.js';
import { officeSvg } from '../src/office-render.js';
const reference = () => ({ seed: 1, dials: officeTemplate().presets.at(-1).dials });

test('actual angled departments, clear floors, wall bodies and port thresholds validate and reproduce', () => {
  const p = generateOfficeDesign(reference()), again = generateOfficeDesign(reference());
  assert.equal(p.layout.sharedCore.length, 5); assert.ok(p.spaces.some(s => s.id === 'shared-boardroom'));
  assert.ok(p.layout.rectangularVariantDifferences.length);
  assert.equal(p.schemaVersion, 'br.zone/0.4'); assert.equal(p.layout.wingCount, 2);
  assert.equal(canonicalExport(p), canonicalExport(again)); assert.equal(p.diagnostics.navigation.reachable.length, p.spaces.length);
  assert.equal(p.diagnostics.navigation.returnable.length, p.spaces.length);
  assert.equal(validateArchitecture(p).errors.length, 0);
  const diagonal = p.spaces.find(s => s.id === 'wing-0-room-0-0').footprint.outer[0];
  assert.notEqual(diagonal.from[0], diagonal.to[0]); assert.notEqual(diagonal.from[1], diagonal.to[1]);
  assert.ok(p.wallBodies.length); assert.equal(p.geometryContract.wallThickness, .15);
  for (const b of p.wallBodies) {
    assert.equal(validateFootprint(b.footprint, { stableTangencies: true }).length, 0);
    for (const hole of b.footprint.holes) assert.equal(ringContains(b.footprint.outer, at(hole[0], 0)), 'inside');
  }
  const mesh = buildMesh(p, { scope: 'ground', lowWalls: true, ceilings: false });
  assert.ok(mesh.faces.length > 0); assert.ok(mesh.faces.every(f => f.points.flat().every(Number.isFinite)));
  const svg = officeSvg(p); assert.ok(svg.includes('<style>')); assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"')); assert.ok(svg.includes('Private office'));
});
test('each conventional wing count and the seven presets has actual outward and return walker paths', () => {
  for (const wings of [0, 20, 40, 60, 80, 100]) {
    const p = generateOfficeDesign({ seed: 7, dials: { size: 65, wings, open: 35, sprawl: 20, strange: 0 } }, { walls: false });
    assert.equal(p.layout.wingCount, 1 + wings / 20); assert.equal(p.diagnostics.navigation.returnable.length, p.spaces.length);
  }
  for (const preset of officeTemplate().presets) {
    const p = generateOfficeDesign({ seed: 1, dials: preset.dials }, { walls: false });
    assert.equal(p.diagnostics.errors.length, 0);
  }
});
test('physical validation rejects a moved required door and actual overlapping angled rooms', () => {
  const p = generateOfficeDesign(reference(), { walls: false }), moved = structuredClone(p);
  moved.openings[0].center[0] += 1;
  assert.ok(validateArchitecture(moved).errors.some(e => /OPENING/.test(e.code)));
  const overlap = structuredClone(p), a = overlap.spaces.find(s => s.id === 'wing-0-room-0-0'), b = overlap.spaces.find(s => s.id === 'wing-0-room-0-1');
  b.footprint = structuredClone(a.footprint); b.clearVolumes[0].footprint = structuredClone(a.footprint);
  assert.ok(interiorsOverlap(a.footprint, b.footprint)); assert.ok(validateArchitecture(overlap).errors.some(e => e.code === 'VOLUME_COLLISION'));
});
