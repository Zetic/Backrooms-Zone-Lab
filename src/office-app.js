import { generateOfficeDesign, officeTemplate } from './offices.js';
import { escapeHtml } from './render.js';
import { officeSvg } from './office-render.js';
import { canonicalExport } from './zone.js';
import { Viewer3D } from './viewer3d.js';
const $ = id => document.getElementById(id), t = officeTemplate(), query = new URLSearchParams(location.search);
let dials = { ...t.presets.at(-1).dials }, plan, rectangular, viewer, selected;
for (const d of t.dials) if (query.has(d.id)) dials[d.id] = Number(query.get(d.id));
$('seed').value = query.get('seed') ?? '1'; $('angled').checked = query.get('angled') !== 'false';
$('dials').innerHTML = t.dials.map(d => `<div class="dial"><label for="dial-${d.id}" title="${escapeHtml(d.help)}">${escapeHtml(d.name)}<output id="value-${d.id}"></output></label><input id="dial-${d.id}" type="range" min="0" max="100" value="${dials[d.id]}"><div class="ends"><span>${escapeHtml(d.low)}</span><span>${escapeHtml(d.high)}</span></div></div>`).join('');
function labels() {
  for (const d of t.dials) { $('dial-' + d.id).value = String(dials[d.id]); $('value-' + d.id).textContent = d.id === 'wings' ? String(1 + Math.floor(dials[d.id] * 5 / 100)) : String(dials[d.id]); }
  t.presets.forEach((p, i) => $('preset-' + i).setAttribute('aria-pressed', String(t.dials.every(d => p.dials[d.id] === dials[d.id]))));
}
$('presets').innerHTML = t.presets.map((p, i) => `<button id="preset-${i}">${escapeHtml(p.name)}</button>`).join('');
t.presets.forEach((p, i) => $('preset-' + i).addEventListener('click', () => { dials = { ...p.dials }; labels(); generate(); }));
for (const d of t.dials) {
  $('dial-' + d.id).addEventListener('input', event => { dials[d.id] = Number(event.target.value); labels(); });
  $('dial-' + d.id).addEventListener('change', generate);
}
function selection() {
  const s = plan?.spaces.find(s => s.id === selected);
  $('selection').innerHTML = s ? `<strong>${escapeHtml(s.label)}</strong>${escapeHtml(s.id)} · ${s.usableFloor.areaM2.toFixed(1)} m² clear floor · ${s.clearHeight.toFixed(1)} m height` : 'Select a room to inspect its usable floor.';
}
function volume(reset = false) {
  if (!plan) return;
  try {
    viewer ??= new Viewer3D($('office-canvas'), id => { selected = id; selection(); });
    viewer.update(plan, { scope: 'ground', floorIndex: 0, lowWalls: $('low-walls').checked, ceilings: false, walls: true, guards: true, selected });
    if (reset) viewer.reset(); $('volume-error').hidden = true;
  } catch (error) { $('volume-error').textContent = error.message; $('volume-error').hidden = false; }
}
function generate() {
  labels(); $('status').textContent = 'GENERATING';
  try {
    const spec = { seed: Number($('seed').value), dials }, candidate = generateOfficeDesign(spec, { angled: $('angled').checked });
    const exchange = t.make(spec); if (exchange.error) throw new Error(exchange.error);
    exchange.notes += ' Full angled variant differences: central shared boardroom/focus cluster and actual rotated geometry are preserved in the separate br.zone export; they are not realized by these rectangles.';
    plan = candidate; rectangular = exchange; $('error').hidden = true; $('status').textContent = 'PHYSICAL CHECKS PASS';
    $('title').textContent = plan.layout.wingCount + ' independent wing' + (plan.layout.wingCount === 1 ? '' : 's') + ' · seed ' + spec.seed;
    $('office-plan').innerHTML = officeSvg(plan, { selected, navigation: false });
    for (const node of document.querySelectorAll('#office-plan [data-space]')) node.addEventListener('click', () => { selected = node.dataset.space; selection(); });
    const m = plan.diagnostics.metrics;
    $('facts').innerHTML = `<div><strong>${plan.layout.wingCount}</strong>Independent wings</div><div><strong>${m.spaces}</strong>Spaces</div><div><strong>${m.netFootprintArea.toFixed(1)} m²</strong>Clear floor</div><div><strong>${m.reachableSpaces}/${m.spaces}</strong>Reachable and returnable</div>`;
    $('diagnostics').textContent = 'Actual rotated floors, 15 cm wall mass, supported openings and walker paths checked. Unreal adapter pending.';
    $('rules').innerHTML = plan.layout.architecturalRules.map(r => `<p>${r.kept ? '●' : '◇'} ${escapeHtml(r.name)}${r.kept ? '' : '<br>' + escapeHtml(r.detail + ' · ' + r.relaxedBy)}</p>`).join('');
    for (const id of ['export', 'snapshot', 'exchange-export', 'report']) $(id).disabled = false;
    const url = new URL(location.href); url.search = new URLSearchParams({ seed: String(spec.seed), ...Object.fromEntries(Object.entries(dials).map(([k, v]) => [k, String(v)])), angled: String($('angled').checked) }); history.replaceState(null, '', url);
    selection(); volume(true);
  } catch (error) { $('status').textContent = 'REFUSED'; $('error').hidden = false; $('error').textContent = error.message + ' The previous accepted plan remains visible.'; for (const id of ['export', 'snapshot', 'exchange-export', 'report']) $(id).disabled = true; }
}
function download(name, data, type) { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([data], { type })); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('generate').addEventListener('click', generate); $('angled').addEventListener('change', generate); $('seed').addEventListener('change', generate);
for (const [id, step] of [['seed-down', -1], ['seed-up', 1]]) $(id).addEventListener('click', () => { $('seed').value = String(Math.min(4294967295, Math.max(0, Number($('seed').value) + step))); generate(); });
$('low-walls').addEventListener('change', () => volume()); $('reset-camera').addEventListener('click', () => viewer?.reset());
$('export').addEventListener('click', () => download('office-full-' + plan.fingerprint + '.zone.json', canonicalExport(plan), 'application/json'));
$('snapshot').addEventListener('click', () => download('office-full-' + plan.fingerprint + '.svg', officeSvg(plan), 'image/svg+xml'));
$('exchange-export').addEventListener('click', () => download(rectangular.id + '.zone.json', globalThis.ZoneExchange.serialize(rectangular), 'application/json'));
$('report').addEventListener('click', () => download('office-full-' + plan.fingerprint + '-checks.json', JSON.stringify(plan.diagnostics, null, 2), 'application/json'));
labels(); generate();
