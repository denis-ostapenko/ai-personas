import { hash } from './core.mjs';
import { ensureRuntime } from './conversation-memory.mjs';

export const terms=text=>new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]));
export function buildGraph(state) {
  const runtime=ensureRuntime(state);
  const memories=state.memories.filter(m=>['active','superseded'].includes(m.status));
  const nodes=memories.map(m=>({id:m.id,kind:'fact',text:m.quote,category:m.category,createdAt:m.createdAt,sourceId:m.sourceId,status:m.status}));
  const edges=[];const known=new Set(nodes.map(n=>n.id));
  for(const ep of runtime.episodes) {
    nodes.push({id:ep.id,kind:'episode',text:`${ep.topic} ${ep.userQuote} ${ep.personaAction}`,createdAt:ep.createdAt,topic:ep.topic,reaction:ep.reaction,salience:ep.salience||0});known.add(ep.id);
    if(!known.has(ep.topicKey)){nodes.push({id:ep.topicKey,kind:'topic',text:ep.topic});known.add(ep.topicKey);}
    edges.push({from:ep.id,to:ep.topicKey,type:'about',weight:0.7});
    for(const mid of ep.memoryIds||[])if(memories.some(m=>m.id===mid))edges.push({from:ep.id,to:mid,type:'uses_fact_version',weight:0.85});
  }
  for(const m of memories)if(m.replacesId&&known.has(m.replacesId))edges.push({from:m.id,to:m.replacesId,type:'supersedes',weight:0.95});
  // A shared source is an association, not an instruction or a correction.
  for(let i=0;i<memories.length;i++)for(let j=i+1;j<memories.length;j++)if(memories[i].sourceId===memories[j].sourceId)edges.push({from:memories[i].id,to:memories[j].id,type:'same_event',weight:0.65});
  edges.push(...runtime.edges.filter(e=>known.has(e.from)&&known.has(e.to)));
  return {nodes,edges};
}
export function activate(state,query,{recallIds=[],limit=18,time=Date.now()}={}) {
  const graph=buildGraph(state),queryTerms=terms(query);
  // Small, bounded bonuses: lexical relevance still dominates; vivid and recent episodes win ties.
  const recency=n=>n.createdAt?1/(1+Math.max(0,time-Date.parse(n.createdAt))/(14*86400000)):0;
  const stop=new Set('the and that this with what when were have about from your you our earlier remember said tell again please would could'.split(' '));
  for(const t of stop)queryTerms.delete(t);
  const frequencies=new Map();for(const n of graph.nodes)for(const t of terms(n.text))frequencies.set(t,(frequencies.get(t)||0)+1);
  const ranked=graph.nodes.filter(n=>n.kind!=='topic').map((node,i)=>{
    const words=terms(node.text),overlap=[...queryTerms].filter(t=>words.has(t)).reduce((sum,t)=>sum+Math.log(1+graph.nodes.length/(frequencies.get(t)||1)),0);
    return {node,score:overlap*10+(node.category==='preference'?3:0)+(node.kind==='fact'?1:0)+(node.kind==='episode'?node.salience*2:0)+recency(node)+i/10000};
  }).sort((a,b)=>b.score-a.score);
  const seeds=[...new Set([...recallIds,...ranked.slice(0,6).map(x=>x.node.id)])].slice(0,10);
  const selected=new Map(seeds.map(s=>[s,{id:s,via:null,depth:0,score:ranked.find(x=>x.node.id===s)?.score||0}]));
  let frontier=seeds;
  for(let depth=1;depth<=2;depth++) {
    const next=[];
    for(const current of frontier) {
      const neighbors=graph.edges.filter(e=>e.from===current||e.to===current).sort((a,b)=>b.weight-a.weight).slice(0,6);
      for(const edge of neighbors){const target=edge.from===current?edge.to:edge.from;if(!selected.has(target)){selected.set(target,{id:target,via:current,depth,type:edge.type,score:edge.weight/depth});next.push(target);}}
    }
    frontier=next;
  }
  const picks=[...selected.values()].filter(x=>graph.nodes.some(n=>n.id===x.id&&n.kind!=='topic')).slice(0,limit);
  // Fill a sparse graph without losing the existing small-store recall behavior.
  for(const r of ranked)if(picks.length<limit&&!picks.some(x=>x.id===r.node.id))picks.push({id:r.node.id,via:null,depth:0,score:r.score});
  let chars=0;const budgeted=picks.filter(p=>{const n=graph.nodes.find(n=>n.id===p.id);const cost=n.text.length+(n.kind==='episode'?state.runtime.episodes.find(e=>e.id===p.id)?.personaAction.length||0:0);if(chars+cost>16000)return false;chars+=cost;return true;});
  const ids=new Set(budgeted.map(x=>x.id));
  return {memories:state.memories.filter(m=>ids.has(m.id)),episodes:state.runtime.episodes.filter(e=>ids.has(e.id)),paths:budgeted,
    candidates:graph.nodes.filter(n=>ids.has(n.id)),counts:{nodes:graph.nodes.length,edges:graph.edges.length},chars};
}
export function addLinks(state,links,user) {
  const runtime=ensureRuntime(state);
  for(const link of links){const key=hash([link.from,link.to,link.type]);if(runtime.edges.some(e=>e.id===key))continue;
    runtime.edges.push({...link,id:key,sourceId:user.id,weight:link.type==='related'?0.65:0.8,provenance:'model_interpretation',createdAt:user.createdAt});}
  // Durable links survive prompt-budget trimming; the store enforces a visible capacity limit.
}
