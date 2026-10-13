import { generateGenericDesign, importGenericDesign } from './generic.js';
import { genericSvg } from './generic-render.js';
import { compareGeneric, genericViewOptions } from './generic-runner.js';
import { prepareViewerData } from './viewer-data.js';
let plan;
self.onmessage = ({ data }) => {
  try {
    let result;
    if (data.type === 'generate') { plan = generateGenericDesign(data.spec); result = { plan, svg: genericSvg(plan) }; }
    else if (data.type === 'import') { plan = importGenericDesign(data.raw); result = { plan, svg: genericSvg(plan) }; }
    else if (data.type === 'compare') result = compareGeneric(data.spec, data.seeds);
    else if (data.type === 'mesh' && plan) result = { prepared: prepareViewerData(plan, genericViewOptions(data.lowWalls)), lowWalls: data.lowWalls };
    else throw new Error('No accepted Generic zone is available.');
    self.postMessage({ id: data.id, result }, result.prepared ? [result.prepared.vertices.buffer, result.prepared.lines.buffer] : []);
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
