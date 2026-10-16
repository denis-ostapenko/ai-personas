import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,writeFile,readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import { Persona,initialState } from '../src/persona.mjs';
import { PersonaStore } from '../src/store.mjs';
import { compile,defaults } from '../src/character.mjs';
import { hash } from '../src/core.mjs';
import { addMemory,forgetMemory } from '../src/memory.mjs';
import { addEpisode,ensureRuntime } from '../src/conversation-memory.mjs';
import { activate } from '../src/memory-graph.mjs';
import { neutralAppraisal,validateAppraisal,interpretationOf } from '../src/appraisal.mjs';
import { transition } from '../src/affect.mjs';
import { resolveTemperament } from '../src/temperament.mjs';
import { eventImpulses } from '../src/emotion-model.mjs';
import { identity } from '../src/character.mjs';
import { selectCells,rebuildCells,cellContext } from '../src/reaction-cells.mjs';

const chat=()=>({id:'chat',remember:true,snapshot:compile(defaults),messages:[]});
function episode(state,c,n,{quote=`A brass robot joke ${n}.`,reply=`Its accountant charges by the bolt ${n}.`,memoryIds=[],references=[],matches=[]}={}) {
  ensureRuntime(state);const user={id:`u${n}`,text:quote,createdAt:'2026-10-13T13:00:00Z'},out={id:`a${n}`,text:reply};
  const appraisal={...neutralAppraisal(),cellMatches:matches};
  addEpisode(state,c,user,out,{topic:{title:'Robot'},appraisal,affect:{active:['amusement'],values:{amusement:0.5}},memoryIds,references});
  return state.runtime.episodes.at(-1);
}
async function storeFixture(t){const directory=await mkdtemp(path.join(os.tmpdir(),'persona-db-'));t.after(()=>rm(directory,{recursive:true,force:true}));return {store:new PersonaStore(directory),owner:hash(directory),directory};}

test('correcting a visible fact preserves 19 episodes and resumes capture; historical versions are retrievable',()=>{
  const s=initialState(),c=chat(),old=addMemory(s,{quote:'The cinema has 12 seats and a 900 reserve.',category:'user_fact',sourceId:'source',sourceType:'chat'});
  for(let i=0;i<19;i++)episode(s,c,i,{memoryIds:[old.id]});
  const before=structuredClone(s.runtime.episodes);
  const current=addMemory(s,{quote:'Correction: 18 seats and a 1200 reserve.',category:'user_fact',sourceId:'correction',sourceType:'chat',replacesId:old.id});
  assert.deepEqual(s.runtime.episodes,before);assert(!s.runtime.excludedEventIds?.length);
  episode(s,c,20);assert.equal(s.runtime.episodes.length,20);
  const recalled=activate(s,'What was the original cinema seat count and reserve?');
  assert(recalled.memories.some(m=>m.id===old.id&&m.status==='superseded'));assert(recalled.memories.some(m=>m.id===current.id&&m.status==='active'));
});
test('more than 60 episodes survive persistence and process reconstruction with original persona expressions',async t=>{
  const {store,owner,directory}=await storeFixture(t),s=initialState(),c=chat();
  for(let i=0;i<85;i++)episode(s,c,i,{reply:i===0?'Our committee scheduled spontaneity for Thursday.':`Another reply ${i}.`});
  await store.save(owner,s);const recovered=await new PersonaStore(directory).get(owner);
  assert.equal(recovered.runtime.episodes.length,85);assert.match(activate(recovered,'committee spontaneity Thursday').episodes[0].personaAction,/Thursday/);
  const db=new DatabaseSync(store.file(owner),{readOnly:true});assert.equal(db.prepare('SELECT count(*) AS n FROM episodes').get().n,85);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
});
test('failed SQL transaction preserves the prior profile and all memory tables',async t=>{
  const {store,owner}=await storeFixture(t),s=initialState();ensureRuntime(s);episode(s,chat(),1);await store.save(owner,s);const before=await store.get(owner);
  const broken=structuredClone(before);broken.revision++;broken.runtime.episodes.push(structuredClone(broken.runtime.episodes[0]));
  await assert.rejects(store.save(owner,broken));assert.deepEqual(await store.get(owner),before);
});
test('legacy JSON is read without writes and migrates on the next saved action',async t=>{
  const {store,owner}=await storeFixture(t),s=initialState();delete s.runtime;
  const raw=JSON.stringify(s);await writeFile(store.legacyFile(owner),raw,{mode:0o600});const p=new Persona({store,provider:{}});
  await p.read(owner);assert.equal(await readFile(store.legacyFile(owner),'utf8'),raw);
  await p.act(owner,{kind:'new_chat',revision:0});assert.equal((await store.get(owner)).chats.length,1);
  assert.equal(await readFile(store.legacyFile(owner),'utf8'),raw);assert.deepEqual(await store.owners(),[owner]);
});
test('forgetting removes explicit content dependencies but keeps contextual neighbors and future capture',()=>{
  const s=initialState(),c=chat(),secret=addMemory(s,{quote:'My street is Cedar.',category:'user_fact',sourceId:'u1',sourceType:'chat'});
  episode(s,c,1,{quote:'My street is Cedar.',reply:'Cedar is your street.',memoryIds:[secret.id]});
  episode(s,c,2,{references:[{id:'episode:u1',quote:'The earlier street.'}],reply:'The earlier street.'});
  episode(s,c,3);s.runtime.edges.push({from:'episode:u3',to:secret.id,type:'related',weight:0.65});
  forgetMemory(s,secret.id);assert.deepEqual(s.runtime.episodes.map(e=>e.id),['episode:u3']);
  episode(s,c,4);assert.equal(s.runtime.episodes.length,2);
  assert.doesNotMatch(JSON.stringify(activate(s,'street')),/Cedar/);
});
test('reaction cells retain distinct supporting episodes and counterexamples; duplicate event is idempotent',()=>{
  const s=initialState(),c=chat(),match={cellId:'shared_teasing',evidenceQuote:'A joke',confidence:0.9,relation:'supports'};
  episode(s,c,1,{matches:[match]});episode(s,c,1,{matches:[match]});episode(s,c,2,{matches:[{...match,relation:'contradicts'}]});
  rebuildCells(s);assert.equal(s.runtime.cells.length,1);assert.equal(s.runtime.cells[0].support.length,1);assert.equal(s.runtime.cells[0].counterexamples.length,1);
  const context=cellContext(s,c).find(c=>c.id==='shared_teasing');assert.equal(context.support.length,1);assert.equal(context.counterexamples.length,1);
  const before=hash(s);const chosen=selectCells(s,c,{cellMatches:[match]});assert(chosen.impulses.amusement>0&&chosen.impulses.amusement<=0.18);assert.equal(hash(s),before);
  assert.deepEqual(selectCells(s,c,{cellMatches:[{...match,relation:'contradicts'}]}).selected,[]);
  // Evidence is profile-scoped: a different core (another slider value or prompt revision) keeps it.
  assert.equal(cellContext(s,{...c,snapshot:compile({...defaults,humor:0})}).find(x=>x.id==='shared_teasing').support.length,1);
  assert(!('tendency' in context));
});
test('unknown or unquoted cell matches are dropped instead of becoming learned experience',()=>{
  const c=chat(),a={...neutralAppraisal(),topic:{existingId:'',title:'Topic'},evidenceQuote:'A joke',cellMatches:[{cellId:'invented',evidenceQuote:'A joke',confidence:1,relation:'supports'}]};
  let kept=validateAppraisal(a,'A joke',{cells:c.snapshot.core.reactionCells});assert.deepEqual(kept.cellMatches,[]);assert(kept.dropped.includes('cell_match'));
  a.cellMatches[0].cellId='shared_teasing';a.cellMatches[0].evidenceQuote='Something else';
  kept=validateAppraisal(a,'A joke',{cells:c.snapshot.core.reactionCells});assert.deepEqual(kept.cellMatches,[]);
});
test('reflection cannot displace a mixed emotion and a neutral turn needs no reflective expression',()=>{
  const settings={...defaults,composure:0,humor:10},t=resolveTemperament(settings),time=Date.parse('2026-10-13T13:00:00Z');
  const charged={target:'persona',agency:'user',valence:-0.3,intent:1,pressure:1,incongruity:1,playfulness:0.6,contradiction:1,substantive:0.4,novelty:1};
  const event=v=>({...eventImpulses({confidence:1,interpretations:[interpretationOf(v)]},t,{anchors:identity.anchors}),evidenceQuote:'x',topicId:'t'});
  const first=transition(null,event(charged),t,'one',time);assert.deepEqual(new Set(first.active),new Set(['anger','amusement']));assert(first.cognition.engaged);
  const next=transition(first,{...event({}),topicId:'other'},t,'two',time+15000);assert.equal(next.cognition.engaged,false);
});

