// Explicit paid integration run. Synthetic job, licensed reference photo, no Google call.
import { mkdtemp,rm,readFile,writeFile,mkdir,access } from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Advisor } from '../src/advisor.mjs';
import { CaseStore } from '../src/store.mjs';
import { OpenAIProvider } from '../src/providers/openai.mjs';
import { TavilySearch,resolveZIP } from '../src/providers/tavily.mjs';
const outputDirectory=process.env.PERSONA_RELEASE_OUTPUT||fileURLToPath(new URL('../docs/verification/release-2026-10-14/',import.meta.url));
await mkdir(outputDirectory,{recursive:true});
const out=path.join(outputDirectory,'live.json');
try {await access(out);throw new Error('Release record already exists. Choose a new PERSONA_RELEASE_OUTPUT directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
const limits={model:8,searchAndExtract:8,zip:2},attempts={model:0,searchAndExtract:0,zip:0};
const bounded=kind=>(...args)=>{if(attempts[kind]>=limits[kind])throw new Error(`Registered ${kind} limit reached.`);attempts[kind]++;return fetch(...args);};
const provider=new OpenAIProvider({key:process.env.OPENAI_API_KEY,fetchFn:bounded('model')});
const search=new TavilySearch({key:process.env.TAVILY_API_KEY,fetchFn:bounded('searchAndExtract')});
const directory=await mkdtemp(path.join(os.tmpdir(),'advisor-release-')),store=new CaseStore(directory);
const advisor=new Advisor({provider,search,store,locate:zip=>resolveZIP(zip,bounded('zip'))});
const report={version:'0.3.1',startedAt:new Date().toISOString(),limits,protocol:['Create synthetic one-door photo case in ZIP 10001','Correct symptoms and preserve photo','Live search, source grounding and estimate','Reconstruct store and delete case'],checks:[],completed:false};
const save=()=>writeFile(out,JSON.stringify(report,null,2));await save();
let item;
try {
 const photo=await readFile(new URL('../tests/fixtures/door-hinge.jpg',import.meta.url));
 report.photoSHA256=createHash('sha256').update(photo).digest('hex');
 item=await advisor.create('synthetic-release-owner',{zip:'10001',message:'Synthetic demonstration: one interior wooden door rubs at the top. Please assess adjustment using existing hardware if possible. This is a public reference photo, not an inspection of a real home.',images:[`data:image/jpeg;base64,${photo.toString('base64')}`]});
 assert(item.assessment.observations.some(o=>o.basis==='photo'));report.checks.push('photo_assessment');
 item=await advisor.reply(item.id,item.owner,{revision:item.revision,message:'Correction: it rubs at the bottom, not the top. Keep the existing door and hinges. The frame is intact according to this hypothetical description. Please find local help.'});
 assert.equal(item.images.length,1);assert(item.memory.facts.some(f=>/bottom/i.test(f.evidence.quote)));report.checks.push('correction_and_photo_retention');
 item=await advisor.find(item.id,item.owner,item.revision);
 assert(item.report.sourceCount>0);assert(item.report.providers.length>0);
 assert(item.report.providers.every(p=>p.name.evidence.url&&p.service.evidence.url&&p.availability.status==='needs_confirmation'));report.checks.push('live_search_and_grounding');
 report.result={providerCount:item.report.providers.length,sourceCount:item.report.sourceCount,estimate:item.report.estimate||null,warnings:item.report.warnings,sourceURLs:[...new Set(item.report.providers.map(p=>p.name.evidence.url))]};
 const restored=await new CaseStore(directory).get(item.id,item.owner);assert.equal(restored.revision,item.revision);assert.equal(restored.images.length,1);report.checks.push('store_reconstruction');
 report.traces=item.traces;report.completed=true;
} catch(error){report.error={name:error.name,code:error.code||null,message:error.message};process.exitCode=1;}
finally {report.finishedAt=new Date().toISOString();report.attempts=attempts;await rm(directory,{recursive:true,force:true});report.temporaryDataRemoved=true;await save();console.log(JSON.stringify({completed:report.completed,checks:report.checks,attempts,error:report.error||null}));}
