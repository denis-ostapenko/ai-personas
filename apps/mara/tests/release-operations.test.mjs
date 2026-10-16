import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.mjs';
import {snapshot,restore} from '../scripts/snapshot.mjs';
import {Engine,appendExperience} from '../src/engine.mjs';
import {seedBelief,proposeRules,beginTrial,observe} from '../src/learning.mjs';
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'mara-release-')),store=new Store(join(dir,'source.sqlite'));t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return {dir,store};}
test('explicit budget changes preserve spent attempts and all state, including after reopening',t=>{
  const {dir,store}=fixture(t),s=store.create('mara');store.reserve('example',s.id);store.setCallLimit(300);
  assert.deepEqual(store.budget(),{used:1,limit:300});assert.deepEqual(store.get('mara'),s);
  assert.throws(()=>store.setCallLimit(0));assert.throws(()=>store.setCallLimit(1.5));
  const reopened=new Store(join(dir,'source.sqlite'),{maxCalls:60});assert.deepEqual(reopened.budget(),{used:1,limit:300});reopened.close();
});
test('a snapshot includes WAL state and API ledger, restore refuses overwrite and corrupt input',async t=>{
  const {dir,store}=fixture(t),s=store.create('mara');s.turns.push({text:'A saved conversation.',reply:'A saved reply.'});store.save(s,s.revision);store.reserve('pending','mara');store.setCallLimit(100);
  await snapshot(join(dir,'source.sqlite'),join(dir,'backup'));await restore(join(dir,'backup'),join(dir,'restored'));
  const recovered=new Store(join(dir,'restored','personas.sqlite'));assert.deepEqual(recovered.get('mara'),s);assert.deepEqual(recovered.budget(),store.budget());assert.deepEqual(recovered.calls(),store.calls());recovered.close();
  await assert.rejects(restore(join(dir,'backup'),join(dir,'restored')),/new destination/);
  const manifest=JSON.parse(readFileSync(join(dir,'backup','snapshot.json')));manifest.sha256='wrong';writeFileSync(join(dir,'backup','snapshot.json'),JSON.stringify(manifest));
  await assert.rejects(restore(join(dir,'backup'),join(dir,'bad')),/checksum/);
});
test('rollback does not reuse retired rule IDs or apply an old pending trial to a new rule',t=>{
  const {store}=fixture(t),s=store.create('mara',{synthetic:true}),catalog={contexts:['practical'],actions:['plan'],signals:{accurate:'The reference is accurate.'}};
  const first=seedBelief(s,{signal:'accurate',contexts:['practical'],probability:.8},catalog);
  for(let i=0;i<8;i++){
    beginTrial(s,{id:`t${i}`,domain:'practical',family:`family-${i%3}`,action:'plan',forecast:.8,source:'Reference forecast.'});
    const text=`Independent executed task ${i} found the reference inaccurate.`,e=appendExperience(s,{sourceId:`e${i}`,text,partner:'experiment',provenance:'synthetic',event:{quote:text,interpretation:'Observed outcome.',actor:'persona',affected:'persona',relationTarget:'none',kind:'outcome',valence:'neutral',substantive:true}});
    observe(s,{trialId:`t${i}`,episodeId:e.id,signals:{accurate:false},provenance:'synthetic'});
  }
  beginTrial(s,{id:'pending',domain:'practical',family:'late-task',action:'plan',forecast:.8,source:'A prediction made before rollback.'});
  store.save(s,s.revision);new Engine(store,{}).rollback('mara',0);const after=store.get('mara');
  const [secondId]=proposeRules(after,{reason:'A new prospective hypothesis after rollback.',rules:[{kind:'belief',signal:'accurate',contexts:['practical'],action:'plan',probability:.3,reason:'The retained outcomes warrant a new prospective check.',evidence:after.experiences.slice(0,3).map(e=>({id:e.id,quote:e.source})),counterevidence:[]}]},catalog);
  assert.notEqual(secondId,first.id);
  const text='The pending task finally finished and the reference was inaccurate.',e=appendExperience(after,{sourceId:'late-source',text,partner:'experiment',provenance:'synthetic',event:{quote:text,interpretation:'A delayed outcome.',actor:'persona',affected:'persona',relationTarget:'none',kind:'outcome',valence:'neutral',substantive:true}});
  observe(after,{trialId:'pending',episodeId:e.id,signals:{accurate:false},provenance:'synthetic'});
  assert.equal(after.learning.receipts.length,9);
  assert.equal(after.learning.rules.find(r=>r.id===secondId).observations.length,0);
});
test('new profiles use configured models without mutating existing profiles',t=>{
  const {dir,store}=fixture(t),original=store.create('mara'),other=new Store(join(dir,'source.sqlite'),{model:'different-model',reasoning:'high'});
  assert.equal(other.create('second').origin.model,'different-model');assert.equal(other.get('mara').originHash,original.originHash);other.close();
});
test('ordinary dialogue requests natural EN/PT-BR replies and English internal records',async t=>{
  const {store}=fixture(t);store.create('mara');let instructions;
  const engine=new Engine(store,{call:async args=>{instructions=args.instructions;return {reply:'Vamos pensar nisso.',initialBeliefs:[],decision:null,feedback:null,event:{quote:args.input.message,interpretation:'A request to explore an idea.',actor:'partner',affected:'persona',relationTarget:'none',kind:'neutral',valence:'neutral',substantive:true}};}},{adaptive:true});
  const result=await engine.turn('mara','Quero explorar uma ideia simples.');
  assert.equal(result.reply,'Vamos pensar nisso.');assert.match(instructions,/Brazilian Portuguese/);assert.match(instructions,/internal interpretations.*English/);assert.match(instructions,/without repeatedly announcing/);
});
