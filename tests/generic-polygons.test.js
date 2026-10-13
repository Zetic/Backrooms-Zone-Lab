import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { generateGenericDesign, importGenericDesign } from '../src/generic.js';
import { genericTemplate, genericInput } from '../src/generic-template.js';
import { composeGeneric } from '../src/generic-layout.js';
import { boundaryNetwork, insetRegion, interiorAnchor, isConcave, corridorRegion } from '../src/polygon-regions.js';
import { polygon, validateFootprint, footprintSubset, interiorsOverlap, contains } from '../src/geometry.js';
import { validateArchitecture } from '../src/physical.js';
import { canonicalExport } from '../src/zone.js';
import { GenericRunner } from '../src/generic-runner.js';

const defaultPlan = generateGenericDesign({ seed: 1 });
test('shared jogs define two nonoverlapping concave rooms and one canonical partition network', () => {
  const A = polygon([[0,0],[4,0],[4,4],[6,4],[6,10],[0,10]]), B = polygon([[4,0],[10,0],[10,10],[6,10],[6,4],[4,4]]);
  assert.ok(isConcave(A) && isConcave(B)); assert.ok(!interiorsOverlap(A,B));
  const network = boundaryNetwork([{ id:'a', footprint:A },{ id:'b', footprint:B }]), shared = network.filter(b=>b.owners.length===2);
  assert.equal(shared.length,3); assert.equal(shared.reduce((s,b)=>s+b.length,0),12);
  for (const b of shared) assert.equal(b.owners[0].direction,-b.owners[1].direction);
  for (const region of [A,B]) {
    const clear = insetRegion(region,.075), envelope = insetRegion(clear,-.15);
    assert.deepEqual(validateFootprint(clear),[]); assert.deepEqual(validateFootprint(envelope),[]);
    assert.ok(footprintSubset(region,clear)); assert.ok(footprintSubset(envelope,clear));
    assert.equal(contains(clear, interiorAnchor(clear)), 'inside');
  }
});
test('one variable-width corridor owns its bends without connector or junction rooms', () => {
  const corridor = corridorRegion([[0,0],[5,0],[10,5],[15,5],[20,0],[25,0]],[2,2.5,3,3,2.5,2]);
  assert.ok(isConcave(corridor)); assert.deepEqual(validateFootprint(corridor),[]);
  const p=defaultPlan, halls=p.spaces.filter(s=>s.role==='circulation'); assert.equal(halls.length,1);
  assert.ok(isConcave(halls[0].footprint)); assert.ok(p.layout.cuts.some(c=>c.horizontal));
  assert.ok(p.layout.metrics.concaveRooms>=8); assert.ok(p.spaces.every(s=>s.footprint.outer.length>4));
  assert.ok(p.openings.some(o=>{const b=p.boundaries.find(b=>b.id===o.boundaryId), a=b.apertures.find(a=>a.openingId===o.id);return Math.abs((a.fromM+a.toM)/2-b.length/2)>.2;}));
  const allocations=p.layout.regions;
  for (const [i,a] of allocations.entries()) for (const b of allocations.slice(i+1)) assert.ok(!interiorsOverlap(a.footprint,b.footprint),a.id+'/'+b.id);
  assert.equal(p.diagnostics.navigation.returnable.length,p.spaces.length);
  assert.ok(p.layout.metrics.cycleRank>0); assert.equal(validateArchitecture(p).errors.length,0);
  for (const b of p.wallBodies) { assert.deepEqual(validateFootprint(b.footprint),[]); for(const s of p.spaces) assert.ok(!interiorsOverlap(b.footprint,s.footprint)); }
});
test('presets and width/count extremes retain the exact program and physical return paths', () => {
  const specs=[...genericTemplate.presets.map((preset,i)=>({seed:29+i,dials:preset.dials})),
    {seed:0,dials:{rooms:0,scale:0,variety:100,hallWidth:100,open:100,exits:100}},
    {seed:3,dials:{rooms:100,scale:0,variety:100,hallWidth:100,turns:100,open:100,exits:100}},
    {seed:4294967295,dials:{rooms:100,scale:100,variety:0,orientation:0,turns:0,loops:0}}];
  for (const spec of specs) {
    const p=generateGenericDesign(spec), D=p.input.config.dials;
    assert.equal(p.layout.metrics.roomCount,8+Math.floor(D.rooms*16/100)); assert.equal(p.externalPorts.length,1+Math.floor(D.exits*7/100));
    assert.equal(p.spaces.filter(s=>s.role==='service').length,Math.floor(p.layout.metrics.roomCount*D.supportMix/300));
    assert.ok(p.layout.attempt<4); assert.equal(p.diagnostics.errors.length,0); assert.equal(p.diagnostics.navigation.returnable.length,p.spaces.length);
    assert.ok(p.openings.every(o=>o.width>=.8));
    assert.equal(p.layout.metrics.cycleRank===0,D.loops===0);
    if (D.orientation===0) assert.ok(p.spaces.every(s=>s.footprint.outer.every(e=>Math.abs(e.to[0]-e.from[0])<1e-5 || Math.abs(e.to[1]-e.from[1])<1e-5)));
    if (D.open===100) assert.ok(p.openings.some(o=>o.height===p.input.config.floorHeight));
  }
});
test('seed replay and function changes retain geometry; old v2 exports replay exactly', async () => {
  assert.equal(canonicalExport(defaultPlan),canonicalExport(generateGenericDesign({seed:1})));
  const a=composeGeneric(genericInput({seed:7})),b=composeGeneric(genericInput({seed:7,dials:{publicMix:100,supportMix:100}}));
  assert.deepEqual(a.allocations.map(a=>a.footprint),b.allocations.map(a=>a.footprint));assert.deepEqual(a.links,b.links);
  const old=JSON.parse(gunzipSync(await readFile(new URL('../docs/generic-v2-examples/generic-7.zone.json.gz',import.meta.url))));
  assert.equal(canonicalExport(generateGenericDesign({generatorVersion:2,seed:7,dials:old.input.config.dials})),canonicalExport(old));
  assert.equal(importGenericDesign(old).input.generatorVersion,2);
});
test('import rebuilds polygon ownership, floor clearances, walls and physical evidence', () => {
  const loaded=importGenericDesign(JSON.parse(canonicalExport(defaultPlan))); assert.deepEqual(loaded.spaces,defaultPlan.spaces);assert.deepEqual(loaded.boundaries,defaultPlan.boundaries);
  const altered=mutate=>{const p=structuredClone(defaultPlan);mutate(p);return p;};
  assert.throws(()=>importGenericDesign(altered(p=>p.boundaries.find(b=>b.owners.length===2).owners.pop())),/network|ownership/);
  assert.throws(()=>importGenericDesign(altered(p=>p.layout.regions[0].footprint.outer[0].from[0]+=1)),/polygon|floor|Wall thickness/i);
  assert.throws(()=>importGenericDesign(altered(p=>p.openings[0].boundaryId='boundary-999')),/ownership/);
  assert.throws(()=>importGenericDesign(altered(p=>p.wallBodies.pop())),/WALL_SOLID_MISMATCH/);
  assert.throws(()=>importGenericDesign(altered(p=>p.walker.radius=.01)),/physical contract/);
  assert.throws(()=>generateGenericDesign({generatorVersion:99,seed:1}),/version/);
});
test('single-seed runner has no gallery operation', () => {
  const runner=new GenericRunner(undefined);assert.equal(runner.compare,undefined);
});
