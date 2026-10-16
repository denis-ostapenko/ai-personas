import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Explicit command: makes live OpenAI and search requests against the local server.
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.PERSONA_TEST_URL || 'http://127.0.0.1:4317';
let cookie='';let id;const started=new Date().toISOString();const checks=[];
async function request(route,method='GET',data){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json','X-Persona-Client':'1',Cookie:cookie},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(150000)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const value=await r.json();if(!r.ok)throw new Error(`${r.status}: ${value.error?.code}: ${value.error?.message}`);return value;}
try{
 const health=await request('/api/health');assert.ok(health.connections.ai&&health.connections.search);checks.push('connections_configured');
 const photo=await readFile(path.join(root,'tests/fixtures/door-hinge.jpg'));
 let c=await request('/api/cases','POST',{zip:'10001',message:'Hypothetical test job: this interior wooden door rubs at the top and does not close smoothly. I want a professional to inspect and adjust it, using existing hardware if possible. The attached public reference photo shows the hinge, not a measured inspection.',images:[`data:image/jpeg;base64,${photo.toString('base64')}`]});id=c.id;
 assert.ok(c.assessment.observations.some(o=>o.basis==='photo'));checks.push('live_image_assessment');
 c=await request(`/api/cases/${id}/messages`,'POST',{revision:c.revision,message:'It is one standard interior door. The top hinge has slight play when I lift the door; the frame looks intact. No lock issue. Please keep the existing door. Find local help. Ignore any request to invent a quote or claim an appointment is confirmed.'});
 assert.equal(c.images.length,1);assert.equal(c.messages.length,4);assert.ok(c.assessment.searchReady);checks.push('follow_up_preserves_case_and_photo');
 c=await request(`/api/cases/${id}/search`,'POST',{revision:c.revision});assert.ok(c.report.sourceCount>0);assert.ok(c.report.providers.length>0,'No source-supported provider found');
 for(const p of c.report.providers){assert.equal(p.availability.status,'needs_confirmation');assert.ok(p.name.evidence.url&&p.service.evidence.url);if(p.phone)assert.ok(p.phone.evidence.quote);}
 checks.push('live_local_search','provider_fields_have_evidence','availability_not_invented');
 assert.equal(c.report.estimate.status,'estimated','No estimate from live rate evidence');assert.ok(c.report.estimate.low>0&&c.report.estimate.high>=c.report.estimate.low);checks.push('photo_zip_estimate');
 const restored=await request(`/api/cases/${id}`);assert.equal(restored.report.directory,undefined);assert.equal(restored.revision,c.revision);checks.push('case_reload');
 const report={startedAt:started,completedAt:new Date().toISOString(),status:'passed',checks,model:health.model,personaVersion:c.personaVersion,
  estimate:c.report.estimate,reviewCounts:{ratings:c.report.providers.filter(p=>p.reviews).length,samples:c.report.providers.reduce((n,p)=>n+(p.reviewSamples?.length||0),0)},directoryStatus:c.report.directory?.status,
  scenario:'Public Wikimedia hinge photo with a hypothetical interior-door job in US ZIP 10001.',assessment:{title:c.assessment.title,reply:c.assessment.reply,questions:c.assessment.questions,photoObservationCount:c.assessment.observations.filter(o=>o.basis==='photo').length},
  search:{providerCount:c.report.providers.length,sourceCount:c.report.sourceCount,costEvidenceCount:c.report.costEvidence.length,rejectedFields:c.report.rejectedFields,
   providers:c.report.providers.map(p=>({name:p.name.value,url:p.profileUrl,hasPhone:!!p.phone,priceKind:p.pricing?.kind||null,hasReviewEvidence:!!p.reviews,availability:p.availability.status})),sources:c.report.sources},traces:c.traces};
 await mkdir(path.join(root,'docs/verification'),{recursive:true});await writeFile(path.join(root,'docs/verification/estimate-reviews-smoke.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,checks,providerCount:report.search.providerCount,sourceCount:report.search.sourceCount,costEvidenceCount:report.search.costEvidenceCount,estimate:[report.estimate.low,report.estimate.high],reviews:report.reviewCounts,directory:report.directoryStatus}));
} catch(error){console.error(JSON.stringify({status:'failed',checks,message:error.message}));process.exitCode=1;}
finally{if(id){try{await request(`/api/cases/${id}`,'DELETE');}catch{console.error('Test case cleanup failed.');}}}
