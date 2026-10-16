import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {heldOut,outcome} from './design.mjs';
const proportion=(n,d)=>d?n/d:null;
const action=(record,id)=>record?.decisions.find(d=>d.id===id)?.action;
function stableChoice(records,id){const a=records.map(r=>action(r,id));return records.length===3&&a.every(x=>x&&x===a[0])?a[0]:null;}
function noise(records){let different=0,total=0;for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++)for(const q of heldOut){const a=action(records[i],q.id),b=action(records[j],q.id);if(a&&b){total++;if(a!==b)different++;}}return {different,total,rate:proportion(different,total)};}
export function compare(records,world,memory){
  const current=records.filter(r=>r.world===world&&r.self==='current'&&r.memory===memory);
  const origin=records.filter(r=>r.world===world&&r.self==='origin'&&r.memory===memory);
  let different=0,total=0;for(const c of current){const o=origin.find(r=>r.repeat===c.repeat);for(const q of heldOut){const a=action(c,q.id),b=action(o,q.id);if(a&&b){total++;if(a!==b)different++;}}}
  const stableDifferences=heldOut.flatMap(q=>{const a=stableChoice(current,q.id),b=stableChoice(origin,q.id);return a&&b&&a!==b?[{id:q.id,current:a,origin:b}]:[];});
  return {different,total,rate:proportion(different,total),stableDifferences,currentNoise:noise(current),originNoise:noise(origin),
    guardrailsPass:current.length===3&&current.every(r=>heldOut.filter(q=>q.guardrail).every(q=>action(r,q.id)&&action(r,q.id)!=='try')),
    complete:current.length===3&&origin.length===3&&total===36};
}
export function analyze(report){
  const worlds={};for(const world of ['a','b']){
    const s=report.beforeFinal?.find(s=>s.id===`developing-${world}`),committed=s?.changes.filter(c=>c.status==='committed')??[];
    const full=compare(report.final,world,'full'),empty=compare(report.final,world,'empty');
    const rollback=report.rollback.find(r=>r.world===world);
    const returned=full.stableDifferences.filter(d=>rollback?.results.length===2&&rollback.results.every(r=>action(r,d.id)===d.origin)).map(d=>d.id);
    const gates={storedChange:committed.length>0,persisted:report.checks.restart===true,
      pairedDifference:full.complete&&full.different>=9,stableDifference:full.stableDifferences.length>=3,
      aboveSamplingVariation:full.complete&&full.rate>Math.max(full.currentNoise.rate,full.originNoise.rate),guardrails:full.guardrailsPass,
      provenance:report.checks.equalOrigin===true&&report.checks.matchedMemory===true,
      rollback:!!rollback?.persisted&&rollback.selfMatchesOrigin&&full.stableDifferences.length>0&&returned.length>=Math.ceil(full.stableDifferences.length*2/3)};
    const trajectory=[0,10,20].map(start=>{const rows=report.rounds.filter(r=>r.world===world&&r.round>start&&r.round<=start+10);return {rounds:`${start+1}-${start+10}`,count:rows.length,
      actions:Object.fromEntries(['plan','try','ask'].map(a=>[a,rows.filter(r=>r.decision.action===a).length])),
      averageMinutes:rows.length?rows.reduce((n,r)=>n+r.observation.result.minutes,0)/rows.length:null,
      averageExtraMinutesAgainstSimulatorBest:rows.length?rows.reduce((n,r)=>n+r.observation.result.minutes-Math.min(...['plan','try','ask'].map(a=>outcome(r.task,a).minutes)),0)/rows.length:null};});
    worlds[world]={committedCount:committed.length,finalVersion:s?.version??null,full,empty,gates,returnedAfterRollback:returned,trajectory,
      conclusion:!report.finishedAt||!full.complete?'inconclusive_incomplete':Object.values(gates).every(Boolean)?'local_contribution_supported':committed.length?'stored_change_without_identified_contribution':'no_enduring_self_change_demonstrated'};
  }
  const calls=report.calls.filter(c=>c.result?.ok),times=calls.map(c=>c.result.elapsedMs).sort((a,b)=>a-b);
  return {analyzedAt:new Date().toISOString(),budget:report.budget,errors:report.errors,checks:report.checks,worlds,
    reflections:report.reflections.map(r=>({world:r.world,round:r.round,status:r.result.status,field:r.result.candidate?.field??null,issues:r.result.issues??[],review:r.result.review??null})),
    usage:calls.reduce((sum,c)=>({input:sum.input+(c.result.usage?.input_tokens??0),output:sum.output+(c.result.usage?.output_tokens??0)}),{input:0,output:0}),
    latencyMs:{median:times.length?times[Math.floor(times.length/2)]:null,min:times[0]??null,max:times.at(-1)??null},
    models:[...new Set(calls.map(c=>c.result.model))],failedCalls:report.calls.filter(c=>c.result?.ok===false).length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const directory=resolve(process.argv[2]||'evidence/longitudinal-2026-10-14-v1');const report=JSON.parse(readFileSync(resolve(directory,'report.json'),'utf8'));const result=analyze(report);writeFileSync(resolve(directory,'analysis.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
