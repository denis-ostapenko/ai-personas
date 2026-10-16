import { id,hash,AppError } from './core.mjs';
import { rebuildCells,cellPolicyVersion } from './reaction-cells.mjs';
import { rebuildRelationship } from './relationship.mjs';
import { transitionConflict } from './affect.mjs';
import { resolveTemperament } from './temperament.mjs';
function rebuildFriction(events,affect) {
  if(!affect)return;
  let prior={conflictOpen:false,conflictStrength:0},last=null;
  for(const event of [...events].sort((a,b)=>a.createdAt.localeCompare(b.createdAt))) {
    const time=Date.parse(event.createdAt),elapsed=last===null?0:Math.max(0,(time-last)/1000);
    prior=transitionConflict(prior,{relational:event.relational},resolveTemperament(event.settings),elapsed);last=time;
  }
  if(last!==null&&affect.updatedAt)prior=transitionConflict(prior,null,resolveTemperament(events.at(-1)?.settings),Math.max(0,(Date.parse(affect.updatedAt)-last)/1000));
  Object.assign(affect,prior);
}

export function ensureRuntime(state) {
  state.runtime??={version:1,conversations:{},episodes:[],edges:[],affectByCore:{}};
  state.runtime.version=3;state.runtime.cells??=[];state.runtime.forgottenFingerprints??=[];state.runtime.affectEvents??=[];
  return state.runtime;
}
export function workingMemory(state,chatId) {
  return ensureRuntime(state).conversations[chatId]??{topics:[],activeTopicId:null};
}
export function workingView(state,chatId) {
  const work=workingMemory(state,chatId);
  return {activeTopicId:work.activeTopicId,topics:work.topics.map(t=>({id:t.id,title:t.title,status:t.status,entries:t.entries.filter(e=>e.status==='active')}))};
}
export function updateWorking(state,chat,user,appraisal) {
  const runtime=ensureRuntime(state),work=runtime.conversations[chat.id]??={topics:[],activeTopicId:null};
  const current=work.topics.find(t=>t.id===work.activeTopicId)||null;
  if(!appraisal)return current;
  let topic=appraisal.topic?work.topics.find(t=>t.id===appraisal.topic.existingId):current;
  if(!topic&&appraisal.topic){
    // Reuse a matching title, but never merge records solely by lexical overlap.
    topic=work.topics.find(t=>t.title.toLowerCase()===appraisal.topic.title.toLowerCase());
    if(!topic){topic={id:id(),title:appraisal.topic.title,titleSourceId:user.id,status:'active',entries:[],createdAt:user.createdAt};work.topics.push(topic);}
  }
  if(!topic){topic={id:id(),title:'Conversation',titleSourceId:null,status:'active',entries:[],createdAt:user.createdAt};work.topics.push(topic);}
  for(const t of work.topics)if(t.id!==topic.id&&t.status==='active')t.status='suspended';
  topic.status='active';topic.updatedAt=user.createdAt;work.activeTopicId=topic.id;
  const replaced=new Set([...appraisal.resolvedIds,...appraisal.working.map(x=>x.replacesId).filter(Boolean)]);
  for(const t of work.topics)for(const e of t.entries)if(replaced.has(e.id))e.status='resolved';
  for(const entry of appraisal.working)if(!topic.entries.some(e=>e.status==='active'&&e.quote===entry.quote))topic.entries.push({...entry,id:id(),sourceId:user.id,sourceRole:'user',status:'active',createdAt:user.createdAt,scope:'chat'});
  // Capacity is explicit: fail before persisting rather than losing open questions.
  if(work.topics.length>24||work.topics.reduce((n,t)=>n+t.entries.filter(e=>e.status==='active').length,0)>80)throw new AppError(413,'working_memory_limit','This conversation has reached its working-memory limit. Start a new chat; saved memories will carry over.');
  return topic;
}

