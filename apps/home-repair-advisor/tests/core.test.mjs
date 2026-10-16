import test from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { groundEvidence, safeURL } from '../src/evidence.mjs';
import { CaseStore, publicCase } from '../src/store.mjs';
import { Advisor, validateInput } from '../src/advisor.mjs';
import { OpenAIProvider } from '../src/providers/openai.mjs';
import { createServer } from '../src/server.mjs';
import { assessmentSchema } from '../src/schema.mjs';

const assessment = () => ({reply:'A hinge adjustment may resolve the rubbing.',status:'ready',category:'door',title:'Interior door adjustment',summary:'Door catches at the top.',observations:[{detail:'The door catches.',basis:'customer',imageIds:[]}],hypotheses:['A loose hinge may be involved.'],scope:['Check hinge attachment and alignment.'],materials:[],assumptions:['No frame damage has been established.'],questions:['Does the hinge move when you lift the door?'],duration:null,trade:'handyman',searchTerms:'interior door adjustment',searchReady:true,jobBrief:'Inspect an interior door that catches at the top.',caution:null,estimatePlan:null});
const text='Acme Home Repair offers door adjustment in New York. Phone 212-555-0100. Door adjustment starts at $95. 4.8 out of 5 from 125 reviews on Yelp.';
const source={id:'s1',url:'https://www.yelp.com/biz/acme-home-repair-fixture',title:'Acme services',text,kind:'page_extract',checkedAt:'2026-10-11T15:00:00Z'};
const claim=(value,quote=value)=>({value,sourceId:'s1',quote});
const provider=()=>({name:claim('Acme Home Repair'),service:claim('door adjustment'),coverage:claim('New York'),phone:claim('212-555-0100'),profileSourceId:'s1',pricing:{kind:'advertised_starting',text:'From $95',scope:'Door adjustment',sourceId:'s1',quote:'Door adjustment starts at $95.'},reviews:{rating:4.8,scale:5,reviewCount:125,platform:'Yelp',sourceId:'s1',quote:'4.8 out of 5 from 125 reviews on Yelp.'},fitReason:'Lists the relevant door service.',ask:'What is included in the minimum visit?'});

