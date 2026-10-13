import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { OfficeRunner } from '../src/office-runner.js';

// Execute the browser worker module itself, bridged to node:worker_threads.
class ModuleWorker {
  constructor(url) {
    this.worker = new Worker(`const { parentPort } = require('node:worker_threads'); globalThis.self = { postMessage: (data, transfer) => parentPort.postMessage(data, transfer) }; import(${JSON.stringify(url.href)}).then(() => parentPort.on('message', data => self.onmessage({ data })));`, { eval: true });
    this.worker.on('message', data => this.onmessage?.({ data }));
    this.worker.on('error', error => this.onerror?.({ message: error.message }));
  }
  postMessage(data) { this.worker.postMessage(data); }
  terminate() { this.worker.terminate(); }
}
const spec = seed => ({ seed, dials: { size: 40, wings: 0, rooms: 0, cohesion: 100, sprawl: 100, strange: 0, open: 35 } });
test('office generation and mesh preparation run off-thread, transfer valid buffers and cancel superseded jobs', async () => {
  const runner = new OfficeRunner(ModuleWorker); let ticks = 0;
  const timer = setInterval(() => ++ticks, 10);
  try {
    const old = runner.generate(spec(1), { angled: true, lowWalls: true });
    const cancelled = assert.rejects(old, { name: 'AbortError' });
    const current = runner.generate(spec(7), { angled: true, lowWalls: true });
    await cancelled;
    const result = await current;
    assert.ok(ticks > 2, 'The main event loop remains responsive while geometry runs.');
    assert.equal(result.plan.input.seed, '7'); assert.equal(result.plan.input.generatorVersion, 3);
    assert.ok(result.svg.includes('<svg')); assert.equal(result.rectangular.source.template, 'offices-v3');
    assert.equal(result.plan.diagnostics.errors.length, 0);
    assert.ok(result.prepared.vertices instanceof Float32Array); assert.ok(result.prepared.vertices.length > 0);
    assert.ok(result.prepared.vertices.every(Number.isFinite)); assert.equal(result.prepared.vertices.length % 12, 0);
    const tall = await runner.mesh(false); assert.equal(tall.lowWalls, false); assert.ok(tall.prepared.vertices.length);
    assert.ok(tall.prepared.vertices.every(Number.isFinite));
    await assert.rejects(runner.generate(spec(1.5), {}), /unsigned 32-bit integer/);
  } finally { clearInterval(timer); runner.cancel(); }
});
