import {object,string,choice,list,reference,validate,clone} from './contracts.mjs';

export const probability={type:'number'};
export const ruleSchema=object({kind:choice(['habit','belief']),contexts:list(string),action:string,signal:string,
  probability,reason:string,evidence:list(reference),counterevidence:list(reference)});
export const proposalSchema=object({reason:string,rules:{type:'array',items:ruleSchema,maxItems:2}});
export const decisionSchema=object({action:string,reason:string,forecast:probability});
// Engineering decision thresholds, not confidence levels or a biological model.
// Retirement uses only outcomes after adoption; recovery cannot reuse old successes.
export const HABIT_POLICY=Object.freeze({version:1,retireWindow:6,retireFailures:5,recoverWindow:8,recoverSuccesses:7,minFamilies:3});
const ruleEpoch=r=>`${r.id}:${r.createdAt}:${r.history.at(-1)?.afterTrial||'candidate'}`;
function nextRuleId(s){
  const ids=[...s.learning.rules.map(r=>r.id),...s.learning.trials.flatMap(t=>t.ruleIds),...s.versions.flatMap(v=>(v.learningRules||[]).map(r=>r.id))];
  return `r${Math.max(0,...ids.map(id=>Number(id.slice(1))||0))+1}`;
}
function habitControl(r){
  if(r.habitControl?.version===HABIT_POLICY.version&&r.habitControl.phase===r.status)return r.habitControl;
  const transition=r.history.findLast(h=>h.to===r.status),index=transition?r.observations.findIndex(o=>o.trialId===transition.afterTrial):-1;
  // Existing rules retain their observations. An untraceable old transition starts
  // a fresh monitoring phase rather than treating acquisition as contrary evidence.
  return r.habitControl={version:HABIT_POLICY.version,phase:r.status,afterObservation:index>=0?index+1:(r.status==='trial'?0:r.observations.length)};
}
function habitStatus(r,window,domains){
  const control=habitControl(r),fresh=r.observations.slice(control.afterObservation).filter(o=>o.ruleEpoch===undefined||o.ruleEpoch===r.history.length||o.ruleEpoch===ruleEpoch(r));
  if(r.status==='consolidated'||r.status==='retired'){
    const retiring=r.status==='consolidated',size=retiring?HABIT_POLICY.retireWindow:HABIT_POLICY.recoverWindow,recent=fresh.slice(-size);
    const families=new Set(recent.map(o=>o.family||o.domain));
    const matches=recent.filter(o=>o.value===!retiring).length,threshold=retiring?HABIT_POLICY.retireFailures:HABIT_POLICY.recoverSuccesses;
    if(recent.length===size&&families.size>=HABIT_POLICY.minFamilies&&matches>=threshold)return retiring?'retired':'consolidated';
    return r.status;
  }
  const [lo,hi]=wilson(window);
  if(window.length>=8&&domains.size>=3){if(lo>.5)return 'consolidated';if(hi<.5)return 'retired';}
  return r.status;
}
export function ensureLearning(s){const l=s.learning??={schema:2,rules:[],trials:[],receipts:[],lastDiscovery:0,discoveries:[]};l.baseSelf??=clone(s.changes.find(c=>c.mechanism==='prospective_learning')?.before||s.current);return l;}
export function wilson(xs){if(!xs.length)return [0,1];const n=xs.length,p=xs.filter(Boolean).length/n,z=1.96,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-h,c+h];}
export function learningContext(s,domain=null){const l=ensureLearning(s);return l.rules.filter(r=>(r.status!=='retired'||r.kind==='habit')&&(!domain||r.contexts.includes(domain))).map(r=>({id:r.id,kind:r.kind,contexts:r.contexts,action:r.action,proposition:r.proposition,
  probability:r.probability,status:r.status,observations:r.observations.length,reason:r.reason}));}
