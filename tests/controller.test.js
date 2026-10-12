import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultPorts } from '../src/zone.js';

// Controller integration with a minimal DOM adapter. This verifies event/data
// flow and the unavailable-WebGL fallback; it is not a browser or GPU test.
test('controller preserves exports through view changes, exposes errors, and restores study mode', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'), downloads = [];
  class Element {
    constructor(id) { this.id = id; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.listeners = new Map(); this.classList = { toggle() {} }; this.options = new Map(); }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    async emit(type) { await this.listeners.get(type)?.({ preventDefault() {} }); }
    querySelector(query) { if (!this.options.has(query)) this.options.set(query, new Element(query)); return this.options.get(query); }
    getContext() { return null; }
    click() { downloads.push({ href: this.href, name: this.download }); }
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
  const get = id => { assert.ok(elements.has(id), `Missing real HTML control ${id}`); return elements.get(id); };
  for (const [id, value] of Object.entries({ seed: '12345', profile: 'reference-house', 'floor-height': '3.2', 'wall-thickness': '0.2', 'floor-filter': 'all', 'volume-scope': 'gallery' })) get(id).value = value;
  for (const id of ['show-labels', 'show-clearance', 'show-voids', 'volume-walls', 'volume-low-walls', 'volume-guards']) get(id).checked = true;
  const oldDocument = globalThis.document, oldLocation = globalThis.location, oldHistory = globalThis.history;
  globalThis.document = { getElementById: get, querySelectorAll: () => [], createElement: () => new Element('download') };
  globalThis.location = new URL('https://example.test/Backrooms-Zone-Lab/');
  globalThis.history = { replaceState: (_state, _title, url) => { globalThis.location = new URL(url); } };
  async function exported() { await get('export').emit('click'); return JSON.parse(await (await fetch(downloads.at(-1).href)).text()); }
  try {
    await import('../src/app.js');
    assert.equal(get('status').textContent, 'ARCHITECTURE VALID');
    assert.ok(get('volume-error').textContent.includes('WebGL is unavailable'));
    const initial = await exported(); assert.equal(initial.schemaVersion, 'br.zone/0.2'); assert.equal(initial.diagnostics.navigation.reachable.length, 17);
    get('show-navigation').checked = true; await get('show-navigation').emit('change');
    get('floor-filter').value = '2'; await get('floor-filter').emit('change');
    assert.ok(get('floor-plans').innerHTML.includes('TOP FLOOR')); assert.equal((await exported()).fingerprint, initial.fingerprint);
    get('contracts').value = '{'; await get('apply-contracts').emit('click');
    assert.equal(get('export').disabled, true); assert.equal(get('export-report').disabled, true); assert.equal(get('input-error').hidden, false);
    const ports = defaultPorts(); ports[2].floorIndex = 2;
    get('contracts').value = JSON.stringify(ports); await get('apply-contracts').emit('click');
    assert.equal(get('export').disabled, false); assert.ok((await exported()).externalPorts.some(port => port.floorIndex === 2));
    get('profile').value = 'angular'; await get('profile').emit('change'); await get('controls').emit('submit');
    assert.equal(get('export').disabled, true); // Third-floor contract is retained, not silently dropped.
    get('contracts').value = JSON.stringify(defaultPorts()); await get('apply-contracts').emit('click');
    assert.equal(get('volume-view').hidden, true); assert.equal(get('schema-version').textContent, 'br.zone/0.1');
    assert.equal(get('floor-filter').value, 'all'); assert.equal(get('show-navigation').disabled, true);
    assert.equal((await exported()).kind, 'geometry-study'); assert.equal(new URL(location.href).searchParams.get('profile'), 'angular');
    get('profile').value = 'gallery-house'; await get('profile').emit('change');
    assert.equal(get('storeys').value, '2'); await get('controls').emit('submit');
    const generated = await exported(); assert.equal(generated.kind, 'generated-house'); assert.equal(generated.floors.length, 2);
    assert.equal(get('composition-panel').hidden, false); assert.equal(get('schema-version').textContent, 'br.zone/0.4');
    assert.equal(new URL(location.href).searchParams.get('storeys'), '2');
    assert.equal(new URL(location.href).searchParams.get('thickness'), '0.2');
    await get('floor-up').emit('click'); assert.equal(get('floor-filter').value, '1'); assert.equal(get('volume-scope').value, 'floor'); assert.equal(get('floor-up').disabled, true); assert.equal((await exported()).fingerprint, generated.fingerprint);
    await get('floor-down').emit('click'); assert.equal(get('floor-filter').value, '0'); assert.equal(get('floor-down').disabled, true); assert.ok(get('floor-plans').innerHTML.includes('GROUND FLOOR')); assert.equal((await exported()).fingerprint, generated.fingerprint);
    await get('next-seed').emit('click'); const next = await exported();
    assert.notEqual(next.fingerprint, generated.fingerprint); assert.notDeepEqual(next.spaces, generated.spaces);
  } finally { globalThis.document = oldDocument; globalThis.location = oldLocation; globalThis.history = oldHistory; }
});
