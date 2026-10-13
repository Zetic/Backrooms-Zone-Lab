// Offices v2: independent department spines and functional room programs.
// All plan decisions use named integer draws; full geometry uses the same composition.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const offices = {
    id: 'offices', version: 2, name: 'Offices', attempts: 16, workLimit: 20000,
    summary: 'A central visitor/service hub with independent department wings, differently sized offices and team spaces. Compare the angled reference design as full geometry.',
    dials: [
      { id: 'size', name: 'Size', low: 'Small company', high: 'Large departments', value: 40, help: 'Room capacities and the number of rooms in each department' },
      { id: 'wings', name: 'Wings', low: '1 spine', high: '6 wings', value: 20, help: 'Independent sections: 1 at 0, 2 at 20, 3 at 40, 4 at 60, 5 at 80, 6 at 100. Extra wings branch from outer junctions.' },
      { id: 'open', name: 'Openness', low: 'Private offices', high: 'Team workplaces', value: 35, help: 'Workplace type and capacity: open team rooms receive larger floor allocations' },
      { id: 'sprawl', name: 'Sprawl', low: 'Compact', high: 'Long / separated', value: 0, help: 'Approach length and breathing space between departmental groups, independently of wing count' },
      { id: 'strange', name: 'Strangeness', low: 'Conventional', high: 'Wrong workplace', value: 0, help: 'Permits stretched rooms, repetition, displaced functions, chained access, empty branches and ceiling variation' }
    ],
    presets: [
      { name: 'Standard office', dials: { size: 40, wings: 0, open: 35, sprawl: 0, strange: 0 } },
      { name: 'Private practice', dials: { size: 15, wings: 0, open: 0, sprawl: 0, strange: 0 } },
      { name: 'Open workplace', dials: { size: 70, wings: 20, open: 100, sprawl: 0, strange: 0 } },
      { name: 'Department wings', dials: { size: 70, wings: 60, open: 45, sprawl: 40, strange: 0 } },
      { name: 'After hours', dials: { size: 50, wings: 40, open: 20, sprawl: 35, strange: 60 } },
      { name: 'Wrong workplace', dials: { size: 75, wings: 100, open: 65, sprawl: 90, strange: 95 } },
      { name: 'Reference floor', dials: { size: 65, wings: 20, open: 15, sprawl: 20, strange: 0 } }
    ],
    make(spec) { return api.generateTemplate(offices, spec, d => offices.compose(d).zone); },
    design(spec) {
      let model;
      const zone = api.generateTemplate(offices, spec, d => { model = offices.compose(d); return model.zone; });
      return zone.error ? zone : { zone, layout: model.layout };
    },
    compose(d) {
      const { size, wings, open, sprawl, strange } = d.dials;
      const count = 1 + Math.floor(wings * 5 / 100), hw = strange >= 30 ? 4 + 2 * Math.floor((strange - 30) / 40) : 4;
      const cx = 10 + Math.floor(size / 50), cy = 8 + Math.floor(size / 50), X = cx + hw, Y = cy + hw;
      const spaces = [], joins = [], layout = { hw, cx, cy, wings: [], groups: {}, source: 'office-v2' };
      const titles = { reception: 'Reception', meeting: 'Visitor meeting', conference: 'Team meeting', office: 'Private office', work: 'Team workplace', washroom: 'Washrooms', break: 'Break room', copy: 'Copy room', server: 'Server room', store: 'Supply store', team: 'Department lounge', hall: 'Corridor', exit: 'Exit / stair lobby' };
      const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
      const uv = (f, u, v) => [f.x + u * dx[f.dir] - v * dy[f.dir], f.y + u * dy[f.dir] + v * dx[f.dir]];
      const rect = (f, u0, u1, v0, v1) => { const a = uv(f, u0, v0), b = uv(f, u1, v1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
      const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      function add(role, r, id, group = 'hub') {
        d.step(); if (spaces.some(s => overlap(s.rect, r))) throw new Error(id + ': room allocation collides with another section.');
        const ceiling = strange >= 85 && role !== 'hall' && d.chance(id + '/ceiling', 70) ? 220 + 10 * d.pick(id + '/height', 0, 16) : 270;
        const s = { id, title: titles[role], kind: ['hall', 'exit'].includes(role) ? 'hall' : 'room', role, rect: r, floor: 0, ceiling };
        spaces.push(s); layout.groups[id] = group; return s;
      }
      function join(a, b, mode = 'door') {
        d.step(); const wall = api.shared(a, b);
        if (!wall || wall.high - wall.low < (mode === 'open' ? 2 : 4)) throw new Error(a.id + '/' + b.id + ': required passage has insufficient shared wall.');
        if (!joins.some(j => j.a === a.id && j.b === b.id || j.a === b.id && j.b === a.id)) joins.push({ a: a.id, b: b.id, mode, required: true });
      }
      // A real central circulation ring around the shared support cluster.
      const H = {};
      H.east = add('hall', [cx, -cy, X, cy], 'hub-east'); H.north = add('hall', [-cx, cy, cx, Y], 'hub-north');
      H.west = add('hall', [-X, -cy, -cx, cy], 'hub-west'); H.south = add('hall', [-cx, -Y, cx, -cy], 'hub-south');
      H.ne = add('hall', [cx, cy, X, Y], 'hub-ne'); H.nw = add('hall', [-X, cy, -cx, Y], 'hub-nw');
      H.sw = add('hall', [-X, -Y, -cx, -cy], 'hub-sw'); H.se = add('hall', [cx, -Y, X, -cy], 'hub-se');
      const ring = [H.east, H.ne, H.north, H.nw, H.west, H.sw, H.south, H.se];
      for (let i = 0; i < ring.length; ++i) if (!(i === 7 && strange >= 40)) join(ring[i], ring[(i + 1) % ring.length], 'open');
      const reception = add('reception', [-hw / 2 - 4, -Y - 6, hw / 2 + 4, -Y], 'reception'); join(reception, H.south, 'open');
      const publicDepth = 8 + Math.floor(size / 35), publicWidth = 8 + Math.floor(size / 30);
      for (const side of [-1, 1]) {
        const r = side < 0 ? [-hw / 2 - 4 - publicWidth, -Y - publicDepth, -hw / 2 - 4, -Y] : [hw / 2 + 4, -Y - publicDepth, hw / 2 + 4 + publicWidth, -Y];
        const s = add(strange >= 65 && side === 1 ? 'server' : 'meeting', r, side < 0 ? 'visitor-meeting-left' : 'visitor-meeting-right'); join(reception, s, 'door');
      }
      const split = -2 + d.pick('services/washroom-height', 0, 2);
      join(H.west, add('washroom', [-cx, -cy, 0, split], 'core-washroom'));
      join(H.west, add('break', [-cx, split, 0, cy], 'core-break'));
      const lo = -cy + 4, hi = lo + 4;
      join(H.east, add(strange >= 65 ? 'meeting' : 'server', [0, -cy, cx, lo], 'core-server'));
      join(H.east, add('copy', [0, lo, cx, hi], 'core-copy'));
      join(H.east, add('store', [0, hi, cx, cy], 'core-store'));
      const sizes = { office: [6, 9, 6, 10], work: [12, 18, 10, 16], conference: [9, 14, 8, 12], team: [8, 12, 7, 11], copy: [4, 5, 4, 6], store: [4, 6, 4, 8] };
      function program(index, side) {
        const rooms = [], n = 4 + Math.floor(size / 65);
        for (let k = 0; k < n; ++k) {
          const id = 'wing-' + index + '-room-' + side + '-' + k;
          let role = k === n - 1 && side === 0 ? 'conference' : k === 0 && side === 1 ? 'team' : d.chance(id + '/open', open) ? 'work' : 'office';
          if (strange >= 50 && k === n - 1 && side === 1) role = d.chance(id + '/repeat', 50) ? 'copy' : 'store';
          const range = sizes[role], length = api.dialSize(range[0], range[1], size) + d.pick(id + '/length', 0, 2);
          let depth = api.dialSize(range[2], range[3], size) + d.pick(id + '/depth', 0, 2);
          if (strange >= 20 && d.chance(id + '/elongate', strange)) depth = Math.min(30, depth + Math.floor(strange / 8));
          rooms.push({ id, role, length, depth });
        }
        return rooms;
      }
      function wing(index, f, parent, parentWing = null) {
        const group = 'wing-' + index, sides = [program(index, 0), program(index, 1)];
        const lead = (count <= 2 ? 4 : 18) + Math.floor(sprawl / 12) + Math.floor(strange / 8), rooms = []; let length = lead;
        for (let side = 0; side < 2; ++side) {
          let u = lead;
          for (let k = 0; k < sides[side].length; ++k) {
            const item = sides[side][k];
            if (k === 2 && sprawl >= 35) u += 4 + Math.floor(sprawl / 25);
            const r = side === 0 ? rect(f, u, u + item.length, hw, hw + item.depth) : rect(f, u, u + item.length, -item.depth, 0);
            rooms.push({ ...item, side, from: u, to: u + item.length, space: add(item.role, r, item.id, group) }); u += item.length;
          }
          length = Math.max(length, u);
        }
        // Split long spines while every room retains at least a 2 m door-bearing stretch.
        const cuts = [0]; let from = 0;
        while (length - from > 36) {
          let cut = Math.min(from + 36, length - 4);
          while (cut > from + 4 && rooms.some(r => r.from < cut && r.to > cut && Math.max(cut - r.from, r.to - cut) < 4)) --cut;
          if (cut <= from + 4) throw new Error(group + ': bounded corridor split cannot preserve doors.');
          cuts.push(cut); from = cut;
        }
        cuts.push(length); const halls = [];
        for (let k = 0; k < cuts.length - 1; ++k) { const s = add('hall', rect(f, cuts[k], cuts[k + 1], 0, hw), group + '-hall-' + k, group); if (k) join(halls[k - 1], s, 'open'); halls.push(s); }
        join(parent, halls[0], 'open');
        for (const room of rooms) {
          const options = halls.map(s => ({ s, wall: api.shared(s, room.space) })).filter(a => a.wall && a.wall.high - a.wall.low >= 4);
          options.sort((a, b) => (b.wall.high - b.wall.low) - (a.wall.high - a.wall.low) || (a.s.id < b.s.id ? -1 : 1));
          if (!options.length) throw new Error(room.id + ': no usable corridor frontage.');
          const previous = rooms.find(r => r.side === room.side && r.to === room.from && ['office', 'work'].includes(r.role));
          if (strange >= 75 && previous && ['office', 'work'].includes(room.role) && api.shared(previous.space, room.space)?.high - api.shared(previous.space, room.space)?.low >= 4) join(previous.space, room.space);
          else join(options[0].s, room.space, room.role === 'work' ? 'open' : room.role === 'conference' ? 'wide' : 'door');
        }
        const junction = add('hall', rect(f, length, length + hw, 0, hw), group + '-junction', group); join(halls.at(-1), junction, 'open');
        const exit = add('exit', rect(f, length + hw, length + hw + 6, -2, hw + 2), group + '-exit', group); join(junction, exit);
        if (strange >= 40) { const empty = add('hall', rect(f, length + hw + 6, length + hw + 14, 0, hw), group + '-empty', group); join(exit, empty, 'open'); }
        const record = { index, group, frame: f, parentId: parent.id, parentWing, junctionId: junction.id, length, rooms: rooms.map(r => ({ id: r.id, role: r.role, side: r.side, length: r.length, depth: r.depth })) };
        layout.wings.push(record); return record;
      }
      const primary = [ { x: X, y: -hw / 2, dir: 0, parent: H.east }, { x: -X, y: hw / 2, dir: 2, parent: H.west }, { x: -hw / 2, y: Y, dir: 1, parent: H.north }, { x: -hw / 2, y: -Y - 6, dir: 3, parent: reception } ];
      for (let i = 0; i < Math.min(count, 4); ++i) { const { parent, ...f } = primary[i]; wing(i, f, parent); }
      for (let i = 4; i < count; ++i) {
        const p = layout.wings[i - 4], at = uv(p.frame, p.length + hw, hw), parent = spaces.find(s => s.id === p.junctionId);
        wing(i, { x: at[0], y: at[1], dir: (p.frame.dir + 1) % 4 }, parent, p.index);
      }
      const zone = { format: 'backrooms-zone', version: 1, id: 'offices-' + d.seed, name: 'Offices · seed ' + d.seed, theme: 'backrooms',
        notes: 'Office v2: central visitor/service hub, ' + count + ' independent department spines, role-specific room capacities, larger team rooms and exit lobbies. This rectangular exchange is a separate layout; the angled full design is available in office.html.',
        source: { template: api.templateKey(offices), seed: d.seed, dials: d.dials, lab: 'exchange-4' }, start: { space: reception.id, x: 0, y: -Y - 3 }, spaces, joins,
        entrances: [{ title: 'Visitor entrance', space: reception.id, side: 's', at: count >= 4 ? -hw / 2 - 2 : 0 }] };
      // Multiple wings have independent future zone-connection opportunities at their ends.
      for (const w of layout.wings) {
        const exit = spaces.find(s => s.id === 'wing-' + w.index + '-exit'), side = ['n', 'w', 's', 'e'][w.frame.dir], p = uv(w.frame, w.length + hw + 3, hw + 2);
        zone.entrances.push({ title: 'Wing ' + (w.index + 1) + ' exit', space: exit.id, side, at: side === 'n' || side === 's' ? p[0] : p[1] });
      }
      return { zone, layout };
    },
    rules(zone, dials) {
      const S = [...zone.spaces].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), at = new Map(S.map((s, i) => [s.id, i])), next = S.map(() => new Set());
      for (const j of zone.joins) if (j.mode !== 'view' && at.has(j.a) && at.has(j.b)) { next[at.get(j.a)].add(at.get(j.b)); next[at.get(j.b)].add(at.get(j.a)); }
      const work = r => r === 'work' || r === 'office', circ = r => r === 'hall' || r === 'reception' || r === 'exit', service = r => ['washroom', 'break', 'copy', 'server', 'store'].includes(r);
      const count = role => S.filter(s => s.role === role).length, area = s => (s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]);
      const opens = (k, test) => [...next[k]].some(n => test(S[n].role)), R = [];
      const relax = (dial, at) => ({ dial, at, name: dial === 'strange' ? 'Strangeness' : dial === 'wings' ? 'Wings' : 'Sprawl' });
      const add = (id, name, kept, detail, permits = []) => R.push(api.rule(id, name, kept, detail, permits, dials));
      add('arrival', 'Visitors start in reception', S[at.get(zone.start.space)]?.role === 'reception', 'Start is outside reception.');
      add('visitor-entry', 'The visitor entrance opens into reception', zone.entrances.some(e => e.title === 'Visitor entrance' && S[at.get(e.space)]?.role === 'reception'), 'No visitor entrance into reception.');
      add('program', 'The floor has workplaces and essential shared services', S.some(s => work(s.role)) && ['washroom', 'break', 'copy', 'server', 'store'].every(r => count(r) >= 1), 'A required workplace or shared service is missing.');
      add('meeting', 'Visitor meeting rooms open directly from reception', S.every((s, k) => s.role !== 'meeting' || opens(k, r => r === 'reception')), 'A meeting room is inside the staff floor.', [relax('strange', 65)]);
      add('visitor-buffer', 'Reception opens onto meetings or circulation, not staff services', S.every((s, k) => s.role !== 'reception' || [...next[k]].every(n => S[n].role === 'meeting' || S[n].role === 'hall')), 'A staff function opens directly onto reception.', [relax('strange', 65)]);
      add('work-access', 'Every workplace opens from circulation', S.every((s, k) => !work(s.role) || opens(k, circ)), 'A workplace is reached only through another workplace.', [relax('strange', 75)]);
      add('service-access', 'Shared services open from a corridor', S.every((s, k) => !service(s.role) || opens(k, r => r === 'hall')), 'A shared service is reached through a room or reception.', [relax('strange', 65)]);
      add('service-counts', 'Shared services form one clear support group', ['washroom', 'break', 'copy', 'server', 'store'].every(r => count(r) === 1), 'Shared services repeat in separate parts of the floor.', [relax('strange', 50)]);
      add('meeting-counts', 'There are one to three meeting rooms', count('meeting') >= 1 && count('meeting') <= 3, 'Meeting rooms are missing or repeat excessively.', [relax('strange', 50)]);
      const proportion = S.every(s => { if (!work(s.role) && !['meeting', 'conference'].includes(s.role)) return true; const w = s.rect[2] - s.rect[0], h = s.rect[3] - s.rect[1]; return Math.min(w, h) >= 5 && Math.max(w, h) <= 2 * Math.min(w, h); });
      add('proportions', 'Work and meeting rooms have conventional proportions', proportion, 'A work or meeting room is unusually elongated.', [relax('strange', 20)]);
      const hallArea = S.filter(s => s.role === 'hall').reduce((a, s) => a + area(s), 0), total = S.reduce((a, s) => a + area(s), 0);
      add('hall-share', 'Corridors take no more than 40% of the floor', hallArea / total <= .4, Math.round(hallArea / total * 100) + '% of the allocation is corridor.', [relax('sprawl', 35), relax('strange', 30), relax('wings', 40)]);
      add('hall-width', 'Corridors are a consistent 2–2.5 m wide', S.every(s => s.role !== 'hall' || (Math.min(s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]) >= 4 && Math.min(s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]) <= 5)), 'A corridor has an unusually broad cross section.', [relax('strange', 30)]);
      add('dead-ends', 'Corridors do not end beyond the last room', S.every((s, k) => s.role !== 'hall' || next[k].size >= 2), 'An empty corridor ends without a room.', [relax('strange', 40)]);
      const group = S.map((_, k) => k), find = k => { while (group[k] !== k) { group[k] = group[group[k]]; k = group[k]; } return k; }; let cycle = false;
      for (let k = 0; k < S.length; ++k) if (circ(S[k].role)) for (const n of next[k]) if (n > k && circ(S[n].role)) { const a = find(k), b = find(n); if (a === b) cycle = true; else group[a] = b; }
      add('loop', 'Circulation has a loop without crossing staff rooms', cycle, 'The circulation loop is interrupted.', [relax('strange', 40)]);
      add('ceiling', 'Rooms share one consistent ceiling height', new Set(S.map(s => s.ceiling ?? 270)).size === 1, 'Ceiling heights change between rooms.', [relax('strange', 85)]);
      add('single-level', 'The office floor occupies one level', new Set(S.map(s => s.floor)).size === 1, 'The floor changes level.');
      add('wing-count', 'The requested number of independent wings is realized', S.filter(s => /^wing-[0-9]+-exit$/.test(s.id)).length === 1 + Math.floor((dials.wings ?? 20) * 5 / 100), 'The wing count differs from the requested setting.');
      return R;
    }
  };
  api.templates.push(offices);
}());
