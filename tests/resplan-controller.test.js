import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ResPlanLibrary as Library } from '../src/resplan-library.js';
import { ResPlanRunner } from '../src/resplan-runner.js';
import { resplanInput, resplanCandidates, selectResPlan, resplanExport } from '../src/resplan-template.js';
import { resplanSvg } from '../src/resplan-render.js';
import { escapeHtml } from '../src/render.js';
const root = new URL('../data/resplan/', import.meta.url), catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
const html = await readFile(new URL('../resplan.html', import.meta.url), 'utf8'), code = (await readFile(new URL('../src/resplan-app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
function controller() {
  const elements = new Map(), downloads = [], urls = [];
  class Element {
    constructor(id) { this.id = id; this.value = ''; this.listeners = new Map(); this.attrs = new Map(); this.checked = ['low-walls','labels'].includes(id); }
    set innerHTML(value) { this.html = value; }
    get innerHTML() { return this.html ?? ''; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    emit(name) { return this.listeners.get(name)?.({ target:this }); }
    click() { if (this.id === 'download') downloads.push({ name:this.download, href:this.href }); else if (!this.disabled) return this.emit('click'); }
    querySelector() { const svg = new Element('svg'); svg.attrs.set('viewBox', this.html?.match(/viewBox="([^"]+)"/)?.[1]); return svg; }
    getAttribute(name) { return this.attrs.get(name); }
    setAttribute(name, value) { this.attrs.set(name, value); }
  }
  for (const m of html.matchAll(/<[^>]*id="([^"]+)"[^>]*>/g)) { const e = new Element(m[1]); e.value = m[0].match(/value="([^"]*)"/)?.[1] ?? ''; elements.set(m[1], e); }
  elements.get('bedrooms').value = 'any';
  const get = id => { assert.ok(elements.has(id), id); return elements.get(id); };
  class ResPlanLibrary { static async fromURL() { return new Library(catalog, file => readFile(new URL(file, root), 'utf8')); } static fromFiles(files) { return Library.fromFiles(files); } }
  const context = { ResPlanLibrary, ResPlanRunner, resplanInput, resplanCandidates, selectResPlan, resplanExport, resplanSvg, escapeHtml,
    Viewer3D: class { constructor() { throw new Error('WebGL unavailable.'); } },
    document:{ getElementById:get, createElement:() => new Element('download') }, location:{ search:'?seed=7',href:'https://example.test/lab/resplan.html' },
    history:{ replaceState(...args) { urls.push(args.at(-1).href); } }, URL, URLSearchParams, Blob, Date, setTimeout, AbortController, Uint32Array, crypto:globalThis.crypto, globalThis:{} };
  vm.runInNewContext(code.replace(/controlLabels\(\); initialize\(\);\s*$/, 'controlLabels(); globalThis.ready = initialize();'), context);
  return { get, downloads, urls, ready:context.globalThis.ready };
}
test('ResPlan page loads real source geometry and disables exports for pending/refused selections', async () => {
  const c = controller(); await c.ready; const get = c.get;
  assert.equal(get('status').textContent, 'SOURCE PLAN LOADED'); assert.match(get('collection').textContent, /128 available/);
  assert.ok(!get('export').disabled); assert.match(c.urls.at(-1), /\/lab\/resplan.html\?/);
  await get('export').click(); const exported = JSON.parse(await (await fetch(c.downloads.at(-1).href)).text());
  assert.equal(exported.schemaVersion, 'br.resplan-zone/1'); assert.ok(exported.spaces.length > 0); assert.equal(exported.importDiagnostics.physicallyCompiled, false);
  const accepted = get('resplan-plan').innerHTML; get('rotation').value = '90'; await get('rotation').emit('input');
  assert.equal(get('status').textContent, 'CHANGES PENDING'); assert.ok(get('export').disabled); assert.equal(get('resplan-plan').innerHTML, accepted);
  await get('rotation').emit('change'); assert.equal(get('status').textContent, 'SOURCE PLAN LOADED');
  const rotated = get('resplan-plan').innerHTML; get('seed').value = '-1'; await get('seed').emit('change');
  assert.equal(get('status').textContent, 'REFUSED'); assert.ok(get('export').disabled); assert.equal(get('resplan-plan').innerHTML, rotated);
  get('import-plan').files = [{ size:1,text:async()=>JSON.stringify(exported) }]; await get('import-plan').emit('change');
  assert.equal(get('status').textContent, 'SOURCE PLAN LOADED'); assert.equal(get('plan-id').value, exported.source.planId);
  await get('snapshot').click(); assert.match(await (await fetch(c.downloads.at(-1).href)).text(), /CC BY 4.0/);
  await get('show-volume').click(); assert.equal(get('volume-error').textContent, 'WebGL unavailable.');
  await get('random').click(); assert.equal(get('status').textContent, 'SOURCE PLAN LOADED'); assert.equal(get('plan-id').value, '');
});
test('a stale file read cannot replace or cancel a newer ResPlan selection', async () => {
  const c = controller(); await c.ready; const get = c.get;
  await get('export').click(); const text = await (await fetch(c.downloads.at(-1).href)).text(); let finish;
  get('import-plan').files = [{ size:1,text:()=>new Promise(resolve => { finish = resolve; }) }];
  const importing = get('import-plan').emit('change'); get('seed').value = '29'; await get('seed').emit('change');
  const latest = get('resplan-plan').innerHTML; finish(text); await importing;
  assert.equal(get('status').textContent, 'SOURCE PLAN LOADED'); assert.equal(get('resplan-plan').innerHTML, latest); assert.ok(!get('export').disabled);
});
