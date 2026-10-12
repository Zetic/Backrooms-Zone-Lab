import { performance } from 'node:perf_hooks';
import { generateArchitecture } from '../src/architecture.js';
import { defaultPorts } from '../src/zone.js';
const failures = [], timings = [], cases = [];
for (const floorHeight of [2.8, 3.2, 3.6]) for (const upperFloor of [1, 2]) for (const primaryDirection of ['reversible', 'entrance-only']) {
  const ports = defaultPorts(); ports[2].floorIndex = upperFloor; ports[0].direction = primaryDirection;
  const start = performance.now(), plan = generateArchitecture({ config: { floorHeight }, portRequirements: ports });
  timings.push(performance.now() - start); cases.push({ floorHeight, upperFloor, primaryDirection });
  if (plan.diagnostics.errors.length) failures.push({ ...cases.at(-1), errors: plan.diagnostics.errors });
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({ scope: 'fixed reference topology; varied physical and port contracts', generated: cases.length, medianMs: +timings[Math.floor(timings.length / 2)].toFixed(2), maxMs: +timings.at(-1).toFixed(2), failures }, null, 2));
if (failures.length) process.exitCode = 1;
