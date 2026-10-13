import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { genericTemplate, genericDefaults } from '../src/generic-template.js';
import { GenericRunner, genericViewOptions } from '../src/generic-runner.js';
import { genericSvg } from '../src/generic-render.js';
import { canonicalExport } from '../src/zone.js';
import { escapeHtml } from '../src/render.js';
const html = await readFile(new URL('../generic.html', import.meta.url), 'utf8'), code = (await readFile(new URL('../src/generic-app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
function controller() {
  const elements = new Map(), downloads = [];
  class Element {
    constructor(id) { this.id = id; this.listeners = new Map(); this.attrs = new Map(); this.checked = id === 'low-walls'; this.open = false; }
    set innerHTML(value) { this.html = value; for (const m of value.matchAll(/id="([^"]+)"/g)) if (!elements.has(m[1])) elements.set(m[1], new Element(m[1])); }
    get innerHTML() { return this.html ?? ''; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    emit(name) { return this.listeners.get(name)?.({ target: this }); }
    click() { if (this.id === 'download') downloads.push({ name: this.download, href: this.href }); else if (!this.disabled) return this.emit('click'); }
    setAttribute(name, value) { this.attrs.set(name, value); }
    getAttribute(name) { return this.attrs.get(name); }
    querySelector() { const svg = new Element('svg'); svg.attrs.set('viewBox', this.html?.match(/viewBox="([^"]+)"/)?.[1]); return svg; }
  }
  for (const m of html.matchAll(/id="([^"]+)"/g)) elements.set(m[1], new Element(m[1]));
  const get = id => { assert.ok(elements.has(id), id); return elements.get(id); };
  const context = { genericTemplate, genericDefaults, GenericRunner, genericViewOptions, genericSvg, canonicalExport, escapeHtml,
    Viewer3D: class { constructor() { throw new Error('WebGL unavailable.'); } }, generatorArchive: async () => new Blob(['source']),
    document: { getElementById: get, createElement: () => new Element('download') }, location: { search: '?rooms=0&seed=7', href: 'https://example.test/lab/generic.html' }, history: { replaceState() {} }, URL, URLSearchParams, Blob, setTimeout, globalThis: {} };
  vm.runInNewContext(code.replace(/labels\(\); generate\(\);\s*$/, 'labels(); globalThis.ready = generate();'), context);
  return { get, downloads, ready: context.globalThis.ready };
}
test('Generic controller exports accepted geometry and retains it while changes are pending or refused', async () => {
  const c = controller(); await c.ready; const get = c.get;
  assert.equal(get('status').textContent, 'PHYSICAL CHECKS PASS'); assert.equal(get('value-rooms').textContent, '8');
  await get('export').click(); const exported = JSON.parse(await (await fetch(c.downloads.at(-1).href)).text());
  assert.equal(exported.kind, 'generated-generic'); assert.equal(exported.input.generatorVersion, 2); assert.ok(exported.wallBodies.length);
  const accepted = get('generic-plan').innerHTML;
  get('dial-orientation').value = '100'; await get('dial-orientation').emit('input');
  assert.equal(get('status').textContent, 'CHANGES PENDING'); assert.ok(get('export').disabled); assert.equal(get('generic-plan').innerHTML, accepted);
  await get('dial-orientation').emit('change'); assert.equal(get('status').textContent, 'PHYSICAL CHECKS PASS');
  const latest = get('generic-plan').innerHTML; get('seed').value = '1.5'; await get('seed').emit('change');
  assert.equal(get('status').textContent, 'REFUSED'); assert.ok(get('export').disabled); assert.equal(get('generic-plan').innerHTML, latest);
  get('import').files = [{ size: 1, text: async () => JSON.stringify(exported) }]; await get('import').emit('change');
  assert.equal(get('status').textContent, 'PHYSICAL CHECKS PASS'); assert.ok(get('source').disabled);
  await get('snapshot').click(); assert.ok((await (await fetch(c.downloads.at(-1).href)).text()).includes('xmlns="http://www.w3.org/2000/svg"'));
  await get('show-volume').click(); assert.equal(get('volume-error').textContent, 'WebGL unavailable.');
});
