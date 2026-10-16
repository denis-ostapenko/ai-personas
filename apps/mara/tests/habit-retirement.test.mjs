import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.mjs';
import {Engine,appendExperience} from '../src/engine.mjs';
import {proposeRules,beginTrial,observe,learningContext} from '../src/learning.mjs';
const catalog={contexts:['reversible'],actions:['test','plan'],signals:{success:'The action succeeds.'}};
function setup(t){
  const dir=mkdtempSync(join(tmpdir(),'habit-retirement-')),store=new Store(join(dir,'db'));
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const s=store.create('mara',{synthetic:true});let next=0;
  function start({action='test',family}={}){const i=++next;beginTrial(s,{id:`t${i}`,domain:'reversible',family:family||`family-${i%3}`,action,forecast:.7,source:'An action with a recorded result.'});return i;}
  function finish(i,success){const text=`Executed independent trial ${i}; observed success: ${success}.`,e=appendExperience(s,{sourceId:`source-${i}`,text,partner:'experiment',provenance:'synthetic',event:{quote:text,interpretation:'Synthetic outcome.',actor:'persona',affected:'persona',relationTarget:'none',kind:'outcome',valence:'neutral',substantive:true}});return observe(s,{trialId:`t${i}`,episodeId:e.id,signals:{success},provenance:'synthetic'});}
  function outcome(success=true,options){return finish(start(options),success);}
  for(let i=0;i<3;i++)outcome();
  proposeRules(s,{reason:'Prospective hypothesis.',rules:[{kind:'habit',contexts:['reversible'],action:'test',signal:'success',probability:.7,reason:'Promising action.',evidence:s.experiences.map(e=>({id:e.id,quote:e.source})),counterevidence:[]}]},catalog);
  for(let i=0;i<8;i++)outcome();
  assert.equal(s.learning.rules[0].status,'consolidated');
  return {s,store,dir,outcome,start,finish,rule:s.learning.rules[0]};
}
test('isolated failures, short bursts and alternating outcomes do not revoke a habit',t=>{
  const {s,rule,outcome}=setup(t),v=s.version;
  for(const value of [false,true,true,true,true,true,false,false,true,true,true,true,...Array.from({length:18},(_,i)=>i%2===0)]){outcome(value);assert.equal(rule.status,'consolidated');}
  assert.equal(s.version,v);assert.ok(rule.probability<.8);
});
test('sustained diverse failure retires, one success cannot restore, durable recovery can',t=>{
  const {s,rule,outcome,store,dir}=setup(t);
  for(const value of [false,false,true,false,false]){outcome(value);assert.equal(rule.status,'consolidated');}
  outcome(false);assert.equal(rule.status,'retired');
  assert.match(s.current.habits,/stopped treating test as my default/);
  assert.equal(learningContext(s,'reversible')[0].status,'retired');
  outcome(true);assert.equal(rule.status,'retired');
  outcome(false);for(let i=0;i<5;i++){outcome(true);assert.equal(rule.status,'retired');}
  store.save(s,s.revision);const reopened=new Store(join(dir,'db'));
  assert.deepEqual(reopened.get('mara').learning.rules[0].habitControl,rule.habitControl);reopened.close();
  outcome(true);assert.equal(rule.status,'consolidated');
  outcome(false);assert.equal(rule.status,'consolidated');
  assert.deepEqual(rule.history.map(h=>h.to),['consolidated','retired','consolidated']);
});
test('failures in one family and outcomes of other actions cannot revoke the general habit',t=>{
  const {rule,outcome}=setup(t);for(let i=0;i<9;i++)outcome(false,{family:'single'});
  assert.equal(rule.status,'consolidated');const n=rule.observations.length;
  for(let i=0;i<9;i++)outcome(false,{action:'plan'});
  assert.equal(rule.observations.length,n);assert.equal(rule.status,'consolidated');
});
test('late results from before retirement do not count as recovery',t=>{
  const {rule,outcome,start,finish}=setup(t),pending=Array.from({length:8},()=>start());
  for(let i=0;i<6;i++)outcome(false);assert.equal(rule.status,'retired');
  for(const i of pending)finish(i,true);assert.equal(rule.status,'retired');
  for(let i=0;i<7;i++){outcome(true);assert.equal(rule.status,'retired');}
  outcome(true);assert.equal(rule.status,'consolidated');
});
test('legacy rules migrate from their actual adoption boundary without deleting evidence',t=>{
  const {rule,outcome}=setup(t);for(let i=0;i<5;i++)outcome(false);
  delete rule.habitControl;for(const o of rule.observations)delete o.ruleEpoch;
  const n=rule.observations.length;outcome(false);
  assert.equal(rule.status,'retired');assert.equal(rule.observations.length,n+1);
});

test('the ordinary dialogue feedback path persists retirement and supplies it on the next turn',async t=>{
  const {s,store}=setup(t);store.save(s,s.revision);let request=0,lastInput;
  const provider={call:async a=>{
    if(a.kind==='learning_discovery')return {reason:'No additional rule.',rules:[]};
    lastInput=a.input;const isOutcome=a.input.message.startsWith('I executed'),i=request++;
    return {initialBeliefs:[],reply:isOutcome?'The failed result is recorded.':'Try the small test.',event:{quote:a.input.message,interpretation:'Task or explicit outcome.',actor:'persona',affected:'persona',relationTarget:'none',kind:isOutcome?'outcome':'neutral',valence:'neutral',substantive:true},decision:isOutcome?null:{domain:'reversible',family:['craft','software','learning'][Math.floor(i/2)%3],action:'test',forecast:.6,prediction:'The small test succeeds without rework.'},feedback:isOutcome?{trialId:a.input.pendingTrials.at(-1).id,signals:[{signal:'success',value:false,quote:a.input.message}]}:null};
  }};
  const engine=new Engine(store,provider,{adaptive:true});
  for(let i=0;i<6;i++){
    await engine.turn('mara',`Suggest a first step for practical task ${i}.`,'alice');
    const result=await engine.turn('mara',`I executed the proposed test for task ${i}; it failed and required rework.`,'alice');
    assert.equal(result.reflectionError,null);
  }
  assert.equal(store.get('mara').learning.rules[0].status,'retired');
  await engine.turn('mara','Suggest a first step for another practical task.','alice');
  assert.equal(lastInput.learnedRules[0].status,'retired');assert.match(lastInput.current.habits,/stopped treating/);
});
test('a previous retirement phase cannot supply recovery evidence after rollback and another retirement',t=>{
  const {s,store,rule,outcome,start,finish}=setup(t);
  for(let i=0;i<6;i++)outcome(false);
  const stale=Array.from({length:8},()=>start());
  store.save(s,s.revision);new Engine(store,{}).rollback('mara',1);
  const restored=store.get('mara');s.current=restored.current;s.version=restored.version;s.versions=restored.versions;s.changes=restored.changes;s.learning=restored.learning;
  for(let i=0;i<6;i++)outcome(false);
  assert.equal(s.learning.rules[0].status,'retired');
  for(const i of stale)finish(i,true);
  assert.equal(s.learning.rules[0].status,'retired');
});