test('a recalled episode supplied as a reaction-cell example is a valid evidence ID',()=>{
  const a={...neutralAppraisal(),topic:{existingId:'',title:'Shared joke'},evidenceQuote:'The projector union',recallIds:['episode:example']};
  assert.doesNotThrow(()=>validateAppraisal(a,'The projector union',{cells:[{id:'shared_teasing',support:[{id:'episode:example'}],counterexamples:[]}]}));
});

test('a reply can cite an actual cell example outside the primary retrieval set',async t=>{
  const {store,owner}=await storeFixture(t),c=chat(),s=initialState();s.chats=[c];s.activeChatId=c.id;
  episode(s,c,0,{quote:'A remembered old quip.',reply:'The quip had a receipt.',matches:[{cellId:'shared_teasing',confidence:0.9,relation:'supports',evidenceQuote:'A remembered old quip.'}]});
  s.runtime.episodes[0].topic='Receipts';s.runtime.episodes[0].topicKey='topic:receipts';
  for(let n=1;n<=30;n++)episode(s,c,n,{quote:`Bananas botanical discussion ${n}.`,reply:`Bananas in context ${n}.`});
  await store.save(owner,s);
  const provider={async structured(request){
    if(request.name==='persona_appraisal')return {data:{...neutralAppraisal(),evidenceQuote:'Bananas',topic:{existingId:'',title:'Bananas'}},trace:{}};
    const evidence=JSON.parse(request.input[0].content.split('\n').slice(1).join('\n'));
    assert(!evidence.episodes.some(e=>e.id==='episode:u0'));
    assert(evidence.reactionCells.some(c=>c.support.some(e=>e.id==='episode:u0')));
    return {data:{reply:'The quip had a receipt.',memories:[],memoryReferences:[{id:'episode:u0',quote:'The quip had a receipt.'}]},trace:{}};
  }};
  const p=new Persona({store,provider});await p.act(owner,{kind:'message',revision:0,chatId:c.id,message:'Bananas'});
  const saved=await store.get(owner);assert.equal(saved.runtime.episodes.at(-1).references[0].id,'episode:u0');
  assert(saved.runtime.edges.some(e=>e.type==='callback_to'&&e.to==='episode:u0'));
});
