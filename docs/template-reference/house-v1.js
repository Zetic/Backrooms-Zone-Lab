// Portable template. Dependencies: ZoneExchange.stream, inputs, dialSize, validate.
// All layout decisions use integers; rectangles are 50 cm units, heights centimetres.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const house = {
    id: 'house', name: 'House',
    summary: 'An ordinary two-storey home, with a hall and stair between two wings.',
    dials: [
      { id: 'size', name: 'Size', low: 'Modest', high: 'Large', value: 40, help: 'How large the house and its rooms are' },
      { id: 'rooms', name: 'Rooms', low: 'Few', high: 'Many', value: 50, help: 'How far its floors are divided' }
    ],
    make(spec) {
      const input = api.inputs(house, spec);
      if (input.error) return input;
      const size = input.dials.size, many = input.dials.rooms;
      const seed = api.stream(input.seed, 'zonelab/house', 'seed');
      let trouble = 'no attempt was accepted';
      for (let attempt = 0; attempt < 4; ++attempt) {
        const s = api.stream(seed, 'attempt', String(attempt));
        const pick = (name, lo, hi) => lo + api.stream(s, 'house', name) % (hi - lo + 1);
        const L = api.dialSize(8, 12, size) + pick('wide', 0, 1), R = api.dialSize(7, 10, size) + pick('narrow', 0, 1);
        const back = api.dialSize(4, 6, size), depth = 18 + back, width = L + 6 + R;
        const sx = L, hx = L + 3, rx = L + 6, mirror = pick('mirror', 0, 1) === 1;
        const zone = {
          format: 'backrooms-zone', version: 1, id: 'house-' + input.seed, name: 'House · seed ' + input.seed, theme: 'residential',
          notes: 'A two-storey home with private rooms off the halls. Plain rectangular rooms keep the circulation transferable. The stair is realized as a ramp in Unreal.',
          source: { template: 'house-v1', seed: input.seed, dials: input.dials, lab: 'exchange-1' },
          start: { space: 'entry', x: mirror ? width - (sx + rx) / 2 : (sx + rx) / 2, y: 2 }, spaces: [], joins: [], entrances: []
        };
        const add = (id, title, kind, rect, floor, role) => {
          const r = mirror ? [width - rect[2], rect[1], width - rect[0], rect[3]] : rect;
          const space = { id, title, kind, rect: r, floor, ceiling: 250 };
          if (role) space.role = role;
          zone.spaces.push(space);
          return space;
        };
        const join = (a, b, mode, required = true) => zone.joins.push({ a: a.id, b: b.id, mode, required });
        const fromHall = (room, first, second, mode) => {
          const a = api.shared(room, first), b = api.shared(room, second), al = a ? a.high - a.low : 0, bl = b ? b.high - b.low : 0;
          join(room, al >= bl ? first : second, mode);
        };
        const entry = add('entry', 'Entry hall', 'hall', [sx, 0, rx, 4], 0);
        const hall = add('hall', 'Hallway', 'hall', [hx, 4, rx, depth], 0);
        const stair = add('stair', 'Stairs', 'stair', [sx, 4, hx, 18], 0); stair.rise = 290; stair.foot = 's';
        const pantry = add('pantry', 'Pantry', 'room', [sx, 18, hx, depth], 0, 'storage');
        const livingDepth = api.dialSize(10, 12, size) + pick('living', 0, 1);
        const dining = many >= 35 && depth - livingDepth >= 11;
        const diningDepth = dining ? Math.min(pick('dining', 5, 6), depth - livingDepth - 6) : 0;
        const living = add('living', 'Living room', 'room', [0, 0, L, livingDepth], 0, 'living');
        const dine = dining ? add('dining', 'Dining room', 'room', [0, livingDepth, L, livingDepth + diningDepth], 0, 'living') : null;
        const kitchen = add('kitchen', 'Kitchen', 'room', [0, livingDepth + diningDepth, L, depth], 0, 'kitchen');
        const frontDepth = pick('front', 7, 8), bathDepth = pick('bath', 4, 5), store = many >= 65 && depth - frontDepth - bathDepth >= 10;
        const utilityDepth = store ? pick('utility', 5, 6) : depth - frontDepth - bathDepth;
        const front = add('front', dining ? 'Study' : 'Dining room', 'room', [rx, 0, width, frontDepth], 0);
        const bath = add('bath', 'Bathroom', 'room', [rx, frontDepth, width, frontDepth + bathDepth], 0, 'bath');
        const utility = add(utilityDepth >= 9 ? 'family' : 'utility', utilityDepth >= 9 ? 'Family room' : 'Utility room', 'room', [rx, frontDepth + bathDepth, width, frontDepth + bathDepth + utilityDepth], 0, utilityDepth >= 9 ? 'living' : 'storage');
        const storeRoom = store ? add('store', 'Store room', 'room', [rx, frontDepth + bathDepth + utilityDepth, width, depth], 0, 'storage') : null;
        join(entry, hall, 'open'); join(entry, stair, 'open'); join(entry, living, 'wide');
        if (dining) { join(living, dine, 'wide'); join(dine, kitchen, 'wide'); } else join(living, kitchen, 'wide');
        join(kitchen, pantry, 'door'); join(hall, pantry, 'door', false);
        fromHall(front, entry, hall, dining ? 'door' : 'wide'); fromHall(bath, hall, entry, 'door'); fromHall(utility, hall, entry, 'door');
        if (storeRoom) fromHall(storeRoom, hall, entry, 'door');
        const landing = add('landing', 'Landing', 'hall', [sx, 18, hx, depth], 290);
        const upHall = add('uphall', 'Upstairs hall', 'hall', [hx, 0, rx, depth], 290);
        const upFront = add('uphall-front', 'Upstairs hall', 'hall', [sx, 0, hx, 4], 290);
        join(stair, landing, 'open'); join(landing, upHall, 'open'); join(upHall, upFront, 'open');
        const bedDepth = pick('bed', 8, 9), mainDepth = Math.max(back + 4, api.dialSize(8, 10, size));
        const between = depth - bedDepth - mainDepth, closet = L >= 9 && many >= 30;
        const bed1 = add('bedroom-1', 'Bedroom', 'room', [0, 0, L, bedDepth], 290, 'bedroom');
        const ensuite = add('ensuite', 'Main bathroom', 'room', [closet ? 4 : 0, bedDepth, L, bedDepth + between], 290, 'bath');
        const walkIn = closet ? add('closet', 'Closet', 'room', [0, bedDepth, 4, bedDepth + between], 290, 'closet') : null;
        const mainBed = add('main-bedroom', 'Main bedroom', 'room', [0, bedDepth + between, L, depth], 290, 'bedroom');
        join(upFront, bed1, 'door'); join(landing, mainBed, 'door'); join(mainBed, ensuite, 'door'); if (walkIn) join(mainBed, walkIn, 'door');
        const bed2Depth = pick('bed2', 7, 8), upBathDepth = pick('upbath', 4, 5), study = many >= 65 && depth - bed2Depth - upBathDepth >= 12;
        const bed3Depth = study ? pick('bed3', 7, 8) : depth - bed2Depth - upBathDepth;
        const bed2 = add('bedroom-2', 'Bedroom', 'room', [rx, 0, width, bed2Depth], 290, 'bedroom');
        const upBath = add('upbath', 'Bathroom', 'room', [rx, bed2Depth, width, bed2Depth + upBathDepth], 290, 'bath');
        const bed3 = add('bedroom-3', 'Bedroom', 'room', [rx, bed2Depth + upBathDepth, width, bed2Depth + upBathDepth + bed3Depth], 290, 'bedroom');
        const studyRoom = study ? add('study', 'Study', 'room', [rx, bed2Depth + upBathDepth + bed3Depth, width, depth], 290) : null;
        for (const room of [bed2, upBath, bed3, studyRoom]) if (room) join(upHall, room, 'door');
        zone.entrances.push({ title: 'Front door', space: entry.id, side: 's', at: (entry.rect[0] + entry.rect[2]) / 2 });
        zone.entrances.push({ title: 'Kitchen back door', space: kitchen.id, side: 'n', at: (kitchen.rect[0] + kitchen.rect[2]) / 2 });
        const checks = api.validate(zone);
        if (checks.valid) return zone;
        trouble = checks.errors.map(e => e.message).join('; ');
      }
      return { error: 'House: no attempt accepted: ' + trouble };
    }
  };
  api.templates.push(house);
}());
