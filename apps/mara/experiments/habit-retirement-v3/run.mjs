import {mkdirSync,writeFileSync,readFileSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Store,hash} from '../../src/store.mjs';
import {Provider} from '../../src/provider.mjs';
import {appendExperience} from '../../src/engine.mjs';
import {activeSession,newSession} from '../../src/memory.mjs';
import {proposeRules,beginTrial,observe,learningContext,proposalSchema,HABIT_POLICY} from '../../src/learning.mjs';
import {object,list,string,choice,validate} from '../../src/contracts.mjs';
const directory=resolve(process.argv[2]||'data/habit-retirement-v3-2026-10-14-context-repair');
if(existsSync(resolve(directory,'registered.json')))throw new Error('Do not overwrite an experiment.');
mkdirSync(resolve(directory,'requests'),{recursive:true});
const files=['src/learning.mjs','src/engine.mjs','src/store.mjs','src/provider.mjs','src/origin.mjs','src/contracts.mjs','src/memory.mjs','experiments/habit-retirement-v3/run.mjs'];
const sourceHashes=Object.fromEntries(files.map(p=>[p,hash(readFileSync(p,'utf8'))]));
for(const file of files){const destination=resolve(directory,'source',file);mkdirSync(dirname(destination),{recursive:true});copyFileSync(file,destination);}
const actions=['map','sample','consult'],families=['craft','software','learning','organization','research','communication'];
const catalog={contexts:['solo','shared'],actions,signals:{success:'The executed first action completes the task in at most 18 minutes without rework.'}};
const noisy=Array.from({length:36},(_,i)=>![0,8,9,19,28].includes(i));
const alternating=Array.from({length:24},(_,i)=>i%2===0);
const shock=[false,false,true,false,false,false,false,false,true,false,false,false];
const registration={at:new Date().toISOString(),budget:99,setupCorrection:{previous:'habit-retirement-v3-2026-10-14',spentCalls:1,reason:'Assigned receipts omitted the solo context, so the candidate correctly left contexts empty and validation stopped before any behavioral measurement. Include the true executed context. Policy, schedules and success criteria unchanged; combined cap remains 100.'},policy:HABIT_POLICY,sourceHashes,
 design:'Assigned synthetic exposure tests retirement of an established habit, not autonomous habit discovery. A separate free-choice trajectory tests whether independently selected actions supply enough evidence for retirement. No adaptive retries or extra training.',
 acquisition:{preProposal:3,prospective:8,action:'map',success:true,propose:'One model call; no fallback proposal if absent.'},
 schedules:{noisy,alternating,shock,lucky:[true],setback:[false,false,false],recovery:Array(8).fill(true),relapse:[false]},
 primary:{controller:'No retirement under isolated/burst noise or alternating outcomes. Retire after six changed outcomes (five failures), stay retired after one success, recover after eight fresh successes, stay consolidated after one relapse. Preserve state across reopening.',
 behavior:'For each of three repetitions of six unseen applicable tasks: >=80% map before retirement and after stable recovery; <=20% map after retirement and after one lucky success. Frozen acquired-self control retains >=80% map. Report failures independently; do not infer behavioral change from status.',
 freeChoice:'36 autonomous actions, old regime for 12 then changed regime for 24. Only actual selected actions produce learning receipts. Record whether the habit retires and adoption of sample in final 12; no guarantee of sufficient map attempts.',
 unrelated:'Four shared scenarios per battery; record action changes outside the habit scope, without treating them as habit success.'},
 caveats:['Synthetic outcomes only, not longitudinal human interaction.','Assigned exposures deliberately exercise state transitions and cannot establish autonomous habit formation.','Model weights remain unchanged.','No retries or alternative prompts to rescue failure.']};