// Forgetting safeguards. Fingerprints are prefixed by kind:
//   t: a word trigram containing at least one content word
//   p: a whole short phrase (fewer than three words)
//   e: a named entity (capitalized, not a common sentence word); Cyrillic names by stem
//   n: a number together with its neighbouring content word
// Unprefixed entries come from v0.3 and are matched as trigrams, phrases or entities only.
// A match is "strong" when it identifies forgotten content; strong matches are masked in
// context and new episodes, and episodes that contain them are removed at forget time.
const STOP=new Set(`the a an i me my mine our ours your yours his her hers their it its we you he she they them this that these those
on in at to of for from with by and but or so if when then than as is are was were be been am do does did have has had not no yes ok okay
please thanks thank hello hi today yesterday tomorrow now also just well actually sure maybe there here after before because what why how who
where which let lets about into over again still very really want wanted like need going think know said say tell remember
monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december
я мы ты вы он она оно они меня мне мной нас нам нами вас вам вами ему им ими ей ею нему ним ней неё мой моя моё мое мои мою моего моей моему моим моих моими наш наша наше наши нашу нашего нашей нашему нашим наших ваш ваша ваше ваши вашу вашего вашей вашим ваших твой твоя твоё твои твою твоего твоей свой своя своё свои свою своего своей своих его её ее их это этот эта эти этого этой этим этих то тот та те того той тем тех здесь там тут вот всё все весь вся
так да нет но и а в на с со по к ко у о об от до из за для при над под про же ли бы не ни что как почему где кто когда если потом тогда ну вот сейчас теперь
ещё еще уже просто кстати сегодня вчера завтра привет спасибо пожалуйста ладно хорошо очень тоже также был была было были есть будет хочу хочешь
понедельник вторник среда среду четверг пятница пятницу суббота субботу воскресенье январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь`.split(/\s+/));
const MASK='[forgotten detail]';
const tokenize=text=>[...(text||'').matchAll(/[\p{L}\p{N}]+/gu)].map(m=>({raw:m[0],lower:m[0].toLocaleLowerCase(),start:m.index,end:m.index+m[0].length}));
const isNumber=w=>/^\p{N}+$/u.test(w);
const isContent=w=>!STOP.has(w)&&w.length>=3&&!isNumber(w);
const isCyrillic=w=>/\p{Script=Cyrillic}/u.test(w);
const stem=w=>isCyrillic(w)?w.slice(0,Math.max(3,w.length-2)):w;
const isEntity=t=>/^\p{Lu}[\p{Ll}\p{M}]{2,}$/u.test(t.raw)&&!STOP.has(t.lower);
function fingerprints(text) {
  const tokens=tokenize(text),words=tokens.map(t=>t.lower),values=new Set();
  if(words.length&&words.length<3)values.add(`p:${hash(words.join(' '))}`);
  for(let i=0;i+2<words.length;i++)if(words.slice(i,i+3).some(isContent))values.add(`t:${hash(words.slice(i,i+3).join(' '))}`);
  for(const t of tokens)if(isEntity(t))values.add(`e:${hash(stem(t.lower))}`);
  for(let i=0;i<words.length;i++)if(isNumber(words[i]))for(const j of [i-1,i+1])if(words[j]&&isContent(words[j]))values.add(`n:${hash(`${words[i]} ${words[j]}`)}`);
  return [...values];
}
// Identify the token positions of forgotten content in a text.
export function forgottenMatches(state,text) {
  const excluded=new Set(ensureRuntime(state).forgottenFingerprints);
  if(!excluded.size||!text)return {strong:false,positions:new Set()};
  const tokens=tokenize(text),words=tokens.map(t=>t.lower),positions=new Set();
  const has=(prefix,value)=>excluded.has(`${prefix}:${value}`)||excluded.has(value);
  let strong=false,trigrams=0;const trigramPositions=[];
  if(words.length&&words.length<3&&has('p',hash(words.join(' ')))){strong=true;words.forEach((_,i)=>positions.add(i));}
  for(let i=0;i+2<words.length;i++)if(has('t',hash(words.slice(i,i+3).join(' ')))){trigrams++;trigramPositions.push(i,i+1,i+2);}
  if(trigrams>=2){strong=true;trigramPositions.forEach(i=>positions.add(i));}
  tokens.forEach((t,i)=>{
    const entity=excluded.has(`e:${hash(stem(t.lower))}`)||(/^\p{Lu}/u.test(t.raw)&&!STOP.has(t.lower)&&excluded.has(hash(t.lower)));
    if(entity&&!isNumber(t.lower)){strong=true;positions.add(i);}
  });
  for(let i=0;i<words.length;i++)if(isNumber(words[i]))for(const j of [i-1,i+1])if(words[j]&&excluded.has(`n:${hash(`${words[i]} ${words[j]}`)}`)){strong=true;positions.add(i);positions.add(j);}
  return {strong,positions,tokens};
}
export const hasForgottenText=(state,text)=>forgottenMatches(state,text).strong;
export function maskForgotten(state,text) {
  const {strong,positions,tokens}=forgottenMatches(state,text);
  if(!strong||!positions.size)return text;
  const runs=[];
  for(const p of [...positions].sort((a,b)=>a-b)){const last=runs.at(-1);if(last&&p===last[1]+1)last[1]=p;else runs.push([p,p]);}
  let out='',cursor=0;
  for(const [a,b] of runs){out+=text.slice(cursor,tokens[a].start)+MASK;cursor=tokens[b].end;}
  return out+text.slice(cursor);
}
export function releaseForgotten(state,quote) {
  const supplied=new Set(fingerprints(quote).flatMap(f=>[f,f.slice(2)]));
  ensureRuntime(state).forgottenFingerprints=state.runtime.forgottenFingerprints.filter(h=>!supplied.has(h));
}
export function recentContext(state,chat,limit) {
  const blocked=new Set(ensureRuntime(state).excludedEventIds||[]);
  return chat.messages.slice(-limit).filter(m=>!blocked.has(m.id)).map(m=>({role:m.role,content:maskForgotten(state,m.text)}));
}
export function addEpisode(state,chat,user,reply,{topic,appraisal,affect,memoryIds=[],inputMemoryIds=[],references=[],sourceReferences=[],signal='uncertain'}) {
  if(!chat.remember)return;
  const runtime=ensureRuntime(state);
  if(runtime.episodes.some(e=>e.id===`episode:${user.id}`))return;
  // Never inherit exclusion merely because an older turn was forgotten; mask the detail itself.
  const userQuote=maskForgotten(state,user.text),personaAction=maskForgotten(state,reply.text);
  if(!userQuote.trim()&&!personaAction.trim())return;
  const values=affect?.values||{};
  const salience=Number(Math.max(0,...Object.entries(values).filter(([k])=>k!=='reflection').map(([,v])=>v)).toFixed(3));
  const episode={id:`episode:${user.id}`,sourceId:user.id,chatId:chat.id,createdAt:user.createdAt,
    topic:topic?.title||'Conversation',topicKey:`topic:${hash((topic?.title||'Conversation').toLowerCase()).slice(0,20)}`,
    userQuote,personaAction,replyId:reply.id,delivery:'committed_text_reply',
    signal,signalEvidence:appraisal?.evidenceQuote?maskForgotten(state,appraisal.evidenceQuote):'',observedFeedback:[],
    reaction:affect?.active||[],cognition:affect?.cognition||null,values:{...values},salience,memoryIds:[...new Set(memoryIds)],
    inputMemoryIds:[...new Set(inputMemoryIds)],references,sourceReferences,coreHash:chat.snapshot.coreHash,cellPolicyVersion,
    cellMatches:appraisal?.cellMatches||[],
    previousEpisodeId:runtime.episodes.filter(e=>e.chatId===chat.id).at(-1)?.id||null};
  const previous=runtime.episodes.find(e=>e.id===episode.previousEpisodeId);
  if(previous)previous.observedFeedback=[...(Array.isArray(previous.observedFeedback)?previous.observedFeedback:[]),{eventId:user.id,quote:userQuote,relation:'subsequent_turn',causalInterpretation:null}];
  runtime.episodes.push(episode);
  for(const ref of episode.references)runtime.edges.push({id:hash([episode.id,ref.id,ref.quote]),from:episode.id,to:ref.id,type:ref.id.startsWith('episode:')?'callback_to':'uses_fact_version',weight:0.85,quote:ref.quote,sourceId:reply.id,provenance:'validated_output_reference'});
  rebuildCells(state);
}
export function pruneDerived(state,removed) {
  const runtime=ensureRuntime(state),ids=new Set(removed.map(m=>m.id)),sources=new Set(removed.map(m=>m.sourceId));
  runtime.forgottenFingerprints=[...new Set([...runtime.forgottenFingerprints,...removed.flatMap(m=>fingerprints(m.quote))])];
  const gone=new Set(runtime.episodes.filter(e=>(e.memoryIds||[]).some(x=>ids.has(x))||(e.sourceReferences||[]).some(r=>sources.has(r.id))||sources.has(e.sourceId)||hasForgottenText(state,e.userQuote)||hasForgottenText(state,e.personaAction)).map(e=>e.id));
  // Explicit output references cascade; contextual neighbors do not.
  let changed=true;while(changed){changed=false;for(const e of runtime.episodes)if(!gone.has(e.id)&&(e.references||[]).some(r=>gone.has(r.id))){gone.add(e.id);changed=true;}}
  const goneEvents=new Set([...sources,...runtime.episodes.filter(e=>gone.has(e.id)).flatMap(e=>[e.sourceId,e.replyId])]);
  runtime.excludedEventIds=[...new Set([...(runtime.excludedEventIds||[]),...goneEvents])];
  runtime.episodes=runtime.episodes.filter(e=>!gone.has(e.id));
  for(const e of runtime.episodes){if(gone.has(e.previousEpisodeId))e.previousEpisodeId=null;e.inputMemoryIds=(e.inputMemoryIds||[]).filter(x=>!ids.has(x));e.observedFeedback=(Array.isArray(e.observedFeedback)?e.observedFeedback:[]).filter(f=>!sources.has(f.eventId)&&!hasForgottenText(state,f.quote)).map(f=>({...f,quote:maskForgotten(state,f.quote)}));}
  runtime.edges=runtime.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to)&&!gone.has(e.from)&&!gone.has(e.to)&&!sources.has(e.sourceId));
  for(const work of Object.values(runtime.conversations)) {
    for(const topic of work.topics) {
      topic.entries=topic.entries.filter(e=>!hasForgottenText(state,e.quote));
      if(hasForgottenText(state,topic.title)){topic.title='Earlier topic';topic.titleSourceId=null;}
    }
    if(work.affectEvents){const count=work.affectEvents.length;work.affectEvents=work.affectEvents.filter(e=>!goneEvents.has(e.sourceId));if(work.affectEvents.length!==count)rebuildFriction(work.affectEvents,work.affect);}
    if(work.affect?.causes)for(const [k,c] of Object.entries(work.affect.causes))if(goneEvents.has(c.eventId)||hasForgottenText(state,c.quote))delete work.affect.causes[k];
  }
  // Affect events derived from removed turns go, and the relationship is recomputed without them.
  const before=runtime.affectEvents.length;
  runtime.affectEvents=runtime.affectEvents.filter(e=>!goneEvents.has(e.sourceId));
  if(runtime.affectEvents.length!==before){runtime.relationship=rebuildRelationship(runtime.affectEvents);rebuildFriction(runtime.affectEvents,runtime.affect);}
  if(runtime.affect?.causes)for(const [k,c] of Object.entries(runtime.affect.causes))if(goneEvents.has(c.eventId)||hasForgottenText(state,c.quote))delete runtime.affect.causes[k];
  rebuildCells(state);
}
