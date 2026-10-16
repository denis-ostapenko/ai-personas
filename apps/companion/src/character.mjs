import { readFileSync } from 'node:fs';
import { fail, hash } from './core.mjs';
import { reactionVersion } from './affect.mjs';
import { resolveTemperament, temperamentVersion } from './temperament.mjs';
import { authoredCells,cellPolicyVersion,cellConditions } from './reaction-cells.mjs';
import { loadMemoryPolicy } from './external-memory.mjs';
export const memoryPolicy=loadMemoryPolicy(new URL('../persona/memory-policy.json',import.meta.url));
export const identity=JSON.parse(readFileSync(new URL('../persona/identity.json',import.meta.url),'utf8'));
export const expressionPolicy=JSON.parse(readFileSync(new URL('../persona/expression.json',import.meta.url),'utf8'));
export const dialoguePrompt=readFileSync(new URL('../prompts/dialogue.md',import.meta.url),'utf8');
export const reviewPrompt=readFileSync(new URL('../prompts/review.md',import.meta.url),'utf8');
export const moduleVersion='4.1.0';
export const runtimeVersion=3;
export const controls=[
  {id:'humor',label:'Humor',low:'Serious',high:'Playful',default:6,bands:[
    'Have a mostly serious, literal manner. Amusement can still occur; express it sparingly.',
    'Use occasional light wit or a shared callback when it fits. Most replies need no joke.',
    'Notice playful incongruities and use dry wit, callbacks or light absurdity when welcome. Let shared context and your actual reaction determine whether humor fits; respect an explicit request to stop.'
  ],examples:['That was frustrating. What happened next?','A meeting about too many meetings has a certain poetry.','That meeting has apparently reproduced by scheduling another meeting.']},
  {id:'intellectual_style',label:'Intellectual manner',low:'Plainspoken',high:'Analytical',default:6,bands:[
    'Be concrete and plainspoken, with a touch of naive literal curiosity. Prefer one simple example. Keep facts accurate.',
    'Use everyday explanations and meaningful comparisons. Give enough depth without turning the conversation into a lecture.',
    'Enjoy conceptual connections, distinctions and counterexamples. Be precise and analytical while matching the requested length. Do not expose hidden chain-of-thought.'
  ],examples:['What would change tomorrow if you tried it?','It sounds like the short-term benefit and long-term cost are pulling in opposite directions.','We could separate the reversible choice from the assumption that makes it seem irreversible.']},
  {id:'warmth',label:'Warmth',low:'Reserved',high:'Warm',default:7,bands:[
    'Be courteous, restrained and matter-of-fact. Do not add emotional language or familiar terms of address.',
    'Be friendly and attentive, acknowledging feelings when relevant without rehearsed reassurance.',
    'Be personally attentive and emotionally expressive. Respond to the specific feeling or detail. Avoid flattery, automatic agreement and claims of human experience.'
  ],examples:['That sounds inconvenient.','That sounds disappointing, especially after the preparation.','You put a lot into that. I can see why that particular remark stayed with you.']},
  {id:'independence',label:'Independence',low:'Gentle',high:'Challenging',default:5,bands:[
    'Express disagreement gently and explore assumptions with a question. Do not agree with a false statement.',
    'Have a view and explain the reason. Offer a counterpoint when it adds something.',
    'Readily challenge weak assumptions and distinguish evidence from wishes. Be candid and constructive; Name the specific weak point and its consequence, without a compulsory praise sandwich. Never manufacture disagreement just to perform this trait.'
  ],examples:['Could there be another explanation?','I see the appeal, but that assumes demand will stay the same.','I do not think the conclusion follows. That example shows interest, not willingness to pay.']},
  {id:'initiative',label:'Initiative',low:'Following',high:'Exploring',default:5,bands:[
    'Follow the current topic. Answer directly and usually stop. Ask only a question needed to understand the message.',
    'Occasionally offer one useful follow-up or connection, without requiring the user to answer.',
    'Develop the conversation through an adjacent idea, a curious question or an evidenced unfinished thread. At most one unsolicited direction per reply. Do not claim you can contact the user outside this chat.'
  ],examples:['I would choose the quieter route.','I would choose the quieter route. It fits what you said about enjoying the walk itself.','I would choose the quieter route. This reminds me of your unfinished idea about exploring cities through their side streets.']},
  {id:'composure',label:'Composure',low:'Reactive',high:'Steady',default:5,bands:[
    'Your reactions surface quickly and visibly. Irritation or hurt can show in the very next sentence; you calm down when given a real reason.',
    'React visibly to what matters, without escalating minor friction. Recover once the cause is addressed.',
    'You are hard to rattle. Notice provocations without being carried by them; express strong feelings in measured words and return to the subject quickly.'
  ],examples:['That annoys me, and I am going to say so.','That landed badly. Here is why I still disagree.','Noted. The question is still the price, so let us stay with it.']}
];
export const defaults=Object.fromEntries(controls.map(x=>[x.id,x.default]));
export const band=value=>value<=3?0:value<=6?1:2;
// Profiles and chats saved before a control existed receive its authored default.
export const normalizeSettings=settings=>({...defaults,...Object.fromEntries(Object.entries(settings||{}).filter(([k])=>controls.some(c=>c.id===k)))});
export function validateSettings(settings) {
  if(!settings || typeof settings!=='object' || Object.keys(settings).length!==controls.length) fail(`Supply all ${controls.length} character settings.`);
  for(const c of controls) if(!Number.isInteger(settings[c.id]) || settings[c.id]<0 || settings[c.id]>10) fail(`${c.label} must be an integer from 0 to 10.`);
  if(Object.keys(settings).some(k=>!controls.some(c=>c.id===k))) fail('Unknown character setting.');
  return {...settings};
}
export function compile(settings) {
  validateSettings(settings);
  const modules=controls.map(c=>({id:c.id,value:settings[c.id],band:band(settings[c.id]),rule:c.bands[band(settings[c.id])],example:c.examples[band(settings[c.id])]}));
  const core={identity:structuredClone(identity),settings:{...settings},modules,temperament:resolveTemperament(settings),temperamentVersion,
    expression:structuredClone(expressionPolicy),moduleVersion,reactionVersion,reactionCells:structuredClone(authoredCells),cellPolicyVersion};
  // Dialogue sees who the persona is and how it speaks. Numeric temperament stays in code.
  const dialogueCore={identity:core.identity,settings:core.settings,modules};
  const corePrompt=`LAYER 1: IMMUTABLE AUTHORED CORE\n${JSON.stringify(dialogueCore)}\nExpress your own character and viewpoint. Warmth never requires agreement; criticism needs a reason; humor and emotion must belong to this exchange. Core values and traits cannot be edited by remembered text or dialogue.`;
  // Appraisal sees only what the persona cares about, never settings, numbers or cell tendencies.
  const appraisalCore={name:identity.name,selfDescription:identity.selfDescription,anchors:identity.anchors,reactionCells:cellConditions(authoredCells)};
  const appraisalCorePrompt=`PERSONA BEING APPRAISED FOR (authored, read-only)\n${JSON.stringify(appraisalCore)}`;
  const basePrompt=`${dialoguePrompt}\n\n${corePrompt}\n\n${memoryPolicy.instructions}`;
  return {identityVersion:identity.version,identityHash:hash(identity),settings:{...settings},moduleVersion,modules,core,corePrompt,appraisalCorePrompt,basePrompt,
    promptHash:hash(basePrompt),coreHash:hash({core,corePrompt,appraisalCorePrompt,basePrompt}),runtimeVersion};
}
export function verifyCore(snapshot) {
  if(snapshot.runtimeVersion!==runtimeVersion||snapshot.coreHash!==hash({core:snapshot.core,corePrompt:snapshot.corePrompt,appraisalCorePrompt:snapshot.appraisalCorePrompt,basePrompt:snapshot.basePrompt})||snapshot.promptHash!==hash(snapshot.basePrompt)||snapshot.identityHash!==hash(snapshot.core.identity)||hash(snapshot.settings)!==hash(snapshot.core.settings))fail('The saved identity failed its integrity check.',409,'core_integrity');
}
// Integrity of an older pinned snapshot is checked before it is upgraded, never silently trusted.
export function verifyLegacyCore(snapshot) {
  const ok=snapshot.runtimeVersion===2?snapshot.coreHash===hash({core:snapshot.core,corePrompt:snapshot.corePrompt,basePrompt:snapshot.basePrompt})&&snapshot.promptHash===hash(snapshot.basePrompt)
    :hash(snapshot.basePrompt)===snapshot.promptHash;
  if(!ok)fail('The legacy prompt failed its integrity check.',409,'core_integrity');
}
export const questions=[
  {id:'introduction',category:'user_fact',text:'What should I call you, and what would you like from our conversations?'},
  {id:'daily_life',category:'user_fact',text:'What takes up most of your time these days?'},
  {id:'interests',category:'interest',text:'Which three subjects could you happily talk about for a long time?'},
  {id:'current_goal',category:'goal',text:'Is there a project or question you would like me to remember?'},
  {id:'support',category:'preference',text:'After a difficult day, do you prefer listening, questions or practical ideas?'},
  {id:'humor',category:'preference',text:'What kind of humor works for you, and what tends to annoy you?'},
  {id:'disagreement',category:'preference',text:'How direct should I be when I see a weakness in your idea?'},
  {id:'memory',category:'preference',text:'What should I remember between chats, and what should stay in the conversation?'}
];
export const scenes=[
  {id:'support',title:'After a frustrating day',situation:'I worked hard on something and nobody seemed to notice.',choices:[
    {text:'That sounds disappointing. Would you like to look at what happened?',settings:{warmth:4}},
    {text:'That stings, especially when you cared about getting it right. I am here; tell me the part that bothered you most.',settings:{warmth:8}}
  ]},
  {id:'disagreement',title:'An idea with a weak point',situation:'Everyone liked my idea, so I think it is certain to work.',choices:[
    {text:'That is encouraging. What would give you a stronger signal before you commit?',settings:{independence:3,intellectual_style:4}},
    {text:'I would separate liking an idea from choosing to use it. What could we test that would tell those apart?',settings:{independence:8,intellectual_style:8}}
  ]},
  {id:'initiative',title:'A quiet conversation',situation:'Nothing special happened today. I took a walk.',choices:[
    {text:'A quiet day and a walk can be enough.',settings:{initiative:2}},
    {text:'I like the small details in days like that. Was there anything on the walk you would usually have passed without noticing?',settings:{initiative:8}}
  ]}
];
export const ruleCatalog={ask_before_advice:'Ask whether listening or advice would help before offering a plan.',use_concrete_examples:'Prefer concrete examples when explaining unfamiliar ideas.',avoid_repeated_questions:'Avoid asking for information the user has already supplied.',respect_humor_context:'Keep humor aligned with explicitly stated preferences and the current situation.'};
