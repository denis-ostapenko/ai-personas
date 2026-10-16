import { id, now, fail } from './core.mjs';
import { pruneDerived, releaseForgotten } from './conversation-memory.mjs';
export const categories=['user_fact','interest','preference','goal','shared_convention'];
const normalize=s=>s.toLocaleLowerCase().replace(/\s+/g,' ').trim();
export function addMemory(state,{quote,category,sourceId,sourceType,replacesId=''}) {
  if(!categories.includes(category) || typeof quote!=='string' || quote.length<2 || quote.length>2000) fail('Invalid memory record.');
  const old=replacesId?state.memories.find(m=>m.id===replacesId):null;
  if(replacesId&&!old) fail('The memory being corrected no longer exists.',409,'stale_memory');
  const duplicate=state.memories.find(m=>m.status==='active'&&normalize(m.quote)===normalize(quote));
  if(duplicate&&!old) return duplicate;
  if(state.memories.filter(m=>m.status==='active').length>=120&&!old) fail('The active memory limit is 120 entries. Organize or remove a memory first.');
  if(old) { old.status='superseded'; old.supersededAt=now(); }
  releaseForgotten(state,quote);
  const record={id:id(),quote,category,sourceId,sourceType,createdAt:now(),status:'active',replacesId};
  if(old){
    old.supersededBy=record.id;
    for(const work of Object.values(state.runtime.conversations))for(const topic of work.topics)for(const entry of topic.entries)
      if(entry.status==='active'&&entry.sourceId===old.sourceId&&(old.quote.includes(entry.quote)||entry.quote.includes(old.quote))){entry.status='resolved';entry.supersededBy=record.id;}
  }
  record.recordedAt=record.createdAt;record.updateKind=old?'correction_or_update':'assertion';
  state.memories.push(record); return record;
}
export function applyCandidates(state,candidates,userMessage) {
  if(!Array.isArray(candidates)||candidates.length>4) fail('Too many memory candidates.',502,'invalid_memory');
  const activeIds=new Set(state.memories.filter(m=>m.status==='active').map(m=>m.id));
  const replaced=new Set();
  for(const c of candidates) {
    if(typeof c.quote!=='string'||c.quote.trim().length<2||!userMessage.text.includes(c.quote)||c.quote.length>1200) fail('A proposed memory has no exact source quote.',502,'ungrounded_memory');
    if(c.replacesId && (!activeIds.has(c.replacesId)||replaced.has(c.replacesId))) fail('A memory correction has no current source.',502,'ungrounded_memory');
    if(c.replacesId) replaced.add(c.replacesId);
  }
  for(const c of candidates) addMemory(state,{...c,sourceId:userMessage.id,sourceType:'chat'});
  return candidates.length;
}
export function retrieve(state,query,limit=18) {
  const tokens=new Set((query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]));
  return state.memories.filter(m=>m.status==='active').map((m,index)=>{
    const terms=new Set(m.quote.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
    const overlap=[...tokens].filter(t=>terms.has(t)).length;
    return {m,score:overlap*10+(m.category==='preference'?3:0)+(m.sourceType==='onboarding'?1:0)+index/1000};
  }).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.m);
}
export function refreshGroups(state) {
  const active=new Set(state.memories.filter(m=>m.status==='active').map(m=>m.id));
  state.documents.groups=state.documents.groups.map(g=>({...g,memoryIds:g.memoryIds.filter(x=>active.has(x))})).filter(g=>g.memoryIds.length);
  const covered=new Set(state.documents.groups.flatMap(g=>g.memoryIds));
  const missing=[...active].filter(x=>!covered.has(x));
  if(missing.length) {
    const unsorted=state.documents.groups.find(g=>g.topic==='Unsorted');
    if(unsorted)unsorted.memoryIds.push(...missing);else state.documents.groups.push({topic:'Unsorted',memoryIds:missing});
  }
  state.documents.proposals=state.documents.proposals.filter(p=>p.memoryIds.every(x=>active.has(x)));
}
// Forget persistent evidence, not its conversation archive. A source message may
// contain several independent facts, so only explicit correction links cascade.
export function forgetMemory(state,memoryId) {
  const target=state.memories.find(m=>m.id===memoryId);
  if(!target) fail('Memory not found.',404);
  const removed=new Set([target.id]); let expanded=true;
  while(expanded) {
    expanded=false;
    for(const m of state.memories) {
      if(removed.has(m.replacesId)&&!removed.has(m.id)) { removed.add(m.id); expanded=true; }
      if(removed.has(m.id)&&m.replacesId&&!removed.has(m.replacesId)) { removed.add(m.replacesId); expanded=true; }
    }
  }
  const removedCount=state.memories.filter(m=>removed.has(m.id)).length;
  pruneDerived(state,state.memories.filter(m=>removed.has(m.id)));
  state.memories=state.memories.filter(m=>!removed.has(m.id));
  // Review snapshots contain references, not source quotes. Prune affected
  // references so rollback cannot restore them; keep unrelated review history.
  for(const doc of [state.documents,...state.documentHistory]) {
    doc.groups=doc.groups.map(g=>({...g,memoryIds:g.memoryIds.filter(x=>!removed.has(x))})).filter(g=>g.memoryIds.length);
    doc.proposals=doc.proposals.filter(p=>!p.memoryIds.some(x=>removed.has(x)));
  }
  state.documents.version++; state.documents.updatedAt=now();
  return {removedCount};
}
