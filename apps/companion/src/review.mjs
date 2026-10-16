import { readdir, readFile } from 'node:fs/promises';
import { reactionVersion } from './affect.mjs';
import { temperamentSource } from './temperament.mjs';
import { describeRelationship, neutralRelationship } from './relationship.mjs';
import { appraisalPrompt } from './appraisal.mjs';
import { authoredCells, cellPolicyVersion } from './reaction-cells.mjs';
import { identity, controls, dialoguePrompt, reviewPrompt, ruleCatalog, expressionPolicy } from './character.mjs';
import { object, array, string, enumeration, hash, now, AppError } from './core.mjs';
export const topics=['About you','Interests','Preferences','Open threads','Shared history','Unsorted'];
export const reviewSchema=object({coverage:array(string),groups:array(object({topic:enumeration(topics),memoryIds:array(string)})),proposals:array(object({ruleId:enumeration(Object.keys(ruleCatalog)),memoryIds:array(string)}))});
export async function latestResearch() {
  // The packaged digest is explicit and travels with the app. Workspace weekly
  // research remains an optional fallback in the canonical checkout.
  try {
    const content=await readFile(new URL('../docs/RESEARCH.md',import.meta.url),'utf8');
    return {date:'2026-10-14',text:content.slice(0,20000),hash:hash(content),truncated:content.length>20000};
  } catch(error) { if(error.code!=='ENOENT')throw error; }
  const root=new URL('../../../research/weekly/',import.meta.url);
  try {
    const names=(await readdir(root)).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&x<=now().slice(0,10)).sort().reverse();
    if(!names.length) return {date:null,text:'No local research digest is available.',hash:null,truncated:false};
    const content=await readFile(new URL(`${names[0]}/README.md`,root),'utf8');
    return {date:names[0],text:content.slice(0,20000),hash:hash(content),truncated:content.length>20000};
  } catch { return {date:null,text:'The local research digest could not be read. No live method check was performed.',hash:null,truncated:false}; }
}
export function dossier(state,research) {
  const active=state.memories.filter(x=>x.status==='active');
  const docs=[
    ['identity',identity],['character_settings',{version:state.settingsVersion,values:state.settings}],
    ['dialogue_prompt',dialoguePrompt],['dialogue_modules',controls],['maintenance_prompt',reviewPrompt],
    ['user_profile',active.filter(x=>x.category!=='shared_convention')],['relationship_memory',active.filter(x=>x.category==='shared_convention')],
    ['current_documentation',state.documents],['review_rule_catalog',ruleCatalog],
    ['onboarding_progress',{step:state.onboarding.step,complete:state.onboarding.complete,calibration:state.onboarding.calibration}],
    ['expression_policy',{reactionVersion,...expressionPolicy}],['temperament',temperamentSource],['appraisal_prompt',appraisalPrompt],
    ['reaction_cell_policy',{version:cellPolicyVersion,cells:authoredCells}],
    ['runtime_structure',{version:state.runtime?.version||null,episodes:state.runtime?.episodes.length||0,links:state.runtime?.edges.length||0,affectEvents:state.runtime?.affectEvents?.length||0,
      relationship:describeRelationship(state.runtime?.relationship||neutralRelationship()),scope:'Counts and coarse bands only; conversation transcripts, working notes and affect logs are not review evidence.'}],
    ['research_digest',{...research,scope:'Local digest only. This session has no live web access.'}]
  ].map(([name,content])=>({id:name,hash:hash(content),content}));
  if(JSON.stringify(docs).length>150000) throw new AppError(413,'dossier_limit','The complete dossier exceeds this prototype review limit. Nothing has been published.');
  return docs;
}
export function validateReview(candidate,docs,state) {
  const error=()=>{throw new AppError(502,'invalid_review','The documentation review failed its evidence or coverage checks. The previous version is preserved.');};
  const expected=docs.map(x=>x.id).sort();
  if(JSON.stringify([...candidate.coverage].sort())!==JSON.stringify(expected)) error();
  const active=state.memories.filter(x=>x.status==='active').map(x=>x.id).sort();
  if(candidate.groups.length>topics.length||new Set(candidate.groups.map(x=>x.topic)).size!==candidate.groups.length) error();
  const ids=candidate.groups.flatMap(x=>x.memoryIds).sort();
  if(JSON.stringify(ids)!==JSON.stringify(active)) error();
  if(candidate.proposals.length>3||new Set(candidate.proposals.map(p=>p.ruleId)).size!==candidate.proposals.length) error();
  for(const p of candidate.proposals) if(!p.memoryIds.length||p.memoryIds.some(x=>!active.includes(x))||!ruleCatalog[p.ruleId]) error();
}
export async function review(state,provider,{researchLoader=latestResearch}={}) {
  const research=await researchLoader(),docs=dossier(state,research);
  const before=hash({identity,settings:state.settings,memories:state.memories,runtime:state.runtime});
  const {data,trace}=await provider.structured({instructions:reviewPrompt,input:[{role:'user',content:JSON.stringify({documents:docs})}],schema:reviewSchema,name:'persona_document_review'});
  validateReview(data,docs,state);
  if(before!==hash({identity,settings:state.settings,memories:state.memories,runtime:state.runtime})) throw new AppError(409,'changed_dossier','The persona changed during review. Please try again.');
  state.documentHistory.push(structuredClone(state.documents)); state.documentHistory=state.documentHistory.slice(-8);
  state.documents={version:state.documents.version+1,groups:data.groups,proposals:data.proposals,updatedAt:now(),reviewedAt:now(),
    manifest:docs.map(({id,hash})=>({id,hash})),research:{date:research.date,hash:research.hash,truncated:research.truncated,liveWebChecked:false},
    trace,checks:{completeCoverage:true,allActiveMemoriesPreserved:true,identityUnchanged:true,settingsUnchanged:true,behavioralEditsApplied:false}};
  state.schedule.reviewedChatCount=state.chats.filter(c=>c.closedAt&&c.substantive).length;
  state.schedule.lastReviewedAt=now(); state.schedule.lastFailureAt=null;
}
export function reviewDue(state,time=Date.now()) {
  if(!state.schedule.enabled||!state.memories.some(x=>x.status==='active')) return false;
  if(state.schedule.lastFailureAt && time-Date.parse(state.schedule.lastFailureAt)<3600000) return false;
  const since=state.schedule.lastReviewedAt||state.createdAt;
  const newMaterial=state.memories.some(x=>x.status==='active'&&x.createdAt>since);
  const chats=state.chats.filter(c=>c.closedAt&&c.substantive).length-state.schedule.reviewedChatCount;
  return newMaterial&&(chats>=10||time-Date.parse(since)>=7*86400000);
}
