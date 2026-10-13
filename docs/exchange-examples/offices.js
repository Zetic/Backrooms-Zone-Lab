// Offices v1: a room program and circulation loop, with bounded department wings.
// Architectural conventions may relax; required physical routes never do.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const offices = {
    id: 'offices', version: 1, name: 'Offices', attempts: 12, workLimit: 12000,
    summary: 'Reception, visitor meetings, staff workplaces and shared services. A conventional office can stretch, repeat and put familiar rooms in the wrong relationships.',
    dials: [
      { id: 'size', name: 'Size', low: 'Small company', high: 'Large floor', value: 40, help: 'Number of workplace bays and the scale of their allocations' },
      { id: 'open', name: 'Openness', low: 'Private offices', high: 'Open plan', value: 35, help: 'Workplace bays merge through wall-less joins; their direct circulation access is kept unless Strangeness permits chains' },
      { id: 'sprawl', name: 'Sprawl', low: 'Compact loop', high: 'Department wings', value: 0, help: 'A rear wing at 35, a turning second leg at 65 and a third at 85; empty ground is preserved between wings' },
      { id: 'strange', name: 'Strangeness', low: 'Standard office', high: 'Wrong workplace', value: 0, help: 'Permissions: proportions 20, hall excess 30, dead ends/branches 40, repetition 50, misplaced functions 65, chained access 75, ceiling changes 85' }
    ],
    presets: [
      { name: 'Standard office', dials: { size: 40, open: 35, sprawl: 0, strange: 0 } },
      { name: 'Private practice', dials: { size: 15, open: 0, sprawl: 0, strange: 0 } },
      { name: 'Open workplace', dials: { size: 70, open: 100, sprawl: 0, strange: 0 } },
      { name: 'Department wings', dials: { size: 70, open: 45, sprawl: 85, strange: 0 } },
      { name: 'After hours', dials: { size: 50, open: 20, sprawl: 35, strange: 60 } },
      { name: 'Wrong workplace', dials: { size: 75, open: 65, sprawl: 90, strange: 95 } }
    ],
    make(spec) {
      return api.generateTemplate(offices, spec, d => {
        const { size, open, sprawl, strange } = d.dials;
        const depth = api.dialSize(8, 12, size), core = api.dialSize(8, 10, size);
        const hw = 4 + (strange >= 30 ? Math.floor((strange - 30) / 25) : 0), front = 6 + Math.floor(size / 50);
        const count = api.dialSize(5, 8, size), spaces = [], joins = [];
        const titles = { reception: 'Reception', meeting: 'Meeting room', office: 'Private office', work: 'Workplace', washroom: 'Washrooms',
          break: 'Break room', copy: 'Copy room', server: 'Server room', store: 'Supply store', hall: 'Corridor' };
        const work = s => s && (s.role === 'office' || s.role === 'work');
        const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
        const free = r => !spaces.some(s => overlap(r, s.rect));
        function add(role, rect, id, ceiling = 270) {
          d.step(); if (!free(rect)) throw new Error(id + ': allocation overlaps accepted architecture.');
          const s = { id, title: titles[role], kind: role === 'hall' ? 'hall' : 'room', role, rect, floor: 0, ceiling };
          spaces.push(s); return s;
        }
        function join(a, b, mode = 'door') { d.step(); joins.push({ a: a.id, b: b.id, mode, required: true }); }
        const roomRole = name => d.chance(name + '/open', open) ? 'work' : 'office';
        const length = name => api.dialSize(7, 11, size) + d.pick(name + '/length', 0, 1) +
          (strange >= 20 && d.chance(name + '/elongate', strange - 10) ? d.pick(name + '/elongation', 0, Math.floor((strange - 20) / 6)) : 0);
        const ceiling = name => strange >= 85 && d.chance(name + '/ceiling', strange - 60) ? 220 + 10 * d.pick(name + '/height', 0, 16) : 270;
        // Stage 1: visitor program at the front, staff services then workplace bays.
        const services = ['washroom', 'break', 'copy', 'server', 'store'];
        const program = Array.from({ length: count }, (_, i) => i < services.length ? services[i] : 'work');
        if (strange >= 50) for (let i = 5; i < count; ++i) program[i] = ['copy', strange >= 65 ? 'meeting' : 'store', 'washroom'][d.pick('program/repeated/' + i, 0, 2)];
        // The displaced server moves to the visitor frontage below; keep the supply store.
        if (strange >= 65) program[3] = 'meeting';
        // Stage 2: two corridors around a service strip, with office bays outside them.
        const xL = depth, xC = xL + hw, xR = xC + core, xOut = xR + hw;
        const reception = add('reception', [xL, 0, xOut, front], 'reception');
        const leftMeeting = add('meeting', [0, 0, xL, front], 'visitor-meeting-left');
        const rightMeeting = add(strange >= 65 ? 'server' : 'meeting', [xOut, 0, xOut + depth, front], 'visitor-meeting-right');
        join(reception, leftMeeting, 'wide'); join(reception, rightMeeting, 'wide');
        let y = front, prevHalls = [reception, reception], previous = [null, null];
        for (let i = 0; i < count; ++i) {
          const len = length('bay/' + i), halls = [add('hall', [xL, y, xC, y + len], 'main-left-' + i), add('hall', [xR, y, xOut, y + len], 'main-right-' + i)];
          for (let side = 0; side < 2; ++side) join(prevHalls[side], halls[side], 'open');
          const support = add(program[i], [xC, y, xR, y + len], 'core-' + i, ceiling('core/' + i));
          join(halls[i % 2], support, support.role === 'work' ? 'wide' : 'door');
          for (let side = 0; side < 2; ++side) {
            const name = 'bay/' + i + '/' + side, r = side === 0 ? [0, y, xL, y + len] : [xOut, y, xOut + depth, y + len];
            const s = add(roomRole(name), r, 'work-' + side + '-' + i, ceiling(name));
            const chain = strange >= 75 && previous[side] && (strange >= 90 || d.chance(name + '/chain', strange - 40));
            if (chain) join(previous[side], s); else join(halls[side], s, s.role === 'work' ? 'open' : 'door');
            if (!chain && work(previous[side]) && previous[side].role === 'work' && s.role === 'work') join(previous[side], s, 'open');
            previous[side] = s;
          }
          prevHalls = halls; y += len;
        }
        const rear = add('hall', [xL, y, xOut, y + hw], 'rear-corridor');
        // Removing one closing link changes the circulation convention, not global reachability.
        if (!(strange >= 40 && (strange >= 85 || d.chance('loop/omit', strange - 20)))) join(prevHalls[0], rear, 'open');
        join(prevHalls[1], rear, 'open');
        // Stage 3: bounded department wings. A failed turn rolls back only its proposal.
        const dx = [0, 1, 0, -1], dy = [1, 0, -1, 0], left = dir => (dir + 3) & 3;
        const frame = (x, y, dir = 0) => ({ x, y, dir });
        const move = (f, u, v) => { const l = left(f.dir); return frame(f.x + u * dx[f.dir] + v * dx[l], f.y + u * dy[f.dir] + v * dy[l], f.dir); };
        const uv = (f, a, b, c, e) => { const p = move(f, a, c), q = move(f, b, e); return [Math.min(p.x, q.x), Math.min(p.y, q.y), Math.max(p.x, q.x), Math.max(p.y, q.y)]; };
        const turned = (f, len, turn) => { const p = turn === 1 ? move(f, len, hw) : move(f, len - hw, 0); return frame(p.x, p.y, turn === 1 ? left(f.dir) : (f.dir + 1) & 3); };
        const legs = sprawl >= 85 ? 3 : sprawl >= 65 ? 2 : sprawl >= 35 || strange >= 40 ? 1 : 0;
        let candidates = [frame(xC, y + hw)], parent = rear;
        function wing(f, leg, final) {
          const savedSpaces = spaces.length, savedJoins = joins.length;
          try {
            const lead = depth + hw, n = 2 + Math.floor(size / 60), wingRoles = [];
            for (let k = 0; k < n; ++k) wingRoles.push([roomRole('wing/' + leg + '/left/' + k), roomRole('wing/' + leg + '/right/' + k)]);
            if (strange >= 50) wingRoles[n - 1][1] = ['copy', strange >= 65 ? 'meeting' : 'store', 'break'][leg % 3];
            let u = lead, last = add('hall', uv(f, 0, lead, 0, hw), 'wing-' + leg + '-approach'), first = last, previous = [null, null];
            for (let k = 0; k < n; ++k) {
              const len = length('wing/' + leg + '/bay/' + k), hall = add('hall', uv(f, u, u + len, 0, hw), 'wing-' + leg + '-hall-' + k); join(last, hall, 'open');
              for (let side = 0; side < 2; ++side) {
                const name = 'wing/' + leg + '/room/' + side + '/' + k, role = wingRoles[k][side], r = side === 0 ? uv(f, u, u + len, hw, hw + depth) : uv(f, u, u + len, -depth, 0);
                const s = add(role, r, 'wing-' + leg + '-room-' + side + '-' + k, ceiling(name));
                const chain = strange >= 75 && work(previous[side]) && (strange >= 90 || d.chance(name + '/chain', strange - 40));
                if (chain) join(previous[side], s); else join(hall, s, s.role === 'work' ? 'open' : role === 'meeting' ? 'wide' : 'door');
                if (!chain && previous[side]?.role === 'work' && s.role === 'work') join(previous[side], s, 'open'); previous[side] = s;
              }
              last = hall; u += len;
            }
            // Reserve the corner for the next leg; a final empty tail is explicitly strange.
            if (!final || strange >= 40) { const tail = depth + hw + (strange >= 30 ? Math.floor(strange / 15) : 0), hall = add('hall', uv(f, u, u + tail, 0, hw), 'wing-' + leg + '-tail'); join(last, hall, 'open'); last = hall; u += tail; }
            return { first, last, len: u };
          } catch (error) { spaces.length = savedSpaces; joins.length = savedJoins; throw error; }
        }
        for (let leg = 0; leg < legs; ++leg) {
          let w = null, acceptedFrame = null, reason = '';
          for (const f of candidates) {
            try { w = wing(f, leg, leg === legs - 1); acceptedFrame = f; break; }
            catch (error) { reason = error.message; }
          }
          if (!w) throw new Error('Department wing ' + leg + ': neither bounded orientation fits: ' + reason);
          join(parent, w.first, 'open'); parent = w.last;
          if (leg + 1 < legs) {
            const want = d.chance('wing/' + leg + '/turn', 50) ? 1 : 2;
            // Both alternatives check actual room footprints, not just a corridor reservation.
            candidates = [turned(acceptedFrame, w.len, want), turned(acceptedFrame, w.len, 3 - want)];
          }
        }
        // Presentation variation follows topology and cannot close a required connection.
        if (d.chance('layout/mirror', 50)) for (const s of spaces) s.rect = [-s.rect[2], s.rect[1], -s.rect[0], s.rect[3]];
        const zone = { format: 'backrooms-zone', version: 1, id: 'offices-' + d.seed, name: 'Offices · seed ' + d.seed, theme: 'backrooms',
          notes: 'Office floor: visitor reception and meetings, staff workplaces, washrooms, break/copy/server/storage rooms. Dials explicitly relax architectural conventions. This prototype describes rooms and circulation; furniture is not placed.',
          source: { template: api.templateKey(offices), seed: d.seed, dials: d.dials, lab: 'exchange-3' },
          start: { space: reception.id, x: (reception.rect[0] + reception.rect[2]) / 2, y: front / 2 }, spaces, joins,
          entrances: [{ title: 'Visitor entrance', space: reception.id, side: 's', at: (reception.rect[0] + reception.rect[2]) / 2 }] };
        const opportunities = api.freeStretches(rear, 'n', spaces, zone).filter(a => a[1] - a[0] >= 4).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]) || a[0] - b[0]);
        if (opportunities.length) zone.entrances.push({ title: 'Staff entrance', space: rear.id, side: 'n', at: (opportunities[0][0] + opportunities[0][1]) / 2 });
        return zone;
      });
    },
    rules(zone, dials) {
      const S = [...zone.spaces].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), at = new Map(S.map((s, i) => [s.id, i])), next = S.map(() => new Set());
      for (const j of zone.joins) if (j.mode !== 'view' && at.has(j.a) && at.has(j.b)) { next[at.get(j.a)].add(at.get(j.b)); next[at.get(j.b)].add(at.get(j.a)); }
      const work = r => r === 'work' || r === 'office', circ = r => r === 'hall' || r === 'reception', service = r => ['washroom', 'break', 'copy', 'server', 'store'].includes(r);
      const count = role => S.filter(s => s.role === role).length, area = s => (s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]);
      const opens = (k, test) => [...next[k]].some(n => test(S[n].role)), R = [];
      const relax = (dial, at) => ({ dial, at, name: dial === 'strange' ? 'Strangeness' : 'Sprawl' });
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
      const proportion = S.every(s => { if (!work(s.role) && s.role !== 'meeting') return true; const w = s.rect[2] - s.rect[0], h = s.rect[3] - s.rect[1]; return Math.min(w, h) >= 6 && Math.max(w, h) <= 2 * Math.min(w, h); });
      add('proportions', 'Work and meeting rooms have conventional proportions', proportion, 'A work or meeting room is unusually elongated.', [relax('strange', 20)]);
      const hallArea = S.filter(s => s.role === 'hall').reduce((a, s) => a + area(s), 0), total = S.reduce((a, s) => a + area(s), 0);
      add('hall-share', 'Corridors take no more than 30% of the floor', hallArea / total <= .3, Math.round(hallArea / total * 100) + '% of the allocation is corridor.', [relax('sprawl', 35), relax('strange', 30)]);
      add('hall-width', 'Corridors are a consistent 2–2.5 m wide', S.every(s => s.role !== 'hall' || (Math.min(s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]) >= 4 && Math.min(s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]) <= 5)), 'A corridor has an unusually broad cross section.', [relax('strange', 30)]);
      add('dead-ends', 'Corridors do not end beyond the last room', S.every((s, k) => s.role !== 'hall' || next[k].size >= 2), 'An empty corridor ends without a room.', [relax('strange', 40)]);
      const group = S.map((_, k) => k), find = k => { while (group[k] !== k) { group[k] = group[group[k]]; k = group[k]; } return k; }; let cycle = false;
      for (let k = 0; k < S.length; ++k) if (circ(S[k].role)) for (const n of next[k]) if (n > k && circ(S[n].role)) { const a = find(k), b = find(n); if (a === b) cycle = true; else group[a] = b; }
      add('loop', 'Circulation has a loop without crossing staff rooms', cycle, 'The circulation loop is interrupted.', [relax('strange', 40)]);
      add('ceiling', 'Rooms share one consistent ceiling height', new Set(S.map(s => s.ceiling ?? 270)).size === 1, 'Ceiling heights change between rooms.', [relax('strange', 85)]);
      add('single-level', 'The office floor occupies one level', new Set(S.map(s => s.floor)).size === 1, 'The floor changes level.');
      return R;
    }
  };
  api.templates.push(offices);
}());
