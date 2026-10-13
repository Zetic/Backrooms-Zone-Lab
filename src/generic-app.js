import { genericTemplate, genericDefaults } from './generic-template.js';
import { GenericRunner, genericViewOptions } from './generic-runner.js';
import { genericSvg } from './generic-render.js';
import { canonicalExport } from './zone.js';
import { escapeHtml } from './render.js';
import { Viewer3D } from './viewer3d.js';
import { generatorArchive } from './source-archive.js';

const $ = id => document.getElementById(id), t = genericTemplate, query = new URLSearchParams(location.search), runner = new GenericRunner();
const exportIds = ['export', 'snapshot', 'report', 'source', 'show-volume'];
let dials = { ...genericDefaults }, plan, revision = 0, meshRevision = 0, selected, viewer, fitBox, drag, generating = false;
const meshes = new Map();
for (const d of t.dials) if (query.has(d.id)) dials[d.id] = Number(query.get(d.id));
$('seed').value = query.get('seed') ?? '1';
const groups = [...new Set(t.dials.map(d => d.group))];
$('dials').innerHTML = groups.map(group => '<details class="dial-group" open><summary>' + escapeHtml(group) + '</summary>' + t.dials.filter(d => d.group === group).map(d => d.type === 'toggle'
  ? `<label class="module-switch"><input id="dial-${d.id}" type="checkbox"><span>${escapeHtml(d.name)}</span></label>`
  : `<div class="dial"><label for="dial-${d.id}" title="${escapeHtml(d.help)}">${escapeHtml(d.name)}<output id="value-${d.id}"></output></label><input id="dial-${d.id}" type="range" min="0" max="100" step="1"><div class="ends"><span>${escapeHtml(d.low)}</span><span>${escapeHtml(d.high)}</span></div></div>`).join('') + '</details>').join('');