// All businesses and contacts in this file are synthetic test fixtures.
test('evidence retains sourced facts while availability remains unconfirmed',()=>{
 const r=groundEvidence({providers:[provider()],costEvidence:[]},[source]);assert.equal(r.providers.length,1);assert.equal(r.providers[0].reviews.rating,4.8);assert.equal(r.providers[0].availability.status,'needs_confirmation');assert.equal(r.providers[0].zipCoverage.status,'needs_confirmation');assert.equal(r.providers[0].pricing.kind,'advertised_starting');
});
test('fabricated quote, phone, rating and unrelated source do not become provider facts',()=>{
 const p=provider();p.phone.value='212-555-0999';p.reviews.rating=4.9;p.pricing.quote='Guaranteed whole job for $25';
 const r=groundEvidence({providers:[p],costEvidence:[]},[source]);assert.equal(r.providers[0].phone,null);assert.equal(r.providers[0].reviews,null);assert.equal(r.providers[0].pricing,null);
 p.name.sourceId='imaginary';assert.equal(groundEvidence({providers:[p],costEvidence:[]},[source]).providers.length,0);
});
test('an unrelated directory profile cannot stand in for the named business',()=>{
 const p=provider();p.profileSourceId='s2';const s={...source,id:'s2',text:'Other Company fixes doors.'};assert.equal(groundEvidence({providers:[p],costEvidence:[]},[source,s]).providers.length,0);
});
test('only public HTTP links can become provider links',()=>{
 for(const bad of ['javascript:alert(1)','file:///etc/passwd','https://user:pass@a.com','http://localhost/x','http://127.0.0.1','http://[::1]','http://0x7f000001','http://2130706433','https://test.local','https://a.com:1234'])assert.equal(safeURL(bad),null,bad);
 assert.equal(safeURL('https://www.example.org/path'),'https://www.example.org/path');
});
test('input rejects malformed ZIP and disguised files before any model call',()=>{
 assert.throws(()=>validateInput({zip:'ABC12',message:'Help'},{initial:true}));assert.throws(()=>validateInput({zip:'10001',message:'Help',images:['data:image/png;base64,SGVsbG8=']},{initial:true}));assert.equal(validateInput({zip:'02108',message:'Fix my door'},{initial:true}).zip,'02108');
});
async function harness(t) {
 const dir=await mkdtemp(path.join(os.tmpdir(),'persona-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=new CaseStore(dir);let calls=0;
 const llm={structured:async({name})=>{calls++;return {data:name==='case_memory'?{transition:'continue',transitionEvidence:null,upserts:[],removals:[]}:name==='job_assessment'?assessment():{providers:[provider()],costEvidence:[]},trace:{provider:'test',model:'fixture'}};}};
 const search={search:async()=>({sources:[source],warnings:[],queries:['synthetic test'],credits:0,provider:'fixture'})};
 const locate=async zip=>({zip,city:'Test City',state:'NY'});
 return {store,advisor:new Advisor({provider:llm,search,store,locate}),dir,calls:()=>calls};
}
test('saved cases survive a store restart and remain isolated by owner',async t=>{
 const h=await harness(t);const c=await h.advisor.create('a',{zip:'10001',message:'My door catches.'});const fresh=new CaseStore(h.dir);assert.equal((await fresh.get(c.id,'a')).assessment.category,'door');await assert.rejects(()=>fresh.get(c.id,'b'),{code:'case_not_found'});assert.equal('owner' in publicCase(c),false);
});
test('follow-up corrects ZIP, preserves conversation and invalidates old search',async t=>{
 const h=await harness(t);let c=await h.advisor.create('a',{zip:'10001',message:'My door catches.'});c=await h.advisor.find(c.id,'a',c.revision);assert.equal(c.report.providers.length,1);
 c=await h.advisor.reply(c.id,'a',{revision:c.revision,zip:'02108',message:'Actually, I am in Boston. The top hinge is loose.'});assert.equal(c.location.zip,'02108');assert.equal(c.report,null);assert.equal(c.messages.length,4);assert.equal(c.personaVersion,'1.1.0');assert.equal(c.sourcePages,undefined);
 await assert.rejects(()=>h.advisor.reply(c.id,'a',{revision:1,message:'stale update'}),{code:'stale_case'});
});
test('failed follow-up cannot overwrite a saved working case',async t=>{
 const h=await harness(t);const c=await h.advisor.create('a',{zip:'10001',message:'My door catches.'});h.advisor.provider.structured=async()=>{throw new Error('upstream failure');};await assert.rejects(()=>h.advisor.reply(c.id,'a',{revision:c.revision,message:'New detail'}));assert.deepEqual(await h.store.get(c.id,'a'),c);
});
test('same-case overlap is rejected instead of losing writes',async t=>{
 const h=await harness(t);let release;const pending=h.store.exclusive('same',()=>new Promise(r=>{release=r;}));await assert.rejects(()=>h.store.exclusive('same',()=>null),{code:'case_busy'});release();await pending;
});
test('missing photos cannot produce photo observations',async t=>{
 const h=await harness(t);h.advisor.provider.structured=async({name})=>({data:name==='case_memory'?{transition:'continue',transitionEvidence:null,upserts:[],removals:[]}:{...assessment(),observations:[{detail:'An invented photo',basis:'photo',imageIds:['not-attached']}]},trace:{}});const c=await h.advisor.create('a',{zip:'10001',message:'My door catches.'});assert.deepEqual(c.assessment.observations,[]);
});
test('OpenAI adapter handles refusal, incomplete output and upstream secret redaction',async()=>{
 const base={key:'test-secret',model:'test',reasoning:'low'};
 for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}]){
  const p=new OpenAIProvider({...base,fetchFn:async()=>Response.json(response)});await assert.rejects(()=>p.structured({instructions:'x',input:[],schema:assessmentSchema,name:'test'}));
 }
 const p=new OpenAIProvider({...base,fetchFn:async()=>new Response('test-secret',{status:401})});await assert.rejects(()=>p.structured({instructions:'x',input:[],schema:assessmentSchema,name:'test'}),e=>e.code==='provider_access'&&!e.message.includes('test-secret'));
});
test('HTTP boundary rejects cross-origin mutations and isolates another browser session',async t=>{
 const h=await harness(t);const server=createServer({...h,configured:{ai:true,search:true},model:'fixture'});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 const headers={'Content-Type':'application/json','X-Persona-Client':'1'};
 let malformed=await fetch(base+'/api/cases',{method:'POST',headers,body:'null'});assert.equal(malformed.status,400);
 let res=await fetch(base+'/api/cases',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'});assert.equal(res.status,403);
 res=await fetch(base+'/api/cases',{method:'POST',headers,body:JSON.stringify({zip:'10001',message:'My door catches.'})});assert.equal(res.status,201);const cookie=res.headers.get('set-cookie').split(';')[0];const c=await res.json();assert.equal('owner' in c,false);
 assert.equal((await fetch(base+`/api/cases/${c.id}`)).status,404);assert.equal((await fetch(base+`/api/cases/${c.id}`,{headers:{Cookie:cookie}})).status,200);
 assert.equal((await fetch(base+'/.env')).status,404);const hostStatus=await new Promise(resolve=>{const r=httpRequest(base+'/api/health',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});r.end();});assert.equal(hostStatus,403);
 res=await fetch(base+`/api/cases/${c.id}`,{method:'DELETE',headers:{...headers,Cookie:cookie}});assert.equal(res.status,200);assert.equal((await fetch(base+`/api/cases/${c.id}`,{headers:{Cookie:cookie}})).status,404);
});
test('explicit refresh bypasses cache while a repeated identical search does not',async t=>{
 const h=await harness(t);let c=await h.advisor.create('a',{zip:'10001',message:'My door catches.'});c=await h.advisor.find(c.id,'a',c.revision);const before=h.calls();
 c=await h.advisor.find(c.id,'a',c.revision);assert.equal(h.calls(),before);
 c=await h.advisor.find(c.id,'a',c.revision,true);assert.equal(h.calls(),before+1);assert.ok(c.traces.at(-1).promptHash);
});
