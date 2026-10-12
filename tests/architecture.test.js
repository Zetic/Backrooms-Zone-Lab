import test from 'node:test';
import assert from 'node:assert/strict';
import { generateArchitecture, deriveWalls, deriveGuards, normalizeArchitectureInput } from '../src/architecture.js';
import { validateArchitecture } from '../src/physical.js';
import { defaultPorts, canonicalExport } from '../src/zone.js';
import { fingerprint } from '../src/determinism.js';
import { rectangle, transform, signedArea, contains } from '../src/geometry.js';
import { localWalkPaths, walkSegmentFits } from '../src/navigation.js';
import { triangulate, buildMesh, cameraMatrix } from '../src/mesh.js';
import { floorSvg } from '../src/render.js';
import { readFile } from 'node:fs/promises';

const sample = generateArchitecture();
const copy = () => structuredClone(sample);
const has = (plan, code) => validateArchitecture(plan).errors.some(e => e.code === code);

test('three-storey reference has physically derived reachability, returnability, and a loop', () => {
  const d = sample.diagnostics;
  assert.equal(d.status, 'architecture-valid'); assert.deepEqual(d.errors, []);
  assert.equal(sample.kind, 'architecture-reference'); assert.equal(sample.schemaVersion, 'br.zone/0.2');
  assert.equal(d.metrics.floors, 3); assert.equal(d.metrics.spaces, 17); assert.equal(d.metrics.stairs, 2);
  assert.equal(d.metrics.cycleRank, 1); assert.equal(d.navigation.reachable.length, 17); assert.equal(d.navigation.returnable.length, 17);
  assert.equal(d.navigation.arrivalSpaceId, 'foyer');
  assert.deepEqual(sample.localConnections, d.navigation.connections);
  assert.ok(sample.spaces.find(s => s.id === 'lounge').footprint.outer.some(e => e.kind === 'arc'));
  assert.equal(sample.spaces.find(s => s.id === 'gallery').footprint.holes.length, 1);
  assert.equal(sample.spaces.find(s => s.id === 'foyer').clearVolumes.length, 2);
});

test('floor rises fit real stair treads, shafts and landings across supported configurations', () => {
  for (const floorHeight of [2.8, 2.9, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6]) {
    const p = generateArchitecture({ seed: String(floorHeight), config: { floorHeight } });
    assert.deepEqual(p.diagnostics.errors, [], `${floorHeight}`);
    for (const s of p.verticalTraversals) {
      assert.equal(s.treads.length, s.riserCount); assert.equal(s.landings.length, 2);
      assert.ok(s.riserHeight <= .2); assert.ok(s.treadDepth >= .26); assert.ok(s.width >= 1);
      assert.equal(s.target.position[2] - s.source.position[2], floorHeight);
    }
  }
});

test('reference architecture repeats deterministically and declares fixed topology', () => {
  const a = generateArchitecture({ seed: 'fixed' }), b = generateArchitecture({ seed: 'fixed', portRequirements: defaultPorts().reverse() });
  assert.equal(canonicalExport(a), canonicalExport(b));
  assert.notEqual(a.fingerprint, sample.fingerprint);
  assert.deepEqual(a.spaces, sample.spaces); // Explicitly a reference, not a procedural recipe.
  const data = copy(), expected = data.fingerprint; delete data.fingerprint;
  assert.equal(fingerprint(data), expected);
  assert.ok(a.diagnostics.warnings.some(w => w.code === 'REFERENCE_LAYOUT'));
});

test('contracts may occur on the third floor and roles do not prescribe direction', () => {
  const ports = defaultPorts(); ports[2].floorIndex = 2; ports[1].direction = 'exit-only';
  const p = generateArchitecture({ portRequirements: ports });
  assert.deepEqual(p.diagnostics.errors, []);
  assert.ok(p.externalPorts.some(port => port.floorIndex === 2));
  assert.equal(p.externalPorts.find(port => port.portId === 'port-secondary').direction, 'exit-only');
});