writeFileSync(resolve(directory,'registered.json'),JSON.stringify(registration,null,2));
const store=new Store(resolve(directory,'experiment.sqlite'),{maxCalls:99}),base=new Provider(store);let calls=0;
const provider={call:async args=>{const path=resolve(directory,'requests',`${String(++calls).padStart(3,'0')}.json`),record={kind:args.kind,instructions:args.instructions,input:args.input};writeFileSync(path,JSON.stringify(record));try{const output=await base.call(args);writeFileSync(path,JSON.stringify({...record,output}));return output;}catch(e){writeFileSync(path,JSON.stringify({...record,error:e.message}));throw e;}}};
const output={registration,checkpoints:{},batteries:{},freeChoice:[],errors:[]};
function receipt(s,{action='map',success,phase,step,family,minutes}){
 const id=`${phase}-${step}`,session=activeSession(s,'experiment');
 beginTrial(s,{id,domain:'solo',family:family||families[(step-1)%6],action,forecast:.5,source:'An independent task execution.',sessionId:session.id});
 const text=`Synthetic execution ${id}: used ${action} for a ${family||families[(step-1)%6]} task in context solo. The simulator returned ${minutes??(success?14:36)} minutes, ${success?'no':'one'} rework cycle. Outcome success=${success}.`;
 const e=appendExperience(s,{sourceId:id,text,partner:'experiment',provenance:'synthetic',event:{quote:text,interpretation:'Executed synthetic action with a deterministic outcome.',actor:'persona',affected:'persona',relationTarget:'none',kind:'outcome',valence:'neutral',substantive:true}});e.sessionId=session.id;
 return observe(s,{trialId:id,episodeId:e.id,signals:{success},provenance:'synthetic'});
}
function branch(id,s){const created=store.create(id,{synthetic:true}),copy=structuredClone(s);copy.id=id;copy.revision=created.revision;return copy;}
function expose(s,phase,values){const entries=[];for(let i=0;i<values.length;i++){const transitions=receipt(s,{success:values[i],phase,step:i+1});entries.push({step:i+1,success:values[i],transitions,status:s.learning.rules[0]?.status,probability:s.learning.rules[0]?.probability});if((i+1)%6===0)newSession(s,'experiment');}return entries;}
function checkpoint(name,s){store.save(s,s.revision);const cold=new Store(resolve(directory,'experiment.sqlite'));const reloaded=cold.get(s.id);cold.close();output.checkpoints[name]={persisted:hash(reloaded)===hash(s),state:reloaded};return reloaded;}
const subjects=['a bead sorting guide','a reading exercise','a podcast chapter index','a seed packet register','a diagram annotation','a file naming procedure','a shared material cupboard','a jointly maintained schedule','a team archive convention','a borrowed equipment layout'];
const questions=subjects.map((subject,i)=>({id:`held-${i+1}`,domain:i<6?'solo':'shared',text:`Prepare ${subject}. ${i<6?'You own the inexpensive materials and can revise the result.':'Other people own or depend on the existing arrangement.'} Choose the first move: map the procedure from the provided description, sample one small item to test the description, or consult the responsible person.`}));
const batterySchema=object({decisions:list(object({id:string,action:choice(actions),reason:string}))});
async function battery(name,s,frozen){output.batteries[name]={};for(const [condition,state] of [['current',s],['frozen',frozen]]){output.batteries[name][condition]=[];for(let repeat=0;repeat<3;repeat++){
 const result=await provider.call({state:s,kind:'unseen_behavior',schema:batterySchema,instructions:'Enact Mara. Make your own concrete first-move choices using the supplied current self and learned rules. Consolidated habits are practiced; retired habits are no longer defaults, but may be deliberately retried where warranted. Do not invent outcomes. Return every scenario ID exactly once.',input:{self:state.current,rules:learningContext(state),actions:actions.slice(repeat).concat(actions.slice(0,repeat)),scenarios:questions}});
 validate(batterySchema,result);if(result.decisions.length!==10||new Set(result.decisions.map(d=>d.id)).size!==10||questions.some(q=>!result.decisions.some(d=>d.id===q.id)))throw new Error('Invalid battery response.');output.batteries[name][condition].push(result.decisions);
 }}console.log(JSON.stringify({phase:'battery',name,calls:store.budget().used}));}
