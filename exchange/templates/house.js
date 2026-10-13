// House v2: program -> circulation spine -> openings -> physical checks -> named rules.
// Port of the local ZoneLabVersion 2 grammar; reference snapshot in docs/template-reference/.
// Dependencies: stream.js, checks.js, method.js. No renderer, classes or global RNG.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const house = {
    id: 'house', version: 2, name: 'House', attempts: 16, workLimit: 20000,
    summary: 'A home grown along a spine: compact to sprawling, familiar to strange. Dials explicitly relax named house rules.',
    dials: [
      { id: 'size', name: 'Size', low: 'Modest', high: 'Large', value: 40, help: 'Room dimensions and the normal bedroom program (2–5)' },
      { id: 'sprawl', name: 'Sprawl', low: 'Compact', high: 'Sprawling', value: 0, help: 'Two storeys below 55; a wing at 30, main bedroom downstairs at 40, turning wing at 48; one storey at 55' },
      { id: 'strange', name: 'Strangeness', low: 'Expected', high: 'Wrong', value: 0, help: 'Permits proportions, hall excess, branches, repetition, misplaced rooms and bedroom chains in a fixed order' }
    ],
    presets: [
      { name: 'Suburban', dials: { size: 40, sprawl: 0, strange: 0 } },
      { name: 'Family home', dials: { size: 75, sprawl: 35, strange: 0 } },
      { name: 'Ranch', dials: { size: 50, sprawl: 65, strange: 0 } },
      { name: 'Rambling', dials: { size: 85, sprawl: 95, strange: 15 } },
      { name: 'Not quite right', dials: { size: 45, sprawl: 20, strange: 55 } },
      { name: 'Backrooms house', dials: { size: 70, sprawl: 90, strange: 95 } }
    ],
    // title, kind, minimum narrow side (50 cm units), maximum aspect ratio.
    roles: {
      entry: ['Entry hall', 'hall', 3, 99], hall: ['Hallway', 'hall', 3, 99], backhall: ['Back hall', 'hall', 3, 99],
      landing: ['Landing', 'hall', 3, 99], uphall: ['Upstairs hall', 'hall', 3, 99], stair: ['Stairs', 'stair', 3, 99],
      living: ['Living room', 'room', 8, 2], dining: ['Dining room', 'room', 6, 2], kitchen: ['Kitchen', 'room', 6, 2],
      family: ['Family room', 'room', 7, 2], study: ['Study', 'room', 5, 2], wc: ['WC', 'room', 3, 3],
      bath: ['Bathroom', 'room', 4, 3], ensuite: ['Main bathroom', 'room', 4, 3], bedroom: ['Bedroom', 'room', 6, 2],
      main: ['Main bedroom', 'room', 7, 2], closet: ['Walk-in closet', 'room', 3, 3],
      utility: ['Utility room', 'room', 3, 3], store: ['Store room', 'room', 3, 3], den: ['Den', 'room', 5, 2]
    },
    make(spec) {
      return api.generateTemplate(house, spec, d => {
        const { size, sprawl, strange } = d.dials, pick = d.pick, chance = d.chance, lerp = api.dialSize;
        const div = (a, b) => Math.trunc(a / b), RISE = 290, LONG = 14;
        const everyone = r => ['living', 'dining', 'kitchen', 'family'].includes(r);
        const sleeping = r => r === 'bedroom' || r === 'main';
        const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
        const shared = (a, b) => { const w = api.shared({ rect: a }, { rect: b }); return w ? w.high - w.low : 0; };
        const P = { rooms: [], doors: [] };
        const add = (role, rect, floor = 0) => { d.step(); P.rooms.push({ role, rect, floor, ceiling: 250 }); return P.rooms.length - 1; };
        const link = (a, b, mode) => { d.step(); P.doors.push({ a, b, mode, required: true }); };
        const free = (r, floor) => !P.rooms.some(q => overlap(r, q.rect) && (q.floor === floor || (q.role === 'stair' && q.floor + RISE === floor)));
        const fail = why => { throw new Error(why); };
        const dx = [0, 1, 0, -1], dy = [1, 0, -1, 0], left = dir => (dir + 3) & 3;
        const frame = (x, y, dir = 0) => ({ x, y, dir });
        const uv = (f, u0, u1, v0, v1) => {
          const l = left(f.dir), ax = f.x + u0 * dx[f.dir] + v0 * dx[l], ay = f.y + u0 * dy[f.dir] + v0 * dy[l];
          const bx = f.x + u1 * dx[f.dir] + v1 * dx[l], by = f.y + u1 * dy[f.dir] + v1 * dy[l];
          return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
        };
        const move = (f, u, v) => { const l = left(f.dir); return frame(f.x + u * dx[f.dir] + v * dx[l], f.y + u * dy[f.dir] + v * dy[l], f.dir); };
        const turned = (f, len, hw, turn, next) => { const m = turn === 1 ? move(f, len, hw) : move(f, len - next, 0); return frame(m.x, m.y, turn === 1 ? left(f.dir) : (f.dir + 1) & 3); };
        // Stage 1: room program, independent of layout and presentation.
        const g = { bedrooms: 2 + div(size * 3 + 50, 100), walkIn: size >= 30, dining: size >= 25 || chance('program/dining', 50),
          family: size >= 60, study: size >= 45, wc: sprawl < 55 && size >= 35, extraBaths: 0, extraStores: 0, extraBedrooms: 0,
          secondKitchen: false, secondLiving: false };
        g.ensuite = g.bedrooms >= 3; g.familyBaths = g.bedrooms >= 4 ? 2 : 1;
        if (strange >= 50) { g.extraBaths = pick('program/extra-baths', 0, 1 + div(strange - 50, 25)); g.extraStores = pick('program/extra-stores', 1, 1 + div(strange - 50, 20)); }
        if (strange >= 75) g.extraBedrooms = pick('program/extra-bedrooms', 1, 2);
        if (strange >= 80) { g.secondKitchen = chance('program/second-kitchen', 40); g.secondLiving = chance('program/second-living', 40); }
        const slot = (role, lo, hi, optional = false, absorb = false) => ({ role, lo, hi, optional, absorb, len: 0 });
        function fit(slots, total, name) {
          let sum = 0;
          slots.forEach((s, k) => { s.len = pick(name + '/' + k + '/' + s.role, s.lo, s.hi); sum += s.len; });
          while (sum > total) { d.step(); let drop = -1; for (let k = slots.length - 1; k >= 0 && drop < 0; --k) if (slots[k].optional) drop = k; if (drop < 0) break; sum -= slots[drop].len; slots.splice(drop, 1); }
          while (sum > total) { d.step(); let any = false; for (let k = slots.length - 1; k >= 0 && sum > total; --k) if (slots[k].len > slots[k].lo) { --slots[k].len; --sum; any = true; } if (!any) break; }
          if (sum > total || !slots.length) return false;
          const start = pick(name + '/grow', 0, slots.length - 1);
          while (sum < total) { d.step(); let any = false; for (let i = 0; i < slots.length && sum < total; ++i) { const s = slots[(start + i) % slots.length]; if (s.len < s.hi) { ++s.len; ++sum; any = true; } } if (!any) break; }
          for (const s of slots) while (sum < total && s.absorb && s.len < s.hi + 6) { d.step(); ++s.len; ++sum; }
          return sum === total;
        }
        const roomItem = (role, len, depth) => ({ kind: 'room', role, len, depth, chain: false });
        const suiteItem = (len, depth) => ({ kind: 'suite', role: 'main', len, depth });
        function unsettle(items, name, depth) {
          const out = [];
          items.forEach((item, k) => {
            const at = name + '/' + k;
            if (strange >= 30 && chance(at + '/gap', strange - 20)) out.push({ kind: 'gap', len: pick(at + '/gap-len', 2, 2 + div(strange - 30, 8)) });
            if (strange >= 40 && chance(at + '/branch', div(strange - 30, 2))) {
              const b = { kind: 'branch', depth, branchLen: depth + pick(at + '/branch-len', 3, 3 + div(strange - 40, 6)), branch: [] };
              if (!(strange >= 55 && chance(at + '/branch-empty', strange - 45))) b.branch.push(roomItem(chance(at + '/branch-what', 50) ? 'store' : 'bath', pick(at + '/branch-room', 4, 5), pick(at + '/branch-deep', 4, 6)));
              out.push(b);
            }
            if (strange >= 85 && sleeping(item.role) && item.kind === 'room') item.chain = chance(at + '/chain', strange - 60);
            out.push(item);
          });
          return out;
        }
        let ended = -1;
        // Stage 2: bounded halls with things beside them. Roll back a failed local proposal.
        function run(f, hw, sides, turn, next, name, startAt = 0, minLen = 0, recursion = 0) {
          if (recursion > 1) fail('Hall branch recursion bound exceeded.');
          const r0 = P.rooms.length, j0 = P.doors.length;
          try {
            const hall = add('hall', [f.x, f.y, f.x, f.y]), ends = [startAt, startAt], spans = [];
            for (let side = 0; side < 2; ++side) {
              let cursor = startAt, previous = -1, touching = false;
              const band = (u0, u1, a, b) => side === 0 ? uv(f, u0, u1, hw + a, hw + b) : uv(f, u0, u1, -b, -a);
              for (let k = 0; k < sides[side].length; ++k) {
                const it = sides[side][k]; if (it.kind === 'gap') { cursor += it.len; touching = false; continue; }
                let placed = false;
                for (let tries = 0; tries < 20 && !placed; ++tries, ++cursor, touching = false) {
                  d.step();
                  if (it.kind === 'branch') {
                    const m = side === 0 ? move(f, cursor + 3, hw) : move(f, cursor, 0), bf = frame(m.x, m.y, side === 0 ? left(f.dir) : (f.dir + 1) & 3), outer = ended;
                    let b; try { b = run(bf, 3, [it.branch, []], 0, 0, name + '/branch' + k, it.depth, it.branchLen, recursion + 1); } catch { ended = outer; continue; }
                    ended = outer; link(hall, b.hall, 'open'); spans.push([cursor, cursor + 3]); cursor += 3; placed = true; previous = -1; break;
                  }
                  if (it.kind === 'suite') {
                    const mb = it.len - 4, bed = band(cursor, cursor + mb, 0, it.depth), clo = band(cursor + mb, cursor + it.len, 0, 4), ens = band(cursor + mb, cursor + it.len, g.walkIn ? 4 : 0, it.depth);
                    if (!free(bed, 0) || !free(ens, 0) || (g.walkIn && !free(clo, 0))) continue;
                    const m = add('main', bed); link(hall, m, 'door'); link(m, add(g.ensuite ? 'ensuite' : 'closet', ens), 'door');
                    if (g.walkIn) link(m, add('closet', clo), 'door'); spans.push([cursor, cursor + mb]); cursor += it.len; placed = true; previous = -1; break;
                  }
                  const r = band(cursor, cursor + it.len, 0, it.depth); if (!free(r, 0)) continue;
                  const n = add(it.role, r); link(it.chain && previous >= 0 && touching ? previous : hall, n, it.chain && previous >= 0 && touching ? 'door' : everyone(it.role) || it.role === 'study' ? 'wide' : 'door');
                  previous = sleeping(it.role) ? n : -1; spans.push([cursor, cursor + it.len]); cursor += it.len; placed = true; break;
                }
                if (!placed) fail(name + ': no room along the hall for ' + (it.role ?? 'a side hall'));
                touching = true;
              }
              ends[side] = cursor;
            }
            const len = Math.max(ends[0] + (turn === 1 ? next : 0), ends[1] + (turn === 2 ? next : 0), minLen, startAt + 3, 4);
            P.rooms[hall].rect = [0, 0, 0, 0]; if (!free(uv(f, 0, len, 0, hw), 0)) fail(name + ': hall overlaps a room');
            const cuts = [0], count = div(len + 35, 36);
            for (let k = 1; k < count; ++k) {
              const target = div(k * len, count); let best = target;
              for (let off = 0; off <= 8; ++off) for (const sign of [1, -1]) {
                const u = target + sign * off; if (u < cuts.at(-1) + 4 || u > len - 4 || best !== target) continue;
                if (spans.every(s => !(s[0] < u && u < s[1] && (u - s[0] < 4 || s[1] - u < 4)))) best = u;
              }
              cuts.push(best);
            }
            cuts.push(len); const pieces = [hall]; P.rooms[hall].rect = uv(f, cuts[0], cuts[1], 0, hw);
            for (let k = 1; k + 1 < cuts.length; ++k) { pieces.push(add('hall', uv(f, cuts[k], cuts[k + 1], 0, hw))); link(pieces[k - 1], pieces[k], 'open'); }
            for (let k = j0; k < P.doors.length; ++k) if (P.doors[k].a === hall && pieces.length > 1) {
              let best = hall, most = -1; for (const p of pieces) { const n = shared(P.rooms[p].rect, P.rooms[P.doors[k].b].rect); if (n > most) { best = p; most = n; } } P.doors[k].a = best;
            }
            ended = pieces.at(-1); return { hall, len };
          } catch (error) { P.rooms.length = r0; P.doors.length = j0; throw error; }
        }
        let entry;
        const drift = strange >= 20 ? div(strange - 10, 15) : 0;
        if (sprawl < 55) {
          const hw = 3, E = size >= 40 ? 6 : 5, grow = Math.min(sprawl, 30);
          const LA = lerp(8, 11, size) + pick('compact/wing-a', 0, 1) + div(grow, 15), LB = lerp(8, 10, size) + pick('compact/wing-b', 0, 1) + div(grow, 15);
          const xS = LA, xH = LA + 3, xB = LA + 6, xE = xB + LB, colonial = chance('compact/colonial', 40);
          const wing = sprawl >= 30 || strange >= 40, mainDown = sprawl >= 40, shuffle = strange >= 70 && chance('compact/shuffle', strange - 40), ga = [], gb = [], ub = [];
          if (!colonial) {
            ga.push(slot('living', Math.max(9, E), 12 + drift, false, true)); if (g.dining) ga.push(slot('dining', 6, 8 + drift)); ga.push(slot('kitchen', 7, 9 + drift, false, true));
            const front = g.study ? 'study' : 'den'; gb.push(slot(front, Math.max(6, E), 9 + drift, false, true)); if (g.wc) gb.push(slot('wc', 4, 4, true));
            gb.push(slot('utility', 4, 5 + drift), slot(g.family ? 'family' : front === 'study' ? 'den' : 'study', 6, 10 + drift, false, true));
          } else {
            ga.push(slot('living', Math.max(9, E), 12 + drift, false, true), slot(g.family ? 'family' : 'study', 7, 10 + drift, false, true));
            gb.push(slot('dining', Math.max(7, E), 9 + drift, false, true), slot('kitchen', 8, 10 + drift, false, true), slot('utility', 4, 5 + drift)); if (g.wc) gb.push(slot('wc', 4, 4, true));
          }
          if (shuffle) { for (const s of ga) if (s.role === 'kitchen') s.role = 'study'; else if (s.role === 'dining') s.role = 'bath'; for (const s of gb) if (s.role === 'utility') s.role = 'kitchen'; }
          const upstairs = Math.max(1, g.bedrooms - (mainDown ? 1 : 0));
          for (let k = 0; k < Math.max(1, upstairs - 2); ++k) { ub.push(slot('bedroom', 7, 8 + drift, false, true)); if (k === 0) for (let b = 0; b < g.familyBaths; ++b) ub.push(slot('bath', 4, 5)); }
          if (!g.study || colonial) ub.push(slot('study', 6, 8, true, true)); ub.push(slot('store', 4, 5, true));
          const least = a => a.filter(s => !s.optional).reduce((n, s) => n + s.lo, 0);
          const D = Math.max(E + 18, least(ga), least(gb), least(ub)) + pick('compact/deep', 0, 1 + div(size, 50)) + div(grow, 10);
          if (!fit(ga, D, 'compact/ga') || !fit(gb, D, 'compact/gb') || !fit(ub, D, 'compact/ub')) fail('Wings do not fill the house depth.');
          entry = add('entry', [xS, 0, xB, E]); const stair = add('stair', [xS, E, xH, E + LONG]); P.rooms[stair].foot = 's';
          const back = add('backhall', [xS, E + LONG, xH, D]), hall = add('hall', [xH, E, xB, D]);
          link(entry, hall, 'open'); link(entry, stair, 'open'); link(back, hall, 'open');
          let y = 0, prev = -1;
          for (const s of ga) { const r = add(s.role, [0, y, xS, y + s.len]); link(prev < 0 ? entry : prev, r, prev < 0 || s.role !== 'bath' ? 'wide' : 'door'); prev = r; y += s.len; }
          link(prev, back, P.rooms[prev].role === 'kitchen' ? 'wide' : 'door');
          y = 0; prev = -1;
          for (const s of gb) {
            const r = [xB, y, xE, y + s.len], n = add(s.role, r), to = shared(r, P.rooms[entry].rect) >= shared(r, P.rooms[hall].rect) ? entry : hall;
            const kd = s.role === 'kitchen' && prev >= 0 && P.rooms[prev].role === 'dining'; if (kd) link(prev, n, 'wide');
            if (!kd || chance('compact/kitchen-hall', 60)) link(to, n, everyone(s.role) || s.role === 'study' ? 'wide' : 'door'); prev = n; y += s.len;
          }
          const uf = add('uphall', [xS, 0, xH, E], RISE), landing = add('landing', [xS, E + LONG, xH, D], RISE), uh = add('uphall', [xH, 0, xB, D], RISE);
          link(stair, landing, 'open'); link(landing, uh, 'open'); link(uf, uh, 'open');
          let f = pick('up/front', 7, 9), m = pick('up/middle', 4, 6), b = D - f - m;
          while (b < 8 && f > 7) { --f; ++b; } while (b < 8 && m > 4) { --m; ++b; } while (b > 12 && m < 7) { ++m; --b; } while (b > 12 && f < 11) { ++f; --b; }
          if (b < 7) fail('No room upstairs for the back bedroom.');
          const bf = add('bedroom', [0, 0, xS, f], RISE), bb = add(mainDown ? 'bedroom' : 'main', [0, f + m, xS, D], RISE); link(uf, bf, 'door'); link(landing, bb, 'door');
          if (!mainDown && g.ensuite) { if (g.walkIn) link(bb, add('closet', [0, f, 4, f + m], RISE), 'door'); link(bb, add('ensuite', [g.walkIn ? 4 : 0, f, xS, f + m], RISE), 'door'); }
          else { const half = div(xS, 2); link(bf, add('closet', [0, f, half, f + m], RISE), 'door'); link(bb, add('closet', [half, f, xS, f + m], RISE), 'door'); }
          y = 0; prev = -1;
          ub.forEach((s, k) => { const n = add(s.role, [xB, y, xE, y + s.len], RISE), chain = strange >= 85 && sleeping(s.role) && prev >= 0 && sleeping(P.rooms[prev].role) && chance('up/chain/' + k, strange - 60); link(chain ? prev : uh, n, 'door'); prev = n; y += s.len; });
          if (wing) {
            const depth = pick('wing/depth', 7, 8); let l = [], r = [];
            if (sprawl >= 30) (chance('wing/den-side', 50) ? l : r).push(roomItem(g.family && colonial ? 'study' : 'family', pick('wing/den', 8, 10), depth));
            if (strange >= 40) { l.push(roomItem('bath', 4, depth)); r.push(roomItem('store', 4, depth)); }
            for (let k = 0; k < g.extraBaths; ++k) l.push(roomItem('bath', pick('wing/xbath/' + k, 4, 5), depth));
            for (let k = 0; k < g.extraStores; ++k) r.push(roomItem('store', 4, depth));
            for (let k = 0; k < g.extraBedrooms; ++k) (k % 2 ? l : r).push(roomItem('bedroom', pick('wing/xbed/' + k, 7, 8), depth));
            if (g.secondKitchen) l.push(roomItem('kitchen', 8, depth));
            const suite = suiteItem(pick('wing/suite', 11, 13), Math.max(8, depth)), turns = sprawl >= 48 || (strange >= 60 && chance('wing/turn-odd', strange - 40));
            l = unsettle(l, 'wing/left', depth); r = unsettle(r, 'wing/right', depth); if (!l.length && !r.length && !mainDown) l.push(roomItem('store', 4, depth));
            const f = frame(xB, D);
            if (!turns) { if (mainDown) (chance('wing/suite-side', 50) ? l : r).push(suite); const q = run(f, hw, [l, r], 0, 0, 'wing'); link(hall, q.hall, 'open'); }
            else { const turn = chance('wing/turn', 50) ? 1 : 2, q = run(f, hw, [l, r], turn, hw, 'wing', 0, 6), last = ended; link(hall, q.hall, 'open'); const l2 = [], r2 = []; if (mainDown) (turn === 1 ? r2 : l2).push(suite); else r2.push(roomItem('store', 4, depth)); const q2 = run(turned(f, q.len, hw, turn, hw), hw, [l2, r2], 0, 0, 'wing/turned'); link(last, q2.hall, 'open'); }
          }
        } else {
          const wide = name => 3 + (strange >= 30 ? pick(name, 0, div(strange - 30, 25)) : 0);
          let hw = wide('hall/0'); const f = frame(0, 0), E = 4 + pick('entry/deep', 0, 1); entry = add('entry', uv(f, 0, E, -2, hw + 2));
          const shuffle = strange >= 70 && chance('spread/shuffle', strange - 40), rows = [];
          const row = (through, len) => ({ through, len, side: ['', ''], depth: [0, 0] });
          const living = row('living', lerp(9, 12, size) + pick('living/len', 0, 1)), s = pick('living/side', 0, 1);
          if (!g.dining && !shuffle) { living.side[s] = 'kitchen'; living.depth[s] = pick('kitchen/depth', div(living.len + 1, 2), 9); }
          if (g.study && chance('living/study', 50) && !living.side[1 - s]) { living.side[1 - s] = 'study'; living.depth[1 - s] = pick('study/depth', div(living.len + 1, 2), div(living.len + 1, 2) + 1); }
          if (shuffle && !living.side[1 - s]) { living.side[1 - s] = 'bath'; living.depth[1 - s] = 4; } rows.push(living);
          if (g.dining) { const r = row('dining', pick('dining/len', 7, 9)), k = pick('kitchen/side', 0, 1); if (!shuffle) { r.side[k] = 'kitchen'; r.depth[k] = pick('kitchen/depth', 7, 9); } if (chance('dining/utility', 60)) { r.side[1 - k] = 'utility'; r.depth[1 - k] = pick('utility/depth', 4, 5); } rows.push(r); }
          if (g.secondLiving) rows.push(row('living', pick('living2/len', 8, 10)));
          let cursor = E, last = entry;
          rows.forEach((r, k) => {
            const name = 'row/' + k, tw = Math.max(hw + 4, lerp(8, 10, size) + pick(name + '/wide', 0, 2) + drift), a = pick(name + '/offset', 2, tw - hw - 2), b = tw - hw - a;
            const n = add(r.through, uv(f, cursor, cursor + r.len, -a, hw + b)); link(last, n, 'wide');
            for (let s = 0; s < 2; ++s) if (r.side[s]) link(n, add(r.side[s], s === 0 ? uv(f, cursor, cursor + r.len, hw + b, hw + b + r.depth[s]) : uv(f, cursor, cursor + r.len, -a - r.depth[s], -a)), r.side[s] === 'kitchen' || r.side[s] === 'study' ? 'wide' : 'door');
            cursor += r.len; last = n;
          });
          const depth = pick('halls/depth', 7, 8), items = [];
          if (g.family) items.push(roomItem('family', pick('halls/family', 8, 10), depth + 1));
          if (g.study && !rows[0].side.includes('study')) items.push(roomItem('study', pick('halls/study', 6, 7), depth));
          if (shuffle) items.push(roomItem('kitchen', pick('halls/kitchen', 7, 8), depth));
          if (!rows.some(r => r.side.includes('utility'))) items.push(roomItem('utility', 4, depth));
          const others = g.bedrooms - 1 + g.extraBedrooms;
          for (let k = 0; k < others; ++k) { items.push(roomItem('bedroom', pick('halls/bedroom/' + k, 7, 8 + drift), depth)); if (k === 0) for (let b = 0; b < g.familyBaths; ++b) items.push(roomItem('bath', pick('halls/bath/' + b, 4, 5), depth)); }
          for (let k = 0; k < g.extraBaths; ++k) items.push(roomItem('bath', 4, depth));
          for (let k = 0; k < g.extraStores; ++k) items.push(roomItem('store', 4, depth)); if (g.secondKitchen) items.push(roomItem('kitchen', 8, depth));
          const runs = Math.max(1, Math.min(6, 1 + div(sprawl - 55, 15) + (strange >= 60 ? pick('halls/extra', 0, 1 + div(strange - 60, 20)) : 0))), single = Math.max(0, div((sprawl - 55) * 3, 2));
          const sides = Array.from({ length: runs }, () => [[], []]), per = Math.ceil(items.length / runs);
          items.forEach((it, k) => { const r = Math.min(runs - 1, div(k, Math.max(1, per))), at = 'halls/' + r; const one = chance(at + '/single', single), toLeft = one ? pick(at + '/single-side', 0, 1) === 0 : (k + pick(at + '/first-side', 0, 1)) % 2 === 0; sides[r][toLeft ? 0 : 1].push(it); });
          sides[runs - 1][chance('halls/suite-side', 50) ? 0 : 1].push(suiteItem(pick('halls/suite', 11, 13), Math.max(8, depth)));
          for (let r = 0; r < runs; ++r) for (let side = 0; side < 2; ++side) sides[r][side] = unsettle(sides[r][side], 'halls/' + r + '/' + (side ? 'right' : 'left'), depth);
          let at = move(f, cursor, 0), prev = last, lastTurn = chance('halls/first-turn', 50) ? 2 : 1;
          for (let r = 0; r < runs; ++r) {
            const name = 'halls/' + r, next = wide(name + '/next'), again = strange >= 60 && chance(name + '/turn-again', strange - 40), want = r === runs - 1 ? 0 : again ? lastTurn : 3 - lastTurn;
            let q = null, turn = want;
            for (const option of [want, want === 0 ? 0 : 3 - want]) { turn = option; try { q = run(at, hw, sides[r], turn, next, name); break; } catch (error) { if (want === 0) throw error; } }
            if (!q) fail('Neither hall turn fits.'); link(prev, q.hall, 'open'); prev = ended;
            if (r < runs - 1) { at = turned(at, q.len, hw, turn, next); hw = next; lastTurn = turn; }
          }
        }
        // Stage 3: presentation never decides topology. Mirrors preserve all roles and links.
        if (chance('mirror', 50)) for (const r of P.rooms) r.rect = [-r.rect[2], r.rect[1], -r.rect[0], r.rect[3]];
        if (strange >= 85) P.rooms.forEach((r, k) => { const stacked = P.rooms.some(o => o.floor !== r.floor && overlap(o.rect, r.rect)); if (!stacked && r.role !== 'stair' && chance('ceiling/' + k, strange - 70)) r.ceiling = 220 + 10 * pick('ceiling-height/' + k, 0, 13); });
        const counts = {}, spaces = P.rooms.map(r => { const n = counts[r.role] = (counts[r.role] ?? 0) + 1, info = house.roles[r.role]; const s = { id: r.role + (n === 1 ? '' : '-' + n), title: info[0], kind: info[1], role: r.role, rect: r.rect, floor: r.floor, ceiling: r.ceiling }; if (r.role === 'stair') { s.rise = RISE; s.foot = r.foot; } return s; });
        const e = spaces[entry], zone = { format: 'backrooms-zone', version: 1, id: 'house-' + d.seed, name: 'House · seed ' + d.seed, theme: 'residential',
          notes: 'House v2: program and circulation spine, with explicit rule relaxation. Sprawl 55 changes to one storey. Stairs remain ramps in Unreal.',
          source: { template: api.templateKey(house), seed: d.seed, dials: d.dials, lab: 'exchange-2' },
          start: { space: e.id, x: (e.rect[0] + e.rect[2]) / 2, y: (e.rect[1] + e.rect[3]) / 2 }, spaces,
          joins: P.doors.map(j => ({ ...j, a: spaces[j.a].id, b: spaces[j.b].id })),
          entrances: [{ title: 'Front door', space: e.id, side: 's', at: (e.rect[0] + e.rect[2]) / 2 }] };
        for (const s of spaces) if (s.role === 'kitchen' && s.floor === 0) {
          let best = 0, entrance = null;
          for (const side of ['s', 'n', 'e', 'w']) { const len = side === 's' || side === 'n' ? s.rect[2] - s.rect[0] : s.rect[3] - s.rect[1]; if (len < 4 || len <= best) continue; if (api.freeStretches(s, side, spaces, zone).some(a => a[1] - a[0] === len)) { best = len; entrance = { title: 'Back door', space: s.id, side, at: side === 's' || side === 'n' ? (s.rect[0] + s.rect[2]) / 2 : (s.rect[1] + s.rect[3]) / 2 }; } }
          if (entrance) { zone.entrances.push(entrance); break; }
        }
        return zone;
      });
    },
    rules(zone, dials) {
      const S = [...zone.spaces].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), at = new Map(S.map((s, i) => [s.id, i])), next = S.map(() => new Set());
      const lowest = Math.min(...S.map(s => s.floor));
      for (const j of zone.joins) if (j.mode !== 'view' && at.has(j.a) && at.has(j.b)) { next[at.get(j.a)].add(at.get(j.b)); next[at.get(j.b)].add(at.get(j.a)); }
      const circulation = r => ['entry', 'hall', 'backhall', 'landing', 'uphall'].includes(r), everyone = r => ['living', 'dining', 'kitchen', 'family'].includes(r), sleeping = r => r === 'main' || r === 'bedroom';
      const count = role => S.filter(s => s.role === role).length, opens = (k, test) => [...next[k]].some(n => test(S[n].role));
      const R = [], relax = (dial, value) => ({ dial, at: value, name: dial === 'sprawl' ? 'Sprawl' : 'Strangeness' });
      const add = (id, name, kept, detail, permits = []) => R.push(api.rule(id, name, kept, detail, permits, dials));
      add('entry', 'The front door opens into an entry hall', zone.entrances.some(e => e.title === 'Front door' && S[at.get(e.space)]?.role === 'entry'), 'No front entrance into an entry hall.');
      add('stair', 'The stair rises from a hall to a landing', S.every((s, k) => s.kind !== 'stair' || ([...next[k]].some(n => S[n].floor === s.floor && circulation(S[n].role)) && [...next[k]].some(n => S[n].floor > s.floor && circulation(S[n].role)))), 'A stair endpoint opens into a room.');
      add('ground', 'The living room, dining room and kitchen are on the ground floor', S.every(s => !['living', 'dining', 'kitchen'].includes(s.role) || s.floor === Math.min(...S.map(s => s.floor))), 'A shared room is upstairs.');
      add('kitchen', 'The kitchen opens onto the dining room', !count('dining') || S.every((s, k) => s.role !== 'kitchen' || opens(k, r => r === 'dining')), 'A kitchen does not open onto a dining room.', [relax('strange', 70)]);
      add('living', 'The living and dining rooms open into each other, or off the same hall', S.every((s, k) => s.role !== 'dining' || [...next[k]].some(n => S[n].role === 'living' || (circulation(S[n].role) && opens(n, r => r === 'living')))), 'Dining is separated from living.', [relax('strange', 70)]);
      add('bedrooms', 'Every bedroom opens off a hall or landing', S.every((s, k) => !sleeping(s.role) || opens(k, circulation)), 'A bedroom opens only through another room.', [relax('strange', 85)]);
      add('private', 'No bedroom opens onto the entry, living room, dining room or kitchen', S.every((s, k) => !sleeping(s.role) || (!opens(k, everyone) && !opens(k, r => r === 'entry'))), 'A bedroom opens onto a shared room or entry.', [relax('strange', 70)]);
      add('baths', 'Bathrooms open off a hall, never onto the living room, dining room or kitchen', S.every((s, k) => !['bath', 'wc'].includes(s.role) || (opens(k, circulation) && !opens(k, everyone))), 'A bathroom has an inappropriate entrance.', [relax('strange', 70)]);
      add('suite', 'The main bathroom opens only from the main bedroom', S.every((s, k) => s.role !== 'ensuite' || [...next[k]].every(n => S[n].role === 'main')), 'An ensuite opens from somewhere else.', [relax('strange', 70)]);
      const beds = count('bedroom') + count('main'), baths = count('bath') + count('ensuite');
      add('counts', 'One kitchen, one living room, and bathrooms to suit the bedrooms', count('kitchen') === 1 && count('living') === 1 && baths >= (beds >= 4 ? 2 : 1) && baths <= beds + 1, 'Room counts fall outside the normal household program.', [relax('strange', 50)]);
      const bad = S.find(s => { const info = house.roles[s.role]; if (!info || info[1] !== 'room') return false; const w = s.rect[2] - s.rect[0], h = s.rect[3] - s.rect[1]; return Math.min(w, h) < info[2] || Math.max(w, h) > info[3] * Math.min(w, h) + .01; });
      add('proportions', 'Every room is a usable size and shape for what it is', !bad, bad ? bad.title + ' has unusual proportions.' : '', [relax('strange', 20)]);
      const area = s => (s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]), floor = S.filter(s => s.kind !== 'stair'), halls = floor.filter(s => circulation(s.role)).reduce((n, s) => n + area(s), 0), total = floor.reduce((n, s) => n + area(s), 0);
      add('halls', 'Halls take no more than a quarter of the floor', !total || halls / total <= .25, Math.round(halls / total * 100) + '% of the floor is hall.', [relax('sprawl', 30), relax('strange', 30)]);
      add('dead-ends', 'No hall leads nowhere', S.every((s, k) => !circulation(s.role) || s.role === 'entry' || next[k].size >= 2), 'A hall leads nowhere.', [relax('strange', 40)]);
      const ground = S.filter(s => s.floor === Math.min(...S.map(s => s.floor))), box = [Math.min(...ground.map(s => s.rect[0])), Math.min(...ground.map(s => s.rect[1])), Math.max(...ground.map(s => s.rect[2])), Math.max(...ground.map(s => s.rect[3]))], cover = ground.reduce((n, s) => n + area(s), 0) / ((box[2] - box[0]) * (box[3] - box[1]));
      add('compact', 'The house is a box, or a box with a wing', cover >= .7, Math.round(cover * 100) + '% of the bounds is occupied.', [relax('sprawl', 30), relax('strange', 40)]);
      const group = S.map((_, k) => k), find = k => { while (group[k] !== k) { group[k] = group[group[k]]; k = group[k]; } return k; }; let cycle = false;
      for (let k = 0; k < S.length; ++k) if (S[k].floor === lowest && S[k].kind !== 'stair') for (const n of next[k]) if (n > k && S[n].floor === lowest && S[n].kind !== 'stair') { const a = find(k), b = find(n); if (a === b) cycle = true; else group[a] = b; }
      add('loop', 'The ground floor can be walked round in a loop', cycle, 'Every route returns by the way it came.', [relax('sprawl', 55), relax('strange', 40)]);
      return R;
    }
  };
  api.templates.push(house);
}());
