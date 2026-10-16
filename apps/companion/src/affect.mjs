import { hash } from './core.mjs';
import { affectChannels, emotionChannels, zeroImpulses } from './temperament.mjs';

export const reactionVersion='2.1.0';
export const channels=affectChannels;
const clamp=(x,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const round=x=>Number(x.toFixed(3));
const legacyChannels=['anger','amusement','reflection','empathy'];
const triggerKey=(event,k)=>`${event.cellKeys?.[k]||'-'}@${event.topicId||'-'}`;

export function baselineState(t) {
  const values=Object.fromEntries(affectChannels.map(k=>[k,t.channels[k].baseline]));
  return {family:'affect-v2',version:reactionVersion,values,expressed:{},active:[],cognition:{reflection:values.reflection,engaged:false},causes:{},
    mood:{valence:0,arousal:0},conflictOpen:false,conflictStrength:0,recent:[],eventId:null,updatedAt:null};
}
// v0.3 states had four channels and no mood; they are imported once, then decay normally.
export function normalizePrior(previous,t) {
  if(!previous)return baselineState(t);
  if(previous.family==='affect-v2'){const base=baselineState(t);return {...base,...structuredClone(previous),values:{...base.values,...previous.values},mood:previous.mood||base.mood,causes:previous.causes||{},recent:previous.recent||[],conflictStrength:previous.conflictStrength||0,conflictOpen:previous.version===reactionVersion&&!!previous.conflictOpen};}
  const base=baselineState(t);
  for(const k of legacyChannels)if(Number.isFinite(previous.values?.[k]))base.values[k]=clamp(previous.values[k],0,t.channels[k].max);
  base.active=(previous.active||[]).filter(k=>emotionChannels.includes(k));
  base.cognition={reflection:base.values.reflection,engaged:!!previous.cognition?.engaged};
  base.updatedAt=previous.updatedAt||null;base.importedFrom=previous.version||'legacy';
  return base;
}

// One committed event applies once. Time decay, per-turn retention, saturation,
// habituation, rumination and mood are explicit and reproducible from the event log.
export function transition(previous,event,t,eventId,time=Date.now()) {
  if(previous?.family==='affect-v2'&&previous.eventId===eventId)return structuredClone(previous);
  const prior=normalizePrior(previous,t);
  const elapsed=prior.updatedAt?clamp((time-Date.parse(prior.updatedAt))/1000,0,30*86400):0;
  const moodDecay=Math.pow(0.5,elapsed/(t.mood.halfLifeHours*3600));
  const mood={valence:prior.mood.valence*moodDecay,arousal:prior.mood.arousal*moodDecay};
  const recent=prior.recent.filter(r=>time-Date.parse(r.at)<=t.habituation.windowSec*1000);
  const values={},applied={},baseline={};
  for(const k of affectChannels) {
    const c=t.channels[k];
    const base=clamp(c.baseline+(t.mood.baselineCoupling[k]||0)*mood.valence,0,c.max);baseline[k]=round(base);
    let retention=1;
    if(event) {
      const continuing=!!event.topicId&&prior.causes[k]?.topicId===event.topicId&&(event.impulses[k]||0)>=0&&(prior.active.includes(k)||(k==='reflection'&&prior.cognition.engaged));
      const irrelevant=t.rumination.channels.includes(k)&&prior.conflictOpen?Math.max(t.rumination.irrelevantRetention,c.turnRetention.irrelevant):c.turnRetention.irrelevant;
      // Staying on the topic that caused a reaction keeps it a little longer; a new subject lets it fade.
      // An event that undoes a reaction (negative impulse) does not also sustain it.
      const undoing=((event.impulses[k]||0)+(event.cellImpulses?.[k]||0))<-0.05;
      retention=undoing?irrelevant:event.relevance?.[k]?c.turnRetention.relevant:continuing?(c.turnRetention.relevant+irrelevant)/2:irrelevant;
    }
    const old=Number.isFinite(prior.values[k])?prior.values[k]:base;
    let v=base+(old-base)*Math.pow(0.5,elapsed/c.halfLifeSec)*retention;
    if(event) {
      let i=clamp((event.impulses[k]||0)+(event.cellImpulses?.[k]||0),-1,1)*c.sensitivity;
      // Habituation is specific: the same pattern or topic loses force, a new joke does not.
      if(i>0)i*=Math.pow(c.habituation,recent.filter(r=>r.channel===k&&r.key===triggerKey(event,k)).length);
      const before=v;
      v=i>=0?v+i*(c.max-v):v+i*v;
      applied[k]=round(v-before);
    }
    values[k]=round(clamp(v,0,c.max));
  }
  if(event)for(const k of affectChannels)if(((event.impulses[k]||0)+(event.cellImpulses?.[k]||0))>=t.habituation.minImpulse)recent.push({channel:k,key:triggerKey(event,k),at:new Date(time).toISOString()});
  const expressed=Object.fromEntries(emotionChannels.map(k=>[k,round(values[k]*t.channels[k].expressiveness)]));
  const active=emotionChannels.filter(k=>values[k]>=(prior.active.includes(k)?t.channels[k].exit:t.channels[k].enter)).sort((a,b)=>expressed[b]-expressed[a]).slice(0,2);
  const r=t.channels.reflection,engaged=values.reflection>=(prior.cognition.engaged?r.exit:r.enter);
  const causes={};
  for(const k of affectChannels) {
    const live=active.includes(k)||(k==='reflection'&&engaged);
    const raw=event?(event.impulses[k]||0)+(event.cellImpulses?.[k]||0):0;
    if(event&&raw>=0.15&&event.evidenceQuote)causes[k]={eventId,topicId:event.topicId||null,quote:event.evidenceQuote.slice(0,240),anchors:event.anchors||[],at:new Date(time).toISOString()};
    else if(live&&prior.causes[k])causes[k]=prior.causes[k];
  }
  // Interpersonal friction has its own decaying state. Moral anger at an
  // outsider neither opens nor sustains it, and an outsider's apology cannot
  // repair it. Unattributed legacy friction is cleared on the first transition.
  const {conflictOpen,conflictStrength}=transitionConflict(prior,event,t,elapsed);
  if(event) {
    const targetValence=clamp((values.joy+values.amusement+0.3*values.empathy-values.anger-values.hurt-values.tension)/1.5,-1,1);
    const targetArousal=clamp((values.anger+values.tension+values.amusement+values.joy)/2,0,1);
    mood.valence+=t.mood.gain*(targetValence-mood.valence);mood.arousal+=t.mood.gain*(targetArousal-mood.arousal);
  }
  return {family:'affect-v2',version:reactionVersion,values,expressed,baseline,applied,active,cognition:{reflection:values.reflection,engaged},causes,
    mood:{valence:round(mood.valence),arousal:round(mood.arousal)},conflictOpen,conflictStrength,recent:recent.slice(-24),eventId,updatedAt:new Date(time).toISOString(),
    temperamentVersion:t.version,temperamentHash:hash(t),...(prior.importedFrom?{importedFrom:prior.importedFrom}:{})};
}
// Reusable for selective forgetting: replay only attributable friction, not
// all emotions or unrelated memory, after removing the contributing events.
export function transitionConflict(prior,event,t,elapsed=0) {
  const c=t.channels.anger,rel=event?.relational;
  let conflictStrength=(prior.conflictStrength||0)*Math.pow(0.5,elapsed/c.halfLifeSec);
  if(event) {
    conflictStrength*=rel?.conflictImpulse>0.1?c.turnRetention.relevant:c.turnRetention.irrelevant;
    const impulse=clamp(rel?.conflictImpulse||0)*c.sensitivity;
    conflictStrength+=impulse*(c.max-conflictStrength);
    if((rel?.repair||0)>=0.5)conflictStrength=0;
    else conflictStrength*=1-clamp(rel?.repair||0);
  }
  conflictStrength=round(clamp(conflictStrength,0,c.max));
  const conflictOpen=conflictStrength>=(prior.conflictOpen?c.exit:c.enter);
  return {conflictOpen,conflictStrength};
}
// Read-only view for display or context: elapsed-time recovery without an event.
export const peek=(previous,t,time=Date.now())=>previous?{...transition(previous,null,t,`peek:${time}`,time),eventId:previous.eventId||null}:baselineState(t);
// A turn whose interpretation failed still passes; everything decays as if relevant.
export const blindEvent=()=>({impulses:zeroImpulses(),relevance:Object.fromEntries(affectChannels.map(k=>[k,true])),features:{},anchors:[]});
