import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSolidHouse,validateSolidHouse,normalizeSolidHouseInput} from '../src/solid-house.js';
import {differenceUnion,outerEnvelope} from '../src/solid-geometry.js';
import {rectangle,transform,contains,validateFootprint,intersections,line,arc} from '../src/geometry.js';
import {floorArea} from '../src/walls.js';
import {canonicalExport} from '../src/zone.js';
import {buildMesh} from '../src/mesh.js';
const sample=generateSolidHouse({profile:'gallery-house',seed:'3'});
test('solid houses reserve actual clear floors and replay independent wall/navigation validation',()=>{
  assert.equal(sample.schemaVersion,'br.zone/0.4');assert.equal(sample.input.generatorVersion,4);assert.deepEqual(sample.diagnostics.errors,[]);assert.deepEqual(validateSolidHouse(sample),sample.diagnostics);
  assert.ok(sample.wallBodies.length>0);assert.equal(sample.geometryContract.roomFootprint,'clear-usable-floor');
  for(const port of sample.externalPorts)assert.deepEqual(port.anchor.position,sample.passages.find(p=>p.openingId===port.openingId).to);
  for(const s of sample.spaces){assert.equal(s.usableFloor.areaM2,floorArea(s.footprint));assert.equal(s.usableFloor.surfaceId,`floor:${s.id}`);}
});
test('thicker walls preserve the allocated room floor areas instead of shrinking rooms',()=>{
  const thin=generateSolidHouse({profile:'atrium-mansion',seed:'2',config:{wallThickness:.1}}),thick=generateSolidHouse({profile:'atrium-mansion',seed:'2',config:{wallThickness:.4}});
  assert.deepEqual(thin.diagnostics.errors,[]);assert.deepEqual(thick.diagnostics.errors,[]);
  for(const s of thin.spaces)assert.ok(thick.spaces.find(t=>t.id===s.id).usableFloor.areaM2>=s.usableFloor.areaM2-1e-5,s.id);
  assert.notEqual(thin.fingerprint,thick.fingerprint);
});
test('exact curved wall envelopes and joined wall union exclude clear rooms',()=>{
  const a=rectangle(4,4),b=transform(rectangle(4,4),[4.2,0],0),bodies=differenceUnion([outerEnvelope(a,.2),outerEnvelope(b,.2)],[a,b]);
  assert.equal(bodies.length,1);assert.equal(bodies[0].holes.length,2);assert.deepEqual(validateFootprint(bodies[0]),[]);
  assert.equal(contains(bodies[0],[4.1,2]),'inside');assert.equal(contains(bodies[0],[2,2]),'outside');assert.ok(bodies[0].outer.some(e=>e.kind==='arc'));
});
test('quantized line/arc tangent joins do not create artificial double intersections',()=>{
  const e=arc([18.952002,17.483467],.2,11.085874,98.643935),l=line([18.884485,17.671726],[13.041627,15.576252]);
  const hit=intersections(e,l,true);assert.equal(hit.points.length,1);assert.ok(Math.hypot(hit.points[0][0]-l.from[0],hit.points[0][1]-l.from[1])<1e-5);
});
test('unsupported thickness, false floor-area claims and unsupported passage slabs fail',()=>{
  for(const wallThickness of [0,.05,.5,NaN])assert.throws(()=>normalizeSolidHouseInput({config:{wallThickness}}));
  const area=structuredClone(sample);area.spaces[0].usableFloor.areaM2+=1;assert.ok(validateSolidHouse(area).errors.some(e=>e.code==='USABLE_FLOOR_MISMATCH'));
  const door=structuredClone(sample);door.passages[0].floor.elevation+=.15;const d=validateSolidHouse(door);assert.ok(d.errors.some(e=>e.code==='PASSAGE_INVALID'));assert.ok(!d.navigation.connections.some(c=>c.geometryId===door.passages[0].openingId));
});
test('wall geometry and room-side finish corruption cannot retain a valid report',()=>{
  const moved=structuredClone(sample);moved.wallBodies[0].minZ+=.1;assert.ok(validateSolidHouse(moved).errors.some(e=>e.code==='WALL_SOLID_MISMATCH'));
  const finish=structuredClone(sample),side=finish.wallBodies.flatMap(b=>b.sides).find(s=>s.spaceId);side.materialId='finish:exterior';assert.ok(validateSolidHouse(finish).errors.some(e=>e.code==='WALL_SOLID_MISMATCH'));
});
test('wall rendering carries independent material/UV sides without duplicate wall triangles',()=>{
  const before=canonicalExport(sample),mesh=buildMesh(sample,{scope:'all',lowWalls:false});
  const wallFaces=mesh.faces.filter(f=>f.category==='wall');assert.ok(new Set(wallFaces.map(f=>f.materialId)).size>3);assert.ok(wallFaces.every(f=>f.uv.length===3&&f.uv.flat().every(Number.isFinite)));
  const keys=wallFaces.map(f=>f.points.map(p=>p.map(v=>Math.round(v*1e5)).join(',')).sort().join('/'));assert.equal(new Set(keys).size,keys.length);
  assert.ok(mesh.faces.some(f=>f.category==='wall-cap'));assert.ok(mesh.faces.some(f=>f.category==='door-floor'));
  const selected=buildMesh(sample,{scope:'floor',floorIndex:1});assert.ok(selected.faces.filter(f=>f.category==='floor').every(f=>sample.spaces.find(s=>s.id===f.spaceId).floorIndex===1));assert.equal(canonicalExport(sample),before);
});
test('solid generation repeats and exhausted requests retain complete contracts',()=>{
  assert.equal(canonicalExport(generateSolidHouse(sample.input)),canonicalExport(sample));
  const input={...sample.input,config:{...sample.input.config,maxAttempts:1},portRequirements:[{...sample.input.portRequirements[0],width:20}]},failed=generateSolidHouse(input);
  assert.equal(failed.generation.status,'failed');assert.deepEqual(failed.input.portRequirements,input.portRequirements);assert.ok(failed.diagnostics.errors.some(e=>e.code==='GENERATION_EXHAUSTED'));
});

test('committed solid-wall examples repeat within generator version 4',async()=>{
  const {readFile}=await import('node:fs/promises');
  for(const name of ['solid-gallery-house-3','solid-atrium-mansion-2']){const stored=await readFile(new URL(`../docs/examples/${name}.json`,import.meta.url),'utf8');assert.equal(canonicalExport(generateSolidHouse(JSON.parse(stored).input)),stored);}
});

test('a wall moved into usable floor is rejected regardless of cached navigation',()=>{
  const damaged=structuredClone(sample),room=damaged.spaces.find(s=>s.id==='main:0');
  damaged.wallBodies[0].footprint=transform(rectangle(1,1),room.labelAnchor,damaged.layout.orientationDegrees);
  const report=validateSolidHouse(damaged);assert.ok(report.errors.some(e=>e.code==='WALL_IN_CLEAR_SPACE'));assert.ok(report.errors.some(e=>e.code==='WALL_SOLID_MISMATCH'));assert.equal(report.status,'invalid');
});
