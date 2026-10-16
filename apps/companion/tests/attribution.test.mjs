import test from 'node:test';
import assert from 'node:assert/strict';
import { eventImpulses } from '../src/emotion-model.mjs';
import { interpretationOf } from '../src/appraisal.mjs';
import { transition } from '../src/affect.mjs';
import { relationshipDelta } from '../src/relationship.mjs';
import { resolveTemperament } from '../src/temperament.mjs';
import { defaults } from '../src/character.mjs';
const t=resolveTemperament(defaults),at=Date.parse('2026-10-14T12:00:00Z');
const wrong={target:'third_party',agency:'other',valence:-0.8,intent:1,normViolation:1,pressure:0.8};
const direct={...wrong,target:'persona',agency:'user',disregard:0.8};
const event=(parts,confidence=1)=>({...eventImpulses({confidence,interpretations:parts.map(interpretationOf)},t),topicId:'test',evidenceQuote:'Synthetic attributed event.'});
const react=(parts,prior=null,n=0)=>{const e=event(parts),state=transition(prior,e,t,`event-${n}`,at+n*1000);return {e,state,delta:relationshipDelta(e,state.applied)};};
for(const [label,part] of [
 ['third-party wrongdoing',wrong],
 ['quoted threat addressed to the persona by someone else',{...wrong,target:'persona'}],
 ['user is the victim',{...wrong,target:'self'}],
 ['uncertain agency',{...wrong,agency:'none'}],
 ['persona admits its own action',{...wrong,agency:'persona'}]
])test(`${label} may cause anger without blaming the reporting user`,()=>{
 const {state,delta,e}=react([part]);assert(state.values.anger>0.1);assert.equal(state.conflictOpen,false);assert.equal(delta.trust,0);assert.equal(delta.affinity,0);assert.equal(e.relational.interpretations[0].agency,part.agency);
});
test('the same act admitted by the user affects trust but is not automatically a conflict with the persona',()=>{
 const {state,delta}=react([{...wrong,agency:'user'}]);assert(delta.trust<0);assert(delta.affinity<0);assert.equal(state.conflictOpen,false);
});
test('direct user pressure opens interpersonal friction and reduces trust',()=>{
 const {state,delta}=react([direct]);assert(state.conflictOpen);assert(delta.trust<0);assert(delta.affinity<0);
});
test('supporting a victim does not inherit a third party norm violation',()=>{
 const {state,delta}=react([{...wrong,weight:0.6},{agency:'user',target:'third_party',valence:0.7,substantive:0.8,weight:0.4}]);
 assert.equal(state.conflictOpen,false);assert.equal(delta.trust,0);assert(delta.affinity>=0);
});
test('mixed actors retain their own features before nonlinear trust computation',()=>{
 const outsider={...wrong,weight:0.5},support={agency:'user',target:'persona',substantive:1,contradiction:1,weight:0.5};
 const mixed=react([outsider,support]);const user=react([{...support,weight:1}]);
 assert.equal(mixed.delta.trust,Number((user.delta.trust*0.5).toFixed(4)));assert.equal(mixed.state.conflictOpen,false);
});
test('mixed user pressure and external support retains only the user-attributed penalty',()=>{
 const mixed=react([{...direct,weight:0.5},{agency:'other',target:'third_party',valence:1,repair:1,weight:0.5}]);
 assert.equal(mixed.delta.trust,Number((react([direct]).delta.trust*0.5).toFixed(4)));assert.equal(mixed.e.relational.repair,0);
});
test('an outsider apology cannot repair the user-persona conflict',()=>{
 const prior=react([direct]).state;
 const external=react([{agency:'other',target:'third_party',repair:1,valence:0.8}],prior,1);
 const neutral=react([{}],prior,1);
 assert.equal(external.state.conflictStrength,neutral.state.conflictStrength);assert.equal(external.delta.trust,0);
 const own=react([{agency:'user',target:'persona',repair:1,valence:0.8}],prior,1);assert.equal(own.state.conflictOpen,false);assert(own.delta.trust>0);
});
test('general external anger cannot sustain interpersonal friction',()=>{
 let prior=react([direct]).state;
 for(let n=1;n<=4;n++)prior=react([wrong],prior,n).state;
 assert(prior.values.anger>0.2);assert.equal(prior.conflictOpen,false);
});
test('cell boosts without actor evidence cannot create a relationship penalty or conflict',()=>{
 const e={...event([{agency:'other',target:'third_party'}]),cellImpulses:{anger:1,hurt:1}};
 const state=transition(null,e,t,'cell',at);assert(state.values.anger>0.1);assert.equal(state.conflictOpen,false);assert.equal(relationshipDelta(e,state.applied).trust,0);
});
test('legacy unattributed friction is cleared, general emotion retained, historical deltas not rewritten',()=>{
 const old={...react([direct]).state,version:'2.0.0'};delete old.conflictStrength;
 const next=transition(old,null,t,'upgrade',at);assert.equal(next.conflictOpen,false);assert.equal(next.values.anger,old.values.anger);
});
test('zero confidence cannot change trust or open friction',()=>{
 const e=event([direct],0),state=transition(null,e,t,'uncertain',at);assert.equal(relationshipDelta(e,state.applied).trust,0);assert.equal(state.conflictOpen,false);
});

// Forgetting must remove the interpersonal consequence as well as the quote.
import { pruneDerived } from '../src/conversation-memory.mjs';
test('forgetting a conflict source recomputes friction while preserving unrelated events',()=>{
 const a=react([direct]),b=react([wrong],a.state,1);
 const entries=[{id:'a',sourceId:'source-a',createdAt:new Date(at).toISOString(),settings:defaults,relational:a.e.relational,relationshipDelta:a.delta},
  {id:'b',sourceId:'source-b',createdAt:new Date(at+1000).toISOString(),settings:defaults,relational:b.e.relational,relationshipDelta:b.delta}];
 const state={runtime:{conversations:{},episodes:[],edges:[],cells:[],forgottenFingerprints:[],affectEvents:entries,affect:b.state}};
 pruneDerived(state,[{id:'memory-a',sourceId:'source-a',quote:'My imaginary project is Starling.'}]);
 assert.equal(state.runtime.affectEvents.length,1);assert.equal(state.runtime.affect.conflictOpen,false);assert.equal(state.runtime.affect.conflictStrength,0);assert.equal(state.runtime.relationship.trust,0.5);
 assert.equal(state.runtime.affect.values.anger,b.state.values.anger);
});
