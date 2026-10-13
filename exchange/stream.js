// Classic script: works from file:// and in Node. No renderer or mutable random state.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange = globalThis.ZoneExchange || {};
  function mix(s) {
    s = (s ^ (s >>> 16)) >>> 0; s = Math.imul(s, 0x7feb352d) >>> 0;
    s = (s ^ (s >>> 15)) >>> 0; s = Math.imul(s, 0x846ca68b) >>> 0;
    return (s ^ (s >>> 16)) >>> 0;
  }
  function stream(seed, path, name) {
    let h = mix((seed ^ 0x9e3779b9) >>> 0);
    for (let i = 0; i < path.length; ++i) { h = (h ^ path.charCodeAt(i)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
    h = mix((h ^ 0x85ebca6b) >>> 0);
    for (let i = 0; i < name.length; ++i) { h = (h ^ name.charCodeAt(i)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
    return mix((h ^ 0xc2b2ae35) >>> 0);
  }
  function inputs(template, spec) {
    if (!spec || !Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > 4294967295) return { error: 'Seed must be an unsigned 32-bit integer.' };
    const dials = {};
    for (let i = 0; i < template.dials.length; ++i) {
      const dial = template.dials[i], value = spec.dials?.[dial.id] ?? dial.value;
      if (!Number.isInteger(value) || value < 0 || value > 100) return { error: 'Dial ' + dial.id + ' must be a whole number from 0 to 100.' };
      dials[dial.id] = value;
    }
    if (spec.dials && Object.keys(spec.dials).some(id => !template.dials.some(d => d.id === id))) return { error: 'Unknown dial.' };
    return { seed: spec.seed, dials };
  }
  // Non-negative integer arithmetic; identical to (delta*dial+50)/100 in C++.
  function dialSize(lo, hi, dial) { return lo + Math.floor(((hi - lo) * dial + 50) / 100); }
  Object.assign(api, { stream, inputs, dialSize, templates: [] });
}());
