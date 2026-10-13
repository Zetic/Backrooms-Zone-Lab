import { validateResPlanCatalog, validateResPlanRecord, selectResPlan } from './resplan-template.js';

export const defaultResPlanCatalog = new URL('../data/resplan/catalog.json', import.meta.url);
const MAX_SHARD_BYTES = 16 * 1024 * 1024;
export async function decodeResPlanShard(text, entry) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SHARD_BYTES) throw new Error('ResPlan shard exceeds 16 MiB.');
  if (!globalThis.crypto?.subtle) throw new Error('Shard integrity requires a secure context (HTTPS or localhost).');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const digest = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
  if (digest !== entry.sha256) throw new Error('ResPlan shard failed SHA-256 verification.');
  const shard = JSON.parse(text);
  if (shard?.schemaVersion !== 'br.resplan-shard/1' || !Array.isArray(shard.plans) || shard.plans.length > 256) throw new Error('Expected a bounded ResPlan shard v1.');
  const matches = shard.plans.filter(p => p.id === entry.id);
  if (matches.length !== 1) throw new Error('Selected plan is missing or duplicated in its shard.');
  return validateResPlanRecord(matches[0]);
}
export class ResPlanLibrary {
  constructor(catalog, readShard) { this.catalog = validateResPlanCatalog(catalog); this.readShard = readShard; this.cache = new Map(); }
  static async fromURL(url = defaultResPlanCatalog, fetcher = globalThis.fetch) {
    const catalogURL = new URL(url), response = await fetcher(catalogURL);
    if (!response.ok) throw new Error('Could not load ResPlan catalog: HTTP ' + response.status);
    const text = await response.text(); if (text.length > 8 * 1024 * 1024) throw new Error('Catalog exceeds 8 MiB.');
    return new ResPlanLibrary(JSON.parse(text), async (file, signal) => {
      const result = await fetcher(new URL(file, catalogURL), { signal });
      if (!result.ok) throw new Error('Could not load ResPlan shard: HTTP ' + result.status);
      return result.text();
    });
  }
  static async fromFiles(files) {
    const manifests = Array.from(files).filter(f => f.name === 'catalog.json');
    if (manifests.length !== 1 || manifests[0].size > 8 * 1024 * 1024) throw new Error('Select a converted collection folder containing one catalog.json.');
    const manifest = manifests[0], prefix = manifest.webkitRelativePath?.slice(0, -manifest.name.length) ?? '';
    const byPath = new Map(Array.from(files).map(f => [f.webkitRelativePath || f.name, f]));
    return new ResPlanLibrary(JSON.parse(await manifest.text()), async file => {
      const item = byPath.get(prefix + file);
      if (!item || item.size > MAX_SHARD_BYTES) throw new Error('Collection shard is missing or exceeds 16 MiB: ' + file);
      return item.text();
    });
  }
  async load(spec, signal) {
    const entry = selectResPlan(this.catalog, spec);
    let text = this.cache.get(entry.file);
    if (!text) {
      text = await this.readShard(entry.file, signal);
      if (signal?.aborted) throw new DOMException('Superseded ResPlan request.', 'AbortError');
      // Keep at most four fetched shards; the full dataset is never loaded eagerly.
      if (this.cache.size >= 4) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(entry.file, text);
    }
    const record = await decodeResPlanShard(text, entry);
    if (signal?.aborted) throw new DOMException('Superseded ResPlan request.', 'AbortError');
    return record;
  }
}
