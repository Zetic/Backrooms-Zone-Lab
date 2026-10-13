import { generateResPlanDesign, importResPlanDesign } from './resplan-template.js';
import { resplanSvg } from './resplan-render.js';
import { prepareResPlanPreview } from './resplan-preview.js';
let plan;
self.onmessage = ({ data }) => {
  try {
    let result;
    if (data.type === 'generate') { plan = generateResPlanDesign(data.spec, data.catalog, data.record); result = { plan, svg: resplanSvg(plan) }; }
    else if (data.type === 'import') { plan = importResPlanDesign(data.raw); result = { plan, svg: resplanSvg(plan) }; }
    else if (data.type === 'mesh' && plan) result = { prepared: prepareResPlanPreview(plan, data.lowWalls) };
    else throw new Error('No ResPlan floor plan is available.');
    self.postMessage({ id: data.id, result }, result.prepared ? [result.prepared.vertices.buffer, result.prepared.lines.buffer] : []);
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
