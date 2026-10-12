import {generateSolidHouse,validateSolidHouse} from '../src/solid-house.js';
const count=Number(process.argv[2]??32);if(!Number.isInteger(count)||count<1||count>10000)throw new RangeError('Supply 1–10000 seeds per profile.');
const failures=[],cases=[];let maxAttempts=0;
function check(input,replay=false){
  const p=generateSolidHouse(input);maxAttempts=Math.max(maxAttempts,p.generation.attemptsTried);
  const d=replay?validateSolidHouse(p):p.diagnostics;
  cases.push({profile:p.input.profile,seed:p.input.seed,storeys:p.input.config.storeys,thickness:p.input.config.wallThickness});
  if(d.errors.length)failures.push({input:p.input,errors:d.errors});
}
for(const profile of ['gallery-house','atrium-mansion'])for(let seed=0;seed<count;seed++)check({profile,seed},seed<2);
for(const profile of ['gallery-house','atrium-mansion'])for(const storeys of [2,3])for(const floorHeight of [2.6,4.2])for(const wallThickness of [.1,.4])check({profile,seed:'boundary',config:{storeys,floorHeight,wallThickness}},true);
console.log(JSON.stringify({scope:'solid wall contract, exact joins, clear floor reservations and supported door navigation',generated:cases.length,boundaryCases:16,maxAttempts,failures},null,2));
if(failures.length)process.exitCode=1;
