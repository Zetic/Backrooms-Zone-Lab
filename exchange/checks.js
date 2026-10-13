// backrooms-zone/1 data checks. Unreal Generate remains the physical authority.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const kinds = ['room', 'hall', 'stair'], modes = ['door', 'wide', 'open', 'climb', 'drop', 'view'];
  const sides = ['n', 'e', 's', 'w'], shapes = ['rect', 'L', 'T', 'U', 'ring'];
  const identifier = /^[a-z0-9-]+$/;
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const integer = Number.isSafeInteger;
  const text = v => typeof v === 'string';
  const ceiling = (s, zone) => s.ceiling ?? ((s.theme ?? zone.theme) === 'backrooms' ? 270 : 250);
  const top = (s, zone) => s.floor + (s.kind === 'stair' ? s.rise : 0) + ceiling(s, zone);
  function shared(a, b) {
    const r = a.rect, q = b.rect;
    if (r[2] === q[0] || q[2] === r[0]) {
      const low = Math.max(r[1], q[1]), high = Math.min(r[3], q[3]);
      if (high > low) return { axis: 'y', plane: r[2] === q[0] ? r[2] : r[0], low, high, aSide: r[2] === q[0] ? 'e' : 'w' };
    }
    if (r[3] === q[1] || q[3] === r[1]) {
      const low = Math.max(r[0], q[0]), high = Math.min(r[2], q[2]);
      if (high > low) return { axis: 'x', plane: r[3] === q[1] ? r[3] : r[1], low, high, aSide: r[3] === q[1] ? 'n' : 's' };
    }
    return null;
  }
  const opposite = side => ({ n: 's', s: 'n', e: 'w', w: 'e' })[side];
  function endpointFloor(s, side) {
    if (s.kind !== 'stair') return s.floor;
    if (side === s.foot) return s.floor;
    if (side === opposite(s.foot)) return s.floor + s.rise;
    return null;
  }
  function freeStretches(space, side, spaces, zone) {
    const horizontal = side === 'n' || side === 's', r = space.rect;
    let free = [[horizontal ? r[0] : r[1], horizontal ? r[2] : r[3]]];
    const floor = endpointFloor(space, side);
    for (const other of spaces) {
      if (other.id === space.id || other.floor >= floor + ceiling(space, zone) + 40 || top(other, zone) + 40 <= floor) continue;
      const wall = shared(space, other);
      if (!wall || wall.aSide !== side) continue;
      const next = [];
      for (const [lo, hi] of free) {
        if (wall.high <= lo || wall.low >= hi) next.push([lo, hi]);
        else { if (wall.low > lo) next.push([lo, wall.low]); if (wall.high < hi) next.push([wall.high, hi]); }
      }
      free = next;
    }
    return free;
  }
  function validate(zone) {
    const errors = [], warnings = [], links = [];
    const fail = (code, message, space, join) => errors.push({ code, message, ...(space ? { space } : {}), ...(join !== undefined ? { join } : {}) });
    const warn = (code, message, space, join) => warnings.push({ code, message, ...(space ? { space } : {}), ...(join !== undefined ? { join } : {}) });
    const keys = (value, allowed, label, space, join) => {
      for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('field', label + ': unsupported field ' + key, space, join);
    };
    const result = () => ({ valid: errors.length === 0, errors, warnings, links });
    if (!object(zone)) { fail('format', 'The zone must be an object.'); return result(); }
    keys(zone, ['format', 'version', 'id', 'name', 'theme', 'notes', 'source', 'start', 'spaces', 'joins', 'entrances'], 'zone');
    if (zone.format !== 'backrooms-zone' || zone.version !== 1) fail('format', 'Expected backrooms-zone version 1. Geometry-study JSON cannot be converted automatically.');
    if (!text(zone.id) || !identifier.test(zone.id)) fail('id', 'Zone id must use lowercase letters, digits and hyphens.');
    if (!text(zone.name) || !zone.name.trim()) fail('name', 'Zone name is required.');
    if (!text(zone.theme) || !zone.theme.trim()) fail('theme', 'A theme name is required.');
    else if (!['backrooms', 'residential'].includes(zone.theme)) {
      if (!text(zone.notes) || !zone.notes.trim()) fail('theme', 'Describe the new theme in notes.');
      warn('theme', 'Unreal will use a fallback until theme ' + zone.theme + ' is implemented.');
    }
    if (zone.notes !== undefined && !text(zone.notes)) fail('notes', 'Notes must be text.');
    if (zone.source !== undefined) {
      if (!object(zone.source)) fail('source', 'Source must be an object.');
      else {
        keys(zone.source, ['template', 'seed', 'dials', 'lab'], 'source');
        if (!text(zone.source.template) || !text(zone.source.lab)) fail('source', 'Source template and lab must be strings.');
        if (!integer(zone.source.seed) || zone.source.seed < 0 || zone.source.seed > 4294967295) fail('source', 'Source seed must be an unsigned 32-bit integer.');
        if (!object(zone.source.dials) || Object.values(zone.source.dials).some(v => !integer(v) || v < 0 || v > 100)) fail('source', 'Source dials must be whole numbers from 0 to 100.');
      }
    }
    if (!Array.isArray(zone.spaces) || zone.spaces.length < 1 || zone.spaces.length > 128) fail('counts', 'Use 1 to 128 spaces.');
    if (!Array.isArray(zone.joins) || zone.joins.length > 256) fail('counts', 'Use at most 256 joins.');
    if (!Array.isArray(zone.spaces) || !Array.isArray(zone.joins) || zone.spaces.length > 128 || zone.joins.length > 256) return result();
    const spaces = [], byId = new Map();
    for (let i = 0; i < zone.spaces.length; ++i) {
      const s = zone.spaces[i], label = 'space ' + (s?.id ?? i);
      if (!object(s)) { fail('space', label + ' must be an object.'); continue; }
      const before = errors.length;
      keys(s, ['id', 'title', 'kind', 'rect', 'floor', 'ceiling', 'role', 'theme', 'features', 'rise', 'foot'], label, s.id);
      if (!text(s.id) || !identifier.test(s.id) || byId.has(s.id)) fail('id', label + ': invalid or duplicate id.', s.id);
      if (!text(s.title) || !s.title.trim()) fail('title', label + ': a title is required.', s.id);
      if (!kinds.includes(s.kind)) fail('kind', label + ': expected room, hall or stair.', s.id);
      const rectOK = Array.isArray(s.rect) && s.rect.length === 4 && s.rect.every(v => integer(v) && Math.abs(v) <= 10000000) && s.rect[2] > s.rect[0] && s.rect[3] > s.rect[1];
      if (!rectOK) fail('grid', label + ': rectangle needs four ordered integers within Unreal coordinate bounds.', s.id);
      if (!integer(s.floor) || s.floor % 10 !== 0 || Math.abs(s.floor) > 99998000) fail('grid', label + ': floor must be centimetres in steps of 10.', s.id);
      const c = ceiling(s, zone);
      if (!integer(c) || c % 10 !== 0 || c < 200 || c > 800) fail('ceiling', label + ': ceiling must be 200–800 cm in steps of 10.', s.id);
      if (s.theme !== undefined && (!text(s.theme) || !s.theme.trim())) fail('theme', label + ': theme must be a name.', s.id);
      else if (s.theme && !['backrooms', 'residential'].includes(s.theme)) {
        if (!text(zone.notes) || !zone.notes.trim()) fail('theme', label + ': describe the new theme in zone notes.', s.id);
        warn('theme', label + ': Unreal will use a fallback theme.', s.id);
      }
      if (s.role !== undefined && !text(s.role)) fail('role', label + ': role must be text.', s.id);
      if (rectOK) {
        const w = s.rect[2] - s.rect[0], h = s.rect[3] - s.rect[1];
        if (s.kind === 'stair') {
          const alongY = s.foot === 'n' || s.foot === 's', width = alongY ? w : h, length = alongY ? h : w;
          if (!sides.includes(s.foot) || !integer(s.rise) || s.rise % 10 || s.rise < 10 || s.rise > 1200 || width < 3 || width > 8 || length < width || length > 84 || length < 4 + Math.ceil(s.rise / 29)) fail('stair', label + ': invalid rise, foot, width or run + 4-unit landings (run at most 80 units).', s.id);
        } else {
          if (w < 3 || h < 3 || w > 40 || h > 40) fail('size', label + ': room sides must be 3–40 units.', s.id);
          if (s.rise !== undefined || s.foot !== undefined) fail('stair', label + ': rise and foot are only for stairs.', s.id);
        }
        if (s.features !== undefined) {
          if (!object(s.features) || s.kind === 'stair') fail('features', label + ': features are only for rooms and halls.', s.id);
          else {
            keys(s.features, ['shape', 'columns', 'divider', 'screen'], label + ' features', s.id);
            const f = s.features;
            if (f.shape !== undefined && (!shapes.includes(f.shape) || (f.shape !== 'rect' && Math.min(w, h) < (f.shape === 'ring' ? 12 : 8)))) fail('features', label + ': shape does not fit.', s.id);
            if (f.columns !== undefined && (![0, 1, 2].includes(f.columns) || (f.columns > 0 && Math.min(w, h) < 10))) fail('features', label + ': columns need a narrow side of at least 10 units.', s.id);
            for (const field of ['divider', 'screen']) if (f[field] !== undefined && typeof f[field] !== 'boolean') fail('features', label + ': ' + field + ' must be boolean.', s.id);
            if ((f.shape && f.shape !== 'rect') || f.columns || f.divider || f.screen) warn('physical', label + ': feature placement and opening clearance need Unreal Generate verification.', s.id);
          }
        }
      }
      if (!byId.has(s.id)) byId.set(s.id, s);
      if (before === errors.length) spaces.push(s);
    }
    for (let i = 0; i < spaces.length; ++i) for (let j = i + 1; j < spaces.length; ++j) {
      const a = spaces[i], b = spaces[j], r = a.rect, q = b.rect;
      if (Math.max(r[0], q[0]) < Math.min(r[2], q[2]) && Math.max(r[1], q[1]) < Math.min(r[3], q[3]) && !(a.floor >= top(b, zone) + 40 || b.floor >= top(a, zone) + 40)) fail('overlap', a.id + ' overlaps ' + b.id + ' without 40 cm vertical clearance.', a.id);
    }
    const pairs = new Set(), graph = new Map(spaces.map(s => [s.id, []])), reverse = new Map(spaces.map(s => [s.id, []]));
    const stairEnds = new Map(spaces.filter(s => s.kind === 'stair').map(s => [s.id, []]));
    const edge = (a, b) => { graph.get(a).push(b); reverse.get(b).push(a); };
    for (let i = 0; i < zone.joins.length; ++i) {
      const j = zone.joins[i], label = 'join ' + i + ' (' + (j?.a ?? '?') + '/' + (j?.b ?? '?') + ')';
      if (!object(j)) { fail('join', label + ' must be an object.', undefined, i); continue; }
      keys(j, ['a', 'b', 'mode', 'required', 'at'], label, undefined, i);
      const a = byId.get(j.a), b = byId.get(j.b), pair = [j.a, j.b].sort().join('/');
      if (!a || !b || a === b || !spaces.includes(a) || !spaces.includes(b)) { fail('join', label + ': two valid distinct spaces are required.', undefined, i); continue; }
      if (pairs.has(pair)) fail('join', label + ': duplicate pair ' + pair, undefined, i);
      pairs.add(pair);
      if (!modes.includes(j.mode)) { fail('mode', label + ': unknown connection mode.', undefined, i); continue; }
      if (j.required !== undefined && typeof j.required !== 'boolean') fail('join', label + ': required must be boolean.', undefined, i);
      const wall = shared(a, b);
      if (!wall) { fail('shared', label + ': ' + pair + ' has no shared wall.', undefined, i); continue; }
      if (j.at !== undefined && (!finite(j.at) || j.at < wall.low || j.at > wall.high)) fail('position', label + ': at must lie on the shared stretch.', undefined, i);
      const fa = endpointFloor(a, wall.aSide), fb = endpointFloor(b, opposite(wall.aSide));
      if (fa === null || fb === null) { fail('stair', label + ': nothing may join a stair long side.', undefined, i); continue; }
      for (const [s, side, other] of [[a, wall.aSide, b], [b, opposite(wall.aSide), a]]) if (s.kind === 'stair') {
        stairEnds.get(s.id).push({ side, mode: j.mode, otherFloor: s === a ? fb : fa });
        if ((other.features?.shape && other.features.shape !== 'rect') || other.features?.columns || other.features?.divider || other.features?.screen) fail('stair', other.id + ': keep stair landings plain so required openings remain clear.', other.id, i);
      }
      const stretch = wall.high - wall.low, rise = Math.abs(fa - fb);
      let mode = j.mode, width = mode === 'open' ? stretch * 50 : mode === 'wide' ? (stretch >= 8 ? 300 : 200) : 100;
      if (mode === 'wide' && stretch >= 4 && stretch < 6) { mode = 'door'; width = 100; warn('fallback', label + ': wide falls back to door on ' + stretch + ' units.', undefined, i); }
      if (stretch < (mode === 'open' ? 2 : mode === 'wide' ? 6 : 4)) fail('stretch', label + ': shared stretch is too short for ' + mode + '.', undefined, i);
      if ((['door', 'wide', 'open'].includes(mode) && rise !== 0) || (mode === 'climb' && (rise < 20 || rise > 110)) || (mode === 'drop' && (rise < 120 || rise > 300))) fail('floors', label + ': floor difference ' + rise + ' cm is incompatible with ' + mode + '.', undefined, i);
      if (mode !== 'view' && Math.min(top(a, zone), top(b, zone)) - Math.max(fa, fb) < 190) fail('headroom', label + ': less than 190 cm common headroom; not a human route.', undefined, i);
      if (mode === 'view' && Math.min(top(a, zone), top(b, zone)) - Math.max(fa, fb) < 33) fail('headroom', label + ': no common height for a 30 cm view slot and reserve.', undefined, i);
      links.push({ index: i, a: a.id, b: b.id, mode, width, wall, fa, fb });
      if (mode !== 'view') { if (mode !== 'drop' || fa > fb) edge(a.id, b.id); if (mode !== 'drop' || fb > fa) edge(b.id, a.id); }
    }
    for (const s of spaces) if (s.kind === 'stair') {
      const ends = stairEnds.get(s.id);
      if (ends.length !== 2 || !ends.some(e => e.side === s.foot && e.otherFloor === s.floor && ['door', 'wide', 'open'].includes(e.mode)) || !ends.some(e => e.side === opposite(s.foot) && e.otherFloor === s.floor + s.rise && ['door', 'wide', 'open'].includes(e.mode))) fail('stair', s.id + ': needs exactly one passable foot join and one head join at matching heights.', s.id);
    }
    const start = zone.start;
    if (!object(start)) fail('start', 'Start must name a space and an interior point.');
    else {
      keys(start, ['space', 'x', 'y'], 'start');
      const s = spaces.find(s => s.id === start.space);
      if (!s || s.kind === 'stair' || !finite(start.x) || !finite(start.y) || start.x <= s.rect[0] || start.x >= s.rect[2] || start.y <= s.rect[1] || start.y >= s.rect[3]) fail('start', 'Start must be strictly inside a room or hall.', start.space);
      else {
        if ((s.features?.shape && s.features.shape !== 'rect') || s.features?.columns || s.features?.divider || s.features?.screen) fail('start', 'Keep the start space plain so its support is known.', s.id);
        const reach = adjacency => {
          const found = new Set([s.id]), todo = [s.id];
          for (let i = 0; i < todo.length && i < 128; ++i) for (const next of adjacency.get(todo[i]) ?? []) if (!found.has(next)) { found.add(next); todo.push(next); }
          return found;
        };
        const outward = reach(graph), home = reach(reverse);
        for (const space of spaces) {
          if (!outward.has(space.id)) fail('reach', space.id + ': cannot be reached from the start.', space.id);
          if (!home.has(space.id)) fail('return', space.id + ': has no way back to the start.', space.id);
        }
      }
    }
    if (zone.entrances !== undefined && (!Array.isArray(zone.entrances) || zone.entrances.length > 512)) fail('entrance', 'Entrances must be an array of at most 512 items.');
    else for (const e of zone.entrances ?? []) {
      if (!object(e)) { fail('entrance', 'Entrance must be an object.'); continue; }
      keys(e, ['title', 'space', 'side', 'at'], 'entrance', e.space);
      const s = spaces.find(s => s.id === e.space);
      if (!s || !text(e.title) || !sides.includes(e.side) || !finite(e.at) || s.kind === 'stair') { fail('entrance', 'Entrance needs a title, room/hall, side and finite coordinate.', e.space); continue; }
      if (!freeStretches(s, e.side, spaces, zone).some(([lo, hi]) => hi - lo >= 4 && e.at >= lo + 2 && e.at <= hi - 2)) fail('entrance', e.title + ': need 4 units of unobstructed outer wall centred on at.', e.space);
    }
    return result();
  }
  function sorted(value) {
    if (Array.isArray(value)) return value.map(sorted);
    if (!object(value)) return value;
    const out = Object.create(null);
    for (const key of Object.keys(value).sort()) out[key] = sorted(value[key]);
    return out;
  }
  function serialize(zone) {
    const checks = validate(zone);
    if (!checks.valid) throw new Error(checks.errors.map(e => e.message).join('\n'));
    const copy = JSON.parse(JSON.stringify(zone));
    copy.spaces.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    copy.joins = copy.joins.map(j => j.a < j.b ? j : { ...j, a: j.b, b: j.a });
    copy.joins.sort((a, b) => a.a < b.a ? -1 : a.a > b.a ? 1 : a.b < b.b ? -1 : a.b > b.b ? 1 : 0);
    if (copy.entrances) copy.entrances.sort((a, b) => { const x = [a.space, a.side, a.at, a.title].join('/'), y = [b.space, b.side, b.at, b.title].join('/'); return x < y ? -1 : x > y ? 1 : 0; });
    return JSON.stringify(sorted(copy), null, 2) + '\n';
  }
  function facts(zone) {
    const spaces = zone.spaces, x0 = Math.min(...spaces.map(s => s.rect[0])), y0 = Math.min(...spaces.map(s => s.rect[1]));
    const x1 = Math.max(...spaces.map(s => s.rect[2])), y1 = Math.max(...spaces.map(s => s.rect[3]));
    const counts = Object.fromEntries(kinds.map(k => [k, spaces.filter(s => s.kind === k).length]));
    const links = validate(zone).links;
    return { bounds: [x0, y0, x1, y1], widthM: (x1 - x0) / 2, depthM: (y1 - y0) / 2,
      allocationAreaM2: spaces.reduce((n, s) => n + (s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]) / 4, 0), counts,
      floors: [...new Set(spaces.flatMap(s => s.kind === 'stair' ? [s.floor, s.floor + s.rise] : [s.floor]))].sort((a, b) => a - b),
      joins: Object.fromEntries(modes.map(m => [m, links.filter(l => l.mode === m).length])) };
  }
  Object.assign(api, { validate, serialize, facts, shared, endpointFloor, opposite, ceiling, freeStretches });
}());
