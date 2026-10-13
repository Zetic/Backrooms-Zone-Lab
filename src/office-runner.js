import { createOfficeJob, officeViewOptions } from './office-job.js';
import { prepareViewerData } from './viewer-data.js';

export class OfficeRunner {
  constructor(WorkerClass = globalThis.Worker) { this.WorkerClass = WorkerClass; this.pending = new Map(); this.id = 0; }
  cancel() {
    this.worker?.terminate(); this.worker = null;
    for (const p of this.pending.values()) p.reject(Object.assign(new Error('Superseded office request.'), { name: 'AbortError' }));
    this.pending.clear();
  }
  generate(spec, options) {
    this.cancel();
    if (!this.WorkerClass) return Promise.resolve().then(() => { const result = createOfficeJob(spec, options); this.plan = result.plan; return result; });
    this.worker = new this.WorkerClass(new URL('./office-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id); if (!p) return;
      this.pending.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
    };
    this.worker.onerror = event => { for (const p of this.pending.values()) p.reject(new Error(event.message || 'Office worker failed to load.')); this.pending.clear(); };
    return this.request({ type: 'generate', spec, options });
  }
  mesh(lowWalls) {
    if (!this.WorkerClass) return Promise.resolve().then(() => ({ prepared: prepareViewerData(this.plan, officeViewOptions(lowWalls)), lowWalls }));
    return this.request({ type: 'mesh', lowWalls });
  }
  request(data) {
    return new Promise((resolve, reject) => { const id = ++this.id; this.pending.set(id, { resolve, reject }); this.worker.postMessage({ ...data, id }); });
  }
}
