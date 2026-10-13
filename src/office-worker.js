import { createOfficeJob, officeViewOptions } from './office-job.js';
import { prepareViewerData } from './viewer-data.js';
let plan;
self.onmessage = ({ data }) => {
  try {
    let result;
    if (data.type === 'generate') { result = createOfficeJob(data.spec, data.options); plan = result.plan; }
    else if (data.type === 'mesh' && plan) result = { prepared: prepareViewerData(plan, officeViewOptions(data.lowWalls)), lowWalls: data.lowWalls };
    else throw new Error('No accepted office is available.');
    self.postMessage({ id: data.id, result }, [result.prepared.vertices.buffer, result.prepared.lines.buffer]);
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