test('unsupported profiles, dimensions, floors and contracts fail explicitly', () => {
  for (const input of [{ profile: 'hotel' }, { generatorVersion: 1 }, { config: { floorHeight: 4 } }, { portRequirements: [{ ...defaultPorts()[0], floorIndex: 3 }] }, { portRequirements: [{ ...defaultPorts()[0], family: 'hatch' }] }]) assert.throws(() => normalizeArchitectureInput(input));
  const p = generateArchitecture({ portRequirements: [{ ...defaultPorts()[0], width: 20 }] });
  assert.equal(p.diagnostics.status, 'invalid'); assert.ok(p.diagnostics.errors.some(e => e.code === 'PORT_UNREALIZED'));
  assert.equal(p.input.portRequirements[0].width, 20);
  const small = generateArchitecture({ portRequirements: [{ ...defaultPorts()[0], width: .2 }] });
  assert.ok(small.diagnostics.errors.some(e => e.code === 'OPENING_INVALID'));
});

test('missing physical aperture breaks access even if the intended graph still claims it', () => {
  const p = copy(); p.openings = p.openings.filter(o => o.id !== 'door:kitchen:winter-garden');
  const d = validateArchitecture(p);
  assert.ok(d.errors.some(e => e.code === 'SPACE_UNREACHABLE' && e.entityId === 'winter-garden'));
  assert.ok(d.errors.some(e => e.code === 'CONNECTION_CACHE_MISMATCH'));
  assert.ok(d.errors.some(e => e.code === 'WALL_GEOMETRY_MISMATCH'));
});

test('false graph edges cannot repair a blocked room', () => {
  const p = copy(); p.openings.find(o => o.id === 'door:kitchen:winter-garden').center[0] += 3;
  p.localConnections.push({ id: 'fake', kind: 'opening', geometryId: 'nonexistent', from: 'foyer', to: 'winter-garden', direction: 'reversible' });
  assert.ok(has(p, 'OPENING_HOST_INVALID')); assert.ok(has(p, 'SPACE_UNREACHABLE')); assert.ok(has(p, 'CONNECTION_CACHE_MISMATCH'));
});

test('wall aperture omission and inconsistent height block the actual transition', () => {
  const p = copy(), door = p.openings.find(o => o.id === 'door:kitchen:winter-garden');
  p.walls.find(w => w.spaceId === 'kitchen' && w.openingIds.includes(door.id)).openingIds = [];
  assert.ok(has(p, 'OPENING_BLOCKED')); assert.ok(has(p, 'SPACE_UNREACHABLE'));
  const q = copy(); q.openings.find(o => o.id === door.id).height = 10;
  assert.ok(has(q, 'OPENING_CLEARANCE_INVALID'));
});

test('missing stair disconnects upper floors despite cached connections', () => {
  const p = copy(); p.verticalTraversals.shift();
  assert.ok(has(p, 'SPACE_UNREACHABLE')); assert.ok(has(p, 'CONNECTION_CACHE_MISMATCH'));
});

test('one-way ascent preserves outgoing reachability but fails required backtracking', () => {
  const p = copy(); p.verticalTraversals[0].direction = 'forward-only';
  const d = validateArchitecture(p);
  assert.equal(d.navigation.unreachable.length, 0);
  assert.ok(d.navigation.noReturnPath.includes('gallery'));
  assert.ok(d.errors.some(e => e.code === 'RETURN_PATH_MISSING'));
});

test('floating/narrow landings, altered endpoints, low headroom and missing treads fail', () => {
  const changes = [
    [p => { p.verticalTraversals[0].landings[1].elevation += .3; }, 'STAIR_LANDING_INVALID'],
    [p => { p.verticalTraversals[0].landings[0].footprint = rectangle(.5, .5); }, 'STAIR_LANDING_INVALID'],
    [p => { p.verticalTraversals[0].target.position[2] += 1; }, 'STAIR_ENDPOINT_INVALID'],
    [p => { p.verticalTraversals[0].headroom = 1; }, 'STAIR_DIMENSIONS_INVALID'],
    [p => { p.verticalTraversals[0].treads.pop(); }, 'STAIR_GEOMETRY_INVALID'],
    [p => { p.verticalTraversals[0].treads[3].elevation += .2; }, 'STAIR_GEOMETRY_INVALID']
  ];
  for (const [damage, code] of changes) { const p = copy(); damage(p); assert.ok(has(p, code), code); }
});

test('filled stair shaft blocks headroom and cannot masquerade as valid navigation', () => {
  const p = copy(); p.surfaces.find(s => s.id === 'floor:stair-core:1').footprint.holes = [];
  assert.ok(has(p, 'STAIR_HEADROOM_BLOCKED')); assert.ok(has(p, 'VOID_FILLED')); assert.ok(has(p, 'FLOOR_INVALID'));
});

