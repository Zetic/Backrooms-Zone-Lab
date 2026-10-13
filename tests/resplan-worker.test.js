import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { ResPlanRunner } from '../src/resplan-runner.js';
import { selectResPlan } from '../src/resplan-template.js';
const root = new URL('../data/resplan/', import.meta.url), catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
class ModuleWorker {
  constructor(url) {
    this.worker = new Worker(`const {parentPort}=require('node:worker_threads'); globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)}; import(${JSON.stringify(url.href)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`, { eval: true });
    this.worker.on('message', data => this.onmessage?.({ data })); this.worker.on('error', error => this.onerror?.({ message: error.message }));
  }
  postMessage(data) { this.worker.postMessage(data); }
  terminate() { this.worker.terminate(); }
}
test('actual ResPlan worker cancels stale loads and transfers finite cutaway/full-height previews', async () => {
  const entry = selectResPlan(catalog, { seed:7 }), record = JSON.parse(await readFile(new URL(entry.file, root), 'utf8')).plans.find(p => p.id === entry.id);
  const runner = new ResPlanRunner(ModuleWorker); let ticks = 0; const timer = setInterval(() => ++ticks, 5);
  try {
    const stale = runner.generate({ seed: 7 }, catalog, record), cancelled = assert.rejects(stale, { name:'AbortError' });
    const latest = runner.generate({ seed: 7, rotation: 45 }, catalog, record); await cancelled; const result = await latest;
    assert.equal(result.plan.input.rotation, 45); assert.ok(ticks > 1); assert.equal(result.plan.importDiagnostics.physicallyCompiled, false);
    const cut = await runner.mesh(true), full = await runner.mesh(false);
    assert.ok(cut.prepared.vertices.length > 0); assert.ok(full.prepared.vertices.every(Number.isFinite)); assert.ok(full.prepared.vertices.length > cut.prepared.vertices.length);
    const imported = await runner.import(result.plan); assert.equal(imported.plan.fingerprint, result.plan.fingerprint);
    await assert.rejects(runner.generate({ seed:-1 }, catalog, record), /unsigned/);
  } finally { clearInterval(timer); runner.cancel(); }
});
