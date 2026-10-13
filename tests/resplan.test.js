import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { generateResPlanDesign, importResPlanDesign, resplanExport, selectResPlan, resplanCandidates, validateResPlanCatalog, validateResPlanRecord } from '../src/resplan-template.js';
import { ResPlanLibrary, decodeResPlanShard } from '../src/resplan-library.js';
import { resplanSvg } from '../src/resplan-render.js';
import { prepareResPlanPreview } from '../src/resplan-preview.js';
import { signedArea } from '../src/geometry.js';

const root = new URL('../data/resplan/', import.meta.url), catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
const shards = new Map(), records = new Map();
for (const file of new Set(catalog.plans.map(p => p.file))) {
  const text = await readFile(new URL(file, root), 'utf8'); shards.set(file, text);
  for (const record of JSON.parse(text).plans) records.set(record.id, record);
}
test('all 128 bundled ResPlan records load with original source IDs, features, calibration and provenance', () => {
  assert.equal(catalog.plans.length, 128); assert.equal(catalog.releasePlanCount, 17000); assert.equal(catalog.refused.length, 0);
  validateResPlanCatalog(catalog);
  for (const entry of catalog.plans) {
    assert.equal(createHash('sha256').update(shards.get(entry.file)).digest('hex'), entry.sha256);
    const record = records.get(entry.id), before = JSON.stringify(record), plan = generateResPlanDesign({ planId: entry.id }, catalog, record);
    assert.equal(plan.source.planId, entry.id); assert.equal(plan.spaces.length, entry.rooms); assert.equal(plan.source.license, 'CC BY 4.0');
    assert.equal(plan.features.length, record.features.length); assert.equal(plan.importDiagnostics.physicallyCompiled, false);
    assert.equal(JSON.stringify(record), before); assert.deepEqual(plan.sourceRecord, record);
    assert.ok(plan.spaces.every(s => Number.isFinite(s.usableFloor.areaM2) && s.usableFloor.areaM2 > 0));
    assert.ok(plan.features.every(f => f.footprint.outer.every(e => e.from.every(Number.isFinite))));
    assert.ok(!plan.localConnections && !plan.externalPorts, 'source annotations must not become invented movement connections');
  }
});
test('selection is seeded, order independent, varied, filterable and independent of presentation controls', () => {
  const reversed = { ...catalog, plans: [...catalog.plans].reverse() }, chosen = new Set();
  for (let seed = 0; seed < 500; seed++) {
    const selected = selectResPlan(catalog, { seed }); chosen.add(selected.id);
    assert.equal(selectResPlan(reversed, { seed }).id, selected.id);
    assert.equal(selectResPlan(catalog, { seed, scale: 2, rotation: 137, mirror: true, ceiling: 4 }).id, selected.id);
  }
  assert.ok(chosen.size > 110, 'many distinct real plans must be reachable');
  const options = { bedrooms: 3, minArea: 80, maxArea: 200 };
  assert.ok(resplanCandidates(catalog, options).length > 0);
  for (let seed = 0; seed < 100; seed++) {
    const p = selectResPlan(catalog, { seed, ...options }); assert.equal(p.bedrooms, 3); assert.ok(p.areaM2 >= 80 && p.areaM2 <= 200);
  }
  assert.throws(() => selectResPlan(catalog, { bedrooms: 32 }), /No floor plans/);
  assert.throws(() => selectResPlan(catalog, { planId: '9999999999' }), /unavailable/);
  assert.throws(() => selectResPlan(catalog, { seed: -1 }), /unsigned/);
});
test('concavity, holes and original coordinates survive rotation/reflection with uniform area scaling', () => {
  const rectangle = (x, y, w, h) => ({ outer: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]], holes: [] });
  const record = { id: '100', calibration: { method: 'test', metresPerSourceUnit: 1, sourceOrigin: [0,0], reportedArea: 200, sourceInnerArea: 200, displaySimplificationMetres: 0 }, features: [
    { id: 'bedroom:0', category: 'bedroom', anchor: [1,1], geometry: { outer: [[0,0],[8,0],[8,3],[4,3],[4,8],[0,8]], holes: [[[1,1],[2,1],[2,2],[1,2]]] } },
    { id: 'living:0', category: 'living', anchor: [11,1], geometry: rectangle(10,0,5,5) },
    { id: 'door:0', category: 'door', anchor: [8,1], geometry: rectangle(8,1,1,.2) },
    { id: 'window:0', category: 'window', anchor: [1,8], geometry: rectangle(1,8,1,.2) }
  ] };
  const c = { ...catalog, releasePlanCount: 1, plans: [{ id:'100',file:'plans-0000.json',sha256:'0'.repeat(64),bedrooms:1,rooms:2,areaM2:200 }] };
  const a = generateResPlanDesign({ seed: 7 }, c, record), b = generateResPlanDesign({ seed: 7, scale: 2, rotation: 137, mirror: true }, c, record);
  assert.equal(b.spaces[0].footprint.outer.length, 6); assert.equal(b.spaces[0].footprint.holes.length, 1);
  assert.ok(signedArea(b.spaces[0].footprint.outer) > 0); assert.ok(signedArea(b.spaces[0].footprint.holes[0]) < 0);
  assert.ok(Math.abs(b.spaces[0].usableFloor.areaM2 - a.spaces[0].usableFloor.areaM2 * 4) < .0001);
  assert.deepEqual(a.sourceRecord, b.sourceRecord); assert.equal(a.importDiagnostics.topologyIssues.length, 0); assert.equal(b.importDiagnostics.topologyIssues.length, 0);
  const mesh = prepareResPlanPreview(b); assert.ok(mesh.vertices.length > 0); assert.ok(mesh.vertices.every(Number.isFinite));
});
test('self-contained exports reopen from source; tampered preview and physical claims are discarded', () => {
  const record = records.get(selectResPlan(catalog, { seed: 7 }).id), plan = generateResPlanDesign({ seed: 7, rotation: 31, mirror: true }, catalog, record);
  const edited = JSON.parse(resplanExport(plan)); edited.spaces = []; edited.features = []; edited.importDiagnostics.physicallyCompiled = true;
  const reopened = importResPlanDesign(edited);
  assert.deepEqual(reopened.spaces, plan.spaces); assert.deepEqual(reopened.features, plan.features); assert.equal(reopened.fingerprint, plan.fingerprint);
  assert.equal(reopened.importDiagnostics.physicallyCompiled, false); assert.deepEqual(reopened.sourceRecord, plan.sourceRecord);
  const bad = structuredClone(edited); bad.source.planId = '999'; assert.throws(() => importResPlanDesign(bad), /disagrees/);
});
test('lazy URL and local-folder loading verifies shard hashes and rejects unsafe paths or records', async () => {
  const fetched = [], fetcher = async url => { fetched.push(url.href); const name = url.pathname.split('/').at(-1); return { ok: true, text: async () => name === 'catalog.json' ? JSON.stringify(catalog) : shards.get(name) }; };
  const library = await ResPlanLibrary.fromURL('https://example.test/lab/data/resplan/catalog.json', fetcher);
  assert.equal(fetched.length, 1);
  const record = await library.load({ seed: 7 }); assert.equal(record.id, selectResPlan(catalog, { seed: 7 }).id); assert.equal(fetched.length, 2);
  assert.ok(fetched[1].startsWith('https://example.test/lab/data/resplan/plans-'));
  await library.load({ seed: 7 }); assert.equal(fetched.length, 2);
  const entry = selectResPlan(catalog, { seed: 7 }); await assert.rejects(decodeResPlanShard(shards.get(entry.file) + ' ', entry), /SHA-256/);
  const files = [{ name: 'catalog.json', webkitRelativePath: 'collection/catalog.json', size: 1000, text: async () => JSON.stringify(catalog) },
    ...Array.from(shards, ([name,text]) => ({ name, webkitRelativePath: 'collection/' + name, size: text.length, text: async () => text }))];
  const local = await ResPlanLibrary.fromFiles(files); assert.equal((await local.load({ seed:7 })).id, record.id);
  const abort = new AbortController(); abort.abort(); await assert.rejects(local.load({ seed:7 }, abort.signal), { name: 'AbortError' });
  const bad = structuredClone(catalog); bad.plans[0].file = '../../secrets.json'; assert.throws(() => validateResPlanCatalog(bad), /shard path/);
  bad.plans[0].file = 'plans-0000.json'; bad.plans[0].id = bad.plans[1].id; assert.throws(() => validateResPlanCatalog(bad), /unique/);
  const invalid = structuredClone(record); invalid.features[0].geometry.outer[0][0] = Infinity; assert.throws(() => validateResPlanRecord(invalid), /finite/);
  invalid.features[0].geometry.outer = Array(8193).fill([0,0]); assert.throws(() => validateResPlanRecord(invalid), /8192/);
});
test('SVG exports preserve source openings, geometry and visible/embedded attribution', () => {
  const record = records.get('916232'), plan = generateResPlanDesign({ planId: record.id }, catalog, record), svg = resplanSvg(plan);
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/); assert.match(svg, /CC BY 4.0/); assert.match(svg, /<metadata>/); assert.match(svg, /estimated m/);
  assert.equal((svg.match(/data-space=/g) ?? []).length, plan.spaces.length);
  assert.match(svg, /feature door/); assert.match(svg, /feature window/); assert.ok(plan.spaces.some(s => s.footprint.outer.length > 4));
  const mesh = prepareResPlanPreview(plan, false); assert.ok(mesh.vertices.every(Number.isFinite)); assert.ok(mesh.vertices.length > 0);
});
