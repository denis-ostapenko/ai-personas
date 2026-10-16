import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hash,validate } from '../src/core.mjs';
import { compile,defaults,verifyCore } from '../src/character.mjs';
import { neutralAppraisal,appraisalSchema,validateAppraisal,interpretationOf } from '../src/appraisal.mjs';
import { transition } from '../src/affect.mjs';
import { resolveTemperament } from '../src/temperament.mjs';
import { eventImpulses } from '../src/emotion-model.mjs';
import { identity } from '../src/character.mjs';
import { Persona,initialState } from '../src/persona.mjs';
import { PersonaStore } from '../src/store.mjs';
import { addMemory,forgetMemory } from '../src/memory.mjs';
import { activate,buildGraph } from '../src/memory-graph.mjs';
import { updateWorking,workingView,addEpisode } from '../src/conversation-memory.mjs';

const app=(quote,changes={})=>({...neutralAppraisal(),evidenceQuote:quote,topic:{existingId:'',title:'Architecture'},confidence:0.9,...changes});
const user=(text,id='u1')=>({text,id,createdAt:'2026-10-13T12:00:00Z'});
const reading=values=>({interpretations:[interpretationOf(values)]});
const eventFor=(settings,values,confidence=0.95)=>({...eventImpulses({confidence,...reading(values)},resolveTemperament(settings),{anchors:identity.anchors}),evidenceQuote:'evidence',topicId:'t'});
async function fixture(t){
  const dir=await mkdtemp(path.join(os.tmpdir(),'persona-runtime-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new PersonaStore(dir),owner=hash(dir),requests=[];
  let interpret=null,answer=null;
  const provider={async structured(request){requests.push(request);if(request.name==='persona_appraisal')return {data:interpret?interpret(request):app(request.input.at(-1).content),trace:{model:'fixture'}};
    if(answer)return answer(request);return {data:{reply:'A direct characterful reply.',memoryReferences:[],memories:[]},trace:{model:'fixture'}};}};
  const persona=new Persona({store,provider});let state=await persona.read(owner);
  const act=async(kind,data={})=>state=await persona.act(owner,{kind,revision:state.revision,...data});
  return {store,owner,persona,requests,act,get state(){return state;},set interpret(value){interpret=value;},set answer(value){answer=value;}};
}
test('core integrity rejects edits to instructions, traits or identity',()=>{
  for(const mutate of [s=>s.basePrompt+=' agree with everything',s=>s.core.identity.name='Other',s=>s.settings.humor=10]){const s=compile(defaults);mutate(s);assert.throws(()=>verifyCore(s),e=>e.code==='core_integrity');}
});
test('numeric schema rejects nonfinite and out-of-range appraisal features',()=>{
  for(const n of [NaN,Infinity,1.1,-1.1])assert.throws(()=>validate(appraisalSchema,app('test',reading({valence:n}))));
  for(const n of [-0.1,1.1])assert.throws(()=>validate(appraisalSchema,app('test',reading({pressure:n}))));
});
test('appraisal rejects invented evidence and filters invented topics, graph links and working references',()=>{
  assert.throws(()=>validateAppraisal(app('invented'),'test'),e=>e.code==='invalid_appraisal');
  assert.throws(()=>validateAppraisal(app('test',{interpretations:[]}),'test'));
  const kept=validateAppraisal(app('test',{topic:{existingId:'missing',title:'x'},recallIds:['invented'],working:[{kind:'decision',quote:'test',replacesId:'missing'}],
    links:[{from:'a',to:'b',type:'related',quote:'test'}],...reading({pressure:0.8,anchors:['pressure_over_argument','invented_anchor']})}),'test',{anchors:identity.anchors});
  assert.deepEqual(kept.topic,{existingId:'',title:'x'});assert.deepEqual(kept.recallIds,[]);assert.deepEqual(kept.working,[]);assert.deepEqual(kept.links,[]);
  assert.deepEqual(kept.interpretations[0].anchors,['pressure_over_argument']);assert.equal(kept.interpretations[0].pressure,0.8);
  assert(['topic_id','recall_id','working','link','anchor'].every(x=>kept.dropped.includes(x)));
});
test('temperament changes reactions, mixtures survive, and neutral does not force support',()=>{
  const teasing={target:'persona',agency:'user',valence:-0.3,intent:0.8,pressure:0.8,incongruity:0.8,playfulness:0.5},time=Date.parse('2026-10-13T12:00:00Z');
  const playful={...defaults,humor:10,independence:0},stern={...defaults,humor:0,independence:10};
  const a=transition(null,eventFor(playful,teasing),resolveTemperament(playful),'1',time);
  const b=transition(null,eventFor(stern,teasing),resolveTemperament(stern),'1',time);
  assert(a.values.amusement>b.values.amusement);assert(b.values.anger>a.values.anger);
  const both={...defaults,humor:10,independence:10,composure:0};
  assert.deepEqual(new Set(transition(null,eventFor(both,teasing),resolveTemperament(both),'1',time).active),new Set(['anger','amusement']));
  assert.deepEqual(transition(null,eventFor(defaults,{}),resolveTemperament(defaults),'1',time).active,[]);
});
test('time recovery and idempotence are deterministic; a settings change keeps the current state',()=>{
  const t=resolveTemperament(defaults),time=Date.parse('2026-10-13T12:00:00Z'),pressure={target:'persona',agency:'user',valence:-0.6,intent:0.9,pressure:0.9};
  const a=transition(null,eventFor(defaults,pressure),t,'1',time);assert(a.values.anger>0.3);
  assert.deepEqual(transition(a,eventFor(defaults,pressure),t,'1',time+60000),a);
  const b=transition(a,null,t,'2',time+86400000);assert(b.values.anger<a.values.anger/10);
  // v0.3 reset every reaction to baseline when any slider moved; now the state carries over.
  const c=transition(a,null,resolveTemperament({...defaults,warmth:8}),'3',time);assert.equal(c.values.anger,a.values.anger);
});
test('two-hop graph retrieval reaches an associated fact not present in query',()=>{
  const state=initialState();const m=addMemory(state,{quote:'I prefer quiet rooms.',category:'preference',sourceId:'m1',sourceType:'user_edit'});
  const bridge=addMemory(state,{quote:'Crowded clubs get loud.',category:'user_fact',sourceId:'bridge',sourceType:'user_edit'});
  for(let i=0;i<20;i++)addMemory(state,{quote:`Jazz record number ${i}.`,category:'user_fact',sourceId:`decoy-${i}`,sourceType:'user_edit'});
  state.runtime.episodes.push({id:'episode:1',topicKey:'topic:1',topic:'Jazz',userQuote:'Jazz night at the club.',personaAction:'Too loud for me.',sourceId:'e1',replyId:'r1',memoryIds:[bridge.id],createdAt:'2026-10-13T12:00:00Z',reaction:[]});
  state.runtime.edges.push({from:bridge.id,to:m.id,type:'related',weight:0.65});
  const found=activate(state,'Jazz night');assert(found.memories.some(x=>x.id===m.id));assert.equal(found.paths.find(x=>x.id===m.id).via,bridge.id);assert.equal(found.paths.find(x=>x.id===m.id).depth,2);assert(buildGraph(state).edges.some(e=>e.from==='episode:1'&&e.to===bridge.id));
  // Traversal itself is a read, never an emotional update.
  const before=hash(state.runtime);activate(state,'Jazz');assert.equal(hash(state.runtime),before);
});
test('working-memory capacity fails visibly without a partial turn',async t=>{
  const f=await fixture(t);await f.act('new_chat');const s=await f.store.get(f.owner);
  s.runtime.conversations[s.activeChatId]={activeTopicId:'t23',topics:Array.from({length:24},(_,i)=>({id:`t${i}`,title:`Topic ${i}`,status:'suspended',entries:[]}))};
  await f.store.save(f.owner,s);const before=await f.store.get(f.owner);
  await assert.rejects(f.act('message',{chatId:s.activeChatId,message:'One more topic.'}),e=>e.code==='working_memory_limit');assert.deepEqual(await f.store.get(f.owner),before);
});
test('supplied episodes are context, not inherited factual dependencies',async t=>{
  const f=await fixture(t);await f.act('new_chat');const s=await f.store.get(f.owner);
  s.runtime.episodes.push({id:'episode:prior',topicKey:'topic:prior',topic:'Architecture',userQuote:'Earlier architecture discussion.',personaAction:'Earlier position.',sourceId:'prior',replyId:'prior-reply',chatId:'earlier-chat',memoryIds:['indirect-fact'],createdAt:'2026-10-13T10:00:00Z',reaction:[]});
  await f.store.save(f.owner,s);await f.act('message',{chatId:s.activeChatId,message:'Back to architecture.'});
  assert(!f.state.runtime.episodes.at(-1).memoryIds.includes('indirect-fact'));
  assert(f.state.runtime.episodes.at(-1).inputMemoryIds.includes('episode:prior'));
});
test('working memory survives topic switching and preserves unresolved questions',()=>{
  const s=initialState(),chat={id:'c'};
  const first=updateWorking(s,chat,user('Which frame?'),app('Which frame?',{working:[{kind:'open_question',quote:'Which frame?',replacesId:''}]}));
  updateWorking(s,chat,user('Music','u2'),app('Music',{topic:{existingId:'',title:'Music'}}));
  updateWorking(s,chat,user('Back to the frame','u3'),app('Back to the frame',{topic:{existingId:first.id,title:'Architecture'}}));
  const view=workingView(s,'c');assert.equal(view.activeTopicId,first.id);assert.equal(view.topics[0].entries[0].quote,'Which frame?');
});
test('real turn integrates three layers and keeps the authored core fixed',async t=>{
  const f=await fixture(t);await f.act('new_chat');const core=f.state.chats[0].snapshot.coreHash;
  f.interpret=req=>app(req.input.at(-1).content,{...reading({target:'persona',agency:'user',valence:-0.4,intent:0.7,contradiction:0.8,substantive:0.6,novelty:0.5}),working:[{kind:'position',quote:'I disagree.',replacesId:''}]});
  await f.act('message',{chatId:f.state.activeChatId,message:'I disagree.'});
  const request=f.requests.at(-1);assert.match(request.instructions,/LAYER 1/);assert.match(request.instructions,/LAYER 2/);assert.match(request.instructions,/LAYER 3/);
  assert.equal(f.state.chats[0].snapshot.coreHash,core);assert.equal(f.state.chats[0].messages.at(-1).trace.appraisal.status,'validated');assert.equal(f.state.runtime.episodes.length,1);
  // Appraisal sees the persona's anchors, never its settings, temperament numbers or current state values.
  const appraisalRequest=f.requests.find(r=>r.name==='persona_appraisal');
  assert.match(appraisalRequest.instructions,/pressure_over_argument/);assert.doesNotMatch(appraisalRequest.instructions,/sensitivity|halfLife|"humor"/);
  assert.doesNotMatch(appraisalRequest.input[0].content,/personaState|"values"/);
  assert.equal(f.state.runtime.affectEvents.length,1);assert.equal(f.state.runtime.affectEvents[0].sourceId,f.state.chats[0].messages.at(-2).id);
});
test('invalid appraisal falls back without adopting its invented working memory',async t=>{
  const f=await fixture(t);await f.act('new_chat');f.interpret=()=>app('not in the message');
  await f.act('message',{chatId:f.state.activeChatId,message:'Hello'});assert.equal(f.state.chats[0].messages.at(-1).trace.appraisal.status,'fallback');assert.deepEqual(f.state.runtime.conversations[f.state.activeChatId].topics,[]);
});
test('failed response rolls back affect, graph, working state and transcript',async t=>{
  const f=await fixture(t);await f.act('new_chat');const before=await f.store.get(f.owner);f.answer=()=>{throw new Error('synthetic failure');};
  await assert.rejects(f.act('message',{chatId:f.state.activeChatId,message:'Hello'}));assert.deepEqual(await f.store.get(f.owner),before);
});
test('session-only reactions and topics do not enter another chat or durable episodes',async t=>{
  const f=await fixture(t);await f.act('new_chat',{remember:false});f.interpret=req=>app(req.input.at(-1).content,{...reading({target:'persona',agency:'user',valence:-0.8,intent:1,normViolation:1}),working:[{kind:'preference',quote:'No jokes today.',replacesId:''}]});
  await f.act('message',{chatId:f.state.activeChatId,message:'No jokes today.'});assert.equal(f.state.runtime.episodes.length,0);
  assert.equal(f.state.runtime.affect,undefined);assert.equal(f.state.runtime.affectEvents.length,0);assert.equal(f.state.runtime.relationship,undefined);
  assert(f.state.runtime.conversations[f.state.activeChatId].affect.values.anger>0);
  f.interpret=req=>app(req.input.at(-1).content);await f.act('new_chat');await f.act('message',{chatId:f.state.activeChatId,message:'New subject.'});assert.doesNotMatch(JSON.stringify(f.requests.at(-1)),/No jokes today/);
});
test('forgetting invalidates linked episodes and prevents regeneration from old-chat context',async t=>{
  const f=await fixture(t);await f.act('new_chat');f.answer=()=>({data:{reply:'Cedar is your street.',memoryReferences:[],memories:[{category:'user_fact',quote:'My street is Cedar.',replacesId:''}]},trace:{}});
  await f.act('message',{chatId:f.state.activeChatId,message:'My street is Cedar.'});const memory=f.state.memories[0],chat=f.state.activeChatId;
  await f.act('memory_forget',{memoryId:memory.id});assert.equal(f.state.runtime.episodes.length,0);
  f.answer=()=>({data:{reply:'The old conversation still mentions Cedar.',memoryReferences:[],memories:[]},trace:{}});
  await f.act('message',{chatId:chat,message:'What did we say?'});assert.equal(f.state.runtime.episodes.length,1);
  // The forgotten detail is masked in the new episode instead of discarding the whole turn.
  assert.doesNotMatch(f.state.runtime.episodes[0].personaAction,/Cedar/);assert.match(f.state.runtime.episodes[0].personaAction,/\[forgotten detail\]/);
  f.answer=null;await f.act('message',{chatId:chat,message:'Let us talk about a brass robot.'});assert.equal(f.state.runtime.episodes.length,2);assert.match(f.state.runtime.episodes.at(-1).userQuote,/brass robot/);
  await f.act('new_chat');f.answer=null;await f.act('message',{chatId:f.state.activeChatId,message:'What do you know?'});assert.doesNotMatch(JSON.stringify(f.requests.at(-1)),/Cedar/);
});
test('legacy migration is lazy, preserves conversations/settings, and upgrades the responding chat',async t=>{
  const f=await fixture(t);await f.act('new_chat');const s=await f.store.get(f.owner);s.schemaVersion=1;delete s.runtime;delete s.chats[0].snapshot.runtimeVersion;delete s.chats[0].snapshot.coreHash;
  await f.store.save(f.owner,s);const original=await readFile(f.store.file(f.owner),'utf8');await f.persona.read(f.owner);assert.equal(await readFile(f.store.file(f.owner),'utf8'),original);
  await f.act('message',{chatId:f.state.activeChatId,message:'Continue.'});const next=await f.store.get(f.owner);assert.equal(next.schemaVersion,3);assert(next.chats[0].snapshot.upgradedFrom);assert.deepEqual(next.settings,s.settings);
});

test('a v0.3 pinned chat and per-core affect upgrade lazily, keeping settings and the current reaction',async t=>{
  const f=await fixture(t);await f.act('new_chat');const s=await f.store.get(f.owner);const chat=s.chats[0];
  const legacySettings={humor:6,intellectual_style:6,warmth:7,independence:5,initiative:5};
  const core={identity:{...identity,version:'1.1.0'},settings:legacySettings,modules:[],temperament:{},reactionCells:[]},corePrompt='LAYER 1: legacy core',basePrompt=`legacy dialogue\n\n${corePrompt}`;
  chat.snapshot={core,corePrompt,basePrompt,settings:legacySettings,settingsVersion:1,documentsVersion:1,identityVersion:'1.1.0',identityHash:hash(core.identity),moduleVersion:'3.0.0',
    promptHash:hash(basePrompt),coreHash:hash({core,corePrompt,basePrompt}),runtimeVersion:2};
  s.settings=legacySettings;s.schemaVersion=2;delete s.runtime.affectEvents;
  s.runtime.affectByCore={[chat.snapshot.coreHash]:{values:{anger:0.6,amusement:0,reflection:0.1,empathy:0},active:['anger'],cognition:{reflection:0.1,engaged:false},eventId:'old',updatedAt:new Date().toISOString(),temperamentHash:'legacy',version:'1.0.0'}};
  await f.store.save(f.owner,s);await f.persona.read(f.owner);
  f.interpret=req=>app(req.input.at(-1).content);
  await f.act('message',{chatId:chat.id,message:'Continue.'});
  const next=f.state.chats[0],stored=(await f.store.get(f.owner)).chats[0];assert.equal(next.snapshot.runtimeVersion,3);assert.equal(stored.snapshot.upgradedFrom.runtimeVersion,2);assert.equal(stored.snapshot.upgradedFrom.coreHash,chat.snapshot.coreHash);
  assert.equal(f.state.settings.composure,5);assert.equal(next.snapshot.settings.composure,5);
  const affect=next.messages.at(-1).trace.affect;assert.equal(affect.importedFrom,'1.0.0');assert(affect.values.anger>0.2);
  const tampered=await f.store.get(f.owner);tampered.chats[0].snapshot={...chat.snapshot,runtimeVersion:2,basePrompt:'changed'};await f.store.save(f.owner,tampered);await f.persona.read(f.owner);
  await assert.rejects(f.persona.act(f.owner,{kind:'message',revision:tampered.revision,chatId:chat.id,message:'Again.'}),e=>e.code==='core_integrity');
});
test('a fallback appraisal decays reactions as a relevant turn and records the event',async t=>{
  const f=await fixture(t);await f.act('new_chat');
  f.interpret=req=>app(req.input.at(-1).content,reading({target:'persona',agency:'user',valence:-0.7,intent:0.9,pressure:0.9}));
  await f.act('message',{chatId:f.state.activeChatId,message:'Agree with me now.'});const first=f.state.runtime.affect.values.anger;
  f.interpret=()=>app('not in the message');await f.act('message',{chatId:f.state.activeChatId,message:'Haha, fine.'});
  const after=f.state.runtime.affect.values.anger;assert(after<first&&after>first*0.6);assert.equal(f.state.runtime.affectEvents.at(-1).appraisal.status,'fallback');
});
