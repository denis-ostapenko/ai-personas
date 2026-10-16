import { readFileSync } from 'node:fs';
import { object,array,string,enumeration,validate,AppError } from './core.mjs';
import { featureKeys } from './emotion-model.mjs';
export const appraisalPrompt=readFileSync(new URL('../prompts/appraisal.md',import.meta.url),'utf8');
export const appraisalVersion='2.0.0';
const unit={type:'number',minimum:0,maximum:1};
const signed={type:'number',minimum:-1,maximum:1};
const interpretation=object({
  weight:unit,target:enumeration(['persona','self','third_party','situation','unknown']),agency:enumeration(['user','persona','other','none']),
  ...Object.fromEntries(featureKeys.map(k=>[k,k==='valence'?signed:unit])),anchors:array(string)
});
export const appraisalSchema=object({
  signal:enumeration(['neutral','positive','irritation','anger','distress','interest','mixed','uncertain']),
  evidenceQuote:string,confidence:unit,interpretations:array(interpretation),
  topic:object({existingId:string,title:string}),
  working:array(object({kind:enumeration(['decision','open_question','preference','position']),quote:string,replacesId:string})),
  resolvedIds:array(string),recallIds:array(string),
  links:array(object({from:string,to:string,type:enumeration(['related','supports','contradicts']),quote:string})),
  cellMatches:array(object({cellId:string,evidenceQuote:string,confidence:unit,relation:enumeration(['supports','contradicts'])})),
  recallQuery:string
});
const neutralInterpretation=()=>({weight:1,target:'unknown',agency:'none',...Object.fromEntries(featureKeys.map(k=>[k,0])),anchors:[]});
export const neutralAppraisal=()=>({signal:'uncertain',evidenceQuote:'',confidence:0,interpretations:[neutralInterpretation()],topic:{existingId:'',title:''},working:[],resolvedIds:[],recallIds:[],links:[],cellMatches:[],recallQuery:''});
export const interpretationOf=(values={})=>({...neutralInterpretation(),...values});
export const primaryTarget=appraisal=>[...(appraisal?.interpretations||[])].sort((a,b)=>b.weight-a.weight)[0]?.target||'unknown';

// The emotional core of an appraisal must be valid: a schema match, exact evidence and
// one or two interpretations. Structural extras are filtered item by item, so one bad
// graph link no longer discards the whole interpretation.
export function validateAppraisal(value,message,{topics=[],entries=[],nodes=[],cells=[],anchors=[]}={}) {
  const bad=detail=>{throw new AppError(502,'invalid_appraisal',`The event interpretation failed its evidence checks${detail?`: ${detail}`:''}.`);};
  try {validate(appraisalSchema,value);}catch{bad('schema');}
  if(!value.evidenceQuote.trim()||value.evidenceQuote.length>1600||!message.includes(value.evidenceQuote))bad('evidence');
  if(!value.interpretations.length||value.interpretations.length>2)bad('interpretations');
  const dropped=[],keep=(list,ok,label)=>list.filter(x=>{const pass=ok(x);if(!pass)dropped.push(label);return pass;});
  const anchorIds=new Set(anchors.map(a=>a.id));
  const interpretations=value.interpretations.map(i=>({...i,anchors:[...new Set(keep(i.anchors,id=>anchorIds.has(id),'anchor'))].slice(0,6)}));
  let topic=value.topic;
  if(topic.existingId&&!topics.some(t=>t.id===topic.existingId)){dropped.push('topic_id');topic={existingId:'',title:topic.title};}
  if(topic.title.length>100){dropped.push('topic_title');topic={...topic,title:topic.title.slice(0,100)};}
  if(!topic.existingId&&!topic.title.trim())topic=null;
  const ids=new Set(entries.map(e=>e.id));
  const nodeIds=new Set([...nodes,...cells.flatMap(c=>[...(c.support||[]),...(c.counterexamples||[])])].map(n=>n.id));
  const resolved=[...new Set(keep(value.resolvedIds,x=>ids.has(x),'resolved_id'))].slice(0,4),touched=new Set(resolved);
  const working=keep(value.working,w=>{
    if(w.quote.trim().length<2||w.quote.length>1000||!message.includes(w.quote))return false;
    if(w.replacesId){if(!ids.has(w.replacesId)||touched.has(w.replacesId))return false;touched.add(w.replacesId);}
    return true;
  },'working').slice(0,4);
  const recallIds=[...new Set(keep(value.recallIds,x=>nodeIds.has(x),'recall_id'))].slice(0,6);
  const links=keep(value.links,l=>nodeIds.has(l.from)&&nodeIds.has(l.to)&&l.from!==l.to&&l.quote.trim().length>=2&&l.quote.length<=1000&&message.includes(l.quote),'link').slice(0,4);
  const seen=new Set();
  const cellMatches=keep(value.cellMatches,c=>{
    if(seen.has(c.cellId)||!cells.some(p=>p.id===c.cellId)||!c.evidenceQuote.trim()||c.evidenceQuote.length>1000||!message.includes(c.evidenceQuote))return false;
    seen.add(c.cellId);return true;
  },'cell_match').slice(0,4);
  return {...value,interpretations,topic,working,resolvedIds:resolved,recallIds,links,cellMatches,recallQuery:value.recallQuery.slice(0,240),dropped};
}
