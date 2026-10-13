import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import '../exchange/stream.js';
import '../exchange/checks.js';
import '../exchange/method.js';
import '../exchange/templates/house.js';
import '../exchange/templates/level0.js';
import '../exchange/templates/offices.js';
import '../exchange/plan.js';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../exchange/app.js', import.meta.url), 'utf8');
function controller(search = '') {
  const elements = new Map(), downloads = [], navigation = [];
  class Element {
    constructor(id) { this.id = id; this.value = id === 'seed' ? '1' : ''; this.style = {}; this.listeners = new Map(); this.disabled = false; this.attributes = new Map(); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    async emit(name) { return this.listeners.get(name)?.({ target: this, key: '', preventDefault() {} }); }
    set innerHTML(value) { this.html = value; for (const match of value.matchAll(/id="([^"]+)"/g)) if (!elements.has(match[1])) elements.set(match[1], new Element(match[1])); }
    get innerHTML() { return this.html ?? ''; }
    querySelector(selector) { if (selector !== 'svg') throw new Error('Unexpected selector'); const svg = new Element('svg'); svg.attributes.set('viewBox', this.html.match(/viewBox="([^"]+)"/)?.[1]); return svg; }
    getAttribute(name) { return this.attributes.get(name); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    click() { if (this.id === 'download') downloads.push({ href: this.href, name: this.download }); else if (!this.disabled) return this.emit('click'); }
    remove() {}
  }
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element(match[1]));
  const get = id => { assert.ok(elements.has(id), 'Real HTML control required: ' + id); return elements.get(id); };
  const document = { getElementById: get, createElement: () => new Element('download'), body: { append() {} }, addEventListener() {} };
  vm.runInNewContext(app, { globalThis: { ZoneExchange: globalThis.ZoneExchange }, document, location: { search, hash: '', href: 'file:///lab/index.html' + search, replace: url => navigation.push(url) }, URL, URLSearchParams, Blob, Uint32Array, crypto: globalThis.crypto, setTimeout });
  return { get, downloads, navigation };
}
test('classic scripts have local assets and preserve legacy study URLs', async () => {
  assert.ok(!html.includes('type="module"'));
  for (const match of html.matchAll(/<script src="\.\/([^"]+)"/g)) assert.ok((await readFile(new URL('../' + match[1], import.meta.url), 'utf8')).length);
  const c = controller('?profile=atrium-mansion&seed=7&generator=4');
  assert.equal(c.navigation[0], 'file:///lab/gallery.html?profile=atrium-mansion&seed=7&generator=4');
});

test('House presets change the accepted plan and expose preserved rule reports', async () => {
  const c = controller(), get = c.get;
  assert.ok(get('rules').innerHTML.includes('15 of 15'));
  await get('preset-5').click();
  const zone = JSON.parse(get('editor').value);
  assert.equal(zone.source.template, 'house-v2'); assert.equal(zone.source.dials.sprawl, 90); assert.equal(zone.source.dials.strange, 95);
  assert.equal(globalThis.ZoneExchange.facts(zone).floors.length, 1);
  assert.ok(get('rules').innerHTML.includes('let go from'));
  await get('report').click();
  const report = JSON.parse(await (await fetch(c.downloads.at(-1).href)).text());
  assert.equal(report.architecturalRules.rules.length, 15); assert.ok(report.architecturalRules.valid);
  await get('preset-0').click(); assert.ok(get('rules').innerHTML.includes('15 of 15'));
  // Repeated manual edits retain the known rule policy while dropping regeneration claims.
  await get('apply').click(); await get('apply').click();
  assert.ok(get('rules').innerHTML.includes('15 of 15')); assert.ok(get('template-export').disabled);
  await get('report').click();
  const editedReport = JSON.parse(await (await fetch(c.downloads.at(-1).href)).text());
  assert.equal(editedReport.architecturalRules.rules.length, 15); assert.equal(editedReport.templateAudit, null);
});

test('Offices selection, presets, exports and imports keep the same accepted design and policy', async () => {
  const c = controller(), get = c.get; get('template').value = 'offices'; await get('template').emit('change');
  assert.equal(get('status').textContent, 'PASS'); assert.ok(get('rules').innerHTML.includes('16 of 16'));
  assert.ok(get('dials').innerHTML.includes('dial-open')); await get('preset-5').click();
  const bytes = get('editor').value, z = JSON.parse(bytes); assert.equal(z.source.template, 'offices-v1');
  assert.equal(z.source.dials.strange, 95); assert.ok(get('rules').innerHTML.includes('let go from'));
  await get('export').click(); assert.equal(await (await fetch(c.downloads.at(-1).href)).text(), bytes);
  await get('template-export').click();
  const isolated = { ...globalThis.ZoneExchange, templates: [] };
  vm.runInNewContext(await (await fetch(c.downloads.at(-1).href)).text(), { globalThis: { ZoneExchange: isolated } });
  assert.equal(isolated.serialize(isolated.templates[0].make({ seed: z.source.seed, dials: z.source.dials })), bytes);
  get('template').value = 'house'; await get('template').emit('change');
  get('import').files = [{ size: bytes.length, text: async () => bytes }]; await get('import').emit('change');
  assert.equal(get('template').value, 'offices'); assert.equal(get('editor').value, bytes);
  await get('report').click(); const r = JSON.parse(await (await fetch(c.downloads.at(-1).href)).text());
  assert.equal(r.architecturalRules.rules.length, 16); assert.ok(r.architecturalRules.valid); assert.equal(r.templateAudit.passed, 120);
});
test('exchange controller exports the shown zone, keeps invalid proposals and round-trips imports', async () => {
  const c = controller(), get = c.get, initial = get('editor').value;
  assert.equal(get('status').textContent, 'PASS');
  await get('floor-up').click(); await get('floor-down').click(); assert.equal(get('editor').value, initial);
  await get('export').click(); const first = c.downloads.at(-1); assert.equal(first.name, 'house-1.zone.json');
  assert.equal(await (await fetch(first.href)).text(), initial);
  await get('template-export').click();
  const templateSource = await (await fetch(c.downloads.at(-1).href)).text();
  const loaded = { ...globalThis.ZoneExchange, templates: [] };
  vm.runInNewContext(templateSource, { globalThis: { ZoneExchange: loaded } });
  assert.equal(globalThis.ZoneExchange.serialize(loaded.templates[0].make({ seed: 1 })), initial);
  get('seed').value = '1.5'; await get('seed').emit('input');
  assert.equal(get('status').textContent, 'REFUSED'); assert.ok(get('export').disabled); assert.equal(get('editor').value, initial);
  get('seed').value = '7'; await get('seed').emit('input'); assert.equal(get('status').textContent, 'PASS');
  const level0 = globalThis.ZoneExchange.templates.find(t => t.id === 'level0').make({ seed: 29 });
  const bytes = globalThis.ZoneExchange.serialize(level0);
  get('import').files = [{ size: bytes.length, text: async () => bytes }]; await get('import').emit('change');
  assert.equal(get('zone-title').textContent, level0.name); assert.equal(get('template').value, 'level0'); assert.equal(get('seed').value, '29');
  assert.ok(get('dials').innerHTML.includes('dial-scale')); assert.equal(get('editor').value, bytes);
  const invalid = JSON.parse(bytes); invalid.joins[0].mode = 'unknown'; get('editor').value = JSON.stringify(invalid); await get('apply').click();
  assert.equal(get('status').textContent, 'REFUSED'); assert.equal(get('zone-title').textContent, level0.name); assert.ok(get('export').disabled);
  assert.ok(get('plan').innerHTML.includes('#ff8177'));
  get('editor').value = bytes; await get('apply').click(); assert.equal(get('status').textContent, 'PASS'); assert.ok(get('template-export').disabled);
  assert.equal(JSON.parse(get('editor').value).source.template, 'edited-level0-v1');
  await get('export').click(); assert.equal(c.downloads.at(-1).name, 'level0-29.zone.json');
  get('notes').value = 'I like this sequence; I wanted a curved room that format 1 cannot express.'; await get('notes').emit('input');
  assert.equal(JSON.parse(get('editor').value).notes, get('notes').value);
  await get('report').click(); assert.equal(JSON.parse(await (await fetch(c.downloads.at(-1).href)).text()).checks.valid, true);
});
