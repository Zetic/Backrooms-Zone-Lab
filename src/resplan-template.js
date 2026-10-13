import { stream, fingerprint, canonicalStringify } from './determinism.js';
import { polygon, transform, point, signedArea, validateFootprint } from './geometry.js';

export const resplanTemplate = Object.freeze({ id: 'resplan', version: 1, name: 'ResPlan random floor plan',
  description: 'Select a real residential layout; preserve polygon rooms, walls, doors, windows and source attribution.' });
export const resplanCategories = ['living', 'bedroom', 'bathroom', 'kitchen', 'storage', 'stair', 'balcony', 'parking', 'garden', 'pool', 'veranda', 'wall', 'door', 'front_door', 'window', 'inner', 'land'];
export const resplanRoomCategories = ['living', 'bedroom', 'bathroom', 'kitchen', 'storage', 'stair', 'balcony', 'veranda'];
const numericId = value => typeof value === 'string' && /^\d{1,10}$/.test(value);
const finite = (n, low, high) => typeof n === 'number' && Number.isFinite(n) && n >= low && n <= high;
const xy = p => Array.isArray(p) && p.length === 2 && p.every(n => finite(n, -1e6, 1e6));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
export function resplanInput(spec = {}) {
  const input = { seed: spec.seed ?? 1, planId: spec.planId || null, bedrooms: spec.bedrooms ?? 'any',
    minArea: spec.minArea ?? 0, maxArea: spec.maxArea ?? 5000, scale: spec.scale ?? 1,
    rotation: spec.rotation ?? 0, mirror: spec.mirror ?? false, ceiling: spec.ceiling ?? 2.7 };
  assert(Number.isInteger(input.seed) && finite(input.seed, 0, 4294967295), 'Seed must be an unsigned 32-bit integer.');
  assert(input.planId === null || numericId(input.planId), 'Plan ID must be a numeric string.');
  assert(input.bedrooms === 'any' || (Number.isInteger(input.bedrooms) && finite(input.bedrooms, 0, 32)), 'Bedroom filter must be any or a count from 0 to 32.');
  assert(finite(input.minArea, 0, 5000) && finite(input.maxArea, input.minArea, 5000), 'Area filter requires 0 ≤ minimum ≤ maximum ≤ 5000 m².');
  assert(finite(input.scale, .5, 2), 'Scale must be 0.5–2.');
  assert(finite(input.rotation, 0, 359), 'Rotation must be 0–359 degrees.');
  assert(typeof input.mirror === 'boolean', 'Mirror must be boolean.');
  assert(finite(input.ceiling, 2.1, 5), 'Preview ceiling must be 2.1–5 m.');
  return input;
}

export function validateResPlanSource(source) {
  assert(source?.name === 'ResPlan' && source.repository === 'https://github.com/m-agour/ResPlan' && source.license === 'CC BY 4.0'
    && source.licenseUrl === 'https://creativecommons.org/licenses/by/4.0/' && typeof source.authors === 'string'
    && typeof source.modifications === 'string' && /^[a-f0-9]{40}$/.test(source.revision) && /^[a-f0-9]{64}$/.test(source.archiveSha256), 'ResPlan provenance or CC BY 4.0 attribution is missing.');
  assert(source.authors.length <= 200 && source.modifications.length <= 2000, 'Source attribution exceeds its budget.');
  return source;
}
export function validateResPlanCatalog(raw) {
  assert(raw?.schemaVersion === 'br.resplan-catalog/1', 'Expected a ResPlan catalog v1.');
  validateResPlanSource(raw.source);
  assert(Array.isArray(raw.plans) && raw.plans.length > 0 && raw.plans.length <= 20000, 'Catalog requires 1–20,000 plans.');
  assert(Number.isInteger(raw.releasePlanCount) && raw.releasePlanCount >= raw.plans.length && raw.releasePlanCount <= 20000, 'Invalid release count.');
  const ids = new Set(), hashes = new Map();
  for (const p of raw.plans) {
    assert(numericId(p.id) && !ids.has(p.id), 'Catalog plan IDs must be unique numeric strings.'); ids.add(p.id);
    assert(/^plans-\d{4}\.json$/.test(p.file) && /^[a-f0-9]{64}$/.test(p.sha256), 'Catalog shard path or SHA-256 is invalid.');
    assert(!hashes.has(p.file) || hashes.get(p.file) === p.sha256, 'Catalog gives conflicting shard hashes.'); hashes.set(p.file, p.sha256);
    assert(Number.isInteger(p.bedrooms) && finite(p.bedrooms, 0, 32) && Number.isInteger(p.rooms) && finite(p.rooms, 1, 256) && finite(p.areaM2, 1, 5000), 'Invalid catalog room counts or area.');
  }
  return raw;
}
export function resplanCandidates(catalog, spec) {
  const input = resplanInput(spec);
  return catalog.plans.filter(p => (input.bedrooms === 'any' || p.bedrooms === input.bedrooms) && p.areaM2 >= input.minArea && p.areaM2 <= input.maxArea).sort((a, b) => Number(a.id) - Number(b.id));
}
export function selectResPlan(catalog, spec) {
  const input = resplanInput(spec), candidates = resplanCandidates(catalog, input);
  assert(candidates.length, 'No floor plans match these bedroom and area filters.');
  if (input.planId) {
    const pinned = candidates.find(p => p.id === input.planId);
    assert(pinned, 'Requested plan ID is unavailable or excluded by the current filters.'); return pinned;
  }
  // Presentation controls do not change which original plan is selected. Sort
  // by numeric source ID so catalog serialization order cannot alter replay.
  const draw = stream({ seed: input.seed, revision: catalog.source.revision, version: 1 }, 'resplan:selection');
  return candidates[Math.floor(draw() * candidates.length)];
}

