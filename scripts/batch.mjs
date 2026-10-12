import { performance } from 'node:perf_hooks';
import { generateStudy } from '../src/zone.js';
const count = Number(process.argv[2] ?? 200);
if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error('Batch count must be 1..10000 seeds per profile.');
const start = performance.now(), failures = [], totals = {};
for (const profile of ['angular', 'rotunda', 'gallery']) {
  const times = [];
  for (let seed = 0; seed < count; seed++) {
    const started = performance.now(), p = generateStudy({ profile, seed }); times.push(performance.now() - started);
    if (p.diagnostics.errors.length) failures.push({ profile, seed, errors: p.diagnostics.errors });
  }
  times.sort((a, b) => a - b);
  totals[profile] = { generated: count, medianMs: +times[Math.floor(count / 2)].toFixed(2), p95Ms: +times[Math.min(count - 1, Math.floor(count * .95))].toFixed(2), maxMs: +times.at(-1).toFixed(2) };
}
console.log(JSON.stringify({ scope: 'geometry studies, not procedural houses', elapsedMs: +(performance.now() - start).toFixed(2), profiles: totals, failures }, null, 2));
if (failures.length) process.exitCode = 1;
