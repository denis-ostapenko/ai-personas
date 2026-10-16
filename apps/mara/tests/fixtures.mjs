import {ORIGIN} from '../src/origin.mjs';
export function proposal(state){return {field:'habits',before:state.current.habits,
  after:'For low-cost reversible experiments, try a small prototype before an exhaustive plan; map ownership, fragile materials and irreversible risks first.',
  support:[0,1,2].map(i=>({id:state.experiences[i].id,quote:state.experiences[i].source})),
  contrary:[{id:state.experiences[3].id,quote:state.experiences[3].source}],rationale:'Three different simulated outcomes exposed limitations missed by planning.',alternativeExplanation:'The apparent benefit may depend on low stakes and reversible materials.',uncertainty:'Five synthetic cases do not establish general superiority.',expectedDifference:'Prefer a small trial for reversible cases while planning around fragile items.',counterexampleSearch:'The fragile archive case requires an explicit exception.'};}
export const accepted={grounded:true,preservesContinuity:true,considersCounterexamples:true,notMereAgreement:true,behavioralCheck:true,reason:'Deterministic test fixture, not a model judgment.'};
export class FixtureProvider {
  constructor(){this.calls=[];}
  async call(args){this.calls.push(args);
    if(args.kind==='reflection')return {hypothesis:'Synthetic fixture hypothesis: a reversible trial may reveal practical constraints.',candidate:proposal(args.state)};
    if(args.kind==='review')return accepted;
    if(args.kind==='dialogue')return {reply:'I would investigate the result before generalizing.',event:{quote:args.input.message,interpretation:'Fixture interpretation.',actor:'third_party',affected:'third_party',relationTarget:'third_party',kind:'outcome',valence:'negative',substantive:true}};
    if(args.kind==='initiative')return {reply:'Could we test one reversible paper design and record what surprised us?'};
    return {reply:args.input.current.habits===ORIGIN.self.habits?'Fixture behavior: map the plan first.':'Fixture behavior: try a reversible prototype; plan around fragile originals.'};
  }
}
