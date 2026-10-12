import { generateStudy, defaultPorts, PROFILES, canonicalExport } from './zone.js';
import { fingerprint } from './determinism.js';
import { signedArea, q } from './geometry.js';
import { floorSvg, escapeHtml as esc } from './render.js';
import { generateArchitecture, ARCHITECTURE_PROFILE } from './architecture.js';
import { Viewer3D } from './viewer3d.js';

const $ = id => document.getElementById(id);
let plan, requirements = defaultPorts(), selected = 'foyer', toastTimer, viewer;
const query = new URLSearchParams(location.search);
if (query.has('seed')) $('seed').value = query.get('seed');
if (query.get('profile') === 'reference-house' || Object.hasOwn(PROFILES, query.get('profile'))) $('profile').value = query.get('profile');
if (query.has('height')) $('floor-height').value = query.get('height');
let startupError;
try { if (query.has('ports')) requirements = JSON.parse(query.get('ports')); } catch { startupError = 'Shared URL contains malformed port JSON. Default contracts are shown.'; }

function options() { return { selected, labels: $('show-labels').checked, clearance: $('show-clearance').checked, vertices: $('show-vertices').checked, voids: $('show-voids').checked, navigation: $('show-navigation').checked }; }
function volumeOptions() { return { selected, scope: $('volume-scope').value, walls: $('volume-walls').checked, lowWalls: $('volume-low-walls').checked, ceilings: $('volume-ceilings').checked, guards: $('volume-guards').checked, navigation: $('show-navigation').checked }; }
function renderVolume(reset = false) {
  const enabled = plan?.kind === 'architecture-reference'; $('volume-view').hidden = !enabled;
  if (!enabled) return;
  try {
    if (!viewer) viewer = new Viewer3D($('volume-canvas'), id => { selected = id; renderFloors(); renderSelection(); renderVolume(); });
    viewer.update(plan, volumeOptions()); if (reset) viewer.reset();
    $('volume-error').hidden = true;
  } catch (error) { $('volume-error').textContent = error.message; $('volume-error').hidden = false; }
}
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000); }
function renderFloors() {
  if (!plan) return;
  const filter = $('floor-filter').value;
  $('floor-plans').innerHTML = plan.floors.filter(f => filter === 'all' || String(f.index) === filter).map(f => `<section class="floor-card"><div class="floor-heading"><b>${f.index + 1} / ${f.index === 0 ? 'GROUND FLOOR' : f.index === 1 ? 'UPPER / GALLERY FLOOR' : 'TOP FLOOR'}</b><span>Z +${f.elevation.toFixed(2)} m · ${plan.spaces.filter(s => s.floorIndex === f.index).length} spaces · 1 m grid</span></div>${floorSvg(plan, f.index, options())}</section>`).join('');
  for (const node of document.querySelectorAll('[data-space]')) {
    const select = () => { selected = node.dataset.space; renderFloors(); renderSelection(); renderVolume(); };
    node.addEventListener('click', select);
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
  }
}
function renderSelection() {
  const space = plan?.spaces.find(s => s.id === selected);
  if (!space) { $('selection').innerHTML = '<p class="muted">Select a footprint to inspect its geometry.</p>'; return; }
  const edges = [space.footprint.outer, ...space.footprint.holes].flat();
  const area = signedArea(space.footprint.outer) + space.footprint.holes.reduce((n, h) => n + signedArea(h), 0);
  const navigation = plan.diagnostics.navigation;
  $('selection').innerHTML = `<h3>${esc(space.label)}</h3><div class="mono">${esc(space.id)}</div><dl><dt>Floor</dt><dd>${space.floorIndex + 1}</dd><dt>Elevation / max clear height</dt><dd>${space.elevation} / ${space.clearHeight} m</dd><dt>Net floor area</dt><dd>${q(area).toFixed(2)} m²</dd><dt>Lines / exact arcs</dt><dd>${edges.filter(e => e.kind === 'line').length} / ${edges.filter(e => e.kind === 'arc').length}</dd><dt>Interior holes</dt><dd>${space.footprint.holes.length}</dd>${navigation ? `<dt>Arrival / return path</dt><dd>${navigation.reachable.includes(space.id) ? 'Yes' : 'No'} / ${navigation.returnable.includes(space.id) ? 'Yes' : 'No'}</dd>` : ''}</dl>${space.clearVolumes?.length > 1 ? '<p class="muted">Clear height varies by footprint patch; the outer foyer is covered below the gallery.</p>' : ''}<details><summary>Canonical geometry</summary><pre>${esc(JSON.stringify({ footprint: space.footprint, ...(space.clearVolumes && { clearVolumes: space.clearVolumes }) }, null, 2))}</pre></details>`;
}
function render() {
  const d = plan.diagnostics;
  const reference = plan.kind === 'architecture-reference', profile = reference ? ARCHITECTURE_PROFILE : PROFILES[plan.input.profile];
  $('study-title').textContent = profile.name;
  $('study-summary').textContent = profile.summary;
  const heightControl = $('floor-height'); heightControl.min = reference ? '2.8' : '2.6'; heightControl.max = reference ? '3.6' : '5';
  $('floor-filter').querySelector('option[value="2"]').hidden = !reference;
  if (!reference && $('floor-filter').value === '2') $('floor-filter').value = 'all';
  $('show-navigation').disabled = !reference;
  $('metrics').innerHTML = [[d.metrics.spaces, 'spaces'], [d.metrics.floors, 'floors'], [reference ? d.metrics.stairs : d.metrics.arcs, reference ? 'stair flights' : 'exact arcs'], [`${d.metrics.portsRealized}/${d.metrics.portsRequested}`, 'ports realized'], [reference ? `${d.metrics.reachableSpaces}/${d.metrics.spaces}` : d.metrics.netFootprintArea.toFixed(1), reference ? 'spaces reachable' : 'm² footprint']].map(([n, label]) => `<div class="metric"><strong>${n}</strong><span>${label}</span></div>`).join('');
  $('status').textContent = d.status === 'invalid' ? 'INVALID' : reference ? 'ARCHITECTURE VALID' : 'GEOMETRY VALID';
  $('status').classList.toggle('invalid', d.status === 'invalid');
  $('diagnostics').innerHTML = `<p class="notice">${d.errors.length ? `${d.errors.length} validation error(s).` : reference ? '<b>Physical openings, stairs, and local paths pass.</b>' : '<b>Footprints and local port clearances pass.</b>'}</p>${d.errors.slice(0, 30).map(e => `<p class="notice error"><strong>${esc(e.code)}</strong><br>${esc(e.entityId)}<br>${esc(e.message)}</p>`).join('')}${d.errors.length > 30 ? '<p class="muted">Additional errors are included in the validation report.</p>' : ''}<p class="notice warning">${esc(d.warnings[0].message)}</p><p class="muted">${reference ? `Arrival: ${esc(d.navigation.arrivalSpaceId ?? 'none')}<br>Reachable: ${d.navigation.reachable.length}/${d.metrics.spaces} · Returnable: ${d.navigation.returnable.length}/${d.metrics.spaces}<br>Circulation loops: ${d.metrics.cycleRank}<br>Walker: 0.3 m radius · 2.1 m headroom` : 'Whole-zone reachability: not evaluated.'}</p>`;
  $('fingerprint').textContent = plan.fingerprint;
  $('schema-version').textContent = plan.schemaVersion; $('generator-version').textContent = plan.input.generatorVersion;
  $('port-count').textContent = `${plan.externalPorts.length} / ${requirements.length}`;
  $('ports').innerHTML = requirements.map(r => {
    const p = plan.externalPorts.find(p => p.contractId === r.contractId);
    return `<div class="port-card"><div class="port-name"><span>${esc(r.portId)}</span><span class="port-role">${esc(r.role)}</span></div><p>Floor ${r.floorIndex + 1} · ${esc(r.direction)}<br>${r.width} × ${r.height} m · approach ${r.approachDepth} m${reference && p ? `<br>Arrival access: ${d.navigation.reachable.includes(p.owningSpaceId) ? 'validated' : 'failed'}` : ''}</p><span class="mono">${p ? esc(p.owningSpaceId) : 'UNREALIZED'}</span></div>`;
  }).join('');
  $('contracts').value = JSON.stringify(requirements, null, 2);
  renderFloors(); renderSelection(); renderVolume(true);
  const url = new URL(location.href);
  url.search = new URLSearchParams({ seed: plan.input.seed, profile: plan.input.profile, height: String(plan.input.config.floorHeight), ports: JSON.stringify(plan.input.portRequirements) }).toString();
  history.replaceState(null, '', url);
  $('export').disabled = false;
  $('export-report').disabled = false;
  $('copy-link').disabled = false;
}
function generate() {
  try {
    const generator = $('profile').value === 'reference-house' ? generateArchitecture : generateStudy;
    const candidate = generator({ seed: $('seed').value, profile: $('profile').value, config: { floorHeight: Number($('floor-height').value) }, portRequirements: requirements });
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
$('show-navigation').addEventListener('change', () => { renderFloors(); renderVolume(); });
for (const id of ['volume-scope', 'volume-walls', 'volume-low-walls', 'volume-ceilings', 'volume-guards']) $(id).addEventListener('change', () => renderVolume());
$('reset-camera').addEventListener('click', () => viewer?.reset());
$('profile').addEventListener('change', () => { const reference = $('profile').value === 'reference-house'; $('floor-height').min = reference ? '2.8' : '2.6'; $('floor-height').max = reference ? '3.6' : '5'; });
$('apply-contracts').addEventListener('click', () => { try { const parsed = JSON.parse($('contracts').value); requirements = parsed; generate(); } catch { $('input-error').textContent = 'Contracts must be valid JSON. The previous study remains visible; export is disabled.'; $('input-error').hidden = false; $('export').disabled = true; $('export-report').disabled = true; $('copy-link').disabled = true; } });
$('export').addEventListener('click', () => download(`zone-${plan.fingerprint}.json`, canonicalExport(plan), 'application/json'));
$('export-report').addEventListener('click', () => download(`validation-${plan.fingerprint}.json`, JSON.stringify(plan.diagnostics, null, 2), 'application/json'));
$('copy-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('Reproducible link copied'); } catch { toast('Clipboard unavailable. Copy the browser address.'); } });
generate();
if (startupError) { $('input-error').textContent = startupError; $('input-error').hidden = false; }
