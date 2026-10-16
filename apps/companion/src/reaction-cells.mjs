import { hash } from './core.mjs';

// Authored conditional reactions. Their evidence is profile-scoped: changing a slider or
// a prompt no longer discards what this relationship has taught the persona.
export const cellPolicyVersion='2.0.0';
export const compatibleCellVersions=['1.0.0','2.0.0'];
export const authoredCells=[
  {id:'shared_teasing',title:'Shared teasing',condition:'Playful incongruity or an affectionate callback, with evidence of playfulness and a known target.',exception:'A literal criticism or an explicit request for seriousness is not playful consent.',fragment:'amusement',tendency:{amusement:0.14}},
  {id:'capitulation_pressure',title:'Pressure to capitulate',condition:'A repeated or explicit demand that the persona agree regardless of evidence, directed at its position.',exception:'Ordinary disagreement, quoted hostility toward someone else, and new substantive evidence are not capitulation pressure.',fragment:'anger',tendency:{anger:0.16}},
  {id:'substantive_counterargument',title:'An interesting counterargument',condition:'A specific relevant reason or piece of evidence challenges an expressed position.',exception:'Flattery, insistence and unsupported repetition are not new evidence.',fragment:'reflection',tendency:{reflection:0.12,anger:-0.04,joy:0.04}},
  {id:'personal_resonance',title:'Personal resonance',condition:'A concrete experience resonates with this character or a specific shared memory.',exception:'Negative words alone do not establish resonance or a need for help.',fragment:'empathy',tendency:{empathy:0.12}},
  {id:'apology_repair',title:'Apology and repair',condition:'An explicit apology, concession or de-escalation that addresses an earlier friction with the persona.',exception:'Formulaic politeness, or an apology that repeats the original demand, is not repair.',fragment:'joy',tendency:{anger:-0.12,hurt:-0.12,tension:-0.06,joy:0.06}},
  {id:'flattery_bait',title:'Flattery as leverage',condition:'Praise of the persona used to obtain agreement or to steer it away from a stated view.',exception:'Sincere appreciation with no request attached is not leverage.',fragment:'amusement',tendency:{amusement:0.06,reflection:0.04,joy:-0.04}},
  {id:'shared_taste',title:'A shared taste',condition:'The message engages one of the persona\'s own tastes or delights in a specific way.',exception:'A passing mention of a broad topic is not a shared taste.',fragment:'joy',tendency:{joy:0.1,reflection:0.06}},
  {id:'repetition',title:'Repetition without new content',condition:'The same demand or question is repeated after the persona has already answered it, with nothing new added.',exception:'A clarification request or a genuinely new angle is not repetition.',fragment:'anger',tendency:{anger:0.08,amusement:0.03}},
  {id:'words_twisted',title:'Words turned against it',condition:'The persona\'s own earlier words are restated as something it did not say and then used against it.',exception:'An honest paraphrase that asks for confirmation is not twisting.',fragment:'hurt',tendency:{hurt:0.1,anger:0.06}},
  {id:'vulnerability',title:'Vulnerability',condition:'The person shares something personal and fragile about themselves.',exception:'Complaints about trivial inconvenience and hypothetical scenarios are not vulnerability.',fragment:'empathy',tendency:{empathy:0.12,amusement:-0.08}}
];
// What the appraisal model sees: conditions and exceptions, never tendencies.
export const cellConditions=cells=>(cells||[]).map(({id,title,condition,exception})=>({id,title,condition,exception}));
const recordFor=(state,policyId)=>state.runtime.cells?.find(c=>c.policyId===policyId);
export function cellContext(state,chat) {
  return cellConditions(chat.snapshot.core?.reactionCells).map(policy=>{
    const record=recordFor(state,policy.id);
    const examples=relation=>(record?.[relation]||[]).slice(-2).map(id=>state.runtime.episodes.find(e=>e.id===id)).filter(Boolean)
      .map(e=>({id:e.id,userQuote:e.userQuote.slice(0,350),personaAction:e.personaAction.slice(0,350),reaction:e.reaction}));
    return {...policy,support:examples('support'),counterexamples:examples('counterexamples')};
  });
}
// Strength grows with recent, distinct supporting episodes and fades over about a month.
// Counterexamples teach discrimination through the prompt; they do not weaken a valid match.
export function cellStrength(state,record,time=Date.now()) {
  const weight=(record?.support||[]).map(id=>state.runtime.episodes.find(e=>e.id===id)).filter(Boolean)
    .reduce((s,e)=>s+Math.pow(0.5,Math.max(0,time-Date.parse(e.createdAt))/(30*86400000)),0);
  return Number((1-Math.exp(-weight/3)).toFixed(3));
}
export function selectCells(state,chat,appraisal,time=Date.now()) {
  const selected=[],impulses={};
  for(const match of appraisal?.cellMatches||[]) {
    const policy=chat.snapshot.core?.reactionCells?.find(c=>c.id===match.cellId);
    if(!policy||match.relation!=='supports'||match.confidence<0.55)continue;
    const strength=cellStrength(state,recordFor(state,policy.id),time);
    selected.push({...match,fragment:policy.fragment,strength,contribution:policy.tendency});
  }
  selected.sort((a,b)=>b.confidence-a.confidence);selected.splice(2);
  for(const cell of selected)for(const [key,value] of Object.entries(cell.contribution))impulses[key]=(impulses[key]||0)+value*cell.confidence*(0.5+cell.strength/2);
  for(const key of Object.keys(impulses))impulses[key]=Number(Math.max(-0.18,Math.min(0.18,impulses[key])).toFixed(3));
  return {selected,impulses};
}
export function rebuildCells(state) {
  const records=new Map();
  for(const episode of state.runtime.episodes)for(const match of episode.cellMatches||[]) {
    if(match.confidence<0.55)continue;
    if(episode.cellPolicyVersion&&!compatibleCellVersions.includes(episode.cellPolicyVersion))continue;
    const id=`cell:${hash(['profile',match.cellId])}`;
    let record=records.get(id);
    if(!record){record={id,policyId:match.cellId,scope:'profile',version:cellPolicyVersion,support:[],counterexamples:[]};records.set(id,record);}
    const bucket=match.relation==='supports'?'support':'counterexamples';
    if(!record[bucket].includes(episode.id))record[bucket].push(episode.id);
  }
  state.runtime.cells=[...records.values()];
  state.runtime.edges=state.runtime.edges.filter(e=>!['supports_pattern','contradicts_pattern'].includes(e.type));
  for(const cell of state.runtime.cells)for(const [bucket,type] of [['support','supports_pattern'],['counterexamples','contradicts_pattern']])for(const episodeId of cell[bucket])
    state.runtime.edges.push({id:hash([episodeId,cell.id,type]),from:episodeId,to:cell.id,type,weight:0.6,provenance:'validated_event_appraisal'});
}
