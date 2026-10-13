import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { GenericRunner } from '../src/generic-runner.js';
class ModuleWorker {
  constructor(url) {
    this.worker = new Worker(`const {parentPort}=require('node:worker_threads'); globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)}; import(${JSON.stringify(url.href)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`, { eval: true });
    this.worker.on('message', data => this.onmessage?.({ data })); this.worker.on('error', error => this.onerror?.({ message: error.message }));
  }
  postMessage(data) { this.worker.postMessage(data); }
  terminate() { this.worker.terminate(); }
}
test('Generic worker cancels old settings and prepares the accepted full geometry off-thread', async () => {
  const runner = new GenericRunner(ModuleWorker), spec = seed => ({ seed, dials: { rooms: 0 } }); let ticks = 0;
  const timer = setInterval(() => ++ticks, 10);
  try {
    const stale = runner.generate(spec(1)), cancelled = assert.rejects(stale, { name: 'AbortError' }), latest = runner.generate(spec(7));
    await cancelled; const result = await latest;
    assert.equal(result.plan.input.seed, '7'); assert.equal(result.plan.diagnostics.errors.length, 0); assert.ok(ticks > 2);
    const mesh = await runner.mesh(true); assert.ok(mesh.prepared.vertices.length); assert.ok(mesh.prepared.vertices.every(Number.isFinite));
    const imported = await runner.import(result.plan); assert.deepEqual(imported.plan.spaces, result.plan.spaces);
    await assert.rejects(runner.generate(spec(-1)), /unsigned 32-bit/);
  } finally { clearInterval(timer); runner.cancel(); }
});
