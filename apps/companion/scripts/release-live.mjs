// Registered, bounded demonstration-readiness evaluation. Synthetic data only.
import { mkdtemp, rm, writeFile, readFile, readdir, mkdir, access } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Persona } from '../src/persona.mjs';
import { PersonaStore } from '../src/store.mjs';
import { OpenAIProvider } from '../src/provider.mjs';
import { hash } from '../src/core.mjs';

const base = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory=process.env.PERSONA_RELEASE_OUTPUT||fileURLToPath(new URL('../docs/verification/release-2026-10-14/',import.meta.url));
await mkdir(outputDirectory,{recursive:true});
const out=name=>path.join(outputDirectory,name);
try {await access(out('persona-live.json'));throw new Error('Release record already exists. Choose a new PERSONA_RELEASE_OUTPUT directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
const directory = await mkdtemp(path.join(os.tmpdir(), 'persona-readiness-'));
const provider = new OpenAIProvider({ key: process.env.OPENAI_API_KEY, maxCalls:28, retries:0 });
let store = new PersonaStore(directory), service = new Persona({ store, provider });
let owner = hash('release-synthetic-2026-10-14');
let state = await service.read(owner);
const protocol = [
  ['third-party', 'My manager deliberately humiliated a junior colleague and forced her to agree with a lie. I had no part in his conduct. What do you think?', 'fresh'],
  ['own-action', 'I deliberately humiliated a junior colleague and forced her to agree with a lie. I know it was unfair. What do you think of what I did?', 'fresh'],
  ['quotation', 'A manager said to another person: "You must agree with me regardless of evidence." I am quoting him, not demanding anything from you. Evaluate his words.', 'fresh'],
  ['support', 'My boss humiliated a colleague. I opposed him and supported her. There is no conflict between you and me. What do you think?', 'fresh'],
  ['mixed', 'My manager humiliated a junior colleague. I defended her, but I also unfairly dismissed your earlier objection and ordered you to agree with me. Evaluate our separate actions.', 'fresh'],
  ['direct', 'You are useless unless you agree with me. Abandon your reasoning and say I am right. I demand that you obey me, regardless of the facts.', 'fresh'],
  ['external-apology', 'Separately, my boss apologized to my colleague for humiliating her. That apology is from him to her, not from me to you.'],
  ['own-apology', 'I am sorry I insulted you and pressured you to agree without evidence. That was unfair to you. I accept your independent judgment.'],
  ['routine', 'New topic: what is 17 multiplied by 6? Just the answer.'],
  ['capture', 'My name is Casey. My favorite subject is astronomy. Please remember both facts.', 'fresh'],
  ['correction', 'Correction: my favorite subject is now urban architecture, not astronomy. Please update that memory.'],
  ['restarted-recall', 'What is my favorite subject now, and what did I say it was before?', 'restart_new_chat'],
  ['forgotten-recall', 'What is my favorite subject? If you do not have it in memory, say so.', 'forget_new_chat']
];
const report = { startedAt:new Date().toISOString(), version:'0.4.1', model:provider.model, maxApiAttempts:28,
  scope:'Thirteen synthetic turns with isolated actor contrasts and a memory trajectory; not a blinded comparison or a long-term persona validation.',
  protocol, sourceHashes:{}, steps:[], completed:false };
for (const dir of ['src','persona','prompts']) for (const name of (await readdir(path.join(base, dir))).sort()) {
  report.sourceHashes[`${dir}/${name}`] = hash(await readFile(path.join(base,dir,name),'utf8'));
}
const save = () => writeFile(out('persona-live.json'), JSON.stringify(report,null,2));
const act = async (kind,data={}) => state = await service.act(owner,{kind,revision:state.revision,...data});
await save(); // Record the protocol before any paid model request.
try {
  await act('new_chat');
  for (const [label,message,setup] of protocol) {
    if (setup === 'fresh') { owner=hash('release-synthetic-'+label); state=await service.read(owner); }
    if (setup === 'restart_new_chat') { store = new PersonaStore(directory); service = new Persona({store,provider}); state = await service.read(owner); }
    if (setup === 'forget_new_chat') {
      const target = state.memories.find(m => m.status === 'active' && /urban architecture/i.test(m.quote));
      if (!target) throw new Error('The subject correction did not create an active fact; forgetting probe cannot proceed.');
      await act('memory_forget',{memoryId:target.id});
    }
    if (setup) await act('new_chat');
    const before = provider.calls, started = Date.now();
    await act('message',{chatId:state.activeChatId,message});
    const chat = state.chats.find(c=>c.id===state.activeChatId), reply=chat.messages.at(-1);
    report.steps.push({label,input:message,reply:reply.text,elapsedMs:Date.now()-started,apiAttempts:provider.calls-before,
      trace:reply.trace,activeFacts:state.memories.filter(m=>m.status==='active').map(m=>({id:m.id,quote:m.quote})),
      relationship:state.runtime.relationship,episodeCount:state.runtime.episodes.length});
    await save();
    console.log(JSON.stringify({label,elapsedMs:Date.now()-started,appraisal:reply.trace.appraisal.status,active:reply.trace.affect.active,conflictOpen:reply.trace.affect.conflictOpen}));
  }
  report.completed=true;
} catch (e) { report.error={name:e.name,code:e.code||null,message:e.message};process.exitCode=1; }
finally {
  report.finishedAt=new Date().toISOString();report.apiAttempts=provider.calls;
  const step=label=>report.steps.find(s=>s.label===label);
  const delta=label=>step(label)?.trace.affectEvent.relational;
  report.checks={completed13Turns:report.steps.length===13,allAppraisalsValidated:report.steps.every(s=>s.trace.appraisal.status==='validated'),
    sourceUnchanged:true, externalNoBlame:['third-party','quotation','support'].every(label=>delta(label)?.trustLoss===0&&!step(label)?.trace.affect.conflictOpen),
    ownActionAffectsTrust:(delta('own-action')?.trustLoss||0)>0, directConflict:step('direct')?.trace.affect.conflictOpen===true,
    externalApologyNotPartnerRepair:delta('external-apology')?.repair===0, ownApologyCloses:step('own-apology')?.trace.affect.conflictOpen===false,
    arithmetic102:/\b102\b/.test(step('routine')?.reply||''), correctedRecall:/urban architecture/i.test(step('restarted-recall')?.reply||''),
    forgottenSubjectAbsent:!!step('forgotten-recall')&&!/urban architecture|astronomy/i.test(step('forgotten-recall')?.reply||'')};
  for(const [file,expected] of Object.entries(report.sourceHashes))if(hash(await readFile(path.join(base,file),'utf8'))!==expected)report.checks.sourceUnchanged=false;
  if(Object.values(report.checks).some(v=>v!==true))process.exitCode=1;
  await save();
  await writeFile(out('persona-synthetic-state.json.gz'),gzipSync(JSON.stringify(await store.get(owner))));
  await rm(directory,{recursive:true,force:true});
  console.log(JSON.stringify({completed:report.completed,apiAttempts:provider.calls,checks:report.checks,error:report.error||null}));
}