test('filled gallery void, removed protection and missing edge guards fail', () => {
  const a = copy(); a.surfaces.find(s => s.id === 'floor:gallery').footprint.holes = [];
  assert.ok(has(a, 'VOID_FILLED')); assert.ok(has(a, 'SURFACE_IN_CLEAR_VOLUME'));
  const b = copy(); b.protectedVoids = b.protectedVoids.filter(v => v.id !== 'void:foyer');
  assert.ok(has(b, 'VOID_MISSING'));
  const c = copy(); c.guards = c.guards.filter(g => !g.id.startsWith('guard:floor:gallery'));
  assert.ok(has(c, 'GUARD_INVALID'));
});

test('damaged clear volume, ceiling, port frame and declared walker fail', () => {
  const a = copy(); a.spaces.find(s => s.id === 'kitchen').clearVolumes[0].footprint = rectangle(1, 1);
  assert.ok(has(a, 'VOLUME_INVALID'));
  const b = copy(); b.surfaces = b.surfaces.filter(s => !(s.kind === 'ceiling' && s.spaceId === 'lounge'));
  assert.ok(has(b, 'CEILING_MISSING'));
  const c = copy(); c.externalPorts[0].anchor.forward[0] += .5;
  assert.ok(has(c, 'PORT_FRAME_INVALID'));
  const d = copy(); d.walker.radius = .01;
  assert.ok(has(d, 'WALKER_CONTRACT_INVALID'));
});

test('walker witnesses go around the gallery hole and reject a narrow passage', () => {
  const gallery = sample.spaces.find(s => s.id === 'gallery');
  assert.equal(walkSegmentFits(gallery.footprint, [1, 4], [7, 4]), false);
  const result = localWalkPaths(gallery.footprint, [{ id: 'west', position: [1, 4] }, { id: 'east', position: [7, 4] }]);
  assert.equal(result.valid, true); assert.ok(result.paths[1].points.length > 2);
  const narrow = rectangle(.5, 10);
  assert.equal(localWalkPaths(narrow, [{ id: 'a', position: [.25, 1] }, { id: 'b', position: [.25, 9] }]).valid, false);
});

test('renderer triangulates slab holes without filling them', () => {
  const gallery = sample.spaces.find(s => s.id === 'gallery'), triangles = triangulate(gallery.footprint);
  const area = triangles.reduce((sum, [a, b, c]) => sum + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2, 0);
  assert.equal(area, 48);
  for (const tri of triangles) {
    const center = [0, 1].map(i => tri.reduce((n, p) => n + p[i] / 3, 0));
    assert.notEqual(contains(gallery.footprint, center), 'outside');
  }
});

test('3D and floor inspection retain physical treads, apertures, guards and plan identity', () => {
  const before = canonicalExport(sample), mesh = buildMesh(sample, { scope: 'all', lowWalls: false, ceilings: true, guards: true, navigation: true });
  for (const category of ['floor', 'ceiling', 'wall', 'stair', 'guard']) assert.ok(mesh.faces.some(f => f.category === category), category);
  const topOnly = buildMesh(sample, { scope: 'top' });
  assert.ok(!topOnly.faces.some(f => f.category === 'floor' && f.spaceId === 'foyer'));
  assert.ok(mesh.lines.length > 0);
  const svg = floorSvg(sample, 1, { labels: true, navigation: true, voids: true });
  assert.ok(svg.includes('stair-tread')); assert.ok(svg.includes('nav-path')); assert.ok(svg.includes('guard-line'));
  assert.equal(canonicalExport(sample), before);
  assert.ok(cameraMatrix({ yaw: .5, pitch: .8, target: [0, 0, 0], extent: 10, zoom: 1 }, 2).every(Number.isFinite));
});

test('wall and guard derivation is independent of diagnostic flags', () => {
  const p = copy(); p.diagnostics = { status: 'invalid' };
  assert.deepEqual(deriveWalls(p), sample.walls); assert.deepEqual(deriveGuards(p), sample.guards);
  assert.deepEqual(validateArchitecture(p).errors, []);
});

test('committed Phase 2 reference plan repeats within generator version 2', async () => {
  const stored = await readFile(new URL('../docs/examples/reference-house.json', import.meta.url), 'utf8');
  assert.equal(canonicalExport(generateArchitecture(JSON.parse(stored).input)), stored);
});
