import { q, point, line, polygon, at, tangent, edgeDistance, distance, signedArea, validateFootprint, interiorsOverlap } from './geometry.js';
import { canonicalStringify } from './determinism.js';
import { approachFor } from './structure.js';
import { outerEnvelope, differenceUnion, edgeLength, edgeParameter } from './solid-geometry.js';
const equal = (a,b) => a===undefined||b===undefined ? a===b : canonicalStringify(a) === canonicalStringify(b);
export const floorArea = f => q(signedArea(f.outer) + f.holes.reduce((s,r)=>s+signedArea(r),0));
export function expectedPassage(plan, opening) {
  const first = opening.hosts[0], owner = plan.spaces.find(s=>s.id===first.spaceId), edge = owner.footprint.outer[first.edgeIndex], from = first.center ?? opening.center;
  const inward = approachFor(edge,from,opening.width,.8).inward;
  const to = opening.hosts.length === 2 ? opening.hosts[1].center : [...point(from[0]-inward[0]*plan.input.config.wallThickness,from[1]-inward[1]*plan.input.config.wallThickness),from[2]];
  const t=approachFor(edge,from,opening.width,.8).tangent,w=opening.width/2;
  // Outward across the first room's clear boundary, counterclockwise.
  const footprint=polygon([point(from[0]-t[0]*w,from[1]-t[1]*w),point(to[0]-t[0]*w,to[1]-t[1]*w),point(to[0]+t[0]*w,to[1]+t[1]*w),point(from[0]+t[0]*w,from[1]+t[1]*w)]);
  return { id:`passage:${opening.id}`, openingId:opening.id, from:structuredClone(from), to:structuredClone(to), width:opening.width, height:opening.height, footprint, floor:{ elevation:from[2],thickness:.2 }, minZ:from[2],maxZ:q(from[2]+opening.height) };
}
export function deriveWallGeometry(plan) {
  const thickness=plan.input.config.wallThickness, bodies=[];
  for(const floor of plan.floors){
    const spaces=plan.spaces.filter(s=>s.floorIndex===floor.index),envelopes=spaces.map(s=>outerEnvelope(s.footprint,thickness)),clear=spaces.map(s=>({outer:s.footprint.outer,holes:[]}));
    const passages=plan.passages.filter(p=>p.minZ===floor.elevation),top=q(floor.elevation+plan.input.config.floorHeight);
    const levels=[...new Set([floor.elevation,top,...passages.map(p=>Math.min(p.maxZ,top))])].sort((a,b)=>a-b);
    for(let level=1;level<levels.length;level++){
      const minZ=levels[level-1],maxZ=levels[level],cuts=passages.filter(p=>p.maxZ>minZ).map(p=>p.footprint);
      const footprints=differenceUnion(envelopes,[...clear,...cuts]);
      for(let index=0;index<footprints.length;index++){
        const footprint=footprints[index],id=`wall-body:${floor.index}:${level-1}:${index}`;
        const sides=[footprint.outer,...footprint.holes].flatMap((ring,ringIndex)=>ring.map((edge,edgeIndex)=>{
          const mid=at(edge,.5),host=spaces.flatMap(s=>s.footprint.outer.map((original,i)=>({s,original,i}))).find(h=>edgeDistance(h.original,mid)<1e-5 && edgeDistance(h.original,at(edge,0))<2e-5 && edgeDistance(h.original,at(edge,1))<2e-5);
          const passage=passages.find(p=>p.maxZ>minZ && p.footprint.outer.some(e=>edgeDistance(e,mid)<1e-5));
          return { id:`${id}:side:${ringIndex}:${edgeIndex}`,ringIndex,edgeIndex,spaceId:host?.s.id??null,materialId:host?`finish:${host.s.id}:${host.i}`:passage?`reveal:${passage.openingId}`:'finish:exterior',uv:{mapping:'edge-distance-height',metresPerRepeat:[1,1],uDirection:host?(tangent(edge,.5).reduce((s,v,i)=>s+v*tangent(host.original,.5)[i],0)>0?1:-1):1,uOffset:host?q(edgeParameter(host.original,at(edge,0))*edgeLength(host.original)):0,vOffset:minZ},edge:structuredClone(edge) };
        }));
        bodies.push({id,floorIndex:floor.index,kind:'wall-solid',nominalThickness:thickness,minZ,maxZ,footprint,sides});
      }
    }
  }
  return bodies;
}
export function realizeWalls(plan) {
  plan.geometryContract={roomFootprint:'clear-usable-floor',wallPlacement:'outside-clear-room-footprints',wallThickness:plan.input.config.wallThickness,wallJoin:'exact-union-with-round-exterior-corners',wallSolids:'wallBodies',tangentPredicates:'distance-tolerance',boundarySemantics:'walls',units:'metres'};
  plan.spaces.forEach(s=>{s.usableFloor={surfaceId:`floor:${s.id}`,areaM2:floorArea(s.footprint)};});
  plan.openings.forEach(o=>{o.hosts.forEach(h=>{h.center??=structuredClone(o.center);});});
  plan.passages=plan.openings.map(o=>expectedPassage(plan,o));
  for(const port of plan.externalPorts)port.anchor.position=structuredClone(plan.passages.find(p=>p.openingId===port.openingId).to);
  plan.materials=[...plan.spaces.flatMap(s=>s.footprint.outer.map((_edge,edgeIndex)=>({id:`finish:${s.id}:${edgeIndex}`,kind:'room-side-finish',spaceId:s.id,edgeIndex,textureKey:`wall/${s.id}/${edgeIndex}`,metresPerRepeat:[1,1]}))),{id:'finish:exterior',kind:'exterior-finish',spaceId:null,textureKey:'wall/exterior',metresPerRepeat:[1,1]},...plan.openings.map(o=>({id:`reveal:${o.id}`,kind:'opening-reveal',spaceId:o.hosts[0].spaceId,textureKey:`wall/reveal/${o.id}`,metresPerRepeat:[1,1]}))];
  plan.wallBodies=deriveWallGeometry(plan);
}
export function validateWalls(plan,{checkWallRebuild=true}={}) {
  const errors=[],add=(code,id,message)=>errors.push({code,entityId:id,message}),blocked=new Set();
  if(plan.geometryContract?.roomFootprint!=='clear-usable-floor'||plan.geometryContract?.wallThickness!==plan.input.config.wallThickness) add('WALL_CONTRACT_INVALID','geometryContract','Clear-floor semantics and explicit wall thickness are required.');
  for(const space of plan.spaces) if(!equal(space.usableFloor,{surfaceId:`floor:${space.id}`,areaM2:floorArea(space.footprint)}))add('USABLE_FLOOR_MISMATCH',space.id,'Available floor area must equal the actual clear floor excluding holes.');
  const materialIds=new Set();
  for(const material of plan.materials??[]){if(materialIds.has(material.id)||typeof material.textureKey!=='string'||!material.textureKey||!equal(material.metresPerRepeat,[1,1]))add('WALL_MATERIAL_INVALID',material.id,'Side finish needs a unique stable ID, texture binding, and metre-scaled UV repeat.');materialIds.add(material.id);}
  for(const opening of plan.openings){
    const p=plan.passages?.find(p=>p.openingId===opening.id);
    if(!p||p.minZ!==plan.spaces.find(s=>s.id===opening.hosts[0].spaceId)?.elevation||!equal(p,expectedPassage(plan,opening))||Math.abs(distance(p.from,p.to)-plan.input.config.wallThickness)>2e-5||validateFootprint(p.footprint).length){add('PASSAGE_INVALID',opening.id,'Door requires its full-thickness supported aperture between real host thresholds.');blocked.add(opening.id);}
  }
  if(plan.passages?.length!==plan.openings.length)add('PASSAGE_INVALID','passages','Every opening requires exactly one physical passage.');
  for(const body of plan.wallBodies??[]){
    if(validateFootprint(body.footprint,{stableTangencies:true}).length||body.nominalThickness!==plan.input.config.wallThickness||!Number.isFinite(body.minZ)||body.maxZ<=body.minZ){add('WALL_SOLID_INVALID',body.id,'Wall solid footprint, height, or thickness is invalid.');continue;}
    const keys=new Set();for(const side of body.sides){const key=`${side.ringIndex}/${side.edgeIndex}`;if(keys.has(key)||!plan.materials.some(m=>m.id===side.materialId)||!equal(side.edge,[body.footprint.outer,...body.footprint.holes][side.ringIndex]?.[side.edgeIndex])||!equal(side.uv.metresPerRepeat,[1,1]))add('WALL_SIDE_INVALID',side.id,'Each exposed side needs one actual boundary, material, and metre-scaled UV mapping.');keys.add(key);}
    if(keys.size!==[body.footprint.outer,...body.footprint.holes].flat().length)add('WALL_SIDE_INVALID',body.id,'Exposed sides are missing material/UV records.');
  }
  if(checkWallRebuild){
    try{const expected=deriveWallGeometry(plan);if(!equal(plan.wallBodies,expected)) {
      for(const body of plan.wallBodies??[])if(!equal(body.footprint,expected.find(b=>b.id===body.id)?.footprint??null))for(const space of plan.spaces)for(const v of space.clearVolumes)if(Math.min(body.maxZ,v.maxZ)>Math.max(body.minZ,v.minZ)+1e-5&&interiorsOverlap(body.footprint,v.footprint))add('WALL_IN_CLEAR_SPACE',body.id,`Wall occupies reserved clear volume of ${space.id}.`);
      add('WALL_SOLID_MISMATCH','wallBodies','Solid union, side ownership, and aperture cuts differ from independently reconstructed walls.');plan.openings.forEach(o=>blocked.add(o.id));}}
    catch(error){add('WALL_SOLID_INVALID','wallBodies',error.message);plan.openings.forEach(o=>blocked.add(o.id));}
  }
  return {errors,blocked};
}
