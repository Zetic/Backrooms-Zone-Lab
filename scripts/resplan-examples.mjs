import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { generateResPlanDesign } from '../src/resplan-template.js';
import { resplanSvg } from '../src/resplan-render.js';
const root = new URL('../data/resplan/', import.meta.url), output = new URL('../docs/resplan-examples/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8')), records = [];
for (const file of new Set(catalog.plans.map(p => p.file))) records.push(...JSON.parse(await readFile(new URL(file, root), 'utf8')).plans);
await mkdir(output, { recursive: true });
const chosen = [0, 16, 32, 48, 64, 80, 96, 112, 127].map(i => records.find(r => r.id === catalog.plans[i].id));
const plans = chosen.map(record => generateResPlanDesign({ planId: record.id }, catalog, record));
const cards = plans.map((plan, i) => {
  const svg = resplanSvg(plan, { labels: false }).replace('<svg ', `<svg x="${i % 3 * 420}" y="${Math.floor(i / 3) * 365 + 32}" width="410" height="315" `);
  return `<text x="${i % 3 * 420 + 12}" y="${Math.floor(i / 3) * 365 + 22}" fill="#eedcaf" font-family="system-ui,sans-serif" font-size="14">Plan ${plan.source.planId} · ${plan.selection.rooms} spaces · ${plan.selection.bedrooms} bedrooms</text>${svg}`;
}).join('');
await writeFile(new URL('nine-plans.svg', output), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1260 1095"><rect width="1260" height="1095" fill="#151f24"/>${cards}</svg>\n`);
await writeFile(new URL('manifest.json', output), JSON.stringify({ source: catalog.source, plans: plans.map(p => ({ id: p.source.planId, rooms: p.selection.rooms, bedrooms: p.selection.bedrooms, estimatedAreaM2: p.selection.areaM2, fingerprint: p.fingerprint })) }, null, 2) + '\n');
console.log('ResPlan nine-source gallery written to docs/resplan-examples/');
