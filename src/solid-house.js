import { normalizeHouseInput, composeHouse, validateHouse } from './house.js';
import { q } from './geometry.js';
import { fingerprint } from './determinism.js';
import { realizeWalls, floorArea } from './walls.js';
export function normalizeSolidHouseInput(raw={}) {
  if(raw.generatorVersion!==undefined&&raw.generatorVersion!==4)throw new Error('Solid houses require generator version 4.');
  const base=normalizeHouseInput({...raw,generatorVersion:3});
  const wallThickness=q(raw.config?.wallThickness??.2);
  if(!Number.isFinite(wallThickness)||wallThickness<.1||wallThickness>.4)throw new Error('Wall thickness must be 0.1–0.4 m.');
  return {...base,generatorVersion:4,config:{...base.config,wallThickness}};
}
export function validateSolidHouse(plan,options={}) {
  const report=validateHouse(plan,options);report.scope='Solid-wall generated architecture and declared walker navigation';
  report.metrics.wallThickness=plan.input.config.wallThickness;report.metrics.clearUsableFloorArea=report.metrics.netFootprintArea;report.metrics.wallVolumeM3=q(plan.wallBodies.reduce((sum,b)=>sum+floorArea(b.footprint)*(b.maxZ-b.minZ),0));return report;
}
export function generateSolidHouse(raw={}) {
  const input=normalizeSolidHouseInput(raw),failures=[];let plan;
  for(let attempt=0;attempt<input.config.maxAttempts;attempt++){
    try{plan=composeHouse(input,attempt);plan.schemaVersion='br.zone/0.4';realizeWalls(plan);}
    catch(error){failures.push({attempt,errors:[{code:'COMPOSITION_FAILED',entityId:input.profile,message:error.message}]});continue;}
    plan.diagnostics=validateSolidHouse(plan,{checkCachedConnections:false,checkGeneration:false,checkWallRebuild:false});
    plan.localConnections=structuredClone(plan.diagnostics.navigation.connections);
    if(!plan.diagnostics.errors.length){plan.generation={status:'accepted',attemptsTried:attempt+1,acceptedAttempt:attempt,candidateFailures:failures};plan.fingerprint=fingerprint(plan);return plan;}
    failures.push({attempt,errors:structuredClone(plan.diagnostics.errors)});
  }
  if(!plan?.wallBodies) {
    plan={schemaVersion:'br.zone/0.4',kind:'generated-house',zoneId:input.zoneId,input,walker:{radius:.3,headroom:2.1},conventions:plan?.conventions??{units:'metres'},floors:Array.from({length:input.config.storeys},(_,index)=>({id:`floor:${index}`,index,elevation:q(index*input.config.floorHeight)})),spaces:[],surfaces:[],openings:[],verticalTraversals:[],protectedVoids:[],externalPorts:[],walls:[],guards:[],localConnections:[],layout:{signature:{lowerFloorIndex:0,upperFloorIndex:1,lowerSpaceId:'main:0',upperSpaceId:'main:1',voidId:'void:signature',shape:'unrealized'},wings:{east:'unresolved',west:'unresolved'},verticalCoreCount:0,program:[],obligations:[]}};
    realizeWalls(plan);
  }
  plan.generation={status:'failed',attemptsTried:input.config.maxAttempts,acceptedAttempt:null,candidateFailures:failures};
  plan.diagnostics=validateSolidHouse(plan);plan.fingerprint=fingerprint(plan);return plan;
}
