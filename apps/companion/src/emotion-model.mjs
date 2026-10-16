import { affectChannels, zeroImpulses } from './temperament.mjs';

// Appraisal describes the event; this module decides what the authored
// temperament makes of it. The model never chooses channel impulses directly.
export const featureKeys=['valence','intent','normViolation','disregard','pressure','substantive','contradiction','incongruity','playfulness','novelty','risk','distress','selfDisclosure','repair','praise','repetition'];
const clamp=(x,lo=-1,hi=1)=>Math.max(lo,Math.min(hi,x));
const pos=x=>Math.max(0,x);

function addAll(target,source,scale=1){for(const [k,v] of Object.entries(source||{}))if(k in target)target[k]+=v*scale;}

export function interpretationImpulses(i,t,{anchors=[],relationship=null}={}) {
  const w=t.weights,out=zeroImpulses(),affinity=pos(relationship?.affinity||0);
  const blame=(w.agency[i.agency]??w.agency.none)*(0.4+0.6*i.intent);
  const negative=pos(-i.valence),positive=pos(i.valence),pressure=i.pressure*w.pressure;
  out.anger=blame*Math.max(i.normViolation*w.anger.normViolation,pressure*w.anger.pressure*(1-i.substantive),negative*w.anger.negativeValence)
    +w.anger.repetition*i.repetition*i.pressure-w.anger.repairRelief*i.repair-w.anger.substantiveRelief*i.substantive*i.contradiction;
  out.hurt=(i.target==='persona'?1:0)*i.disregard*(0.5+0.5*i.intent)*w.hurt.disregard*(1-w.hurt.playfulRelief*i.playfulness*(0.5+0.5*affinity))
    -w.hurt.repairRelief*i.repair;
  out.tension=i.risk*w.tension.risk*(1-0.5*i.playfulness)-w.tension.repairRelief*i.repair;
  const damping=1-w.amusement.distressDamping*Math.max(i.distress,i.target==='persona'?i.normViolation:0.5*i.normViolation);
  out.amusement=i.incongruity*w.amusement.incongruity*(w.amusement.playfulnessFloor+(1-w.amusement.playfulnessFloor)*i.playfulness)*damping*(1+w.amusement.affinityBonus*affinity*i.playfulness);
  const hostility=Math.max(i.disregard,i.normViolation)*(1-i.playfulness);
  // Negative events inhibit lingering good spirits; they do not merely add a negative channel beside them.
  out.amusement-=w.amusement.hostilityRelief*hostility;
  out.joy=positive*w.joy.positiveValence+w.joy.justifiedPraise*i.praise*i.substantive+w.joy.repair*i.repair-w.joy.negativeRelief*negative*Math.max(blame,0.3);
  const factor=i.target==='self'?1:i.target==='third_party'?w.empathy.thirdPartyFactor:i.target==='persona'?w.empathy.personaFactor:0.7;
  out.empathy=i.distress*(w.empathy.disclosureFloor+(1-w.empathy.disclosureFloor)*i.selfDisclosure)*w.empathy.distress*factor*(1+w.empathy.affinityBonus*affinity);
  const engagement=Math.max(i.novelty,i.contradiction,i.incongruity);
  out.reflection=engagement<w.reflection.routineThreshold?w.reflection.routineImpulse
    :Math.max(i.novelty*w.reflection.novelty,i.contradiction*i.substantive*w.reflection.contradiction,i.incongruity*(1-i.playfulness)*w.reflection.incongruity);
  // Anchors tie a reaction to what this persona actually values, enjoys or dislikes.
  const byId=new Map(anchors.map(a=>[a.id,a])),kinds=new Set();
  for(const id of i.anchors||[]) {
    const anchor=byId.get(id);if(!anchor)continue;
    if(!kinds.has(anchor.kind)){kinds.add(anchor.kind);const rule=w.anchorKinds[anchor.kind];if(rule){const boost=i.valence<0?rule.whenNegative:rule.whenPositive;addAll(out,boost,boost.anger?Math.max(blame,0.3):1);}}
    addAll(out,w.anchorOverrides[id]);
  }
  for(const k of affectChannels)out[k]=clamp(out[k]);
  return out;
}

export function normalizedInterpretations(appraisal) {
  const list=appraisal?.interpretations||[];
  const total=list.reduce((s,i)=>s+i.weight,0);
  return list.map(i=>({...i,weight:total>0?i.weight/total:1/list.length}));
}

export function eventImpulses(appraisal,t,{anchors=[],relationship=null,gapHours=null,firstTurnInChat=false}={}) {
  const impulses=zeroImpulses(),partnerImpulses=zeroImpulses();
  const interpretations=normalizedInterpretations(appraisal);
  // Keep attribution until after each nonlinear calculation. Combining actors'
  // features first can wrongly attach someone else's wrongdoing to the user.
  const relational={version:1,interpretations:structuredClone(interpretations),impulses:partnerImpulses,trustGain:0,trustLoss:0,conflictImpulse:0,repair:0};
  for(const i of interpretations) {
    const reaction=interpretationImpulses(i,t,{anchors,relationship});
    addAll(impulses,reaction,i.weight);
    if(i.agency!=='user')continue;
    const weight=i.weight*appraisal.confidence;
    addAll(partnerImpulses,reaction,weight);
    relational.trustLoss+=weight*(i.pressure*(1-i.substantive)+i.normViolation);
    relational.trustGain+=weight*(i.substantive*i.contradiction+(i.target==='persona'?i.repair:0));
    if(i.target==='persona') {
      relational.conflictImpulse+=weight*Math.max(0,reaction.anger,reaction.hurt);
      relational.repair+=weight*i.repair;
    }
  }

  for(const k of affectChannels)impulses[k]=clamp(impulses[k]*appraisal.confidence);
  // A reunion after a real pause can be glad, scaled by the shared history.
  const r=t.relationship,affinity=pos(relationship?.affinity||0);
  let reunion=false;
  if(firstTurnInChat&&gapHours!==null&&gapHours>=r.reunionGapHours&&affinity>0.15){impulses.joy=clamp(impulses.joy+r.reunionJoy*affinity);reunion=true;}
  const relevance=Object.fromEntries(affectChannels.map(k=>[k,Math.abs(impulses[k])>=0.05]));
  const summary=Object.fromEntries(featureKeys.filter(k=>k!=='valence').map(k=>[k,Number(normalizedInterpretations(appraisal).reduce((s,i)=>s+i[k]*i.weight,0).toFixed(3))]));
  summary.valence=Number(normalizedInterpretations(appraisal).reduce((s,i)=>s+i.valence*i.weight,0).toFixed(3));
  const anchorsTouched=[...new Set((appraisal.interpretations||[]).flatMap(i=>i.anchors||[]))];
  return {impulses:Object.fromEntries(Object.entries(impulses).map(([k,v])=>[k,Number(v.toFixed(3))])),relevance,features:summary,relational,anchors:anchorsTouched,reunion};
}
