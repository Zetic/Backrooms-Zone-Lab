import { performance } from 'node:perf_hooks';
import { generateHouse, HOUSE_PROFILES } from '../src/house.js';
import { defaultPorts } from '../src/zone.js';
import { fingerprint } from '../src/determinism.js';
const count = Number(process.argv[2] ?? 64);
if (!Number.isInteger(count) || count < 12 || count > 10000) throw new RangeError('Supply 12–10000 seeds per profile.');
const failures = [], timings = [], profiles = {}, configs = [];
function generate(input) {
  const start = performance.now(), plan = generateHouse(input); timings.push(performance.now() - start);
  if (plan.diagnostics.errors.length) failures.push({ input: plan.input, errors: plan.diagnostics.errors });
  return plan;
}
for (const profile of Object.keys(HOUSE_PROFILES)) {
  const plans = Array.from({ length: count }, (_, seed) => generate({ profile, seed }));
  const values = pick => [...new Set(plans.map(pick))].sort((a, b) => a - b);
  const report = {
    generated: plans.length,
    uniqueTopologies: new Set(plans.map(plan => fingerprint(plan.localConnections.map(c => [c.from, c.to, c.kind, c.direction])))).size,
    roomCounts: values(p => p.layout.program.length), spaceCounts: values(p => p.spaces.length),
    stairCounts: values(p => p.verticalTraversals.length), cycleRanks: values(p => p.diagnostics.metrics.cycleRank),
    galleryFloors: values(p => p.layout.signature.upperFloorIndex), orientations: values(p => p.layout.orientationDegrees),
    signatureShapes: [...new Set(plans.map(p => p.layout.signature.shape))].sort(),
    maximumAttempts: Math.max(...plans.map(p => p.generation.attemptsTried))
  };
  profiles[profile] = report;
  if (report.uniqueTopologies < 6 || report.spaceCounts.length < 4 || report.stairCounts.length < 2 || report.signatureShapes.length < 2 || !report.orientations.some(a => Math.abs(a) % 90)) failures.push({ profile, code: 'DIVERSITY_REGRESSION', report });
}
for (const profile of Object.keys(HOUSE_PROFILES)) for (const storeys of [2, 3]) for (const floorHeight of [2.6, 4.2]) {
  const ports = defaultPorts(); ports[2].floorIndex = storeys - 1; ports[0].direction = 'entrance-only';
  const input = { profile, seed: 'boundary', config: { storeys, floorHeight }, portRequirements: ports };
  const plan = generate(input); configs.push({ profile, storeys, floorHeight, status: plan.diagnostics.status });
}
// Expected failures are checked separately so missing or silently dropped requests cannot pass.
for (const input of [
  { seed: 'unsatisfiable', config: { maxAttempts: 1 }, portRequirements: [{ ...defaultPorts()[0], width: 20 }] },
  { seed: 'missing-floor', config: { storeys: 2, maxAttempts: 1 }, portRequirements: [{ ...defaultPorts()[0], floorIndex: 2 }] }
]) {
  const plan = generateHouse(input);
  if (plan.generation.status !== 'failed' || !plan.diagnostics.errors.some(e => e.code === 'PORT_UNREALIZED') || !plan.diagnostics.errors.some(e => e.code === 'GENERATION_EXHAUSTED') || plan.input.portRequirements.length !== input.portRequirements.length) failures.push({ input, code: 'FAILURE_CONTRACT_REGRESSION' });
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({ scope: 'procedural physical validation and transition-graph diversity; no browser/GPU claim', profiles, boundaryConfigurations: configs, expectedFailures: 2, medianMs: +timings[Math.floor(timings.length / 2)].toFixed(2), maxMs: +timings.at(-1).toFixed(2), failures }, null, 2));
if (failures.length) process.exitCode = 1;
