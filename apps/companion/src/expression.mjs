import { emotionChannels } from './temperament.mjs';
import { describeRelationship } from './relationship.mjs';

const bandOf=value=>value<0.45?'low':value<0.7?'mid':'high';
const level=value=>value<=3?'low':value<=6?'mid':'high';
const REFUSAL=/^\s*(no|nope|нет|не-а)\b/iu;

// Deterministic observations about the persona's own recent replies.
export function styleGuard(messages=[]) {
  const replies=messages.filter(m=>m.role==='assistant').slice(-6);
  const lastThree=replies.slice(-3);
  return {repeatedRefusal:lastThree.length>=3&&lastThree.filter(m=>REFUSAL.test(m.text)).length>=2,
    noQuestions:replies.length>=6&&!replies.some(m=>/[?？]\s*$/.test(m.text.trim()))};
}
function styleNotes(policy,channel,settings) {
  return (policy.style?.[channel]||[]).filter(rule=>Object.entries(rule.when).every(([k,v])=>level(settings[k])===v)).map(rule=>rule.text);
}
// LAYER 2 rendering: trusted authored fragments chosen by state, never memory text as instructions.
export function reactionInstructions(affect,{core,messages=[],relationship=null}={}) {
  const policy=core.expression,settings=core.settings,t=core.temperament,lines=[];
  for(const k of affect.active) {
    const value=affect.values[k],shown=value*t.channels[k].expressiveness;
    const parts=[`${policy.labels[k].toUpperCase()} (${bandOf(value)}): ${policy.channels[k][bandOf(value)]}`,...styleNotes(policy,k,settings)];
    if(shown<t.channels[k].enter)parts.push(policy.displayHidden);
    // The cause is quoted user text, so it stays in the evidence block, never in instructions.
    if(affect.causes?.[k])parts.push('Its cause is quoted in the evidence under personaState.causes; react to that, not to the topic in general.');
    lines.push(parts.join(' '));
  }
  if(affect.active.length===2){const mix=policy.mixtures[[...affect.active].sort().join('+')];if(mix)lines.push(`TOGETHER: ${mix}`);}
  if(affect.cognition?.engaged)lines.push(`${policy.labels.reflection.toUpperCase()}: ${policy.channels.reflection[bandOf(affect.values.reflection)]}`);
  if(!lines.length)lines.push('No strong reaction is active. Continue in your own character; do not manufacture drama or default to support.');
  const mood=affect.mood?.valence||0;
  if(Math.abs(mood)>=0.2)lines.push(`Underlying mood: ${mood>0?'lighter':'heavier'} than usual. Let it tint the tone, not drive the content.`);
  if(relationship){const r=describeRelationship(relationship);if(r.familiarity!=='new')lines.push(`Relationship: ${r.familiarity}, ${r.affinity} affinity, ${r.trust} trust. Interpret teasing and criticism in that light.`);}
  const guard=styleGuard(messages);
  if(guard.repeatedRefusal)lines.push(policy.guards.repeatedRefusal);
  if(guard.noQuestions&&(affect.cognition?.engaged||settings.initiative>=5))lines.push(policy.guards.noQuestions);
  return `LAYER 2: CURRENT EXPRESSION\n${lines.join('\n')}\n${policy.closing}`;
}
export const expressionChannels=emotionChannels;
