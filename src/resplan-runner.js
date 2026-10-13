import { generateResPlanDesign, importResPlanDesign } from './resplan-template.js';
import { resplanSvg } from './resplan-render.js';
import { prepareResPlanPreview } from './resplan-preview.js';

export class ResPlanRunner {
  constructor(WorkerClass = globalThis.Worker) { this.WorkerClass = WorkerClass; this.pending = new Map(); this.id = 0; }
  cancel() { this.fail(Object.assign(new Error('Superseded ResPlan request.'), { name: 'AbortError' })); }
  fail(error) { this.worker?.terminate(); this.worker = null; for (const p of this.pending.values()) p.reject(error); this.pending.clear(); this.plan = null; }
  request(data) {
    if (!this.worker) {
      this.worker = new this.WorkerClass(new URL('./resplan-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => { const p = this.pending.get(data.id); if (!p) return; this.pending.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data.result); };
      this.worker.onerror = e => this.fail(new Error(e.message || 'ResPlan worker failed to load.'));
    }
    return new Promise((resolve, reject) => { const id = ++this.id; this.pending.set(id, { resolve, reject }); this.worker.postMessage({ ...data, id }); });
  }
  generate(spec, catalog, record) {
    this.cancel();
    if (this.WorkerClass) return this.request({ type: 'generate', spec, catalog, record });
    return Promise.resolve().then(() => { this.plan = generateResPlanDesign(spec, catalog, record); return { plan: this.plan, svg: resplanSvg(this.plan) }; });
  }
  import(raw) {
    this.cancel();
    if (this.WorkerClass) return this.request({ type: 'import', raw });
    return Promise.resolve().then(() => { this.plan = importResPlanDesign(raw); return { plan: this.plan, svg: resplanSvg(this.plan) }; });
  }
  mesh(lowWalls) {
    if (this.WorkerClass) return this.request({ type: 'mesh', lowWalls });
    return Promise.resolve().then(() => ({ prepared: prepareResPlanPreview(this.plan, lowWalls) }));
  }
}
