import { generateGenericDesign, importGenericDesign } from './generic.js';
import { genericSvg } from './generic-render.js';
import { prepareViewerData } from './viewer-data.js';
export const genericViewOptions = lowWalls => ({ scope: 'ground', floorIndex: 0, lowWalls, ceilings: false, walls: true, guards: true });
export class GenericRunner {
  constructor(WorkerClass = globalThis.Worker) { this.WorkerClass = WorkerClass; this.pending = new Map(); this.id = 0; }
  cancel() {
    this.worker?.terminate(); this.worker = null;
    for (const p of this.pending.values()) p.reject(Object.assign(new Error('Superseded Generic request.'), { name: 'AbortError' }));
    this.pending.clear();
  }
  ensureWorker() {
    if (this.worker) return;
    this.worker = new this.WorkerClass(new URL('./generic-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => { const p = this.pending.get(data.id); if (!p) return; this.pending.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data.result); };
    this.worker.onerror = event => { this.cancelWithError(new Error(event.message || 'Generic worker failed to load.')); };
  }
  cancelWithError(error) { for (const p of this.pending.values()) p.reject(error); this.pending.clear(); this.worker?.terminate(); this.worker = null; }
  request(data) { this.ensureWorker(); return new Promise((resolve, reject) => { const id = ++this.id; this.pending.set(id, { resolve, reject }); this.worker.postMessage({ ...data, id }); }); }
  generate(spec) {
    this.cancel();
    if (this.WorkerClass) return this.request({ type: 'generate', spec });
    return Promise.resolve().then(() => { this.plan = generateGenericDesign(spec); return { plan: this.plan, svg: genericSvg(this.plan) }; });
  }
  import(raw) {
    this.cancel();
    if (this.WorkerClass) return this.request({ type: 'import', raw });
    return Promise.resolve().then(() => { this.plan = importGenericDesign(raw); return { plan: this.plan, svg: genericSvg(this.plan) }; });
  }
  mesh(lowWalls) {
    if (this.WorkerClass) return this.request({ type: 'mesh', lowWalls });
    return Promise.resolve().then(() => ({ prepared: prepareViewerData(this.plan, genericViewOptions(lowWalls)), lowWalls }));
  }
  compare(spec, seeds) {
    this.cancel();
    if (this.WorkerClass) return this.request({ type: 'compare', spec, seeds });
    return Promise.resolve().then(() => compareGeneric(spec, seeds));
  }
}
export function compareGeneric(spec, seeds) {
  if (!Array.isArray(seeds) || seeds.length > 9) throw new Error('Comparison is bounded to nine seeds.');
  return seeds.map(seed => {
    try { const plan = generateGenericDesign({ ...spec, seed }); return { seed, fingerprint: plan.fingerprint, metrics: plan.layout.metrics, svg: genericSvg(plan, { idPrefix: 'seed-' + seed }) }; }
    catch (error) { return { seed, error: error.message }; }
  });
}
