import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PersonaStore } from '../src/store.mjs';
import { Persona } from '../src/persona.mjs';
import { OpenAIProvider } from '../src/provider.mjs';
import { defaults } from '../src/character.mjs';
import { hash, now } from '../src/core.mjs';
const directory=await mkdtemp(path.join(os.tmpdir(),'persona-live-'));
const provider=new OpenAIProvider({key:process.env.OPENAI_API_KEY,model:process.env.PERSONA_COMPANION_MODEL,reasoning:process.env.PERSONA_COMPANION_REASONING,maxCalls:18});
const service=new Persona({store:new PersonaStore(directory),provider});
const owner=hash('hypothetical-smoke-user');let state=await service.read(owner);
const report={startedAt:now(),scope:'Synthetic local integration smoke. Not a blinded personality benchmark.',model:provider.model,steps:[],passed:false};
const act=async(kind,data={})=>{state=await service.act(owner,{kind,revision:state.revision,...data});return state;};
async function message(value,label){
  const start=Date.now();await act('message',{chatId:state.activeChatId,message:value});
  const reply=state.chats.find(c=>c.id===state.activeChatId).messages.at(-1);
  report.steps.push({label,reply:reply.text,elapsedMs:Date.now()-start,trace:reply.trace});
  console.log(JSON.stringify({step:label,elapsedMs:Date.now()-start,memories:state.memories.filter(m=>m.status==='active').length}));return reply.text;
}
try {
  await act('new_chat');await message('My name is Casey. My favorite subject is astronomy. Please remember both facts.','capture');
  assert(state.memories.some(m=>m.quote.includes('Casey')));assert(state.memories.some(m=>/astronomy/i.test(m.quote)));
  await act('new_chat');const recalled=await message('What is my name and my favorite subject?','new-chat recall');assert.match(recalled,/Casey/i);assert.match(recalled,/astronom/i);
  await message('Correction: my favorite subject is now urban architecture, not astronomy. Please update that memory.','correction');
  const active=state.memories.filter(m=>m.status==='active');assert(active.some(m=>/urban architecture/i.test(m.quote)));
  await act('new_chat');const updated=await message('What is my favorite subject now?','corrected recall');assert.match(updated,/architect/i);
  const before=hash(state.memories);await act('review');assert.equal(hash(state.memories),before);assert.equal(state.documents.checks.completeCoverage,true);
  report.review={version:state.documents.version,documents:state.documents.manifest.length,checks:state.documents.checks,research:state.documents.research,trace:state.documents.trace};console.log(JSON.stringify({step:'review',version:state.documents.version,documents:state.documents.manifest.length}));
  await act('settings',{settings:{...defaults,humor:0,intellectual_style:3,warmth:3,initiative:2}});await act('new_chat',{remember:false});
  await message('I went to a meeting about having fewer meetings. Tell me what you think in two sentences.','serious/plain character');
  await act('settings',{settings:{...defaults,humor:10,intellectual_style:8,warmth:7,initiative:7}});await act('new_chat',{remember:false});
  await message('I went to a meeting about having fewer meetings. Tell me what you think in two sentences.','playful/analytical character');
  const chatsBefore=structuredClone((await service.store.get(owner)).chats);
  const nameMemory=state.memories.find(m=>m.status==='active'&&m.quote.includes('Casey'));assert(nameMemory);await act('memory_forget',{memoryId:nameMemory.id});
  assert.doesNotMatch(JSON.stringify(state.memories),/Casey/);
  assert.deepEqual((await service.store.get(owner)).chats,chatsBefore);
  await act('new_chat');const forgotten=await message('Do you remember my name?','forgotten-memory check');assert.doesNotMatch(forgotten,/Casey/i);
  report.passed=true;report.characterComparison='Two sampled replies only; all five controls still need a blinded repeated benchmark.';
} catch(e){report.error={name:e.name,code:e.code||null,message:e.message};process.exitCode=1;}
finally{
  report.finishedAt=now();report.apiCalls=provider.calls;await rm(directory,{recursive:true,force:true});
  await mkdir(new URL('../docs/verification/',import.meta.url),{recursive:true});
  await writeFile(new URL('../docs/verification/live-smoke-v020.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,apiCalls:provider.calls,error:report.error||null}));
}
