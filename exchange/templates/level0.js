// Portable bounded subdivision template. No physical wall, fixture or mesh generation.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const level0 = {
    id: 'level0', name: 'Level 0',
    summary: 'An open office floor, with large rooms, circulation loops and solid masses.',
    dials: [
      { id: 'size', name: 'Size', low: '30 m', high: '90 m', value: 35, help: 'How much ground the floor covers' },
      { id: 'scale', name: 'Room scale', low: 'Small', high: 'Vast', value: 45, help: 'How large the rooms are' },
      { id: 'open', name: 'Openness', low: 'Walled', high: 'Open', value: 70, help: 'How many shared walls are left out or opened wide' },
      { id: 'gaps', name: 'Solid masses', low: 'None', high: 'Many', value: 40, help: 'Ground left unbuilt as blocks to walk around' }
    ],
    make(spec) {
      const input = api.inputs(level0, spec);
      if (input.error) return input;
      const d = input.dials, seed = api.stream(input.seed, 'zonelab/level0', 'seed');
      const side = api.dialSize(60, 180, d.size), least = api.dialSize(6, 14, d.scale), most = api.dialSize(16, 36, d.scale);
      const key = r => r.join('-'), compare = (a, b) => a[1] - b[1] || a[0] - b[0] || a[3] - b[3] || a[2] - b[2];
      let trouble = 'no attempt was accepted';
      for (let attempt = 0; attempt < 4; ++attempt) {
        const s = api.stream(seed, 'attempt', String(attempt)), leaves = [], todo = [[0, 0, side, side]];
        for (let step = 0; todo.length && step < 511; ++step) {
          const r = todo.pop(), w = r[2] - r[0], h = r[3] - r[1], longest = Math.max(w, h);
          const draw = api.stream(s, 'split/' + key(r), 'split'), fits = w <= most && h <= most;
          if (longest < 2 * least || (fits && (draw % 100 < 35 || longest < 2 * least + 2))) { leaves.push(r); continue; }
          const across = w >= h, at = least + Math.floor(draw / 100) % (longest - 2 * least + 1);
          if (across) { todo.push([r[0], r[1], r[0] + at, r[3]]); todo.push([r[0] + at, r[1], r[2], r[3]]); }
          else { todo.push([r[0], r[1], r[2], r[1] + at]); todo.push([r[0], r[1] + at, r[2], r[3]]); }
        }
        if (todo.length || leaves.length > 128) { trouble = 'subdivision exceeds the 128-space work bound; increase Room scale or reduce Size'; continue; }
        leaves.sort(compare);
        let arrival = 0, best = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < leaves.length; ++i) {
          const r = leaves[i], dx = r[0] + r[2] - side, dy = r[1] + r[3] - side, distance = dx * dx + dy * dy;
          if (distance < best) { best = distance; arrival = i; }
        }
        const spaces = [], pairs = [];
        let start = '';
        for (let i = 0; i < leaves.length; ++i) {
          const rect = leaves[i], path = key(rect);
          if (i !== arrival && api.stream(s, 'void/' + path, 'void') % 100 < Math.floor(d.gaps * 14 / 100)) continue;
          const id = 'r-' + path;
          spaces.push({ id, title: i === arrival ? 'Arrival room' : 'Room', kind: 'room', rect, floor: 0, ceiling: 270 });
          if (i === arrival) start = id;
        }
        for (let a = 0; a < spaces.length; ++a) for (let b = a + 1; b < spaces.length; ++b) {
          const wall = api.shared(spaces[a], spaces[b]);
          if (wall && wall.high - wall.low >= 4) pairs.push({ a, b, draw: api.stream(s, 'join/' + spaces[a].id + '/' + spaces[b].id, 'order') });
        }
        pairs.sort((a, b) => a.draw - b.draw || a.a - b.a || a.b - b.b);
        const groups = spaces.map((_, i) => i), joins = [];
        const find = index => { for (let step = 0; groups[index] !== index && step < 128; ++step) index = groups[index]; return index; };
        for (const pair of pairs) {
          const a = find(pair.a), b = find(pair.b), draw = pair.draw % 100;
          const mode = draw < 20 + Math.floor(d.open * 55 / 100) ? 'open' : draw < 55 + Math.floor(d.open * 40 / 100) ? 'wide' : 'door';
          if (a !== b || (pair.draw >>> 8) % 100 < 25 + Math.floor(d.open * 70 / 100)) {
            joins.push({ a: spaces[pair.a].id, b: spaces[pair.b].id, mode, required: a !== b });
            groups[a] = b;
          }
        }
        const root = find(spaces.findIndex(space => space.id === start));
        const kept = spaces.filter((_, i) => find(i) === root);
        const ids = kept.map(space => space.id), arrivalRoom = kept.find(space => space.id === start);
        const zone = {
          format: 'backrooms-zone', version: 1, id: 'level0-' + input.seed, name: 'Level 0 · seed ' + input.seed, theme: 'backrooms',
          notes: 'Broad rectangular spaces run together through wide and open joins. Unbuilt patches are solid masses. Feature dressing is left to a later physically checked template revision.',
          source: { template: 'level0-v1', seed: input.seed, dials: input.dials, lab: 'exchange-1' },
          start: { space: start, x: (arrivalRoom.rect[0] + arrivalRoom.rect[2]) / 2, y: (arrivalRoom.rect[1] + arrivalRoom.rect[3]) / 2 },
          spaces: kept, joins: joins.filter(join => ids.includes(join.a) && ids.includes(join.b)), entrances: []
        };
        // Complete tie order: longest stretch, then unique space id, then position.
        for (const way of ['n', 'e', 's', 'w']) {
          const options = [];
          for (const space of kept) for (const [lo, hi] of api.freeStretches(space, way, kept, zone)) if (hi - lo >= 4) options.push({ space, lo, hi });
          options.sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo) || (a.space.id < b.space.id ? -1 : a.space.id > b.space.id ? 1 : 0) || a.lo - b.lo);
          if (options.length) { const o = options[0]; zone.entrances.push({ title: way.toUpperCase() + ' entrance', space: o.space.id, side: way, at: (o.lo + o.hi) / 2 }); }
        }
        const checks = api.validate(zone);
        if (checks.valid) return zone;
        trouble = checks.errors.map(e => e.message).join('; ');
      }
      return { error: 'Level 0: no attempt accepted: ' + trouble };
    }
  };
  api.templates.push(level0);
}());
