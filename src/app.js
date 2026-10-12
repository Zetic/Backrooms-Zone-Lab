import { generateStudy, defaultPorts, PROFILES, canonicalExport } from './zone.js';
import { fingerprint } from './determinism.js';
import { signedArea, q } from './geometry.js';
import { floorSvg, escapeHtml as esc } from './render.js';

const $ = id => document.getElementById(id);
let plan, requirements = defaultPorts(), selected = 'study-gallery', toastTimer;
const query = new URLSearchParams(location.search);
if (query.has('seed')) $('seed').value = query.get('seed');
if (Object.hasOwn(PROFILES, query.get('profile'))) $('profile').value = query.get('profile');
if (query.has('height')) $('floor-height').value = query.get('height');
let startupError;
try { if (query.has('ports')) requirements = JSON.parse(query.get('ports')); } catch { startupError = 'Shared URL contains malformed port JSON. Default contracts are shown.'; }

function options() { return { selected, labels: $('show-labels').checked, clearance: $('show-clearance').checked, vertices: $('show-vertices').checked, voids: $('show-voids').checked }; }
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000); }
function renderFloors() {
  if (!plan) return;
  const filter = $('floor-filter').value;
  $('floor-plans').innerHTML = plan.floors.filter(f => filter === 'all' || String(f.index) === filter).map(f => `<section class="floor-card"><div class="floor-heading"><b>${f.index === 0 ? '01 / GROUND FLOOR' : '02 / UPPER FLOOR'}</b><span>Z +${f.elevation.toFixed(2)} m · ${plan.spaces.filter(s => s.floorIndex === f.index).length} spaces · 1 m grid</span></div>${floorSvg(plan, f.index, options())}</section>`).join('');
  for (const node of document.querySelectorAll('[data-space]')) {
    const select = () => { selected = node.dataset.space; renderFloors(); renderSelection(); };
    node.addEventListener('click', select);
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
  }
}
function renderSelection() {
  const space = plan?.spaces.find(s => s.id === selected);
  if (!space) { $('selection').innerHTML = '<p class="muted">Select a footprint to inspect its geometry.</p>'; return; }
  const edges = [space.footprint.outer, ...space.footprint.holes].flat();
  const area = signedArea(space.footprint.outer) + space.footprint.holes.reduce((n, h) => n + signedArea(h), 0);
  $('selection').innerHTML = `<h3>${esc(space.label)}</h3><div class="mono">${esc(space.id)}</div><dl><dt>Floor</dt><dd>${space.floorIndex + 1}</dd><dt>Elevation / clear height</dt><dd>${space.elevation} / ${space.clearHeight} m</dd><dt>Net footprint</dt><dd>${q(area).toFixed(2)} m²</dd><dt>Lines / exact arcs</dt><dd>${edges.filter(e => e.kind === 'line').length} / ${edges.filter(e => e.kind === 'arc').length}</dd><dt>Interior holes</dt><dd>${space.footprint.holes.length}</dd></dl><details><summary>Canonical footprint</summary><pre>${esc(JSON.stringify(space.footprint, null, 2))}</pre></details>`;
}
function render() {
  const d = plan.diagnostics;
  $('study-title').textContent = PROFILES[plan.input.profile].name;
  $('study-summary').textContent = PROFILES[plan.input.profile].summary;
  $('metrics').innerHTML = [[d.metrics.spaces, 'spaces'], [d.metrics.floors, 'floors'], [d.metrics.arcs, 'exact arcs'], [`${d.metrics.portsRealized}/${d.metrics.portsRequested}`, 'ports realized'], [d.metrics.netFootprintArea.toFixed(1), 'm² footprint']].map(([n, label]) => `<div class="metric"><strong>${n}</strong><span>${label}</span></div>`).join('');
  $('status').textContent = d.status === 'invalid' ? 'INVALID' : 'GEOMETRY VALID';
  $('status').classList.toggle('invalid', d.status === 'invalid');
  $('diagnostics').innerHTML = `<p class="notice">${d.errors.length ? `${d.errors.length} validation error(s).` : '<b>Footprints and local port clearances pass.</b>'}</p>${d.errors.map(e => `<p class="notice error"><strong>${esc(e.code)}</strong><br>${esc(e.entityId)}<br>${esc(e.message)}</p>`).join('')}<p class="notice warning">${esc(d.warnings[0].message)}</p><p class="muted">Whole-zone reachability: not evaluated.</p>`;
  $('fingerprint').textContent = plan.fingerprint;
  $('port-count').textContent = `${plan.externalPorts.length} / ${requirements.length}`;
  $('ports').innerHTML = requirements.map(r => {
    const p = plan.externalPorts.find(p => p.contractId === r.contractId);
    return `<div class="port-card"><div class="port-name"><span>${esc(r.portId)}</span><span class="port-role">${esc(r.role)}</span></div><p>Floor ${r.floorIndex + 1} · ${esc(r.direction)}<br>${r.width} × ${r.height} m · approach ${r.approachDepth} m</p><span class="mono">${p ? esc(p.owningSpaceId) : 'UNREALIZED'}</span></div>`;
  }).join('');
  $('contracts').value = JSON.stringify(requirements, null, 2);
  renderFloors(); renderSelection();
  const url = new URL(location.href);
  url.search = new URLSearchParams({ seed: plan.input.seed, profile: plan.input.profile, height: String(plan.input.config.floorHeight), ports: JSON.stringify(plan.input.portRequirements) }).toString();
  history.replaceState(null, '', url);
  $('export').disabled = false;
  $('export-report').disabled = false;
  $('copy-link').disabled = false;
}
function generate() {
  try {
    const candidate = generateStudy({ seed: $('seed').value, profile: $('profile').value, config: { floorHeight: Number($('floor-height').value) }, portRequirements: requirements });
    plan = candidate; requirements = structuredClone(plan.input.portRequirements);
    if (!plan.spaces.some(s => s.id === selected)) selected = plan.spaces[0].id;
    $('input-error').hidden = true;
    render();
  } catch (error) {
    $('input-error').textContent = error.message + (plan ? ' The previous study remains visible; export is disabled until a valid input is generated.' : '');
    $('input-error').hidden = false;
    $('export').disabled = true; $('export-report').disabled = true; $('copy-link').disabled = true;
  }
}
function download(name, data, type) {
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([data], { type }));
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('controls').addEventListener('submit', event => { event.preventDefault(); generate(); });
$('next-seed').addEventListener('click', () => { const seed = $('seed').value; $('seed').value = /^\d+$/.test(seed) ? (BigInt(seed) + 1n).toString() : fingerprint([seed, 'next']).slice(0, 10); generate(); });
$('floor-filter').addEventListener('change', renderFloors);
for (const id of ['show-labels', 'show-clearance', 'show-vertices', 'show-voids']) $(id).addEventListener('change', renderFloors);
$('apply-contracts').addEventListener('click', () => { try { const parsed = JSON.parse($('contracts').value); requirements = parsed; generate(); } catch { $('input-error').textContent = 'Contracts must be valid JSON. The previous study remains visible; export is disabled.'; $('input-error').hidden = false; $('export').disabled = true; $('export-report').disabled = true; $('copy-link').disabled = true; } });
$('export').addEventListener('click', () => download(`zone-study-${plan.fingerprint}.json`, canonicalExport(plan), 'application/json'));
$('export-report').addEventListener('click', () => download(`validation-${plan.fingerprint}.json`, JSON.stringify(plan.diagnostics, null, 2), 'application/json'));
$('copy-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('Reproducible link copied'); } catch { toast('Clipboard unavailable. Copy the browser address.'); } });
generate();
if (startupError) { $('input-error').textContent = startupError; $('input-error').hidden = false; }
