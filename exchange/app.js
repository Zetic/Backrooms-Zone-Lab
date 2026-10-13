(function () {
  'use strict';
  // Preserve URLs shared before the exchange workbench became the default page.
  if (new URLSearchParams(location.search).has('profile')) {
    location.replace(new URL('gallery.html' + location.search + location.hash, location.href).href); return;
  }
  const api = globalThis.ZoneExchange, $ = id => document.getElementById(id), esc = api.escape;
  const state = { template: 'house', zone: null, draft: null, checks: null, floor: 0, rejected: false, saved: new Map(), drag: null, fitBox: null };
  const audits = new Map();
  const gallery = { start: 1, key: '', samples: [] };
  function template() { return api.templates.find(t => t.id === state.template); }
  function settings() {
    if (!state.saved.has(state.template)) state.saved.set(state.template, { seed: 1, dials: Object.fromEntries(template().dials.map(d => [d.id, d.value])) });
    return state.saved.get(state.template);
  }
  function message(text) { $('message').textContent = text; $('message').hidden = !text; }
  function showChecks(checks) {
    $('status').textContent = checks.valid ? 'PASS' : 'REFUSED';
    $('status').style.color = checks.valid ? '#b2e2b9' : '#ff9b91';
    $('plan-checks').textContent = checks.valid ? 'Checks pass' : 'Change refused';
    $('plan-checks').style.color = checks.valid ? '#b2e2b9' : '#ff9b91';
    $('checks').innerHTML = (checks.valid ? '<p>Grid · ids · overlap · stairs · joins · reach and return · start · entrances · counts · same again</p>' : '') +
      (checks.errors.length ? '<ul class="errors">' + checks.errors.map(e => `<li>${esc(e.message)}</li>`).join('') + '</ul>' : '') +
      (checks.warnings.length ? '<ul class="warnings">' + checks.warnings.map(e => `<li>${esc(e.message)}</li>`).join('') + '</ul>' : '');
    for (const id of ['export', 'snapshot']) $(id).disabled = !checks.valid;
  }
  function draw() {
    if (!state.zone) return;
    const checks = state.rejected ? { ...state.checks, links: api.validate(state.zone).links, errors: state.checks.errors.map(e => {
      const proposed = state.draft?.joins?.[e.join];
      if (!proposed) return e;
      const pair = [proposed.a, proposed.b].sort().join('/');
      return { ...e, spaces: [proposed.a, proposed.b], join: state.zone.joins.findIndex(j => [j.a, j.b].sort().join('/') === pair) };
    }) } : state.checks;
    $('plan').innerHTML = api.plan(state.zone, state.floor, { checks });
    const svg = $('plan').querySelector('svg');
    state.fitBox = svg.getAttribute('viewBox');
    const facts = api.facts(state.zone), index = facts.floors.indexOf(state.floor);
    $('floor').value = String(state.floor); $('floor-down').disabled = index <= 0; $('floor-up').disabled = index >= facts.floors.length - 1;
    drawGallery();
  }
  function accept(zone, imported = false) {
    const recordedTemplate = typeof zone?.source?.template === 'string' ? zone.source.template.replace(/^(?:edited-)+/, '') : '';
    const policy = api.templates.find(t => recordedTemplate === api.templateKey(t) && typeof t.rules === 'function');
    // Known reports are recomputed from geometry and recorded dials, including fixed edits.
    const physical = policy && zone && typeof zone === 'object' ? { ...zone } : zone;
    if (policy) delete physical.rules;
    const checks = api.validate(physical);
    const report = checks.valid && policy ? api.ruleReport(policy, physical) : null;
    if (report && !report.valid) { checks.valid = false; checks.errors.push(...report.rules.filter(r => !r.kept && !r.relaxed).map(r => ({ code: 'rule.' + r.id, message: r.name + ': ' + r.detail }))); }
    if (checks.valid && report && policy.rules) zone = { ...zone, rules: report.rules };
    if (checks.valid && !policy && zone.rules?.length) checks.warnings.push({ code: 'rules-unverified', message: 'Embedded rule report retained; its rule evaluator is unavailable, so the architectural claims cannot be recomputed here.' });
    state.checks = checks; showChecks(checks);
    if (!checks.valid) {
      state.rejected = true; state.draft = zone; message('Edit or import refused. The plan is the last accepted zone; export is disabled until the errors are resolved.');
      $('plan-state').textContent = 'Last accepted plan · proposed change refused';
      draw(); return false;
    }
    state.zone = zone; state.draft = null; state.rejected = false; message('');
    const shownRules = report?.rules ?? zone.rules ?? [];
    $('rules').innerHTML = shownRules.length ? '<p>' + shownRules.filter(r => r.kept).length + ' of ' + shownRules.length + ' rules kept' + (!policy ? ' · imported claims, unverified' : '') + '</p>' + shownRules.map(r => '<p class="small">' + (r.kept ? '● ' : '◇ ') + esc(r.name) + (r.kept ? '' : '<br><span class="muted">' + esc((r.detail ?? '') + ' · let go from ' + (typeof r.relaxedBy === 'string' ? r.relaxedBy : r.relaxedBy.dial + ' ' + r.relaxedBy.from)) + '</span>') + '</p>').join('') : '<p class="muted small">No architectural rulebook recorded for this template/version.</p>';
    const facts = api.facts(zone);
    if (!facts.floors.includes(state.floor)) state.floor = facts.floors[0];
    $('floor').innerHTML = facts.floors.map(f => `<option value="${f}">Floor ${(f / 100).toFixed(1)} m</option>`).join('');
    $('zone-title').textContent = zone.name;
    $('plan-state').textContent = imported ? 'Imported / edited fixed zone · generating replaces this plan' : 'Generated from the seed and dials shown';
    $('notes').value = zone.notes ?? ''; $('editor').value = api.serialize(zone);
    $('facts').innerHTML = `<div><strong>${facts.widthM} × ${facts.depthM} m</strong>Footprint bounds</div><div><strong>${facts.allocationAreaM2.toFixed(1)} m²</strong>Floor allocation</div><div><strong>${facts.counts.room} / ${facts.counts.hall} / ${facts.counts.stair}</strong>Rooms / halls / stairs</div><div><strong>${zone.joins.length}</strong>Joins</div>` +
      '<p class="muted small">' + Object.entries(facts.joins).filter(([, n]) => n).map(([mode, n]) => `${n} ${mode}`).join(' · ') + '<br>Allocation includes wall mass. Unreal reports finished usable floor.</p>';
    $('template-export').disabled = !api.templates.some(t => zone.source?.template === api.templateKey(t));
    draw(); return true;
  }
  function generate() {
    const current = settings(); current.seed = Number($('seed').value);
    if (!$('seed').value.trim()) { reject('Seed is required.'); return; }
    const zone = template().make(current);
    if (zone.error) { reject(zone.error); return; }
    const again = template().make(current);
    if (again.error || api.serialize(zone) !== api.serialize(again)) { reject('Same-again check failed: identical inputs produced different files.'); return; }
    gallery.start = 1 + 9 * Math.floor((Math.max(1, current.seed) - 1) / 9);
    updatePresets(); accept(zone);
  }
  function reject(error) {
    state.rejected = true; state.draft = null; state.checks = { valid: false, errors: [{ code: 'generation', message: error }], warnings: [], links: [] };
    showChecks(state.checks); message(error); $('plan-state').textContent = 'Last accepted plan · generation refused'; draw();
  }
  function selectTemplate(regenerate = true) {
    state.template = $('template').value;
    $('seed').value = String(settings().seed); $('summary').textContent = template().summary;
    $('dials').innerHTML = template().dials.map(d => `<div class="dial"><label for="dial-${d.id}" title="${esc(d.help)}">${esc(d.name)}<output id="value-${d.id}">${settings().dials[d.id]}</output></label><input id="dial-${d.id}" type="range" min="0" max="100" step="1" value="${settings().dials[d.id]}"><div class="ends"><span>${esc(d.low)}</span><span>${esc(d.high)}</span></div></div>`).join('');
    for (const d of template().dials) $('dial-' + d.id).addEventListener('input', event => { settings().dials[d.id] = Number(event.target.value); $('value-' + d.id).value = event.target.value; generate(); });
    $('presets').innerHTML = (template().presets ?? []).map((p, i) => '<button id="preset-' + i + '">' + esc(p.name) + '</button>').join('');
    (template().presets ?? []).forEach((p, i) => $('preset-' + i).addEventListener('click', () => { settings().dials = { ...p.dials }; selectTemplate(); }));
    updatePresets();
    if (regenerate) generate(); else { gallery.start = 1 + 9 * Math.floor((Math.max(1, settings().seed) - 1) / 9); drawGallery(); }
  }
  function updatePresets() {
    (template().presets ?? []).forEach((p, i) => {
      const selected = template().dials.every(d => p.dials[d.id] === settings().dials[d.id]);
      $('preset-' + i).setAttribute('aria-pressed', String(selected));
    });
  }
  function drawGallery() {
    const t = template(), dials = { ...settings().dials }, key = JSON.stringify([api.templateKey(t), dials, gallery.start]);
    if (gallery.key !== key) {
      gallery.key = key; gallery.samples = [];
      for (let seed = gallery.start; seed < gallery.start + 9 && seed <= 4294967295; ++seed) {
        const zone = t.make({ seed, dials });
        const checks = zone.error ? null : api.validate(zone);
        const report = checks?.valid ? api.ruleReport(t, zone, dials) : null;
        gallery.samples.push({ seed, zone, report, error: zone.error ?? (!checks.valid ? checks.errors.map(e => e.message).join('; ') : !report.valid ? 'Architectural rules failed.' : null) });
      }
    }
    $('gallery-range').textContent = 'Seeds ' + gallery.start + '–' + gallery.samples.at(-1).seed + ' · ' + t.name;
    $('gallery-prev').disabled = gallery.start === 1; $('gallery-next').disabled = gallery.start + 9 > 4294967295;
    $('gallery-export').disabled = !gallery.samples.some(s => !s.error);
    $('seed-cards').innerHTML = gallery.samples.map(s => {
      if (s.error) return '<div class="seed-card failed"><strong>Seed ' + s.seed + ' · refused</strong><p>' + esc(s.error) + '</p></div>';
      const floors = api.facts(s.zone).floors, floor = floors.includes(state.floor) ? state.floor : floors[0];
      return '<button class="seed-card" id="gallery-seed-' + s.seed + '" aria-pressed="' + (s.seed === settings().seed) + '"><strong>Seed ' + s.seed + '</strong><span>' + s.report.kept + '/' + s.report.rules.length + ' rules kept · floor ' + floor / 100 + ' m</span>' + api.plan(s.zone, floor, { idPrefix: 'seed-' + s.seed + '-' }) + '</button>';
    }).join('');
    for (const s of gallery.samples) if (!s.error) $('gallery-seed-' + s.seed).addEventListener('click', () => { $('seed').value = String(s.seed); generate(); });
  }
  function download(name, contents, mime) {
    const url = URL.createObjectURL(new Blob([contents], { type: mime })), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function audit(t) {
    if (audits.has(t.id)) return audits.get(t.id);
    const report = api.auditTemplate(t); audits.set(t.id, report); return report;
  }
  function moveFloor(step) {
    if (!state.zone) return;
    const floors = api.facts(state.zone).floors, index = floors.indexOf(state.floor);
    state.floor = floors[Math.max(0, Math.min(floors.length - 1, index + step))]; draw();
  }
  $('template').innerHTML = api.templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('template').value = state.template; $('template').addEventListener('change', () => selectTemplate());
  $('seed').addEventListener('input', generate);
  for (const [id, step] of [['seed-down', -1], ['seed-up', 1]]) $(id).addEventListener('click', () => { $('seed').value = String(Math.max(0, Math.min(4294967295, Number($('seed').value) + step))); generate(); });
  $('random').addEventListener('click', () => { const draw = new Uint32Array(1); crypto.getRandomValues(draw); $('seed').value = String(draw[0]); generate(); });
  $('reset').addEventListener('click', () => { settings().dials = Object.fromEntries(template().dials.map(d => [d.id, d.value])); selectTemplate(); });
  $('floor').addEventListener('change', () => { state.floor = Number($('floor').value); draw(); });
  $('floor-down').addEventListener('click', () => moveFloor(-1)); $('floor-up').addEventListener('click', () => moveFloor(1));
  $('fit').addEventListener('click', () => $('plan').querySelector('svg')?.setAttribute('viewBox', state.fitBox));
  for (const [id, step] of [['gallery-prev', -9], ['gallery-next', 9]]) $(id).addEventListener('click', () => { gallery.start += step; drawGallery(); });
  $('gallery-export').addEventListener('click', () => {
    download(template().id + '-seeds-' + gallery.start + '-floor-' + state.floor + '.svg', api.galleryPlan($('gallery-range').textContent, settings().dials, gallery.samples, state.floor), 'image/svg+xml');
  });
  $('notes').addEventListener('input', () => {
    if (!state.zone || state.rejected) return;
    const edited = { ...state.zone, notes: $('notes').value }, checks = api.validate(edited);
    if (!checks.valid) { state.rejected = true; state.checks = checks; showChecks(checks); message('Notes refused: ' + checks.errors.map(e => e.message).join('; ')); return; }
    state.zone = edited; $('editor').value = api.serialize(state.zone);
  });
  $('export').addEventListener('click', () => { if (!state.rejected && state.zone && api.validate(state.zone).valid) download(state.zone.id + '.zone.json', api.serialize(state.zone), 'application/json'); });
  $('snapshot').addEventListener('click', () => { if (!state.rejected && state.zone) download(state.zone.id + '-floor-' + state.floor + '.svg', api.plan(state.zone, state.floor), 'image/svg+xml'); });
  $('template-export').addEventListener('click', () => {
    const t = api.templates.find(t => state.zone?.source?.template === api.templateKey(t)); if (!t) return;
    // Reconstruct the same plain template from its loaded method and metadata;
    // a Blob download also works offline without fetching a local file.
    const code = api.exportTemplate(t);
    download(t.id + '.js', code, 'text/javascript');
    message('The template also needs exchange/stream.js, exchange/checks.js and exchange/method.js. Its 120-case acceptance and 40-case strict results are in Export check report.');
  });
  $('report').addEventListener('click', () => {
    const t = api.templates.find(t => state.zone?.source?.template === api.templateKey(t));
    const policy = t ?? api.templates.find(t => (state.zone?.source?.template ?? '').replace(/^(?:edited-)+/, '') === api.templateKey(t));
    download((state.zone?.id ?? 'rejected') + '-checks.json', JSON.stringify({ format: 'backrooms-zone-checks', version: 1, zone: state.zone?.id, shownPlanIsLastAccepted: state.rejected, checks: state.checks, proposedZone: state.draft, architecturalRules: state.zone && policy ? api.ruleReport(policy, state.zone) : null, requestedTemplate: state.template, requestedSpec: settings(), templateAudit: t ? audit(t) : null, physicalStatus: 'Unreal Generate verification required; the file loader is not built.' }, null, 2) + '\n', 'application/json');
  });
  function applyText(text) {
    try {
      const zone = JSON.parse(text);
      if (accept(zone, true)) {
        const t = api.templates.find(t => zone.source?.template === api.templateKey(t));
        if (t) { state.template = t.id; state.saved.set(t.id, { seed: zone.source.seed, dials: { ...zone.source.dials } }); $('template').value = t.id; selectTemplate(false); $('summary').textContent = t.summary + ' (fixed imported plan)'; }
      }
    } catch (error) { reject('Invalid JSON: ' + error.message); }
  }
  $('apply').addEventListener('click', () => {
    try { const zone = JSON.parse($('editor').value); if (zone.source) zone.source.template = 'edited-' + zone.source.template; applyText(JSON.stringify(zone)); }
    catch (error) { reject('Invalid JSON: ' + error.message); }
  });
  $('import').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { reject('Zone file is too large (2 MiB limit).'); return; }
    try { applyText(await file.text()); } catch (error) { reject('Could not read zone: ' + error.message); }
    event.target.value = '';
  });
  const viewport = $('plan');
  function point(svg, event) { return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse()); }
  viewport.addEventListener('wheel', event => {
    const svg = viewport.querySelector('svg'); if (!svg) return;
    event.preventDefault(); const p = point(svg, event), b = svg.viewBox.baseVal;
    const scale = Math.exp(Math.max(-1, Math.min(1, event.deltaY / 500))), width = Math.max(20, Math.min(100000, b.width * scale)), ratio = width / b.width;
    svg.setAttribute('viewBox', [p.x + (b.x - p.x) * ratio, p.y + (b.y - p.y) * ratio, width, b.height * ratio].join(' '));
  }, { passive: false });
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const svg = viewport.querySelector('svg'); if (!svg) return;
    state.drag = { point: point(svg, event), box: svg.getAttribute('viewBox') }; viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    if (!state.drag) return; const svg = viewport.querySelector('svg'); if (!svg) return;
    svg.setAttribute('viewBox', state.drag.box); const p = point(svg, event), b = svg.viewBox.baseVal;
    svg.setAttribute('viewBox', [b.x + state.drag.point.x - p.x, b.y + state.drag.point.y - p.y, b.width, b.height].join(' '));
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, () => { state.drag = null; });
  document.addEventListener('keydown', event => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); $('fit').click(); }
    if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); moveFloor(event.key === 'PageUp' ? 1 : -1); }
  });
  selectTemplate();
}());
