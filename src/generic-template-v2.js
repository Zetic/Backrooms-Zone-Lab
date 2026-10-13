// Generic v2 uses the full geometry contract; v1 remains a separate replayable template.
const dial = (id, name, group, value, low, high, help) => ({ id, name, group, value, low, high, help });
export const genericTemplate = {
  id: 'generic', version: 2, name: 'Generic zone v2',
  dials: [
    dial('rooms', 'Room Count', 'Program', 45, '8 rooms', '96 rooms', 'Exact room count; circulation has a separate bounded budget.'),
    dial('scale', 'Room scale', 'Program', 45, 'Small rooms', 'Large rooms', 'Actual room dimensions, independent of connecting corridor length.'),
    dial('variety', 'Room variety', 'Program', 80, 'Even dimensions', 'Mixed dimensions', 'Size differences, offsets and stepped cluster boundaries.'),
    dial('clusterSize', 'Rooms per cluster', 'Program', 55, '2 rooms', '10 rooms', 'More small groups or fewer extensive interconnected groups.'),
    dial('moduleMix', 'Architecture variety', 'Program', 100, 'Repeated recipe', 'Mixed recipes', 'Mix partitioned groups, chamber chains, side-room halls and shared chambers.'),
    dial('publicMix', 'Shared room mix', 'Program', 35, 'Quiet rooms', 'Shared rooms', 'Function mix; shared-chamber recipes always retain their large shared room.'),
    dial('supportMix', 'Support room mix', 'Program', 15, 'None', 'One third', 'Exact support allocation among the requested rooms.'),
    dial('sprawl', 'Sprawl', 'Composition', 65, 'Compact', 'Outward growth', 'Biases new branches toward the outer frontier; also increases route separation.'),
    dial('branching', 'Branching', 'Composition', 65, 'One chain', 'Many offshoots', 'Grow from the latest cluster or an earlier cluster, subject to physical fit.'),
    dial('turns', 'Turning', 'Composition', 65, 'Straight routes', 'Frequent bends', 'Creates real corridor junctions and changes route direction.'),
    dial('orientation', 'Orientation variety', 'Composition', 80, 'Cardinal clusters', 'Angled clusters', 'Permits 45-degree changes between cluster frames; rooms within a cluster stay coherent.'),
    dial('cohesion', 'Cohesion', 'Composition', 35, 'Separated groups', 'Adjoining groups', 'More directly adjoining clusters and shorter connecting passages; does not stretch rooms.'),
    dial('corridorLength', 'Corridor length', 'Circulation', 55, 'Short links', 'Long passages', 'Route length independent of room supply; each link can include two runs and a bend.'),
    dial('hallWidth', 'Corridor width', 'Circulation', 25, '2 m', '4 m', 'Actual connecting and local hall widths; narrow host walls cap connection width.'),
    dial('loops', 'Secondary routes', 'Circulation', 55, 'Tree', 'Many loops', 'Adds physically available shared-wall passages within and between clusters.'),
    dial('open', 'Openness', 'Circulation', 65, 'Doorways', 'Wide passages', 'Changes supported aperture width, bounded by real wall frontage.'),
    dial('exits', 'External ports', 'Circulation', 25, '1 port', '8 ports', 'Exact exterior connection opportunities, including the arrival.'),
    dial('ceiling', 'Ceiling height', 'Height', 35, '2.4 m', '5 m', 'Uniform usable headroom for this single-floor generator.'),
    ...['partitioned', 'chains', 'sideHalls', 'chambers'].map((id, i) => ({ id, name: ['Partitioned groups', 'Room chains', 'Side-room halls', 'Shared chambers'][i], group: 'Architecture', type: 'toggle', value: 100, help: 'Makes this architecture recipe available. Partitioned groups provide the fallback when all recipes are disabled.' }))
  ],
  displayDial(id, value) {
    if (id === 'rooms') return String(8 + Math.floor(value * 88 / 100));
    if (id === 'clusterSize') return String(2 + Math.floor(value * 8 / 100));
    if (id === 'exits') return String(1 + Math.floor(value * 7 / 100));
    if (id === 'hallWidth') return (2 + value / 50).toFixed(1) + ' m';
    if (id === 'ceiling') return (2.4 + value * .026).toFixed(1) + ' m';
    return String(value);
  }
};
export const genericDefaults = Object.fromEntries(genericTemplate.dials.map(d => [d.id, d.value]));
genericTemplate.presets = [
  { name: 'Explored Backrooms', dials: { ...genericDefaults } },
  { name: 'Branching wings', dials: { ...genericDefaults, rooms: 70, clusterSize: 35, sprawl: 90, branching: 90, turns: 70, corridorLength: 80, cohesion: 15 } },
  { name: 'Interconnected chambers', dials: { ...genericDefaults, clusterSize: 90, cohesion: 90, corridorLength: 10, loops: 95, open: 100, sideHalls: 0, chains: 0 } },
  { name: 'Long quiet passages', dials: { ...genericDefaults, rooms: 25, clusterSize: 25, corridorLength: 100, sprawl: 100, branching: 20, loops: 0, open: 0, cohesion: 0 } },
  { name: 'Dense subdivisions', dials: { ...genericDefaults, rooms: 60, clusterSize: 100, scale: 20, cohesion: 100, orientation: 0, turns: 25, loops: 80, sideHalls: 0, chains: 0, chambers: 0 } },
  { name: 'Angled room chains', dials: { ...genericDefaults, partitioned: 0, sideHalls: 0, chambers: 0, orientation: 100, turns: 100, branching: 45, corridorLength: 30 } }
];

export function genericInput(spec = {}) {
  if (!Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > 4294967295) throw new Error('Seed must be an unsigned 32-bit integer.');
  const dials = { ...genericDefaults };
  for (const d of genericTemplate.dials) {
    const value = spec.dials?.[d.id] ?? d.value;
    if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error(d.name + ' must be a whole number from 0 to 100.');
    dials[d.id] = value;
  }
  return { seed: spec.seed, dials };
}
