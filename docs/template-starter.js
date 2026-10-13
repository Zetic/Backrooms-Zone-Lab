// Copy to exchange/templates/<name>.js; rename starter/id; register in index.html and scripts/exchange.mjs.
// Dependencies: exchange/stream.js, checks.js, method.js. This file is runnable and audited by tests.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const starter = {
    id: 'starter', version: 1, name: 'Template starter', attempts: 4, workLimit: 1000,
    summary: 'A small workplace demonstrating program, adjacency intent and explicit rule relaxation.',
    dials: [
      { id: 'size', name: 'Size', low: 'Small', high: 'Large', value: 40, help: 'Room allocation dimensions' },
      { id: 'strange', name: 'Strangeness', low: 'Expected', high: 'Wrong', value: 0, help: 'At 50 storage is reached through work rather than arrival' }
    ],
    presets: [{ name: 'Ordinary', dials: { size: 40, strange: 0 } }, { name: 'Unusual access', dials: { size: 60, strange: 75 } }],
    make(spec) {
      return api.generateTemplate(starter, spec, d => {
        // 1. Define the program and semantic roles.
        const program = ['arrival', 'work', 'store'];
        // 2. Allocate a bounded composition; named draws never depend on call order.
        d.step(program.length);
        const w = api.dialSize(6, 10, d.dials.size), h = w + d.pick('layout/depth', 0, 1);
        const spaces = [
          { id: program[0], title: 'Arrival', kind: 'room', role: 'arrival', rect: [0, 0, w, h], floor: 0, ceiling: 270 },
          { id: program[1], title: 'Work room', kind: 'room', role: 'work', rect: [w, 0, 2 * w, 2 * h], floor: 0, ceiling: 270 },
          { id: program[2], title: 'Store', kind: 'room', role: 'store', rect: [0, h, w, 2 * h], floor: 0, ceiling: 270 }
        ];
        // 3. State every required connection. Both variants fit real shared stretches.
        const joins = [{ a: 'arrival', b: 'work', mode: 'wide', required: true },
          { a: d.dials.strange >= 50 ? 'work' : 'arrival', b: 'store', mode: 'door', required: true }];
        // 4. The method validates physical exchange contracts, then evaluates the rulebook.
        return { format: 'backrooms-zone', version: 1, id: 'starter-' + d.seed, name: 'Workplace · seed ' + d.seed,
          theme: 'backrooms', notes: 'Starter example; change the program, composition and rules for a new archetype.',
          source: { template: api.templateKey(starter), seed: d.seed, dials: d.dials, lab: 'exchange-2' },
          start: { space: 'arrival', x: w / 2, y: h / 2 }, spaces, joins,
          entrances: [{ title: 'Arrival entrance', space: 'arrival', side: 's', at: w / 2 }] };
      });
    },
    rules(zone, dials) {
      const direct = zone.joins.some(j => j.mode !== 'view' && [j.a, j.b].includes('arrival') && [j.a, j.b].includes('store'));
      return [
        api.rule('arrival', 'The start belongs to arrival', zone.start.space === 'arrival', 'Start is in another space.'),
        api.rule('store-access', 'Storage opens directly from arrival', direct, 'Storage is reached through the work room.',
          [{ dial: 'strange', name: 'Strangeness', at: 50 }], dials)
      ];
    }
  };
  api.templates.push(starter);
}());
