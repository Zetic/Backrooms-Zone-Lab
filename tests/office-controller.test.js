import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { generateOfficeDesign, officeTemplate } from '../src/offices.js';
import { officeSvg } from '../src/office-render.js';
import { escapeHtml } from '../src/render.js';
import { OfficeRunner } from '../src/office-runner.js';
import { canonicalExport } from '../src/zone.js';
const html = await readFile(new URL('../office.html', import.meta.url), 'utf8'), code = (await readFile(new URL('../src/office-app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
async function controller() {
  const elements = new Map(), downloads = [];
  class Element {
    constructor(id) { this.id = id; this.style = {}; this.listeners = new Map(); this.attrs = new Map(); this.checked = ['angled', 'low-walls'].includes(id); }
    set innerHTML(value) { this.html = value; for (const m of value.matchAll(/id="([^"]+)"/g)) if (!elements.has(m[1])) elements.set(m[1], new Element(m[1])); }
    get innerHTML() { return this.html ?? ''; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    emit(name) { return this.listeners.get(name)?.({ target: this }); }
    click() { if (this.id === 'download') downloads.push({ name: this.download, href: this.href }); else if (!this.disabled) return this.emit('click'); }
    setAttribute(name, value) { this.attrs.set(name, value); }
  }
  for (const m of html.matchAll(/id="([^"]+)"/g)) elements.set(m[1], new Element(m[1]));
  const get = id => { assert.ok(elements.has(id), id); return elements.get(id); };
  const context = { OfficeRunner, generateOfficeDesign, officeTemplate, officeSvg, escapeHtml, canonicalExport,
    Viewer3D: class { constructor() { throw new Error('WebGL unavailable in test.'); } },
    document: { getElementById: get, querySelectorAll: () => [], createElement: () => new Element('download') },
    location: { search: '', href: 'https://example.test/lab/office.html' }, history: { replaceState() {} }, URL, URLSearchParams, Blob, setTimeout,
    globalThis: { ZoneExchange: globalThis.ZoneExchange } };
  vm.runInNewContext(code.replace(/labels\(\); generate\(\);\s*$/, "labels(); globalThis.ready = generate();"), context);
  await context.globalThis.ready;
  return { get, downloads };
}
test('full office controller loads the angled reference, exports exact geometry, and preserves its plan on failure', async () => {
  const c = await controller(), get = c.get;
  assert.equal(get('status').textContent, 'PHYSICAL CHECKS PASS'); assert.ok(get('office-plan').innerHTML.includes('<style>'));
  assert.ok(get('volume-error').textContent.includes('WebGL'));
  get('export').click(); let data = JSON.parse(await (await fetch(c.downloads.at(-1).href)).text());
  assert.equal(data.kind, 'generated-office'); assert.equal(data.layout.wingCount, 2); assert.ok(data.wallBodies.length);
  const last = get('office-plan').innerHTML; get('seed').value = '1.5'; await get('seed').emit('change');
  assert.equal(get('status').textContent, 'REFUSED'); assert.ok(get('export').disabled); assert.equal(get('office-plan').innerHTML, last);
  get('seed').value = '7'; await get('preset-0').click(); assert.equal(get('status').textContent, 'PHYSICAL CHECKS PASS');
  get('exchange-export').click(); data = JSON.parse(await (await fetch(c.downloads.at(-1).href)).text());
  assert.ok(data.notes.includes('central shared boardroom/focus'));
  assert.equal(data.source.template, 'offices-v3'); assert.equal(data.source.dials.wings, 0);
  const previous = get('office-plan').innerHTML;
  get('dial-cohesion').value = '0'; await get('dial-cohesion').emit('input');
  assert.equal(get('status').textContent, 'CHANGES PENDING'); assert.ok(get('export').disabled); assert.equal(get('office-plan').innerHTML, previous);
  await get('dial-cohesion').emit('change'); assert.equal(get('status').textContent, 'PHYSICAL CHECKS PASS');
  get('snapshot').click(); assert.ok((await (await fetch(c.downloads.at(-1).href)).text()).includes('xmlns="http://www.w3.org/2000/svg"'));
});