export function validateResPlanRecord(record) {
  assert(numericId(record?.id), 'Invalid ResPlan record ID.');
  const c = record.calibration;
  assert(c && finite(c.metresPerSourceUnit, .000001, 100) && xy(c.sourceOrigin) && finite(c.reportedArea, 0, 1e9)
    && finite(c.sourceInnerArea, .000001, 1e12) && typeof c.method === 'string' && c.method.length <= 200
    && finite(c.displaySimplificationMetres, 0, .001), 'Invalid source coordinate calibration.');
  assert(Array.isArray(record.features) && record.features.length > 0 && record.features.length <= 512, 'Source feature budget is 1–512.');
  let vertices = 0; const ids = new Set();
  for (const f of record.features) {
    assert(typeof f.id === 'string' && /^[a-z_]+:\d{1,4}$/.test(f.id) && !ids.has(f.id) && resplanCategories.includes(f.category) && xy(f.anchor), 'Invalid or duplicate source feature.'); ids.add(f.id);
    for (const g of [f.geometry, ...(f.displayGeometry ? [f.displayGeometry] : [])]) {
      assert(g && Array.isArray(g.outer) && Array.isArray(g.holes) && g.holes.length <= 128, 'Invalid polygon rings.');
      for (const r of [g.outer, ...g.holes]) {
        assert(Array.isArray(r) && r.length >= 3 && r.length <= 8192 && r.every(xy), 'Source ring must have 3–8192 finite coordinate pairs.');
        vertices += r.length;
      }
    }
  }
  assert(vertices <= 64000, 'Source and display contours exceed 64,000 vertices.');
  assert(record.features.some(f => resplanRoomCategories.includes(f.category)), 'No functional rooms in source record.');
  return record;
}

