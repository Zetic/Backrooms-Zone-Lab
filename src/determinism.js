// No runtime clock or global random state participates in the plan.
export function canonicalStringify(value) {
  function normalize(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return Object.is(v, -0) ? 0 : v;
    if (Array.isArray(v)) return v.map(normalize);
    if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])]));
    }
    throw new TypeError('Canonical data must contain only finite JSON values.');
  }
  return JSON.stringify(normalize(value));
}

// FNV-1a over UTF-8, explicitly wrapping at 64 bits. Fingerprint, not cryptography.
export function fingerprint(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonicalStringify(value))) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function stream(input, namespace) {
  let state = Number(BigInt('0x' + fingerprint([input, namespace])) & 0xffffffffn) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
