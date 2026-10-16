import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hash } from '../src/core.mjs';
import { defaults, compile, identity, questions } from '../src/character.mjs';
import { PersonaStore } from '../src/store.mjs';
import { Persona, initialState } from '../src/persona.mjs';
import { addMemory, retrieve, forgetMemory } from '../src/memory.mjs';
import { reviewDue } from '../src/review.mjs';
import { createServer } from '../src/server.mjs';
import { OpenAIProvider } from '../src/provider.mjs';
import { neutralAppraisal } from '../src/appraisal.mjs';
const owner=hash('fixture-owner');
class FakeProvider {
  calls=[];next=null;
  async structured(request) {
    this.calls.push(request);
    if(request.name==='persona_appraisal')return {data:{...neutralAppraisal(),evidenceQuote:request.input.at(-1).content,topic:{existingId:'',title:'Fixture topic'}},trace:{model:'fixture-appraisal'}};
    if(this.next){const next=this.next;this.next=null;return typeof next==='function'?next(request):{data:next,trace:{model:'fixture'}};}
    if(request.name==='persona_document_review'){
      const docs=JSON.parse(request.input[0].content).documents;
      const memories=[...docs.find(d=>d.id==='user_profile').content,...docs.find(d=>d.id==='relationship_memory').content];
      return {data:{coverage:docs.map(d=>d.id),groups:memories.length?[{topic:'About you',memoryIds:memories.map(m=>m.id)}]:[],proposals:[]},trace:{model:'fixture'}};
    }
    return {data:{reply:'A fixture response.',memoryReferences:[],memories:[]},trace:{model:'fixture'}};
  }
}
async function fixture(t){
  const directory=await mkdtemp(path.join(os.tmpdir(),'persona-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const store=new PersonaStore(directory),provider=new FakeProvider();
  const persona=new Persona({store,provider,researchLoader:async()=>({date:'2026-10-12',text:'Fixture method digest.',hash:'fixture',truncated:false})});
  let state=await persona.read(owner);
  const act=async(kind,data={})=>{state=await persona.act(owner,{kind,revision:state.revision,...data});return state;};
  return {directory,store,provider,persona,act,get state(){return state;}};
}
test('each control changes its own compiled module and prompt fingerprint',()=>{
  for(const key of Object.keys(defaults)){
    const low=compile({...defaults,[key]:0}),high=compile({...defaults,[key]:10});
    assert.notEqual(low.promptHash,high.promptHash);assert.notEqual(low.modules.find(m=>m.id===key).rule,high.modules.find(m=>m.id===key).rule);
    assert.equal(low.identityHash,high.identityHash);
    assert.deepEqual(low.modules.filter(m=>m.id!==key),high.modules.filter(m=>m.id!==key));
  }
  assert.throws(()=>compile({...defaults,humor:11}));assert.throws(()=>compile({...defaults,unexpected:1}));
});
test('new chats use saved character; existing chats remain pinned until explicit application',async t=>{
  const f=await fixture(t);await f.act('new_chat');const first=f.state.activeChatId,oldHash=f.state.chats[0].snapshot.promptHash;
  await f.act('settings',{settings:{...defaults,humor:0}});assert.equal(f.state.chats[0].snapshot.promptHash,oldHash);
  await f.act('new_chat');assert.notEqual(f.state.chats[1].snapshot.promptHash,oldHash);
  await f.act('apply_settings',{chatId:first});assert.equal(f.state.chats[0].snapshot.promptHash,f.state.chats[1].snapshot.promptHash);
});
test('quoted memory survives a new chat and process reconstruction',async t=>{
  const f=await fixture(t);await f.act('new_chat');
  f.provider.next={reply:'Architecture it is.',memoryReferences:[],memories:[{category:'interest',quote:'I enjoy architecture.',replacesId:''}]};
  await f.act('message',{chatId:f.state.activeChatId,message:'I enjoy architecture.'});await f.act('new_chat');
  await f.act('message',{chatId:f.state.activeChatId,message:'What do I enjoy?'});
  assert.match(f.provider.calls.at(-1).input[0].content,/architecture/);
  const restarted=new Persona({store:new PersonaStore(f.directory),provider:f.provider});
  assert.equal((await restarted.read(owner)).memories[0].quote,'I enjoy architecture.');
});
test('unsupported quote rejects the entire turn without partial persistence',async t=>{
  const f=await fixture(t);await f.act('new_chat');const before=await f.store.get(owner);
  f.provider.next={reply:'Saved.',memoryReferences:[],memories:[{category:'user_fact',quote:'I am a pilot.',replacesId:''}]};
  await assert.rejects(f.act('message',{chatId:f.state.activeChatId,message:'Hello.'}),e=>e.code==='ungrounded_memory');
  assert.deepEqual(await f.store.get(owner),before);
});
test('corrections supersede facts and retrieval excludes the old fact',async t=>{
  const f=await fixture(t);await f.act('memory_add',{quote:'I live in Boston.'});const old=f.state.memories[0].id;await f.act('new_chat');
  f.provider.next={reply:'Understood.',memoryReferences:[],memories:[{category:'user_fact',quote:'I now live in Denver.',replacesId:old}]};
  await f.act('message',{chatId:f.state.activeChatId,message:'Correction: I now live in Denver.'});
  assert.equal(f.state.memories.find(m=>m.id===old).status,'superseded');assert.equal(retrieve(f.state,'Where do I live?').length,1);assert.match(retrieve(f.state,'Where do I live?')[0].quote,/Denver/);
});
test('session-only mode ignores memory candidates and does not persist a profile',async t=>{
  const f=await fixture(t);await f.act('new_chat',{remember:false});f.provider.next={reply:'I hear you.',memoryReferences:[],memories:[{category:'user_fact',quote:'My private detail.',replacesId:''}]};
  await f.act('message',{chatId:f.state.activeChatId,message:'My private detail.'});assert.equal(f.state.memories.length,0);
  assert.match(f.provider.calls[0].input[0].content,/"memoryEnabled":false/);
});
test('onboarding is resumable and a nonremembered answer is not stored',async t=>{
  const f=await fixture(t);await f.act('onboarding_answer',{answer:'Private onboarding phrase',remember:false});
  assert.equal(f.state.onboarding.step,1);assert.doesNotMatch(JSON.stringify(await f.store.get(owner)),/Private onboarding phrase/);
  for(let i=1;i<questions.length;i++)await f.act('onboarding_answer',{answer:i===2?'I enjoy music.':'',remember:true});
  assert.equal(f.state.memories.length,1);assert.equal(f.state.onboarding.step,8);
  await f.act('calibrate',{sceneId:'disagreement',choice:1});assert.equal(f.state.settings.independence,5);
  await f.act('finish_onboarding',{applySuggestions:true});assert.equal(f.state.settings.independence,8);assert.equal(f.state.onboarding.complete,true);
});
test('stale revisions and concurrent requests cannot overwrite newer state',async t=>{
  const f=await fixture(t),revision=f.state.revision;await f.act('new_chat');
  await assert.rejects(f.persona.act(owner,{kind:'settings',revision,settings:defaults}),e=>e.code==='stale_revision');
  let unblock,entered;const ready=new Promise(r=>entered=r);
  f.provider.next=async()=>{entered();await new Promise(r=>unblock=r);return {data:{reply:'Done.',memoryReferences:[],memories:[]},trace:{}};};
  const request=f.act('message',{chatId:f.state.activeChatId,message:'Wait.'});await ready;
  await assert.rejects(f.persona.act(owner,{kind:'new_chat',revision:f.state.revision}),e=>e.code==='busy');unblock();await request;
});
test('upstream failure leaves transcripts and memories unchanged',async t=>{
  const f=await fixture(t);await f.act('new_chat');const before=await f.store.get(owner);f.provider.next=()=>{throw new Error('fixture upstream failure');};
  await assert.rejects(f.act('message',{chatId:f.state.activeChatId,message:'Hello.'}));assert.deepEqual(await f.store.get(owner),before);
});
test('fresh review covers active documents, preserves identity/facts, and supports rollback',async t=>{
  const f=await fixture(t);await f.act('memory_add',{quote:'I enjoy music.'});await f.act('new_chat');await f.act('message',{chatId:f.state.activeChatId,message:'A chat-only phrase.'});
  const memories=structuredClone(f.state.memories),settings=structuredClone(f.state.settings);
  await f.act('review');assert.equal(f.state.documents.version,2);assert.equal(f.state.documents.manifest.length,16);assert.deepEqual(f.state.memories,memories);assert.deepEqual(f.state.settings,settings);
  assert.doesNotMatch(JSON.stringify(f.provider.calls.at(-1).input),/A chat-only phrase/);assert.equal(f.state.documents.checks.behavioralEditsApplied,false);
  await f.act('rollback',{version:1});assert.equal(f.state.documents.version,3);assert.equal(f.state.documents.restoredFrom,1);assert.deepEqual(f.state.memories,memories);
});
for(const flaw of ['missing_document','dropped_memory','duplicate_memory','invented_memory','unsupported_rule'])test(`review rejects ${flaw} and preserves the prior version`,async t=>{
  const f=await fixture(t);await f.act('memory_add',{quote:'I enjoy music.'});const before=await f.store.get(owner),memoryId=f.state.memories[0].id;
  f.provider.next=async request=>{
    const docs=JSON.parse(request.input[0].content).documents;
    const data={coverage:docs.map(d=>d.id),groups:[{topic:'Interests',memoryIds:[memoryId]}],proposals:[]};
    if(flaw==='missing_document')data.coverage.pop();if(flaw==='dropped_memory')data.groups=[];
    if(flaw==='duplicate_memory')data.groups[0].memoryIds.push(memoryId);if(flaw==='invented_memory')data.groups[0].memoryIds=['invented'];
    if(flaw==='unsupported_rule')data.proposals=[{ruleId:'ask_before_advice',memoryIds:['invented']}];
    return {data,trace:{}};
  };
  await assert.rejects(f.act('review'),e=>e.code==='invalid_review');assert.deepEqual(await f.store.get(owner),before);
});
test('forgetting preserves conversations and remaining memories across reload and excludes the detail from new chats',async t=>{
  const f=await fixture(t);await f.act('onboarding_answer',{answer:'Unique secret: Cedar Street.',remember:true});const secretId=f.state.memories[0].id;
  await f.act('memory_add',{quote:'I enjoy music.'});await f.act('new_chat');
  f.provider.next={reply:'Cedar Street sounds familiar.',memoryReferences:[],memories:[]};await f.act('message',{chatId:f.state.activeChatId,message:'Recall my street.'});await f.act('review');
  await f.act('new_chat');await f.act('message',{chatId:f.state.activeChatId,message:'Let us discuss music.'});
  const before=await f.store.get(owner);
  await f.act('memory_forget',{memoryId:secretId});const saved=await f.store.get(owner);
  assert.deepEqual(saved.chats,before.chats);assert.equal(saved.activeChatId,before.activeChatId);
  assert.deepEqual(saved.onboarding,before.onboarding);assert.deepEqual(saved.schedule,before.schedule);
  assert.deepEqual(saved.memories,before.memories.filter(m=>m.id!==secretId));
  assert.equal(saved.documentHistory.length,before.documentHistory.length);
  const restarted=new Persona({store:new PersonaStore(f.directory),provider:f.provider});
  assert.deepEqual((await restarted.read(owner)).chats,f.state.chats);
  await f.act('new_chat');await f.act('message',{chatId:f.state.activeChatId,message:'What do you know about me?'});
  assert.doesNotMatch(JSON.stringify(f.provider.calls.at(-1)),/Cedar Street/);
  assert.match(f.provider.calls.at(-1).input[0].content,/music/);
  await f.act('review');assert.doesNotMatch(JSON.stringify(f.provider.calls.at(-1)),/Cedar Street/);
});
test('forgetting a corrected fact removes its correction chain but keeps same-source siblings',()=>{
  const state=initialState(),old=addMemory(state,{quote:'Old secret.',category:'user_fact',sourceId:'a',sourceType:'chat'});
  const sibling=addMemory(state,{quote:'I enjoy music.',category:'interest',sourceId:'a',sourceType:'chat'});
  const middle=addMemory(state,{quote:'Intermediate secret.',category:'user_fact',sourceId:'b',sourceType:'chat',replacesId:old.id});
  const next=addMemory(state,{quote:'New secret.',category:'user_fact',sourceId:'c',sourceType:'chat',replacesId:middle.id});
  const laterSibling=addMemory(state,{quote:'I enjoy walking.',category:'interest',sourceId:'c',sourceType:'chat'});
  assert.deepEqual(forgetMemory(state,middle.id),{removedCount:3});assert.deepEqual(state.memories,[sibling,laterSibling]);
  assert(!retrieve(state,'secret').some(m=>m.id===next.id));
});
test('forgetting one of two facts extracted from a single message keeps the other and the full transcript',async t=>{
  const f=await fixture(t);await f.act('new_chat');
  f.provider.next={reply:'Noted.',memoryReferences:[],memories:[{category:'user_fact',quote:'My name is Casey.',replacesId:''},{category:'interest',quote:'I enjoy music.',replacesId:''}]};
  await f.act('message',{chatId:f.state.activeChatId,message:'My name is Casey. I enjoy music.'});
  const before=await f.store.get(owner),[target,sibling]=before.memories;
  assert.equal(target.sourceId,sibling.sourceId);
  await f.act('memory_forget',{memoryId:target.id});
  assert.deepEqual(f.state.memories,[sibling]);assert.deepEqual((await f.store.get(owner)).chats,before.chats);
  await f.act('new_chat');await f.act('message',{chatId:f.state.activeChatId,message:'What do you remember?'});
  assert.doesNotMatch(JSON.stringify(f.provider.calls.at(-1)),/Casey/);assert.match(f.provider.calls.at(-1).input[0].content,/music/);
});
test('forgetting prunes affected review references while preserving unrelated proposals and rollback',async t=>{
  const f=await fixture(t);await f.act('memory_add',{quote:'I live in Boston.'});await f.act('memory_add',{quote:'I enjoy music.'});
  const [target,sibling]=f.state.memories;
  f.provider.next=async request=>({data:{coverage:JSON.parse(request.input[0].content).documents.map(d=>d.id),
    groups:[{topic:'About you',memoryIds:[target.id]},{topic:'Interests',memoryIds:[sibling.id]}],
    proposals:[{ruleId:'ask_before_advice',memoryIds:[target.id,sibling.id]},{ruleId:'use_concrete_examples',memoryIds:[sibling.id]}]},trace:{model:'fixture'}});
  await f.act('review');await f.act('review');const before=structuredClone(f.state);
  await f.act('memory_forget',{memoryId:target.id});
  assert.equal(f.state.documentHistory.length,before.documentHistory.length);
  for(const doc of [f.state.documents,...f.state.documentHistory]) {
    assert(!doc.groups.some(g=>g.memoryIds.includes(target.id)));assert(!doc.proposals.some(p=>p.memoryIds.includes(target.id)));
  }
  const archived=f.state.documentHistory.find(d=>d.version===2),original=before.documentHistory.find(d=>d.version===2);
  assert.deepEqual(archived.proposals,[original.proposals[1]]);assert.deepEqual(archived.manifest,original.manifest);assert.deepEqual(archived.trace,original.trace);
  await f.act('rollback',{version:2});
  assert.deepEqual(f.state.memories,[sibling]);assert.deepEqual(f.state.documents.groups,[{topic:'Interests',memoryIds:[sibling.id]}]);
  assert.deepEqual(f.state.documents.proposals,[original.proposals[1]]);
});
test('editing a memory preserves chats and same-source facts and supplies the corrected detail in a new chat',async t=>{
  const f=await fixture(t);await f.act('new_chat');
  f.provider.next={reply:'Noted.',memoryReferences:[],memories:[{category:'user_fact',quote:'I live in Boston.',replacesId:''},{category:'interest',quote:'I enjoy music.',replacesId:''}]};
  await f.act('message',{chatId:f.state.activeChatId,message:'I live in Boston. I enjoy music.'});
  const before=await f.store.get(owner),[target,sibling]=before.memories;
  await f.act('memory_edit',{memoryId:target.id,quote:'I live in Denver.'});
  assert.deepEqual((await f.store.get(owner)).chats,before.chats);assert.equal(f.state.activeChatId,before.activeChatId);
  assert.deepEqual(f.state.memories.find(m=>m.id===sibling.id),sibling);assert.equal(f.state.memories.filter(m=>m.status==='active').length,2);
  assert.equal(f.state.memories.find(m=>m.id===target.id).status,'superseded');
  await f.act('new_chat');await f.act('message',{chatId:f.state.activeChatId,message:'What do you remember?'});
  assert.match(f.provider.calls.at(-1).input[0].content,/superseded/);assert.match(f.provider.calls.at(-1).input[0].content,/Denver/);
});
test('invalid memory deletion and failed correction leave the whole profile unchanged',async t=>{
  const f=await fixture(t);await f.act('memory_add',{quote:'I enjoy music.'});await f.act('new_chat');const before=await f.store.get(owner);
  await assert.rejects(f.act('memory_forget',{memoryId:'missing'}),e=>e.status===404);
  await assert.rejects(f.act('memory_edit',{memoryId:f.state.memories[0].id,quote:'x'}));
  assert.deepEqual(await f.store.get(owner),before);
});
test('review scheduling needs new material, respects opt-in and backs off on failure',()=>{
  const state=initialState(),time=Date.now();state.createdAt=new Date(time-8*86400000).toISOString();
  addMemory(state,{quote:'I enjoy music.',category:'interest',sourceId:'x',sourceType:'user_edit'});
  assert.equal(reviewDue(state,time),false);state.schedule.enabled=true;assert.equal(reviewDue(state,time),true);
  state.schedule.lastFailureAt=new Date(time).toISOString();assert.equal(reviewDue(state,time),false);
  state.schedule.lastFailureAt=null;state.schedule.lastReviewedAt=new Date(time+1).toISOString();assert.equal(reviewDue(state,time),false);
});
test('storage rejects paths and persists restricted file permissions',async t=>{
  const f=await fixture(t);assert.throws(()=>f.store.file('../escape'));
  const mode=(await stat(f.store.file(owner))).mode&0o777;assert.equal(mode,0o600);
  assert.equal(await f.store.get(hash('different-owner')),null);
});
test('HTTP isolates browser profiles, blocks cross-origin actions, and keeps scripts as text',async t=>{
  const f=await fixture(t),server=createServer({persona:f.persona});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const url=`http://127.0.0.1:${server.address().port}`,initial=await fetch(`${url}/api/state`),cookie=initial.headers.get('set-cookie').split(';')[0];
  const state=(await initial.json()).state;assert.match(initial.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const send=(extra,headers={})=>fetch(`${url}/api/action`,{method:'POST',headers:{'Content-Type':'application/json','x-persona-client':'1',cookie,...headers},body:JSON.stringify({revision:state.revision,...extra})});
  assert.equal((await send({kind:'new_chat'},{origin:'https://outside.example'})).status,403);
  const inserted=await send({kind:'memory_add',quote:'<script>alert(1)</script>'});assert.equal(inserted.status,200);
  const different=(await(await fetch(`${url}/api/state`)).json()).state;assert.equal(different.memories.length,0);
  const mine=(await(await fetch(`${url}/api/state`,{headers:{cookie}})).json()).state;assert.equal(mine.memories[0].quote,'<script>alert(1)</script>');
  assert.equal((await fetch(`${url}/api/action`,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:'{}'})).status,404);
  assert.match((await fetch(url)).headers.get('content-security-policy'),/script-src 'self'/);
});
test('provider uses strict structured output and never returns upstream bodies',async()=>{
  let payload;
  const provider=new OpenAIProvider({key:'fixture-not-a-key',fetchFn:async(url,opts)=>{
    payload=JSON.parse(opts.body);
    const result={status:'completed',id:'fixture',model:'fixture',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Hi',memoryReferences:[],memories:[]})}]}]};
    return new Response(JSON.stringify(result),{status:200});
  }});
  const {dialogueSchema}=await import('../src/persona.mjs');await provider.structured({instructions:'fixture',input:[],schema:dialogueSchema,name:'fixture'});
  assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.model,'gpt-6.1-sol');
  let attempts=0;
  const failure=new OpenAIProvider({key:'fixture',fetchFn:async()=>{attempts++;return new Response('PRIVATE SECRET',{status:401});},sleep:async()=>{}});
  await assert.rejects(failure.structured({schema:dialogueSchema}),e=>!e.message.includes('PRIVATE SECRET')&&e.code==='provider_error');assert.equal(attempts,1);
});
test('provider retries transient failures within its call budget and allows a per-call model',async()=>{
  const statuses=[503,429,200],models=[];let n=0;
  const ok={status:'completed',id:'fixture',model:'fixture',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Hi',memoryReferences:[],memories:[]})}]}]};
  const provider=new OpenAIProvider({key:'fixture',sleep:async()=>{},fetchFn:async(url,opts)=>{models.push(JSON.parse(opts.body).model);const status=statuses[n++];return new Response(status===200?JSON.stringify(ok):'busy',{status});}});
  const {dialogueSchema}=await import('../src/persona.mjs');
  const result=await provider.structured({instructions:'x',input:[],schema:dialogueSchema,name:'fixture',model:'fixture-fast'});
  assert.equal(result.data.reply,'Hi');assert.equal(provider.calls,3);assert.deepEqual(models,['fixture-fast','fixture-fast','fixture-fast']);
  const limited=new OpenAIProvider({key:'fixture',maxCalls:2,sleep:async()=>{},fetchFn:async()=>new Response('busy',{status:503})});
  await assert.rejects(limited.structured({schema:dialogueSchema}),e=>e.code==='usage_limit');assert.equal(limited.calls,2);
});

test('language module upgrade preserves pinned settings and rejects damaged old cores',async t=>{
 const f=await fixture(t);await f.act('new_chat');const chatId=f.state.activeChatId;
 const state=await f.store.get(owner),snapshot=state.chats[0].snapshot;
 snapshot.moduleVersion='4.0.0';snapshot.core.moduleVersion='4.0.0';
 snapshot.basePrompt=snapshot.basePrompt.replace(/Converse naturally[\s\S]*?disclaimers\./,'Respond naturally in the user language.');
 snapshot.promptHash=hash(snapshot.basePrompt);
 snapshot.coreHash=hash({core:snapshot.core,corePrompt:snapshot.corePrompt,appraisalCorePrompt:snapshot.appraisalCorePrompt,basePrompt:snapshot.basePrompt});
 const oldSettings={...snapshot.settings},oldHash=snapshot.coreHash;
 await f.store.save(owner,state);
 await f.act('settings',{settings:{...defaults,humor:0}});
 await f.act('message',{chatId,message:'Podemos conversar em português?'});
 const saved=await f.store.get(owner),updated=saved.chats[0].snapshot;
 assert.deepEqual(updated.settings,oldSettings);assert.equal(updated.upgradedFrom.coreHash,oldHash);
 assert.match(updated.basePrompt,/Brazilian Portuguese/);
 assert.equal(saved.chats[0].messages.at(-2).text,'Podemos conversar em português?');
 updated.moduleVersion='4.0.0';updated.basePrompt+='corrupted';await f.store.save(owner,saved);
 await assert.rejects(()=>f.act('message',{chatId,message:'Continue.'}),{code:'core_integrity'});
});
