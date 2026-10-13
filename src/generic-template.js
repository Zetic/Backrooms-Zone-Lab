const dial = (id, name, group, value, low, high, help) => ({ id, name, group, value, low, high, help });
export const genericTemplate = {
  id: 'generic', version: 3, name: 'Generic polygon neighborhood',
  dials: [
    dial('rooms', 'Room count', 'Rooms', 35, '8 rooms', '24 rooms', 'Exact room count for one connected neighborhood.'),
    dial('scale', 'Room scale', 'Rooms', 45, 'Small rooms', 'Large rooms', 'Sets the available floor area before shared boundaries are grown.'),
    dial('variety', 'Boundary variety', 'Rooms', 80, 'Shallow offsets', 'Deep offsets', 'Changes shared wall jogs, room proportions, corridor widening and the outer silhouette.'),
    dial('publicMix', 'Shared room mix', 'Rooms', 35, 'Quiet rooms', 'Shared rooms', 'Assigns room functions after geometry is complete.'),
    dial('supportMix', 'Support room mix', 'Rooms', 15, 'None', 'One third', 'Exact support allocation among the requested rooms.'),
    dial('turns', 'Passage bends', 'Layout', 65, 'Straight', 'Deep bends', 'Shapes one continuous corridor polygon; bends do not add junction rooms.'),
    dial('orientation', 'Angled walls', 'Layout', 80, 'Orthogonal', 'Many angled cuts', 'Permits slanted shared wall cuts and diagonal passage runs.'),
    dial('hallWidth', 'Passage width', 'Connections', 25, '2 m', '4 m', 'Base clear route width, with a variable width profile.'),
    dial('loops', 'Secondary routes', 'Connections', 55, 'Tree', 'Many loops', 'Opens additional shared boundaries. Any nonzero setting guarantees a real loop.'),
    dial('open', 'Openness', 'Connections', 65, 'Doorways', 'Wide passages', 'Changes aperture width within the actual shared wall span.'),
    dial('exits', 'External ports', 'Connections', 25, '1 port', '8 ports', 'Exact exterior connection opportunities, including arrival.'),
    dial('ceiling', 'Ceiling height', 'Height', 35, '2.4 m', '5 m', 'Uniform usable headroom for this single-floor generator.')
  ],
  displayDial(id, value) {
    if (id === 'rooms') return String(8 + Math.floor(value * 16 / 100));
    if (id === 'exits') return String(1 + Math.floor(value * 7 / 100));
    if (id === 'hallWidth') return (2 + value / 50).toFixed(1) + ' m';
    if (id === 'ceiling') return (2.4 + value * .026).toFixed(1) + ' m';
    return String(value);
  }
};
export const genericDefaults = Object.fromEntries(genericTemplate.dials.map(d => [d.id, d.value]));
genericTemplate.presets = [
  { name: 'Polygon neighborhood', dials: { ...genericDefaults } },
  { name: 'Angled shared walls', dials: { ...genericDefaults, orientation: 100, turns: 100, variety: 100 } },
  { name: 'Orthogonal recesses', dials: { ...genericDefaults, orientation: 0, variety: 100, turns: 70 } },
  { name: 'Open connected rooms', dials: { ...genericDefaults, loops: 100, open: 100, turns: 30 } },
  { name: 'Quiet winding route', dials: { ...genericDefaults, loops: 0, open: 0, publicMix: 0, turns: 90 } }
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
