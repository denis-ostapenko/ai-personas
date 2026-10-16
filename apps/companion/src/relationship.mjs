import { temperamentSource } from './temperament.mjs';

// Slow relationship state for one profile. Every change is a stored delta on a
// committed affect event, so forgetting an event can recompute the state exactly.
const config=temperamentSource.relationship;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const round=x=>Number(x.toFixed(4));
export const neutralRelationship=()=>({version:1,affinity:0,trust:0.5,familiarity:0,events:0,updatedAt:null,lastInteractionAt:null});

export function decayRelationship(relationship,time) {
  const r={...neutralRelationship(),...(relationship||{})};
  if(!r.updatedAt)return r;
  const days=Math.max(0,(time-Date.parse(r.updatedAt))/86400000),f=Math.pow(0.5,days/config.halfLifeDays);
  return {...r,affinity:round(r.affinity*f),trust:round(0.5+(r.trust-0.5)*f)};
}
export function relationshipDelta(event,applied) {
  // General affect and cell boosts have no authority to blame or reward the
  // partner. Only the user-attributed projection may change these two measures.
  const r=event?.relational,positive=k=>Math.max(0,r?.impulses?.[k]||0);
  const warm=positive('joy')+positive('amusement')+0.5*positive('empathy'),cold=positive('anger')+positive('hurt');
  const trust=config.trustGain*(r?.trustGain||0)-config.trustLoss*(r?.trustLoss||0);
  return {affinity:round(config.affinityGain*(warm-cold)),trust:round(trust),familiarity:config.familiarityGain};
}
export function applyRelationship(relationship,delta,time) {
  const r=decayRelationship(relationship,time),at=new Date(time).toISOString();
  return {...r,affinity:round(clamp(r.affinity+delta.affinity,-1,1)),trust:round(clamp(r.trust+delta.trust,0,1)),
    familiarity:round(clamp(r.familiarity+delta.familiarity,0,1)),events:r.events+1,updatedAt:at,lastInteractionAt:at};
}
export function rebuildRelationship(events) {
  return [...events].filter(e=>e.relationshipDelta).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
    .reduce((r,e)=>applyRelationship(r,e.relationshipDelta,Date.parse(e.createdAt)),neutralRelationship());
}
export function describeRelationship(r) {
  const band=(x,lo,hi,[a,b,c])=>x<lo?a:x<hi?b:c;
  return {familiarity:band(r.familiarity,0.15,0.5,['new','familiar','well known']),
    affinity:band(r.affinity,-0.15,0.15,['strained','neutral','warm']),
    trust:band(r.trust,0.4,0.6,['guarded','ordinary','high'])};
}
