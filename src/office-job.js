import { generateOfficeDesign, officeTemplate } from './offices.js';
import { officeSvg } from './office-render.js';
import { prepareViewerData } from './viewer-data.js';

export const officeViewOptions = lowWalls => ({ scope: 'ground', floorIndex: 0, lowWalls, ceilings: false, walls: true, guards: true });
export function createOfficeJob(spec, { angled = true, lowWalls = true } = {}) {
  const plan = generateOfficeDesign(spec, { angled });
  const rectangular = officeTemplate().make(spec);
  if (rectangular.error) throw new Error(rectangular.error);
  if (angled) rectangular.notes += ' Full angled variant differences: central shared boardroom/focus cluster and actual rotated geometry are preserved in the separate br.zone export; they are not realized by these rectangles.';
  return { plan, rectangular, svg: officeSvg(plan, { navigation: false }), prepared: prepareViewerData(plan, officeViewOptions(lowWalls)), lowWalls };
}