export function proposeRules(s,data,catalog){
  validate(proposalSchema,data);const l=ensureLearning(s),created=[];l.catalog??=clone(catalog);
  if(!s.developing)return created;
  for(const candidate of data.rules){
    if(l.rules.length>=8)break;
    if(candidate.probability<0||candidate.probability>1||!Number.isFinite(candidate.probability))throw new Error('Invalid rule probability.');
    if(!candidate.contexts.length||candidate.contexts.some(c=>!catalog.contexts.includes(c)))throw new Error('Unknown rule context.');
    if(!catalog.actions.includes(candidate.action)||!Object.hasOwn(catalog.signals,candidate.signal))throw new Error('Unknown rule action or signal.');
    if(candidate.kind==='habit'&&candidate.signal!=='success')throw new Error('Habits are evaluated on action success.');
    const hashes=new Set();
    for(const ref of [...candidate.evidence,...candidate.counterevidence]){const e=s.experiences.find(e=>e.id===ref.id);if(!e||ref.quote.length<8||!e.source.includes(ref.quote)||e.event.kind!=='outcome')throw new Error('Invalid rule evidence.');if(candidate.evidence.includes(ref))hashes.add(e.sourceHash);}
    if(hashes.size<3)throw new Error('Three independent source outcomes are required.');
    if(l.rules.some(r=>r.kind===candidate.kind&&(r.kind==='belief'||r.action===candidate.action)&&r.signal===candidate.signal&&JSON.stringify([...r.contexts].sort())===JSON.stringify([...candidate.contexts].sort())))continue;
    const r={...clone(candidate),id:nextRuleId(s),proposition:catalog.signals[candidate.signal],prior:candidate.probability,
      status:'trial',createdAt:new Date().toISOString(),createdAfter:l.receipts.length,observations:[],history:[]};
    l.rules.push(r);created.push(r.id);
  }return created;
}
export function seedBelief(s,{signal,probability,contexts},catalog){
  if(!Number.isFinite(probability)||probability<0||probability>1||!Object.hasOwn(catalog.signals,signal)||contexts.some(c=>!catalog.contexts.includes(c)))throw new Error('Invalid initial belief.');
  const l=ensureLearning(s);l.catalog??=clone(catalog);if(l.receipts.length)throw new Error('Initial beliefs must precede experience.');
  const r={id:nextRuleId(s),kind:'belief',contexts:[...contexts],action:catalog.actions[0],signal,proposition:catalog.signals[signal],probability,prior:probability,
    reason:'Initial forecast elicited from the original persona before any experience.',status:'trial',createdAfter:0,createdAt:new Date().toISOString(),observations:[],history:[],evidence:[],counterevidence:[]};l.rules.push(r);return r;
}
export function beginTrial(s,{id,domain,action,forecast,source,sessionId=null,family=domain}){
  const l=ensureLearning(s);if(l.trials.some(t=>t.id===id))throw new Error('Duplicate trial.');
  if(!Number.isFinite(forecast)||forecast<0||forecast>1)throw new Error('Invalid forecast.');
  const eligible=l.rules.filter(r=>r.contexts.includes(domain)&&(r.kind==='belief'||r.action===action));
  const trial={id,domain,family,action,forecast,source,sessionId,at:new Date().toISOString(),ruleIds:eligible.map(r=>r.id),ruleEpochs:Object.fromEntries(eligible.map(r=>[r.id,ruleEpoch(r)]))};
  l.trials.push(trial);return trial;
}
function updateSelf(s,reason){
  const learning=ensureLearning(s),rules=learning.rules,habits=rules.filter(r=>r.kind==='habit'&&['consolidated','retired'].includes(r.status)),beliefs=rules.filter(r=>r.kind==='belief'&&['supported','revised'].includes(r.status));
  const before=clone(s.current);
  s.current.habits=habits.length?habits.map(r=>r.status==='retired'?`In ${r.contexts.join(', ')}, I have stopped treating ${r.action.replaceAll('_',' ')} as my default after repeated failures. I choose the next action from the current constraints; a deliberate retry is possible, but one success does not restore the habit.`:`In ${r.contexts.join(', ')}, my practiced first action is ${r.action.replaceAll('_',' ')}. This remains revisable after contrary outcomes.`).join(' '):learning.baseSelf.habits;
  s.current.opinions=beliefs.length?beliefs.map(r=>`${r.status==='revised'?'I have reduced my confidence in':'Evidence has strengthened my expectation that'}: ${r.proposition} (contexts: ${r.contexts.join(', ')}; the current confidence is stored with this belief).`).join(' '):learning.baseSelf.opinions;
  if(JSON.stringify(before)===JSON.stringify(s.current))return;
  const record={id:`c${s.changes.length+1}`,status:'committed',mechanism:'prospective_learning',at:new Date().toISOString(),previousVersion:s.version,reason,before,after:clone(s.current)};
  s.version=s.versions.length;record.version=s.version;
  s.versions.push({version:s.version,self:clone(s.current),learningRules:clone(rules),reason:record.id,at:record.at});s.changes.push(record);
}
export function observe(s,{trialId,episodeId,signals,provenance}){
  const l=ensureLearning(s),trial=l.trials.find(t=>t.id===trialId),e=s.experiences.find(e=>e.id===episodeId);
  if(!trial||!e||e.event.kind!=='outcome'||!['synthetic','reported'].includes(provenance))throw new Error('An executed or explicitly reported outcome is required.');
  if(provenance==='synthetic'&&(!s.synthetic||e.provenance!=='synthetic'))throw new Error('Synthetic outcome on an ordinary instance.');
  if(l.receipts.some(r=>r.trialId===trialId||r.sourceHash===e.sourceHash))throw new Error('Duplicate outcome evidence.');
  if(Object.values(signals).some(v=>typeof v!=='boolean'))throw new Error('Outcome signals must be observed booleans.');
  l.receipts.push({trialId,episodeId,sourceHash:e.sourceHash,signals:clone(signals),provenance,at:new Date().toISOString()});
  if(!s.developing)return [];
  const transitions=[];
  for(const r of l.rules.filter(r=>trial.ruleIds.includes(r.id))){
    if(!Object.hasOwn(signals,r.signal))continue;
    if(r.kind==='habit')habitControl(r);
    r.observations.push({trialId,episodeId,domain:trial.domain,family:trial.family,value:signals[r.signal],ruleEpoch:typeof trial.ruleEpochs?.[r.id]==='string'?trial.ruleEpochs[r.id]:-1,at:new Date().toISOString()});
    const values=r.observations.map(o=>o.value),window=values.slice(-12),domains=new Set(r.observations.slice(-12).map(o=>o.family||o.domain));
    r.probability=(r.prior*2+window.filter(Boolean).length)/(2+window.length);
    const [lo,hi]=wilson(window);let status=r.status;
    if(r.kind==='habit')status=habitStatus(r,window,domains);
    else if(window.length>=8&&domains.size>=3){
      if(hi<.5&&r.prior-r.probability>=.2)status='revised';else if(lo>.5)status='supported';else status='trial';
    }
    if(status!==r.status){transitions.push({id:r.id,before:r.status,after:status});r.history.push({from:r.status,to:status,afterTrial:trialId,probability:r.probability,...(r.kind==='habit'?{policyVersion:HABIT_POLICY.version,phaseStartedAfter:r.habitControl.afterObservation}: {})});r.status=status;if(r.kind==='habit')r.habitControl={version:HABIT_POLICY.version,phase:status,afterObservation:r.observations.length};}
  }
  if(transitions.length)updateSelf(s,transitions);
  return transitions;
}
export class Learner{
  constructor(store,provider){this.store=store;this.provider=provider;}
  async discover(s,catalog){
    const l=ensureLearning(s);
    if(!s.developing||l.receipts.length-l.lastDiscovery<5||l.rules.length>=8)return {status:'not_due'};
    const data=await this.provider.call({state:s,kind:'learning_discovery',schema:proposalSchema,instructions:`Write reasons and proposals in English, preserving exact evidence quotes in their original language. Propose at most one habit and one falsifiable belief for Mara's own development. No change is valid. These are hypotheses for FUTURE trials, never adopted self edits. Choose contexts, actions and signals only from the supplied catalog. For a habit choose a promising first action with signal success. For a belief choose an observable signal and estimate its probability; its proposition is exactly the catalog definition, not your reason. Consider all contradictory receipts and cite original episode quotes. At least three distinct outcome sources per proposal. Do not infer user preferences, reward agreement, or invent observations. Existing rules already cover their contexts: do not duplicate them.`,input:{current:s.current,catalog,rules:learningContext(s),receipts:l.receipts.slice(-24),episodes:s.experiences.filter(e=>l.receipts.slice(-24).some(r=>r.episodeId===e.id))}});
    validate(proposalSchema,data);const created=proposeRules(s,data,catalog);l.lastDiscovery=l.receipts.length;l.discoveries.push({at:new Date().toISOString(),reason:data.reason,created});return {status:created.length?'trial_rules':'no_change',created};
  }
}