$('presets').innerHTML = t.presets.map((p, i) => `<button id="preset-${i}">${escapeHtml(p.name)}</button>`).join('');
function labels() {
  for (const d of t.dials) { if (d.type === 'toggle') $('dial-' + d.id).checked = dials[d.id] >= 50; else { $('dial-' + d.id).value = String(dials[d.id]); $('value-' + d.id).textContent = t.displayDial(d.id, dials[d.id]); } }
  t.presets.forEach((p, i) => $('preset-' + i).setAttribute('aria-pressed', String(t.dials.every(d => p.dials[d.id] === dials[d.id]))));
}
function pending() {
  ++revision; ++meshRevision; runner.cancel(); generating = false;
  $('elapsed').textContent = ''; $('status').textContent = 'CHANGES PENDING'; exportIds.forEach(id => $(id).disabled = true);
}
for (const d of t.dials) {
  const input = $('dial-' + d.id);
  if (d.type === 'toggle') input.addEventListener('change', () => { dials[d.id] = input.checked ? 100 : 0; labels(); return generate(); });
  else { input.addEventListener('input', () => { dials[d.id] = Number(input.value); labels(); pending(); }); input.addEventListener('change', generate); }
}
t.presets.forEach((p, i) => $('preset-' + i).addEventListener('click', () => { dials = { ...p.dials }; labels(); return generate(); }));
function selection() {
  const s = plan?.spaces.find(s => s.id === selected);
  $('selection').innerHTML = s ? `<strong>${escapeHtml(s.label)}</strong>${s.usableFloor.areaM2.toFixed(1)} m² clear floor · ${s.clearHeight.toFixed(1)} m ceiling` : 'Select a room to inspect its usable floor.';
}
function draw() {
  if (!plan) return;
  $('generic-plan').innerHTML = genericSvg(plan, { labels: $('labels').checked, selected });
  fitBox = $('generic-plan').querySelector('svg')?.getAttribute('viewBox');
}
function accept(result, imported = false) {
  plan = result.plan; meshes.clear(); $('generic-volume').hidden = true; $('show-volume').textContent = 'Show 3D cutaway'; selected = null;
  draw(); selection(); $('status').textContent = 'PHYSICAL CHECKS PASS'; $('error').hidden = true;
  const m = plan.layout.metrics, physical = plan.diagnostics.metrics;
  $('title').textContent = m.roomCount + ' rooms · ' + m.clusterCount + ' room groups · seed ' + plan.input.seed;
  $('facts').innerHTML = `<div><strong>${m.roomAreaMinM2.toFixed(1)}–${m.roomAreaMaxM2.toFixed(1)} m²</strong>Room areas</div><div><strong>${m.concaveRooms ?? '—'}</strong>Concave rooms</div><div><strong>${m.routeLengthM.toFixed(0)} m</strong>Passage length</div><div><strong>${physical.cycleRank}</strong>Independent loops</div><div><strong>${physical.reachableSpaces}/${physical.spaces}</strong>Reachable and returnable</div>`;
  $('rules').innerHTML = plan.layout.architecturalRules.map(r => '<p>' + (r.kept ? '● ' : '◇ ') + escapeHtml(r.name) + '</p>').join('');
  exportIds.forEach(id => $(id).disabled = false); $('source').disabled = imported;
  if (imported) $('elapsed').textContent = 'Imported v' + plan.input.generatorVersion + ' · physical checks repeated';
}
async function generate() {
  const token = ++revision; ++meshRevision; generating = true; const started = Date.now();
  labels(); $('elapsed').textContent = ''; $('status').textContent = 'GENERATING'; exportIds.forEach(id => $(id).disabled = true);
  try {
    if (!$('seed').value.trim()) throw new Error('Seed is required.');
    const spec = { seed: Number($('seed').value), dials: { ...dials } }, result = await runner.generate(spec);
    if (token !== revision) return; generating = false; accept(result); $('elapsed').textContent = ((Date.now() - started) / 1000).toFixed(2) + ' s · one seed';
    const url = new URL(location.href); url.search = new URLSearchParams({ seed: String(spec.seed), ...Object.fromEntries(Object.entries(spec.dials).map(([k, v]) => [k, String(v)])) }); history.replaceState(null, '', url);
  } catch (error) { if (token !== revision || error.name === 'AbortError') return; generating = false; $('status').textContent = 'REFUSED'; $('error').hidden = false; $('error').textContent = error.message + ' The previous accepted plan remains visible.'; }
}
async function volume() {
  if (!plan || generating || $('show-volume').disabled) return;
  const token = ++meshRevision, current = revision, lowWalls = $('low-walls').checked;
  $('generic-volume').hidden = false; $('show-volume').textContent = 'Refresh 3D cutaway';
  try {
    let prepared = meshes.get(lowWalls);
    if (!prepared) { const result = await runner.mesh(lowWalls); if (token !== meshRevision || current !== revision) return; prepared = result.prepared; meshes.set(lowWalls, prepared); }
    viewer ??= new Viewer3D($('generic-canvas'), id => { selected = id; selection(); });
    viewer.update(plan, { ...genericViewOptions(lowWalls), selected, prepared }); viewer.reset(); $('volume-error').hidden = true;
  } catch (error) { if (token !== meshRevision || current !== revision || error.name === 'AbortError') return; $('volume-error').textContent = error.message; $('volume-error').hidden = false; }
}
function download(name, data, type) { const a = document.createElement('a'), url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('generate').addEventListener('click', generate); $('seed').addEventListener('input', pending); $('seed').addEventListener('change', generate);
for (const [id, delta] of [['seed-down', -1], ['seed-up', 1]]) $(id).addEventListener('click', () => { $('seed').value = String(Math.min(4294967295, Math.max(0, Number($('seed').value) + delta))); return generate(); });
$('labels').addEventListener('change', draw); $('show-volume').addEventListener('click', volume); $('low-walls').addEventListener('change', () => { if (!$('generic-volume').hidden) return volume(); }); $('reset-camera').addEventListener('click', () => viewer?.reset());
$('export').addEventListener('click', () => download('generic-v' + plan.input.generatorVersion + '-' + plan.fingerprint + '.zone.json', canonicalExport(plan), 'application/json'));
$('snapshot').addEventListener('click', () => download('generic-v' + plan.input.generatorVersion + '-' + plan.fingerprint + '.svg', genericSvg(plan, { labels: $('labels').checked }), 'image/svg+xml'));
$('report').addEventListener('click', () => download('generic-v' + plan.input.generatorVersion + '-' + plan.fingerprint + '-checks.json', JSON.stringify({ diagnostics: plan.diagnostics, architecture: plan.layout.architecturalRules, diversity: plan.layout.metrics }, null, 2), 'application/json'));
$('source').addEventListener('click', async () => {
  const token = revision, accepted = plan; $('source').disabled = true;
  try { const archive = await generatorArchive({ generatorVersion: accepted.input.generatorVersion, seed: Number(accepted.input.seed), dials: accepted.input.config.dials }); if (token !== revision) return; download('generic-v' + plan.input.generatorVersion + '-' + accepted.fingerprint + '-generator.zip', archive); }
  catch (error) { if (token === revision) { $('error').hidden = false; $('error').textContent = error.message; } }
  finally { if (token === revision) $('source').disabled = false; }
});
$('import').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  pending(); const token = revision;
  try { if (file.size > 20 * 1024 * 1024) throw new Error('Zone file exceeds 20 MiB.'); const raw = JSON.parse(await file.text()), result = await runner.import(raw); if (token !== revision) return; dials = { ...raw.input.config.dials }; $('seed').value = raw.input.seed; labels(); accept(result, true); }
  catch (error) { if (token !== revision || error.name === 'AbortError') return; $('status').textContent = 'REFUSED'; $('error').hidden = false; $('error').textContent = error.message + ' The previous accepted plan remains visible.'; }
  finally { event.target.value = ''; }
});
const viewport = $('generic-plan');
const pointer = (svg, event) => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
viewport.addEventListener('click', event => { const id = event.target.closest?.('[data-space]')?.dataset.space; if (id) { selected = id; selection(); } });
viewport.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { const id = event.target.dataset?.space; if (id) { event.preventDefault(); selected = id; selection(); } } });
viewport.addEventListener('wheel', event => { const svg = viewport.querySelector('svg'); if (!svg) return; event.preventDefault(); const p = pointer(svg, event), b = svg.viewBox.baseVal, ratio = Math.exp(Math.max(-1, Math.min(1, event.deltaY / 500))); if (b.width * ratio < 5 || b.width * ratio > 100000) return; svg.setAttribute('viewBox', [p.x + (b.x - p.x) * ratio, p.y + (b.y - p.y) * ratio, b.width * ratio, b.height * ratio].join(' ')); }, { passive: false });
viewport.addEventListener('pointerdown', event => { const svg = viewport.querySelector('svg'); if (event.button !== 0 || !svg) return; drag = { point: pointer(svg, event), box: svg.getAttribute('viewBox') }; viewport.setPointerCapture(event.pointerId); });
viewport.addEventListener('pointermove', event => { const svg = viewport.querySelector('svg'); if (!drag || !svg) return; svg.setAttribute('viewBox', drag.box); const p = pointer(svg, event), b = svg.viewBox.baseVal; svg.setAttribute('viewBox', [b.x + drag.point.x - p.x, b.y + drag.point.y - p.y, b.width, b.height].join(' ')); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, () => { drag = null; });
$('fit').addEventListener('click', () => { const svg = viewport.querySelector('svg'); if (svg && fitBox) svg.setAttribute('viewBox', fitBox); });
labels(); generate();
