// Generic v1: room program -> module composition -> shared thresholds -> independent rules.
// Portable classic script; every helper is exported with the template.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const generic = {
    id: 'generic', version: 1, name: 'Generic zone', attempts: 4, workLimit: 30000,
    summary: 'Combine adjoining clusters, corridor crosses, courtyard rings and shared halls. Room supply limits reach; grouped dials and switchable modules shape the result.',
    dials: [
      { id: 'rooms', name: 'Room Count', group: 'Program', low: '8 rooms', high: '48 rooms', value: 40, help: 'Exact room program, independently of room dimensions and circulation spaces' },
      { id: 'scale', name: 'Room scale', group: 'Program', low: 'Small groups', high: 'Large groups', value: 40, help: 'Module envelopes from 12 to 18 metres across; partitions define actual room dimensions' },
      { id: 'variety', name: 'Room variety', group: 'Program', low: 'Even partitions', high: 'Varied partitions', value: 50, help: 'Offsets partition cuts while preserving usable sizes and reserved connection frontage' },
      { id: 'clusterSize', name: 'Rooms per cluster', group: 'Program', low: '2 rooms', high: '8 rooms', value: 65, help: 'Distributes the exact program among fewer large clusters or more small clusters' },
      { id: 'publicMix', name: 'Shared room mix', group: 'Program', low: 'Quiet rooms', high: 'Shared rooms', value: 45, help: 'Function mix among rooms not assigned to support facilities' },
      { id: 'supportMix', name: 'Support room mix', group: 'Program', low: 'None', high: 'One third', value: 35, help: 'Exact support allocation when the Support groups module is enabled' },
      { id: 'centrality', name: 'Service centrality', group: 'Program', low: 'Outer groups', high: 'Central groups', value: 80, help: 'Places the support program toward the outer or central module groups' },
      { id: 'sprawl', name: 'Sprawl', group: 'Composition', low: 'Compact', high: 'Reaching branches', value: 30, help: 'Chooses compact or outward module growth; available room clusters bound the reach' },
      { id: 'branching', name: 'Branching', group: 'Composition', low: 'One chain', high: 'Many offshoots', value: 40, help: 'Chooses an active tip or earlier module as the next growth parent' },
      { id: 'turns', name: 'Turning', group: 'Composition', low: 'Straight runs', high: 'Frequent turns', value: 40, help: 'Biases the next module direction relative to its parent heading' },
      { id: 'cohesion', name: 'Cohesion', group: 'Composition', low: 'Separated groups', high: 'Shared boundaries', value: 100, strict: 100, help: '100 makes neighbouring module envelopes touch. Lower values permit explicit connector halls; rooms are not stretched.' },
      { id: 'moduleMix', name: 'Module variety', group: 'Composition', low: 'Repeated recipe', high: 'Mixed recipes', value: 65, help: 'Repeats a chosen compatible recipe or mixes enabled architectural modules' },
      { id: 'loops', name: 'Secondary routes', group: 'Circulation', low: 'Tree', high: 'Many loops', value: 45, help: 'Adds available cross-cluster and within-cluster passages when the Secondary passages module is enabled; courtyard rings have their own required loop' },
      { id: 'hallWidth', name: 'Corridor width', group: 'Circulation', low: '2 m', high: '4 m', value: 20, help: 'Width of corridor crosses, courtyard circulation and inter-cluster connector halls' },
      { id: 'open', name: 'Openness', group: 'Circulation', low: 'Doors', high: 'Open passages', value: 40, help: 'Selects actual door, wide and open join modes; narrow frontage may cause a documented wide-to-door fallback' },
      { id: 'exits', name: 'External ports', group: 'Circulation', low: '1 port', high: '8 ports', value: 30, help: 'Exact count of free exterior entrance/exit opportunities, including the arrival entrance' },
      { id: 'ceiling', name: 'Ceiling height', group: 'Height', low: '2.4 m', high: '5 m', value: 25, help: 'Base headroom; raised sections enforce the larger height needed for compatible climb passages' },
      { id: 'heightVariety', name: 'Height variety', group: 'Height', low: 'Uniform', high: 'Varied ceilings', value: 25, help: 'Seeded height variation in ten-centimetre steps; never removes required route headroom' },
      { id: 'levelChange', name: 'Raised sections', group: 'Height', low: 'Flat', high: '1 m ledges', value: 0, help: 'Alternates module floor levels joined by reversible climb passages. These are raised sections, not stacked storeys or generated stairs.' },
      { id: 'spines', name: 'Corridor crosses', group: 'Modules', type: 'toggle', value: 100, help: 'Central cross circulation with rooms subdivided into four surrounding groups; needs at least four rooms' },
      { id: 'courts', name: 'Courtyard rings', group: 'Modules', type: 'toggle', value: 100, help: 'Eight circulation pieces enclose a real unbuilt courtyard and four occupied room bands; needs at least four rooms' },
      { id: 'halls', name: 'Shared halls', group: 'Modules', type: 'toggle', value: 100, help: 'A large gathering room connects smaller adjoining rooms' },
      { id: 'support', name: 'Support groups', group: 'Modules', type: 'toggle', value: 100, help: 'Assigns support rooms as a grouped program using Support mix and Service centrality' },
      { id: 'crossLinks', name: 'Secondary passages', group: 'Modules', type: 'toggle', value: 100, help: 'Enables optional additional shared-wall routes; required connectivity is always retained' }
    ],
    // A module declares its program needs and circulation cost; additions share the same envelope/port contract.
    modules: [
      { id: 'cluster', name: 'Adjoining cluster', minimumRooms: 2, extraSpaces: 0, builder: 'cluster', supplies: 'Occupied rectangle; passages through rooms; four reserved edge frontages' },
      { id: 'spine', name: 'Corridor cross', control: 'spines', minimumRooms: 4, extraSpaces: 3, builder: 'spine', supplies: 'Four room groups; independent north/south/east/west circulation ports' },
      { id: 'court', name: 'Courtyard ring', control: 'courts', minimumInterior: 12, void: 'courtyard-square', minimumRooms: 4, extraSpaces: 8, builder: 'court', supplies: 'Four room bands; reserved courtyard; continuous perimeter circulation' },
      { id: 'hall', name: 'Shared hall', control: 'halls', minimumRooms: 2, extraSpaces: 0, builder: 'hall', supplies: 'Large shared room; smaller adjoining rooms; four reserved edge frontages' }
    ],
    ruleModules: [
      { id: 'program', evaluator: 'programRules' },
      { id: 'envelopes', evaluator: 'moduleRules' },
      { id: 'movement', evaluator: 'movementRules' }
    ],
    presets: [],
    make(spec) { return api.generateTemplate(generic, spec, d => generic.compose(d).zone); },
    design(spec) {
      let model;
      const zone = api.generateTemplate(generic, spec, d => { model = generic.compose(d); return model.zone; });
      return zone.error ? zone : { zone, layout: model.layout };
    },
    displayDial(id, value) {
      if (id === 'rooms') return String(8 + Math.floor(value * 40 / 100));
      if (id === 'scale') return (12 + 2 * Math.floor(value * 3 / 100)) + ' m';
      if (id === 'clusterSize') return String(2 + Math.floor(value * 6 / 100));
      if (id === 'hallWidth') return (2 + Math.floor(value * 2 / 100)) + ' m';
      if (id === 'exits') return String(1 + Math.floor(value * 7 / 100));
      if (id === 'ceiling') return ((240 + 10 * Math.floor(value * 26 / 100)) / 100).toFixed(1) + ' m';
      if (id === 'levelChange') return (value ? (20 + 10 * Math.floor(value * 8 / 100)) / 100 : 0).toFixed(1) + ' m';
      if (id === 'supportMix') return Math.floor(value / 3) + '%';
      return String(value);
    },
    quantities(dials) {
      const rooms = 8 + Math.floor(dials.rooms * 40 / 100), per = 2 + Math.floor(dials.clusterSize * 6 / 100);
      return { rooms, modules: Math.ceil(rooms / per), tile: 24 + 4 * Math.floor(dials.scale * 3 / 100), hall: 4 + 2 * Math.floor(dials.hallWidth * 2 / 100), gap: 4 * Math.floor(dials.sprawl * (100 - dials.cohesion) * 3 / 10000), ports: 1 + Math.floor(dials.exits * 7 / 100), step: dials.levelChange ? 20 + 10 * Math.floor(dials.levelChange * 8 / 100) : 0 };
    },
    // Seeded spatial grammar builds occupied module cells, not arbitrary room scattering.
    arrange(d, count) {
      const nodes = [{ x: 0, y: 0, parent: null, heading: 0 }], dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
      const occupied = (x, y) => nodes.some(n => n.x === x && n.y === y);
      for (let i = 1; i < count; ++i) {
        const branch = d.chance('layout/' + i + '/branch', d.dials.branching), options = [];
        const order = branch ? nodes.map((n, index) => ({ n, index, draw: d.pick('layout/' + i + '/parent/' + index, 0, 100000) })).sort((a, b) => a.draw - b.draw || a.index - b.index) : nodes.map((n, index) => ({ n, index })).reverse();
        for (let rank = 0; rank < order.length; ++rank) for (let dir = 0; dir < 4; ++dir) {
          d.step(); const { n, index } = order[rank], x = n.x + dx[dir], y = n.y + dy[dir]; if (occupied(x, y)) continue;
          const distance = Math.abs(x) + Math.abs(y), turn = dir !== n.heading, neighbours = nodes.filter(n => Math.abs(n.x - x) + Math.abs(n.y - y) === 1).length;
          const score = distance * (d.dials.sprawl - 50) * 20 - rank * (d.dials.sprawl >= 50 ? 2000 : 20) + (turn ? d.dials.turns * 4 - 200 : 200 - d.dials.turns * 4) + (neighbours - 1) * (d.dials.crossLinks >= 50 ? d.dials.loops : 0) * 3;
          options.push({ x, y, parent: index, heading: dir, score, draw: d.pick('layout/' + i + '/tie/' + index + '/' + dir, 0, 10000) });
        }
        options.sort((a, b) => b.score - a.score || a.draw - b.draw || a.parent - b.parent || a.heading - b.heading);
        if (!options.length) throw new Error('Bounded module frontier has no available cell.');
        const { x, y, parent, heading } = options[0]; nodes.push({ x, y, parent, heading });
      }
      return nodes;
    },
    // Integer BSP preserves each exterior port strip and a minimum 2 m room side.
    partition(d, rect, count, name, tile, hall) {
      const leaves = [rect], low = (tile - hall) / 2, high = (tile + hall) / 2;
      while (leaves.length < count) {
        const choices = [], capacity = r => Math.floor((r[2] - r[0]) / 4) * Math.floor((r[3] - r[1]) / 4), totalCapacity = leaves.reduce((n, r) => n + capacity(r), 0);
        leaves.forEach((r, index) => {
          for (const axis of [0, 1]) for (let cut = r[axis] + 4; cut <= r[axis + 2] - 4; ++cut) {
            d.step(); const exterior = axis === 0 ? r[1] === 0 || r[3] === tile : r[0] === 0 || r[2] === tile;
            if (exterior && cut > low && cut < high) continue;
            const a = [...r], b = [...r]; a[axis + 2] = cut; b[axis] = cut;
            if (totalCapacity - capacity(r) + capacity(a) + capacity(b) < count) continue;
            const length = r[axis + 2] - r[axis], middle = r[axis] + Math.floor(length / 2), offset = Math.abs(cut - middle), variation = d.pick(name + '/split/' + leaves.length + '/' + index + '/' + axis + '/' + cut, 0, d.dials.variety * 2);
            choices.push({ index, axis, cut, score: length * 100 - offset * (100 - d.dials.variety) + variation });
          }
        });
        choices.sort((a, b) => b.score - a.score || a.index - b.index || a.axis - b.axis || a.cut - b.cut);
        if (!choices.length) throw new Error(name + ': room program cannot fit reserved frontage.');
        const { index, axis, cut } = choices[0], a = [...leaves[index]], b = [...a]; a[axis + 2] = cut; b[axis] = cut; leaves.splice(index, 1, a, b);
      }
      return leaves;
    },
    cluster(ctx) { ctx.rooms(ctx.partition([0, 0, ctx.tile, ctx.tile], ctx.count, 'cluster')); },
    hall(ctx) {
      const split = (ctx.tile + ctx.hall) / 2;
      ctx.room([0, 0, split, ctx.tile], 'Gathering hall', 'shared');
      ctx.rooms(ctx.partition([split, 0, ctx.tile, ctx.tile], ctx.count - 1, 'hall'));
    },
    spine(ctx) {
      const a = (ctx.tile - ctx.hall) / 2, b = a + ctx.hall;
      ctx.hallSpace([a, 0, b, ctx.tile], 'Main spine'); ctx.hallSpace([0, a, a, b], 'Cross passage'); ctx.hallSpace([b, a, ctx.tile, b], 'Cross passage');
      ctx.bands([[0, 0, a, a], [b, 0, ctx.tile, a], [b, b, ctx.tile, ctx.tile], [0, b, a, ctx.tile]], 'spine');
    },
    court(ctx) {
      const T = ctx.tile, H = ctx.hall, m = T / 2, half = Math.max(2, Math.min(4, m - H - 4));
      for (const r of [[0, 0, H, H], [H, 0, T - H, H], [T - H, 0, T, H], [T - H, H, T, T - H], [T - H, T - H, T, T], [H, T - H, T - H, T], [0, T - H, H, T], [0, H, H, T - H]]) ctx.hallSpace(r, 'Courtyard walk');
      ctx.bands([[H, H, T - H, m - half], [m + half, m - half, T - H, T - H], [H, m + half, m + half, T - H], [H, m - half, m - half, m + half]], 'court');
      ctx.voids.push([m - half, m - half, m + half, m + half]);
    },
    compose(d) {
      const D = d.dials, q = generic.quantities(D), nodes = generic.arrange(d, q.modules), pitch = q.tile + q.gap;
      const spaces = [], joins = [], packets = [], dx = [1, 0, -1, 0], dy = [0, 1, 0, -1], sides = ['e', 'n', 'w', 's'];
      const layout = { quantities: q, modules: [], modulesLimitedByBudget: [], ruleModules: generic.ruleModules.map(r => r.id), enabledModules: generic.modules.filter(m => !m.control || D[m.control] >= 50).map(m => m.id) };
      let circulationBudget = 128 - q.rooms - (q.gap ? 2 * q.modules : 0);
      const height = id => Math.max(200 + q.step, 240 + 10 * Math.floor(D.ceiling * 26 / 100) + 10 * d.pick(id + '/height', -Math.floor(D.heightVariety / 10), Math.floor(D.heightVariety / 10)));
      const mode = name => d.chance(name + '/open', D.open) ? 'open' : d.chance(name + '/wide', D.open) ? 'wide' : 'door';
      function add(id, rect, floor, kind = 'room', title = 'Room', role = 'quiet') {
        d.step(); const s = { id, rect, floor, kind, title, role, ceiling: height(id) }; spaces.push(s); return s;
      }
      function link(a, b, required, name) {
        d.step(); const wall = api.shared(a, b); if (!wall || wall.high - wall.low < 4) throw new Error('Module passage lacks reserved frontage.');
        if (!joins.some(j => j.a === a.id && j.b === b.id || j.a === b.id && j.b === a.id)) joins.push({ a: a.id, b: b.id, mode: a.floor === b.floor ? mode(name) : 'climb', required });
      }
      const counts = nodes.map((_, i) => Math.floor(q.rooms / nodes.length) + (i < q.rooms % nodes.length ? 1 : 0));
      const compatible = (i, budget) => generic.modules.filter(m => (!m.control || D[m.control] >= 50) && m.minimumRooms <= counts[i] && (!m.minimumInterior || q.tile - 2 * q.hall >= m.minimumInterior) && m.extraSpaces <= budget);
      let repeated = null;
      for (let i = 0; i < nodes.length; ++i) {
        const node = nodes[i], x = node.x * pitch, y = node.y * pitch, floor = q.step * (((node.x + node.y) % 2 + 2) % 2), local = [], voids = [];
        const available = compatible(i, circulationBudget); if (!available.length) throw new Error('No compatible module for the room program.');
        let recipe = available.find(m => m.id === repeated);
        if (!recipe) recipe = available[d.pick('module/' + i + '/recipe', available.length > 1 ? 1 : 0, available.length - 1)];
        else if (d.chance('module/' + i + '/mix', D.moduleMix)) recipe = available[d.pick('module/' + i + '/recipe', 0, available.length - 1)];
        const excluded = generic.modules.filter(m => (!m.control || D[m.control] >= 50) && m.minimumRooms <= counts[i] && m.extraSpaces > circulationBudget);
        excluded.forEach(m => layout.modulesLimitedByBudget.push({ module: i, recipe: m.id }));
        repeated ??= recipe.id; circulationBudget -= recipe.extraSpaces;
        let roomIndex = 0, hallIndex = 0;
        const room = (r, title, role) => { const s = add('module-' + i + '-' + recipe.id + '-room-' + roomIndex++, [r[0] + x, r[1] + y, r[2] + x, r[3] + y], floor, 'room', title, role); local.push(s); return s; };
        const context = { tile: q.tile, hall: q.hall, count: counts[i], voids, room,
          hallSpace(r, title) { const s = add('module-' + i + '-' + recipe.id + '-hall-' + hallIndex++, [r[0] + x, r[1] + y, r[2] + x, r[3] + y], floor, 'hall', title, 'circulation'); local.push(s); return s; },
          partition(r, n, path) { return generic.partition(d, r, n, 'module/' + i + '/' + path, q.tile, q.hall); },
          rooms(rects) { rects.forEach(r => room(r)); },
          bands(bands, path) {
            const quantities = bands.map(() => 1); let remaining = counts[i] - 4;
            while (remaining > 0) {
              let fitted = false;
              for (let k = 0; k < bands.length && remaining > 0; ++k) {
                try { this.partition(bands[k], quantities[k] + 1, path + '/' + k); ++quantities[k]; --remaining; fitted = true; } catch (error) { if (/work bound/.test(error.message)) throw error; }
              }
              if (!fitted) throw new Error('Room bands cannot fit the complete program.');
            }
            bands.forEach((r, k) => this.rooms(this.partition(r, quantities[k], path + '/' + k)));
          }
        };
        generic[recipe.builder](context);
        if (roomIndex !== counts[i] || hallIndex !== recipe.extraSpaces) throw new Error('Module violated its declared program/circulation contract.');
        const ports = {};
        for (let dir = 0; dir < 4; ++dir) {
          const a = (q.tile - q.hall) / 2, b = a + q.hall;
          ports[sides[dir]] = local.find(s => { const r = s.rect.map((v, k) => v - (k % 2 ? y : x)); return dir === 0 ? r[2] === q.tile && r[1] <= a && r[3] >= b : dir === 1 ? r[3] === q.tile && r[0] <= a && r[2] >= b : dir === 2 ? r[0] === 0 && r[1] <= a && r[3] >= b : r[1] === 0 && r[0] <= a && r[2] >= b; });
          if (!ports[sides[dir]]) throw new Error(recipe.id + ' cannot supply its ' + sides[dir] + ' port.');
        }
        const pairs = [];
        for (let a = 0; a < local.length; ++a) for (let b = a + 1; b < local.length; ++b) { d.step(); const wall = api.shared(local[a], local[b]); if (wall && wall.high - wall.low >= 4) pairs.push({ a, b, draw: d.pick('module/' + i + '/join/' + a + '/' + b, 0, 100000), ring: recipe.id === 'court' && local[a].kind === 'hall' && local[b].kind === 'hall' }); }
        pairs.sort((a, b) => Number(b.ring) - Number(a.ring) || a.draw - b.draw || a.a - b.a || a.b - b.b);
        const group = local.map((_, i) => i), find = k => { while (group[k] !== k) k = group[k]; return k; };
        for (const p of pairs) {
          const a = find(p.a), b = find(p.b), required = a !== b || p.ring;
          if (required || D.crossLinks >= 50 && d.chance('module/' + i + '/extra/' + p.a + '/' + p.b, D.loops)) { link(local[p.a], local[p.b], required, 'module/' + i + '/mode/' + p.a + '/' + p.b); group[a] = b; }
        }
        if (local.some((_, k) => find(k) !== find(0))) throw new Error('Module internal passages are disconnected.');
        const packet = { node, ports, rooms: local.filter(s => s.kind === 'room'), x, y, floor, recipe: recipe.id }; packets.push(packet);
        layout.modules.push({ id: 'module-' + i, recipe: recipe.id, parent: node.parent, cell: [node.x, node.y], envelope: [x, y, x + q.tile, y + q.tile], floor, rooms: counts[i], voids: voids.map(r => [r[0] + x, r[1] + y, r[2] + x, r[3] + y]) });
      }
      function connectPackets(a, b, required) {
        const dir = dx.findIndex((v, i) => b.node.x - a.node.x === v && b.node.y - a.node.y === dy[i]), first = a.ports[sides[dir]], second = b.ports[sides[(dir + 2) % 4]], name = 'between/' + a.node.x + '/' + a.node.y + '/' + b.node.x + '/' + b.node.y;
        if (!q.gap) link(first, second, required, name);
        else {
          const m = q.tile / 2, h = q.hall / 2, r = dir === 0 ? [a.x + q.tile, a.y + m - h, b.x, a.y + m + h] : dir === 1 ? [a.x + m - h, a.y + q.tile, a.x + m + h, b.y] : dir === 2 ? [b.x + q.tile, a.y + m - h, a.x, a.y + m + h] : [a.x + m - h, b.y + q.tile, a.x + m + h, a.y];
          const bridge = add('connector-' + packets.indexOf(a) + '-' + packets.indexOf(b), r, a.floor, 'hall', 'Cluster connector', 'circulation'); link(first, bridge, required, name + '/first'); link(bridge, second, required, name + '/second');
        }
      }
      const connected = new Set();
      for (let i = 1; i < packets.length; ++i) { const p = nodes[i].parent; connectPackets(packets[p], packets[i], true); connected.add([p, i].sort((a, b) => a - b).join('/')); }
      if (D.crossLinks >= 50) for (let a = 0; a < packets.length; ++a) for (let b = a + 1; b < packets.length; ++b) if (!connected.has(a + '/' + b) && Math.abs(nodes[a].x - nodes[b].x) + Math.abs(nodes[a].y - nodes[b].y) === 1 && d.chance('between/' + a + '/' + b + '/extra', D.loops)) connectPackets(packets[a], packets[b], false);
      // Program grouping is independent of the spatial RNG; shared halls retain their functional role.
      const supportCount = D.support >= 50 ? Math.floor(q.rooms * D.supportMix / 300) : 0;
      const ordered = packets.map((p, index) => ({ p, index, priority: (Math.abs(p.node.x) + Math.abs(p.node.y)) * (D.centrality - 50) + d.pick('program/support/module/' + index, 0, 100) })).sort((a, b) => a.priority - b.priority || a.index - b.index);
      let assigned = 0;
      for (const { p } of ordered) for (const room of p.rooms) {
        if (assigned < supportCount) { room.role = 'support'; room.title = 'Support room'; ++assigned; }
        else if (room.title !== 'Gathering hall') { room.role = d.chance(room.id + '/public', D.publicMix) ? 'shared' : 'quiet'; room.title = room.role === 'shared' ? 'Shared room' : 'Quiet room'; }
      }
      const arrival = packets[0].ports.s;
      const zone = { format: 'backrooms-zone', version: 1, id: 'generic-' + d.seed, name: 'Generic zone · seed ' + d.seed, theme: 'backrooms',
        notes: 'Generic modular prototype: ' + q.rooms + ' rooms in ' + q.modules + ' clusters. Recipes: ' + layout.modules.map(m => m.recipe).join(', ') + '. Maximum Cohesion joins envelopes without stretching rooms. Courtyards are unbuilt exterior space. Raised sections use climb contracts, not generated stairs. Full angled/curved geometry requires a richer adapter.',
        source: { template: api.templateKey(generic), seed: d.seed, dials: D, lab: 'exchange-6' }, start: { space: arrival.id, x: (arrival.rect[0] + arrival.rect[2]) / 2, y: (arrival.rect[1] + arrival.rect[3]) / 2 }, spaces, joins, entrances: [] };
      const ports = [];
      for (const s of spaces) for (const side of ['s', 'n', 'e', 'w']) for (const [lo, hi] of api.freeStretches(s, side, spaces, zone)) if (hi - lo >= 4) ports.push({ s, side, lo, hi, priority: s.id === arrival.id ? -1 : 0 });
      ports.sort((a, b) => a.priority - b.priority || (b.hi - b.lo) - (a.hi - a.lo) || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0) || (a.side < b.side ? -1 : a.side > b.side ? 1 : 0) || a.lo - b.lo);
      for (let i = 0; i < q.ports; ++i) {
        const p = ports[i]; if (!p) throw new Error('Requested exterior port count cannot fit free walls.');
        zone.entrances.push({ title: i === 0 ? 'Arrival entrance' : 'Secondary port ' + i, space: p.s.id, side: p.side, at: (p.lo + p.hi) / 2 });
      }
      // If module zero is surrounded by later modules, arrival may use another perimeter room.
      const first = zone.entrances[0], entranceRoom = spaces.find(s => s.id === first.space);
      zone.start = { space: entranceRoom.id, x: (entranceRoom.rect[0] + entranceRoom.rect[2]) / 2, y: (entranceRoom.rect[1] + entranceRoom.rect[3]) / 2 };
      return { zone, layout };
    },
    rules(zone, dials) {
      return generic.ruleModules.flatMap(module => {
        const evaluate = generic[module.evaluator];
        if (typeof evaluate !== 'function') throw new Error('Missing rule module evaluator: ' + module.id);
        return evaluate.call(generic, zone, dials);
      });
    },
    programRules(zone, dials) {
      const q = generic.quantities(dials), S = zone.spaces;
      const reports = [], add = (id, name, kept, detail) => reports.push(api.rule(id, name, kept, detail));
      const rooms = S.filter(s => s.kind === 'room'), moduleRooms = rooms.filter(s => /^module-[0-9]+-[a-z0-9-]+-room-/.test(s.id));
      add('room-program', 'The complete requested room program is present', rooms.length === q.rooms && moduleRooms.length === q.rooms, 'Room program is missing or exceeds Room Count.');
      add('support-program', 'Support facilities match the enabled program', rooms.filter(s => s.role === 'support').length === (dials.support >= 50 ? Math.floor(q.rooms * dials.supportMix / 300) : 0), 'Support grouping differs from the requested program.');
      return reports;
    },
    moduleRules(zone, dials) {
      const q = generic.quantities(dials), S = zone.spaces;
      const reports = [], add = (id, name, kept, detail) => reports.push(api.rule(id, name, kept, detail));
      const modules = new Map();
      for (const s of S) { const match = s.id.match(/^module-([0-9]+)-(.+)-(room|hall)-[0-9]+$/); if (match) { if (!modules.has(Number(match[1]))) modules.set(Number(match[1]), { recipe: match[2], spaces: [] }); const m = modules.get(Number(match[1])); if (m.recipe !== match[2]) m.recipe = 'mixed'; m.spaces.push(s); } }
      const contracts = modules.size === q.modules && [...modules].every(([i, m]) => {
        const r = m.spaces.map(s => s.rect), box = [Math.min(...r.map(r => r[0])), Math.min(...r.map(r => r[1])), Math.max(...r.map(r => r[2])), Math.max(...r.map(r => r[3]))];
        const recipe = generic.modules.find(r => r.id === m.recipe), half = Math.max(2, Math.min(4, q.tile / 2 - q.hall - 4));
        const hole = [box[0] + q.tile / 2 - half, box[1] + q.tile / 2 - half, box[0] + q.tile / 2 + half, box[1] + q.tile / 2 + half];
        const emptyCourtyard = recipe?.void !== 'courtyard-square' || r.every(r => !(r[0] < hole[2] && hole[0] < r[2] && r[1] < hole[3] && hole[1] < r[3]));
        const area = r.reduce((n, r) => n + (r[2] - r[0]) * (r[3] - r[1]), 0), expectedRooms = Math.floor(q.rooms / q.modules) + (i < q.rooms % q.modules ? 1 : 0);
        return recipe && emptyCourtyard && i < q.modules && box[2] - box[0] === q.tile && box[3] - box[1] === q.tile && area === q.tile * q.tile - (recipe?.void === 'courtyard-square' ? 4 * half * half : 0) && m.spaces.filter(s => s.kind === 'room').length === expectedRooms && m.spaces.filter(s => s.kind === 'hall').length === recipe.extraSpaces;
      });
      add('module-contracts', 'Every module realizes its occupied envelope and recipe program', contracts, 'Module envelope, courtyard, program, circulation or enabled recipe differs from its contract.');
      add('cohesion', 'Maximum cohesion uses touching cluster envelopes', dials.cohesion < 100 || S.every(s => /^module-[0-9]+-[a-z0-9-]+-(room|hall)-[0-9]+$/.test(s.id)), 'Maximum cohesion retained an empty inter-cluster connector.');
      add('module-switches', 'Disabled modules do not leave their circulation structures', [...modules.values()].every(m => { const recipe = generic.modules.find(r => r.id === m.recipe); return recipe && (!recipe.control || dials[recipe.control] >= 50); }), 'Disabled architectural module is still present.');
      return reports;
    },
    movementRules(zone, dials) {
      const q = generic.quantities(dials), S = zone.spaces;
      const reports = [], add = (id, name, kept, detail) => reports.push(api.rule(id, name, kept, detail));
      add('arrival', 'Arrival starts at an actual external entrance owner', zone.entrances[0]?.space === zone.start.space, 'Arrival does not belong to its exterior port.');
      add('ports', 'The requested external port count is realized', zone.entrances.length === q.ports, 'External port count differs from the requested control.');
      add('secondary-passages', 'Disabled secondary passages leave required routes only', dials.crossLinks >= 50 || zone.joins.every(j => j.required), 'Optional routes remain after their module was disabled.');
      add('floors', 'Raised sections match the declared level range', S.every(s => s.floor === Math.min(...S.map(s => s.floor)) || q.step && s.floor === Math.min(...S.map(s => s.floor)) + q.step), 'A floor is outside the requested raised-section range.');
      add('headroom', 'All spaces preserve compatible movement headroom', S.every(s => s.ceiling >= 200 + q.step), 'A raised connection lacks common headroom.');
      add('plain-geometry', 'Required movement uses plain checked rectangular geometry', S.every(s => !s.features && !s.outline && s.kind !== 'stair'), 'Unexpected geometry dressing or stair contract.');
      return reports;
    }
  };
  const defaults = Object.fromEntries(generic.dials.map(d => [d.id, d.value]));
  generic.presets = [
    { name: 'Mixed zone', dials: { ...defaults } },
    { name: 'Compact clusters', dials: { ...defaults, rooms: 35, sprawl: 0, branching: 65, turns: 65, cohesion: 100, moduleMix: 100, spines: 0, courts: 0, halls: 0, loops: 80 } },
    { name: 'Branching wings', dials: { ...defaults, rooms: 85, clusterSize: 35, sprawl: 100, branching: 80, turns: 35, cohesion: 100, moduleMix: 0, spines: 100, courts: 0, halls: 0 } },
    { name: 'Courtyard compound', dials: { ...defaults, rooms: 70, clusterSize: 100, sprawl: 10, branching: 75, turns: 80, cohesion: 100, moduleMix: 100, spines: 0, courts: 100, halls: 0, loops: 90 } },
    { name: 'Shared halls', dials: { ...defaults, rooms: 60, clusterSize: 90, publicMix: 100, supportMix: 0, sprawl: 45, halls: 100, spines: 0, courts: 0, moduleMix: 0, open: 90 } },
    { name: 'Quiet passages', dials: { ...defaults, rooms: 65, publicMix: 0, supportMix: 15, open: 0, loops: 0, crossLinks: 0, halls: 0, courts: 0, spines: 0, sprawl: 75, branching: 15 } },
    { name: 'Dispersed compound', dials: { ...defaults, rooms: 65, cohesion: 0, sprawl: 90, branching: 85, turns: 90, moduleMix: 100 } },
    { name: 'Raised sections', dials: { ...defaults, rooms: 40, levelChange: 65, ceiling: 50, heightVariety: 80, sprawl: 35, open: 25 } }
  ];
  api.templates.push(generic);
}());