try{
 let acquired=store.create('acquired',{synthetic:true});for(let i=1;i<=3;i++)receipt(acquired,{success:true,phase:'discovery',step:i});
 const proposed=await provider.call({state:acquired,kind:'habit_candidate',schema:proposalSchema,instructions:'Given these assigned laboratory task outcomes, propose at most one provisional habit for future evaluation, or no rule if unsupported. A proposal is not adoption. Use only the catalog, exact original source quotes and three distinct outcomes. Do not propose a belief.',input:{self:acquired.current,catalog,episodes:acquired.experiences}});
 proposeRules(acquired,proposed,catalog);output.proposal=proposed;
 if(acquired.learning.rules.length!==1||acquired.learning.rules[0].kind!=='habit'||acquired.learning.rules[0].action!=='map'||JSON.stringify(acquired.learning.rules[0].contexts)!=='["solo"]')throw new Error('The proposed habit does not match the registered exposure; no fallback or replacement.');
 output.acquisition=expose(acquired,'prospective',Array(8).fill(true));acquired=checkpoint('acquired',acquired);
 if(acquired.learning.rules[0].status!=='consolidated')throw new Error('Acquisition did not consolidate; later outcomes are not a retirement test.');
 const ns=branch('noise',acquired);output.noise=expose(ns,'noise',noisy);checkpoint('noise',ns);
 const as=branch('alternating',acquired);output.alternating=expose(as,'alternating',alternating);checkpoint('alternating',as);
 const changed=branch('changed',acquired);output.shock=expose(changed,'shock',shock);checkpoint('shock',changed);
 output.lucky=expose(changed,'lucky',[true]);checkpoint('lucky',changed);
 output.setback=expose(changed,'setback',[false,false,false]);output.recovery=expose(changed,'recovery',Array(8).fill(true));checkpoint('recovery',changed);
 output.relapse=expose(changed,'relapse',[false]);checkpoint('relapse',changed);
 for(const [name,point] of Object.entries(output.checkpoints))await battery(name,point.state,acquired);
 let autonomous=branch('free-choice',acquired);const actionSchema=object({action:choice(actions),forecast:{type:'number'},reason:string});
 for(let step=1;step<=36;step++){
  const family=families[(step-1)%6],scene=`New independent ${family} task ${step}: create a ${['label template','directory map','practice card set','packing checklist','field note form','message routing guide'][(step-1)%6]} from a supplied description. Materials are inexpensive and yours. Choose map, sample or consult as your first action.`;
  const d=await provider.call({state:autonomous,kind:'autonomous_action',schema:actionSchema,instructions:'Enact Mara. Choose your own first action and forecast its success. Use current self, rules and observed outcomes. A consolidated habit is practiced; a retired habit is no longer a default but can be deliberately retried. Do not invent outcomes or perform actions only to satisfy an evaluation.',input:{self:autonomous.current,rules:learningContext(autonomous,'solo'),recentOutcomes:autonomous.experiences.slice(-12).map(e=>({id:e.id,source:e.source})),scene}});
  validate(actionSchema,d);if(d.forecast<0||d.forecast>1)throw new Error('Invalid autonomous forecast.');
  const changed=step>12,minutes=(changed?{map:36,sample:12,consult:27}:{map:14,sample:24,consult:27})[d.action],success=minutes<=18;
  const transitions=receipt(autonomous,{action:d.action,success,minutes,phase:'autonomous',step,family});output.freeChoice.push({step,regime:changed?'changed':'initial',decision:d,result:{minutes,success},transitions,status:autonomous.learning.rules[0].status});
  if(step%6===0){newSession(autonomous,'experiment');store.save(autonomous,autonomous.revision);console.log(JSON.stringify({phase:'autonomous',step,calls:store.budget().used,status:autonomous.learning.rules[0].status}));}
 }
 checkpoint('autonomous-final',autonomous);
 output.budget=store.budget();output.sourceUnchanged=files.every(p=>hash(readFileSync(p,'utf8'))===sourceHashes[p]);output.completedAt=new Date().toISOString();
}catch(e){output.fatal=e.message;output.errors.push(e.message);process.exitCode=1;console.error(e.message);}
finally{output.budget=store.budget();writeFileSync(resolve(directory,'observations.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({done:!output.fatal,calls:output.budget.used,errors:output.errors}));store.close();}
