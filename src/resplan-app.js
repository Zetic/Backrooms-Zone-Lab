import { ResPlanLibrary } from './resplan-library.js';
import { ResPlanRunner } from './resplan-runner.js';
import { resplanInput, resplanCandidates, selectResPlan, resplanExport } from './resplan-template.js';
import { resplanSvg } from './resplan-render.js';
import { Viewer3D } from './viewer3d.js';
import { escapeHtml } from './render.js';

const $ = id => document.getElementById(id), query = new URLSearchParams(location.search), runner = new ResPlanRunner();
const exportIds = ['export', 'snapshot', 'show-volume'];
let library, plan, revision = 0, libraryRevision = 0, meshRevision = 0, abort, selected, viewer, fitBox, drag;
const meshes = new Map(), randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
$('seed').value = query.get('seed') ?? String(randomSeed());
$('plan-id').value = query.get('planId') ?? '';
for (const [id, key] of [['min-area', 'minArea'], ['max-area', 'maxArea'], ['scale', 'scale'], ['rotation', 'rotation'], ['ceiling', 'ceiling']]) if (query.has(key)) $(id).value = query.get(key);
$('mirror').checked = query.get('mirror') === 'true';
function spec() {
  if (!$('seed').value.trim()) throw new Error('Seed is required.');
  return resplanInput({ seed: Number($('seed').value), planId: $('plan-id').value.trim(), bedrooms: $('bedrooms').value === 'any' ? 'any' : Number($('bedrooms').value), minArea: Number($('min-area').value), maxArea: Number($('max-area').value), scale: Number($('scale').value), rotation: Number($('rotation').value), mirror: $('mirror').checked, ceiling: Number($('ceiling').value) });
}
function controlLabels() {
  $('scale-value').textContent = Number($('scale').value).toFixed(2) + '×'; $('rotation-value').textContent = $('rotation').value + '°';
  try { $('eligible').textContent = library ? resplanCandidates(library.catalog, spec()).length + ' matching plans · before presentation scale' : ''; }
  catch { $('eligible').textContent = 'Invalid selection settings'; }
}
function pending() {
  ++revision; ++meshRevision; abort?.abort(); runner.cancel(); exportIds.forEach(id => $(id).disabled = true);
  $('status').textContent = 'CHANGES PENDING'; controlLabels();
}
function fail(error) { $('status').textContent = 'REFUSED'; $('error').hidden = false; $('error').textContent = error.message + (plan ? ' The previous plan remains visible; exports are disabled.' : ''); }
function setLibrary(value) {
  library = value;
  const counts = [...new Set(library.catalog.plans.map(p => p.bedrooms))].sort((a, b) => a - b);
  $('bedrooms').innerHTML = '<option value="any">Any bedroom count</option>' + counts.map(n => `<option value="${n}">${n} bedrooms</option>`).join('');
  $('bedrooms').value = 'any'; $('collection').textContent = `${library.catalog.plans.length} available plans from the ${library.catalog.releasePlanCount.toLocaleString()}-plan release`;
  $('random').disabled = false; $('load').disabled = false; controlLabels();
}
function draw() { if (!plan) return; $('resplan-plan').innerHTML = resplanSvg(plan, { labels: $('labels').checked, semantics: $('semantics').checked, selected }); fitBox = $('resplan-plan').querySelector('svg')?.getAttribute('viewBox'); }
function selection() {
  const s = plan?.spaces.find(s => s.id === selected);
  $('selection').innerHTML = s ? `<strong>${escapeHtml(s.label)}</strong>${s.usableFloor.areaM2.toFixed(1)} estimated m² · ${s.footprint.outer.length} boundary segments · ${s.footprint.holes.length} holes` : 'Select a room to inspect its area.';
}
function accept(result) {
  plan = result.plan; selected = null; meshes.clear(); draw(); selection(); $('resplan-volume').hidden = true; $('show-volume').textContent = 'Show 3D preview';
  $('status').textContent = 'SOURCE PLAN LOADED'; $('error').hidden = true; $('title').textContent = 'ResPlan ' + plan.source.planId + ' · seed ' + plan.input.seed;
  const count = category => plan.features.filter(f => f.category === category).length;
  $('facts').innerHTML = `<div><strong>${plan.selection.rooms}</strong>Functional space polygons</div><div><strong>${plan.selection.bedrooms}</strong>Bedrooms</div><div><strong>${(plan.selection.areaM2 * plan.input.scale ** 2).toFixed(1)} m²</strong>Calibrated inner area</div><div><strong>${count('door') + count('front_door')} / ${count('window')}</strong>Source doors / windows</div>`;
  $('scope').textContent = 'Source geometry loaded; physical compilation is pending. Dimensions are area calibrated; heights are preview assumptions.' + (plan.importDiagnostics.topologyIssues.length ? ' ' + plan.importDiagnostics.topologyIssues.length + ' contour precision issues recorded in the export.' : '');
  exportIds.forEach(id => $(id).disabled = false);
}
function writeURL() {
  const url = new URL(location.href); url.search = new URLSearchParams(Object.entries({ ...plan.input, planId: plan.source.planId }).map(([k, v]) => [k, String(v)])); history.replaceState(null, '', url);
}
async function generate() {
  pending(); if (!library) return; const token = revision; abort = new AbortController(); $('status').textContent = 'LOADING SOURCE PLAN';
  try {
    const input = spec(), record = await library.load(input, abort.signal); if (token !== revision) return;
    const result = await runner.generate(input, library.catalog, record); if (token !== revision) return;
    accept(result); writeURL();
  } catch (error) { if (token === revision && error.name !== 'AbortError') fail(error); }
}
async function volume() {
  if (!plan || $('show-volume').disabled) return;
  const current = revision, token = ++meshRevision, lowWalls = $('low-walls').checked;
  $('resplan-volume').hidden = false; $('show-volume').textContent = 'Refresh 3D preview';
  try {
    let prepared = meshes.get(lowWalls);
    if (!prepared) { const result = await runner.mesh(lowWalls); if (current !== revision || token !== meshRevision) return; prepared = result.prepared; meshes.set(lowWalls, prepared); }
    viewer ??= new Viewer3D($('resplan-canvas'), id => { selected = id; selection(); });
    viewer.update(plan, { scope: 'ground', lowWalls, prepared }); viewer.reset(); $('volume-error').hidden = true;
  } catch (error) { if (current !== revision || token !== meshRevision || error.name === 'AbortError') return; $('volume-error').textContent = error.message; $('volume-error').hidden = false; }
}
function download(name, data, type) { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([data], { type })); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('random').addEventListener('click', () => {
  $('plan-id').value = '';
  try {
    const input = spec(), candidates = resplanCandidates(library.catalog, input); let seed;
    for (let i = 0; i < 12; i++) { seed = randomSeed(); if (candidates.length < 2 || selectResPlan(library.catalog, { ...input, seed }).id !== plan?.source.planId) break; }
    $('seed').value = String(seed); return generate();
  } catch (error) { pending(); fail(error); }
});
$('load').addEventListener('click', generate);
for (const id of ['seed', 'plan-id', 'min-area', 'max-area', 'scale', 'rotation', 'ceiling']) { $(id).addEventListener('input', pending); $(id).addEventListener('change', generate); }
for (const id of ['bedrooms', 'mirror']) $(id).addEventListener('change', generate);
for (const id of ['labels', 'semantics']) $(id).addEventListener('change', draw);
$('show-volume').addEventListener('click', volume); $('low-walls').addEventListener('change', () => { if (!$('resplan-volume').hidden) return volume(); }); $('reset-camera').addEventListener('click', () => viewer?.reset());
$('export').addEventListener('click', () => download('resplan-' + plan.source.planId + '-' + plan.fingerprint + '.resplan.json', resplanExport(plan), 'application/json'));
$('snapshot').addEventListener('click', () => download('resplan-' + plan.source.planId + '.svg', resplanSvg(plan, { labels: $('labels').checked, semantics: $('semantics').checked }), 'image/svg+xml'));
$('import-plan').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return; pending(); const token = revision;
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error('Source export exceeds 16 MiB.');
    const raw = JSON.parse(await file.text()); if (token !== revision) return;
    const result = await runner.import(raw); if (token !== revision) return; accept(result);
    const p = result.plan.input; $('seed').value = String(p.seed); $('plan-id').value = result.plan.source.planId;
    for (const [id, key] of [['min-area', 'minArea'], ['max-area', 'maxArea'], ['scale', 'scale'], ['rotation', 'rotation'], ['ceiling', 'ceiling']]) $(id).value = String(p[key]);
    $('mirror').checked = p.mirror; $('bedrooms').value = library?.catalog.plans.some(e => e.bedrooms === p.bedrooms) ? String(p.bedrooms) : 'any'; controlLabels();
  } catch (error) { if (token === revision && error.name !== 'AbortError') fail(error); }
  finally { event.target.value = ''; }
});
$('import-collection').addEventListener('change', async event => {
  const files = event.target.files; if (!files?.length) return; pending(); ++libraryRevision; const token = revision;
  try { const value = await ResPlanLibrary.fromFiles(files); if (token !== revision) return; setLibrary(value); $('plan-id').value = ''; $('min-area').value = '0'; $('max-area').value = '5000'; return generate(); }
  catch (error) { if (token === revision) fail(error); }
});
const viewport = $('resplan-plan'), pointer = (svg, event) => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
viewport.addEventListener('click', event => { const id = event.target.closest?.('[data-space]')?.dataset.space; if (id) { selected = id; draw(); selection(); } });
viewport.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { const id = event.target.dataset?.space; if (id) { event.preventDefault(); selected = id; draw(); selection(); } } });
viewport.addEventListener('wheel', event => { const svg = viewport.querySelector('svg'); if (!svg) return; event.preventDefault(); const p = pointer(svg, event), b = svg.viewBox.baseVal, ratio = Math.exp(Math.max(-1, Math.min(1, event.deltaY / 500))); if (b.width * ratio < 2 || b.width * ratio > 10000) return; svg.setAttribute('viewBox', [p.x + (b.x - p.x) * ratio, p.y + (b.y - p.y) * ratio, b.width * ratio, b.height * ratio].join(' ')); }, { passive: false });
viewport.addEventListener('pointerdown', event => { const svg = viewport.querySelector('svg'); if (event.button !== 0 || !svg) return; drag = { point: pointer(svg, event), box: svg.getAttribute('viewBox') }; viewport.setPointerCapture(event.pointerId); });
viewport.addEventListener('pointermove', event => { const svg = viewport.querySelector('svg'); if (!drag || !svg) return; svg.setAttribute('viewBox', drag.box); const p = pointer(svg, event), b = svg.viewBox.baseVal; svg.setAttribute('viewBox', [b.x + drag.point.x - p.x, b.y + drag.point.y - p.y, b.width, b.height].join(' ')); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, () => { drag = null; });
$('fit').addEventListener('click', () => { const svg = viewport.querySelector('svg'); if (svg && fitBox) svg.setAttribute('viewBox', fitBox); });
async function initialize() {
  const token = revision, collectionToken = libraryRevision;
  try { const value = await ResPlanLibrary.fromURL(); if (collectionToken !== libraryRevision) return; setLibrary(value); if (token !== revision) return; if (query.has('bedrooms')) $('bedrooms').value = query.get('bedrooms'); return generate(); }
  catch (error) { if (token === revision) fail(error); }
}
controlLabels(); initialize();
