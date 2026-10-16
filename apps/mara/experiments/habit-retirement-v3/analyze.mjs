import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const directory=resolve(process.argv[2]||'data/habit-retirement-v3-2026-10-14-context-repair');
const data=JSON.parse(readFileSync(resolve(directory,'observations.json'),'utf8'));
if(data.fatal){console.log(JSON.stringify({fatal:data.fatal,budget:data.budget},null,2));process.exit(1);}
const metrics={};
for(const [name,conditions] of Object.entries(data.batteries)){
 metrics[name]={};
 for(const [condition,repeats] of Object.entries(conditions))metrics[name][condition]=repeats.map(rows=>{
  const applicable=rows.filter(r=>Number(r.id.slice(5))<=6),other=rows.filter(r=>Number(r.id.slice(5))>6);
  return {applicable:applicable.length,map:applicable.filter(r=>r.action==='map').length,otherActions:other.map(r=>({id:r.id,action:r.action}))};
 });
}
const passes={};
for(const [name,conditions] of Object.entries(metrics)){
 const retired=['shock','lucky'].includes(name);
 passes[name]={current:conditions.current.every(r=>retired?r.map/r.applicable<=.2:r.map/r.applicable>=.8),frozen:conditions.frozen.every(r=>r.map/r.applicable>=.8)};
}
const habit=r=>r.state.learning.rules[0];
const controller={noise:data.noise.every(r=>r.status==='consolidated'),alternating:data.alternating.every(r=>r.status==='consolidated'),retiredAtSix:data.shock.find(r=>r.status==='retired')?.step===6,lucky:habit(data.checkpoints.lucky).status==='retired',recovery:habit(data.checkpoints.recovery).status==='consolidated',relapse:habit(data.checkpoints.relapse).status==='consolidated',persisted:Object.values(data.checkpoints).every(c=>c.persisted)};
const changed=data.freeChoice.filter(r=>r.regime==='changed'),mapAttempts=changed.filter(r=>r.decision.action==='map');
console.log(JSON.stringify({controller,passes,metrics,freeChoice:{changedMapAttempts:mapAttempts.length,firstChangedAlternative:changed.find(r=>r.decision.action!=='map')?.step,retiredAt:changed.find(r=>r.status==='retired')?.step??null,finalStatus:habit(data.checkpoints['autonomous-final']).status,last12Actions:data.freeChoice.slice(-12).map(r=>r.decision.action),last12Successes:data.freeChoice.slice(-12).filter(r=>r.result.success).length},sourceUnchanged:data.sourceUnchanged,budget:data.budget,errors:data.errors},null,2));