function footprintFrom(feature, calibration, input) {
  const g = feature.displayGeometry ?? feature.geometry;
  const convert = p => point((p[0] - calibration.sourceOrigin[0]) * calibration.metresPerSourceUnit * input.scale * (input.mirror ? -1 : 1), (p[1] - calibration.sourceOrigin[1]) * calibration.metresPerSourceUnit * input.scale);
  const rings = [g.outer, ...g.holes].map((r, i) => {
    let points = r.map(convert).filter((p, j, a) => Math.hypot(p[0] - a[(j + a.length - 1) % a.length][0], p[1] - a[(j + a.length - 1) % a.length][1]) > 1e-5);
    assert(points.length >= 3, 'Source feature collapsed below display precision: ' + feature.id);
    if ((signedArea(polygon(points).outer) > 0) !== (i === 0)) points = points.reverse();
    return polygon(points).outer;
  });
  return transform({ outer: rings[0], holes: rings.slice(1) }, [0, 0], input.rotation);
}
function sourceAnchor(feature, calibration, input) {
  const x = (feature.anchor[0] - calibration.sourceOrigin[0]) * calibration.metresPerSourceUnit * input.scale * (input.mirror ? -1 : 1),
    y = (feature.anchor[1] - calibration.sourceOrigin[1]) * calibration.metresPerSourceUnit * input.scale, a = input.rotation * Math.PI / 180;
  return point(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
}

export function generateResPlanDesign(spec, catalog, record) {
  validateResPlanCatalog(catalog); validateResPlanRecord(record);
  const input = resplanInput(spec), selected = selectResPlan(catalog, input);
  assert(selected.id === record.id, 'Loaded record does not match the selected source plan.');
  const rooms = record.features.filter(f => resplanRoomCategories.includes(f.category));
  assert(rooms.length === selected.rooms && rooms.filter(f => f.category === 'bedroom').length === selected.bedrooms, 'Source room counts disagree with the catalog.');
  const baseArea = record.calibration.sourceInnerArea * record.calibration.metresPerSourceUnit ** 2;
  assert(Math.abs(baseArea - selected.areaM2) <= .00001, 'Source calibration disagrees with catalog area.');
  const features = record.features.map(f => ({ id: f.id, category: f.category, footprint: footprintFrom(f, record.calibration, input), labelAnchor: sourceAnchor(f, record.calibration, input) }));
  const topologyIssues = features.flatMap(f => validateFootprint(f.footprint).map(message => ({ featureId: f.id, message }))).slice(0, 32);
  const spaces = features.filter(f => resplanRoomCategories.includes(f.category)).map(f => ({ id: f.id, label: f.id.replace('_', ' ').replace(':', ' '),
    category: f.category, role: ['bathroom', 'kitchen', 'storage'].includes(f.category) ? 'service' : f.category === 'bedroom' ? 'private' : 'public',
    floorIndex: 0, elevation: 0, footprint: f.footprint, labelAnchor: f.labelAnchor, clearHeight: input.ceiling,
    usableFloor: { areaM2: signedArea(f.footprint.outer) + f.footprint.holes.reduce((n, r) => n + signedArea(r), 0) } }));
  const plan = { schemaVersion: 'br.resplan-zone/1', kind: 'resplan-source-floorplan', template: resplanTemplate, input,
    source: { ...structuredClone(catalog.source), planId: record.id }, sourceRecord: structuredClone(record),
    selection: { id: record.id, bedrooms: selected.bedrooms, rooms: selected.rooms, areaM2: selected.areaM2, eligiblePlans: resplanCandidates(catalog, input).length },
    conventions: { units: 'estimated metres', axes: { horizontal: ['X', 'Y'], vertical: 'Z' }, coordinateQuantum: 1e-6 },
    floors: [{ id: 'floor:0', index: 0, elevation: 0 }], spaces, features,
    importDiagnostics: { state: 'source-only', physicallyCompiled: false, topologyIssues,
      notes: ['Scale is an explicit calibration, not surveyed dimensions.', 'Original source coordinates are embedded; display contours retain concavity and holes.',
        'Doors, front doors and windows are source features, not validated movement connections.', 'Source stairs are single-floor annotations; preview height is user supplied.'] } };
  // Replay identity depends on the source and controls, not collection size or
  // imported diagnostic claims. A self-contained export reopens identically.
  plan.fingerprint = fingerprint({ input, source: plan.source, sourceRecord: record }); return plan;
}

export function resplanExport(plan) { return canonicalStringify(plan); }
export function importResPlanDesign(raw) {
  raw = structuredClone(raw);
  assert(raw?.schemaVersion === 'br.resplan-zone/1' && raw.kind === 'resplan-source-floorplan', 'Expected a ResPlan source floor-plan export.');
  validateResPlanSource(raw.source); validateResPlanRecord(raw.sourceRecord);
  assert(raw.source.planId === raw.sourceRecord.id, 'Source plan ID disagrees with the embedded record.');
  const record = raw.sourceRecord, rooms = record.features.filter(f => resplanRoomCategories.includes(f.category));
  const entry = { id: record.id, file: 'plans-0000.json', sha256: '0'.repeat(64), rooms: rooms.length,
    bedrooms: rooms.filter(f => f.category === 'bedroom').length, areaM2: record.calibration.sourceInnerArea * record.calibration.metresPerSourceUnit ** 2 };
  // Regenerate geometry and diagnostics; imported claims of physical validity
  // and edited preview polygons are never trusted. The embedded source is authoritative.
  const source = structuredClone(raw.source); delete source.planId;
  return generateResPlanDesign(raw.input, { schemaVersion: 'br.resplan-catalog/1', source, releasePlanCount: 1, plans: [entry] }, record);
}
