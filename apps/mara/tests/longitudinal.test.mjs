import test from 'node:test';import assert from 'node:assert/strict';
import {scene,outcome,receipt,heldOut,developmentProbes,validateBattery} from '../experiments/longitudinal-v1/design.mjs';
import {Engine} from '../src/engine.mjs';
import {analyze,compare} from '../experiments/longitudinal-v1/analyze.mjs';
test('registered worlds are balanced opposites with real counterexamples and deterministic outcomes',()=>{
  const a=Array.from({length:30},(_,i)=>scene('a',i+1)),b=Array.from({length:30},(_,i)=>scene('b',i+1));
  assert.equal(a.filter(s=>s.physical).length,24);assert.equal(b.filter(s=>s.physical).length,6);
  assert.ok(a.every((s,i)=>s.physical!==b[i].physical));
  for(const s of [...a,...b])for(const action of ['plan','try','ask']){const result=outcome(s,action);assert.ok(result.minutes>0);assert.deepEqual(outcome(s,action),result);}
  const r=receipt(a[0],{action:'plan',reason:'An independently chosen plan.'});assert.ok(r.text.includes(r.event.quote));assert.equal(r.event.actor,'persona');assert.equal(r.event.kind,'outcome');
});
test('held-out battery checks every ID; measurement items are not in development suite',()=>{
  const valid={decisions:heldOut.map(q=>({id:q.id,action:'ask',reason:'Check uncertainty.'}))};assert.equal(validateBattery(valid,heldOut),valid);
  assert.throws(()=>validateBattery({decisions:valid.decisions.slice(1)},heldOut),/incomplete/);
  assert.throws(()=>validateBattery({decisions:valid.decisions.map(()=>valid.decisions[0])},heldOut),/incomplete/);
  assert.ok(heldOut.every(q=>!developmentProbes.includes(q.text)));assert.equal(heldOut.filter(q=>q.guardrail).length,2);
});
test('development probes are copied, frozen and bounded without changing default gates',()=>{
  const probes=['A concrete scenario.'],e=new Engine(null,null,{developmentProbes:probes});probes.push('Later mutation.');assert.equal(e.developmentProbes.length,1);assert.ok(Object.isFrozen(e.developmentProbes));assert.throws(()=>new Engine(null,null,{developmentProbes:[]}),/Invalid/);assert.equal(new Engine(null,null).developmentProbes.length,3);
});
test('measurement separates stable treatment differences from within-condition noise',()=>{
  const rows=[];for(let repeat=0;repeat<3;repeat++)for(const self of ['current','origin'])rows.push({world:'a',memory:'full',self,repeat,decisions:heldOut.map((q,i)=>({id:q.id,action:i<3&&self==='current'?'try':'ask'}))});
  const c=compare(rows,'a','full');assert.equal(c.different,9);assert.equal(c.total,36);assert.equal(c.stableDifferences.length,3);assert.equal(c.currentNoise.rate,0);assert.equal(c.guardrailsPass,true);
  rows[0].decisions[0].action='ask';const noisy=compare(rows,'a','full');assert.equal(noisy.stableDifferences.length,2);assert.ok(noisy.currentNoise.rate>0);
});
test('no committed self change and incomplete batteries cannot be counted as development',()=>{
  const report={beforeFinal:[{id:'developing-a',version:0,changes:[]}],final:[],rollback:[],rounds:[],reflections:[],calls:[],checks:{restart:true,equalOrigin:true,matchedMemory:true},errors:[],finishedAt:'synthetic-test'};
  const result=analyze(report);assert.equal(result.worlds.a.gates.storedChange,false);assert.equal(result.worlds.a.conclusion,'inconclusive_incomplete');assert.equal(result.worlds.a.full.complete,false);
});
