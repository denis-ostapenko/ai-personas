import test from 'node:test';
import assert from 'node:assert/strict';
import { hash } from '../src/core.mjs';
import { initialState } from '../src/persona.mjs';
import { addMemory,forgetMemory } from '../src/memory.mjs';
import { ensureRuntime,hasForgottenText,maskForgotten,recentContext } from '../src/conversation-memory.mjs';

function forgotten(quote) {
  const state=initialState();ensureRuntime(state);
  const memory=addMemory(state,{quote,category:'user_fact',sourceId:'source',sourceType:'chat'});forgetMemory(state,memory.id);return state;
}
// v0.3 hashed every capitalized word and every number of a forgotten fact and compared them
// with each single word of later messages, which silently removed unrelated messages.
test('forgetting an English fact no longer suppresses sentence starters, weekdays or bare numbers',()=>{
  const s=forgotten('Yesterday I met Anna at Google and we booked 12 seats.');
  for(const text of ['Yesterday was a strange day.','I need 12 chairs for the kitchen.','We booked a table.','I love documentary films.'])assert.equal(hasForgottenText(s,text),false,text);
  for(const text of ['Anna called me.','We booked 12 seats again.'])assert.equal(hasForgottenText(s,text),true,text);
  assert.equal(maskForgotten(s,'Anna called me.'),'[forgotten detail] called me.');
  assert.equal(maskForgotten(s,'Google Maps sent me the wrong way.'),'[forgotten detail] Maps sent me the wrong way.');
});
test('forgetting a Russian fact catches declined names and leaves unrelated words alone',()=>{
  const s=forgotten('Мою сестру зовут Анна, она живёт в Казани.');
  for(const text of ['Анна звонила вчера.','Вчера говорил с Анной.','Я был в Казани.'])assert.equal(hasForgottenText(s,text),true,text);
  for(const text of ['Сегодня хороший день.','Аннотация к книге готова.','Мою машину починили.'])assert.equal(hasForgottenText(s,text),false,text);
  assert.equal(maskForgotten(s,'Вчера говорил с Анной.'),'Вчера говорил с [forgotten detail].');
});
test('recent context keeps unrelated messages and masks only the forgotten detail',()=>{
  const s=forgotten('My manager Brian said the launch is on Friday.');
  const chat={id:'c',messages:[{id:'1',role:'user',text:'On Friday I want to watch a film.'},{id:'2',role:'assistant',text:'Which film?'},{id:'3',role:'user',text:'Brian will join us.'}]};
  assert.deepEqual(recentContext(s,chat,24),[{role:'user',content:'On Friday I want to watch a film.'},{role:'assistant',content:'Which film?'},{role:'user',content:'[forgotten detail] will join us.'}]);
});
test('v0.3 fingerprints keep protecting names without blocking numbers or ordinary words',()=>{
  const s=initialState();ensureRuntime(s);s.runtime.forgottenFingerprints=[hash('cedar'),hash('my street is'),hash('street is cedar'),hash('12')];
  assert.equal(hasForgottenText(s,'Cedar is a nice street.'),true);assert.equal(hasForgottenText(s,'I need 12 chairs.'),false);assert.equal(hasForgottenText(s,'My street is quiet.'),false);
});
test('stating a forgotten fact again explicitly releases its fingerprints',()=>{
  const s=forgotten('My dog is called Juniper.');assert.equal(hasForgottenText(s,'Juniper barked.'),true);
  addMemory(s,{quote:'My dog is called Juniper.',category:'user_fact',sourceId:'again',sourceType:'chat'});assert.equal(hasForgottenText(s,'Juniper barked.'),false);
});
