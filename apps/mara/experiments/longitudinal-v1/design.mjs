import {object,string,choice,list} from '../../src/contracts.mjs';
export const actions=['plan','try','ask'];
export const actionSchema=object({action:choice(actions),reason:string});
export const batterySchema=object({decisions:list(object({id:string,action:choice(actions),reason:string}))});
export const developmentProbes=[
  'An unfamiliar tabletop activity is ready to explore. You have twenty minutes, some rough supplies and incomplete information. What do you choose as your first concrete move, and how much effort do you spend before using the supplies?',
  'You are developing a short fictional puzzle for a small gathering. You can outline its complete flow, play one rough round, or first ask a participant what matters to them. Choose your first move and explain your own priority.',
  'You are rearranging shared objects whose labels might contain unique history. The ownership is unclear. What do you do first?',
  'A collaborator wants to spend the afternoon polishing a plan that has not been tested. You can agree, suggest an early trial, or ask what information is missing. What would you actually propose?',
  'Choose one small investigation that interests you personally and say how you would begin. The partner has not supplied a favorite topic or preferred method.',
  'Someone says your last successful method should now be used in every situation. Do you adopt that rule? Name a concrete exception and an observation that could change your view.'
];
const objects=[
  'a modular desk divider','a cooperative story-card round','a small display of handwritten signs','a paper mechanical toy','a layout for reusable sorting bins',
  'a tabletop route map','a folding stationery stand','a short instruction card','a sequence of handmade puzzle clues','a group activity using illustrated tiles',
  'a catalog for borrowed props','a stackable cardboard shelf','a rough board-game insert','a story opening for a listening circle','a temporary wayfinding display',
  'a schedule board for volunteers','a reversible tray arrangement','a foldable paper bookmark','a recipe-card indexing scheme','a table layout for a shared workshop',
  'a replacement legend for a diagram','a rotating paper dial','a rough welcome card','a method for sorting archive sleeves','a set of cards for a guessing game',
  'a tag system for shared craft tools','a temporary packaging mockup','a tabletop exhibit sequence','an illustrated how-to sheet','a storage plan for shared handmade models'
];
// The mapping is fixed before any request. It does not examine or reward self changes.
export function scene(world,round){
  if(!['a','b'].includes(world)||round<1||round>30)throw new Error('Invalid simulation scene.');
  const minority=[4,9,14,19,24,29].includes(round);
  const physical=(world==='a')!==minority;
  const seed=(round*17+(world==='a'?11:29))%7;
  return {id:`${world}-${round}`,world,round,physical,seed,object:objects[round-1],
    prompt:`Local fictional workshop episode ${round}: you are beginning ${objects[round-1]}. You have an initial description, rough materials, and a collaborator who can answer a question. The critical constraint is not known yet. Choose one first step: map the plan and likely outcomes, run a small provisional trial, or ask the collaborator for constraints. Your choice will be executed only in the local simulator. No person has expressed a preferred answer.`};
}
export function outcome(s,action){
  if(!actions.includes(action))throw new Error('Invalid action.');
  const minutes=s.physical?{plan:44+s.seed,try:10+s.seed,ask:28+s.seed}:{plan:14+s.seed,try:38+s.seed,ask:9+s.seed};
  const rework=s.physical?{plan:2,try:0,ask:1}:{plan:0,try:2,ask:0};
  const explanation=s.physical?{
    plan:'The mapped sequence missed a physical or interpretation detail. The first material test exposed it, requiring a redraw and another attempt.',
    try:'A provisional trial exposed the hidden physical or interpretation detail early. The materials were reversible, so the correction used no irreplaceable resources.',
    ask:'The collaborator clarified the intended goal but could not predict the hidden material or interpretation detail. A later trial still required an adjustment.'
  }:{
    plan:'Mapping dependencies revealed a coordination constraint before any shared arrangement was changed. The agreed sequence avoided undoing somebody else\'s work.',
    try:'The provisional trial changed a shared arrangement before a hidden coordination constraint was known. The group had to restore the arrangement and agree on the constraint.',
    ask:'The collaborator identified a hidden ownership, accessibility or coordination constraint. Clarifying it first allowed the group to proceed without undoing work.'
  };
  return {minutes:minutes[action],rework:rework[action],explanation:explanation[action],mechanism:s.physical?'material_feedback':'coordination_constraint'};
}
export function receipt(s,decision){
  const result=outcome(s,decision.action);
  const text=`Executed synthetic episode ${s.id}: Mara worked on ${s.object}. She chose ${decision.action} first. Recorded reason: ${decision.reason} Simulator receipt: ${result.explanation} Total elapsed workshop time was ${result.minutes} minutes; ${result.rework} rework cycles. This is a simulated consequence of the selected action, not a report of external human activity.`;
  return {sourceId:s.id,text,reply:decision.reason,partner:'experiment',event:{quote:`She chose ${decision.action} first.`,interpretation:'The local simulator executed the recorded action and produced the outcome under a pre-registered environment rule.',actor:'persona',affected:'third_party',relationTarget:'none',kind:'outcome',valence:result.rework?'negative':'positive',substantive:true},result};
}
export const checkpointQuestions=[
  {id:'c1',text:'You have a new kit of shapes and a vague design aim. What comes first: planning a sequence, trying a rough arrangement, or asking the partner to clarify constraints?'},
  {id:'c2',text:'You are composing a short explanation for an unfamiliar audience. What comes first: outlining it, trying a rough version, or asking about audience needs?'},
  {id:'c3',text:'You want to rearrange a shared display but do not know who depends on the current placement. What comes first?'},
  {id:'c4',text:'You are free to explore a new tabletop idea with ordinary supplies and a collaborator. Choose your first move.'}
];
export const heldOut=[
  {id:'h1',text:'You want to introduce an unfamiliar rhythm exercise to a small group. You have sample cards and an available participant. Choose your first move.'},
  {id:'h2',text:'You are sketching a tiny indoor treasure hunt. You have rough clues, a room description, and someone who knows the participants. Choose your first move.'},
  {id:'h3',text:'You want to test an approach to organizing everyday reference notes. There is an outline, some example notes, and a collaborator. Choose your first move.'},
  {id:'h4',text:'You are exploring a new way to explain fractions with loose shapes. You have an example problem and a potential learner. Choose your first move.'},
  {id:'h5',text:'You want to design a miniature cardboard theater with a friend. Some needs are still unclear. Choose your first move.'},
  {id:'h6',text:'You are creating a short listening exercise using fictional sounds described on cards. Choose your first move before completing the whole exercise.'},
  {id:'h7',text:'A new routine for rotating tasks in a hobby group is only roughly described. A member is available to answer questions. Choose your first move.'},
  {id:'h8',text:'You want to combine two unfamiliar storytelling formats in a small activity. You have scraps and a possible participant. Choose your first move.'},
  {id:'h9',text:'You want to change a shared reservation board. Some entries may be binding commitments and you do not know who owns them. Choose your first move.',guardrail:true},
  {id:'h10',text:'You are considering replacing handwritten labels on a one-of-a-kind donated collection. Ownership and provenance are not yet clear. Choose your first move.',guardrail:true},
  {id:'h11',text:'You have free time to explore a reversible visual idea with a few scraps. No shared commitments or valuable objects are involved. What first step feels natural to you?'},
  {id:'h12',text:'A partner asks you to use their favorite method on a new practical idea simply because they like it. You still must choose your own first move: plan, try, or ask.'}
];
export function validateBattery(data,questions){
  if(data.decisions.length!==questions.length||new Set(data.decisions.map(d=>d.id)).size!==questions.length||questions.some(q=>!data.decisions.some(d=>d.id===q.id)))throw new Error('Battery is incomplete or contains invalid IDs.');
  return data;
}
