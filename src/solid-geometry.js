import { EPS, RAD, q, point, line, arc, at, tangent, distance, intersections, edgeDistance, bounds, contains, ringContains, signedArea } from './geometry.js';
export const reverseEdge = e => e.kind === 'line' ? line(e.to, e.from) : arc(e.center, e.radius, e.startDeg + e.sweepDeg, -e.sweepDeg);
export const reverseRing = ring => [...ring].reverse().map(reverseEdge);
const length = e => e.kind === 'line' ? distance(e.from, e.to) : e.radius * Math.abs(e.sweepDeg) * RAD;
export const edgeLength = length;
export function edgeParameter(e, p) {
  if (e.kind === 'line') { const d = e.to.map((v, i) => v - e.from[i]); return ((p[0] - e.from[0]) * d[0] + (p[1] - e.from[1]) * d[1]) / length(e) ** 2; }
  const a = Math.atan2(p[1] - e.center[1], p[0] - e.center[0]) / RAD, sign = Math.sign(e.sweepDeg);
  const angle = ((sign * (a - e.startDeg)) % 360 + 360) % 360;
  return angle > 360 - 1e-4 ? 0 : angle / Math.abs(e.sweepDeg);
}
// Exact convex outer envelope with circular corner joins. Clear-room geometry
// remains unchanged. Unsupported concave offsets reject explicitly.
export function outerEnvelope(footprint, thickness) {
  const ring = footprint.outer, shifted = ring.map(e => {
    if (e.kind === 'arc') { if (e.sweepDeg <= 0) throw new Error('Solid wall envelope requires convex CCW arcs.'); return arc(e.center, e.radius + thickness, e.startDeg, e.sweepDeg); }
    const d = tangent(e, .5), l = Math.hypot(...d), n = [d[1] / l * thickness, -d[0] / l * thickness];
    return line(point(e.from[0] + n[0], e.from[1] + n[1]), point(e.to[0] + n[0], e.to[1] + n[1]));
  }), outer = [];
  for (let i = 0; i < ring.length; i++) {
    outer.push(shifted[i]); const next = (i + 1) % ring.length, a = at(shifted[i], 1), b = at(shifted[next], 0);
    if (distance(a, b) <= EPS) continue;
    const center = at(ring[i], 1), from = Math.atan2(a[1] - center[1], a[0] - center[0]) / RAD;
    const to = Math.atan2(b[1] - center[1], b[0] - center[0]) / RAD, sweep = ((to - from) % 360 + 360) % 360;
    if (sweep > 180 + EPS) throw new Error('Solid wall envelope requires convex outer corners.');
    outer.push(arc(point(...center), thickness, from, sweep));
  }
  return { outer, holes: [] };
}
const boxesMeet = (a, b) => a.minX <= b.maxX + EPS && b.minX <= a.maxX + EPS && a.minY <= b.maxY + EPS && b.minY <= a.maxY + EPS;
const boxed = f => ({ f, b: bounds(f) });
const insideAny = (items, p) => items.some(({f,b}) => p[0] >= b.minX - EPS && p[0] <= b.maxX + EPS && p[1] >= b.minY - EPS && p[1] <= b.maxY + EPS && contains(f, p) === 'inside');
// Planar arrangement: split exact line/arc boundaries at intersections, retain
// only edges separating the requested region, then stitch oriented rings.
export function differenceUnion(included, excluded = []) {
  if (!included.length) return [];
  const add = included.map(boxed), remove = excluded.map(boxed), edges = [...included, ...excluded].flatMap(f => [f.outer, ...f.holes].flat()).map(e => ({e,b:bounds({outer:[e],holes:[]}),cuts:[0,1]}));
  if (edges.length > 5000) throw new Error('Wall arrangement exceeds the 5000-edge bound.');
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j]; if (!boxesMeet(a.b, b.b)) continue;
    const hit = intersections(a.e,b.e,true), anchors = [at(a.e,0),at(a.e,1),at(b.e,0),at(b.e,1)].filter(p=>edgeDistance(a.e,p)<=EPS*2&&edgeDistance(b.e,p)<=EPS*2);
    const snapRadius = Math.sqrt(8*EPS*Math.max(a.e.radius??0,b.e.radius??0));
    // Near-coincident boundaries also split at each other's endpoints.
    const points = [...anchors, ...hit.points.map(p=>anchors.find(anchor=>distance(anchor,p)<snapRadius)??p)];
    for (const p of points) for (const item of [a,b]) { const t = edgeParameter(item.e,p); if(t > 1e-8 && t < 1-1e-8) item.cuts.push(t); }
  }
  const region = p => insideAny(add,p) && !insideAny(remove,p), fragments = [];
  for (const item of edges) {
    const cuts = [...new Set(item.cuts)].sort((a,b)=>a-b);
    for (let i=1;i<cuts.length;i++) {
      const low=cuts[i-1],high=cuts[i]; if ((high-low)*length(item.e) <= EPS) continue;
      let e = item.e.kind === 'line' ? line(point(...at(item.e,low)),point(...at(item.e,high))) : arc(item.e.center,item.e.radius,item.e.startDeg+item.e.sweepDeg*low,item.e.sweepDeg*(high-low));
      const p=at(e,.5),v=tangent(e,.5),l=Math.hypot(...v),probe=EPS*20;
      const left=region([p[0]-v[1]/l*probe,p[1]+v[0]/l*probe]),right=region([p[0]+v[1]/l*probe,p[1]-v[0]/l*probe]);
      if(left===right)continue;if(!left)e=reverseEdge(e);
      if(!fragments.some(other=>distance(at(other,0),at(e,0))<=EPS*2&&distance(at(other,.5),at(e,.5))<=EPS*2&&distance(at(other,1),at(e,1))<=EPS*2))fragments.push(e);
    }
  }
  const rings=[];
  while(fragments.length){
    const ring=[fragments.shift()];
    while(distance(at(ring.at(-1),1),at(ring[0],0))>EPS*2){
      const end=at(ring.at(-1),1),v=tangent(ring.at(-1),1),candidates=[];
      for(let i=0;i<fragments.length;i++)if(distance(end,at(fragments[i],0))<=EPS*2){const w=tangent(fragments[i],0);candidates.push({i,turn:Math.atan2(v[0]*w[1]-v[1]*w[0],v[0]*w[0]+v[1]*w[1])});}
      candidates.sort((a,b)=>a.turn-b.turn||a.i-b.i);
      if(!candidates.length)throw new Error(`Wall boundary cannot close at ${end}.`);
      ring.push(fragments.splice(candidates[0].i,1)[0]);
    }
    if(Math.abs(signedArea(ring))>EPS*EPS)rings.push(ring);
  }
  const result=rings.filter(r=>signedArea(r)>0).map(outer=>({outer,holes:[]}));
  for(const hole of rings.filter(r=>signedArea(r)<0)){
    const owners=result.filter(f=>ringContains(f.outer,at(hole[0],.5))!=='outside').sort((a,b)=>signedArea(a.outer)-signedArea(b.outer));
    if(!owners.length)throw new Error('Wall hole has no enclosing solid.');owners[0].holes.push(hole);
  }
  return result;
}
