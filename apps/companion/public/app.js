const $=s=>document.querySelector(s);
const node=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
let state=null,selected=null,tab='character',draft={},busy=false,introHidden=false,connected=false;
const date=value=>value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Not yet';
const activeMemories=()=>state.memories.filter(m=>m.status==='active');
function button(label,fn,cls='button') {const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function notice(message){$('#notice').textContent=message;$('#notice').hidden=!message;}
function showError(message){$('#error').textContent=message;$('#error').hidden=!message;}
function pending(on,label='Persona is thinking…') {
  busy=on;$('#busy-message').hidden=!on;$('#busy-message').textContent=label;
  document.querySelectorAll('button,input,textarea').forEach(e=>{if(!e.matches('[data-tab],#settings-toggle,#close-inspector'))e.disabled=on;});
}
async function load() {
  try {const r=await fetch('/api/state'),data=await r.json();if(!r.ok)throw new Error(data.error?.message||'Could not load persona.');state=data.state;connected=data.configured;selected=state.activeChatId;draft={...state.settings};render();}
  catch(e){showError(e.message);$('#connection').textContent='Unavailable';}
}
async function act(kind,extra={},label) {
  if(busy||!state)return false;showError('');pending(true,label);
  try {
    const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json','x-persona-client':'1'},body:JSON.stringify({kind,revision:state.revision,...extra})});
    const data=await r.json();
    if(!r.ok){if(data.error?.code==='stale_revision'){await load();}throw new Error(data.error?.message||'The request failed.');}
    state=data.state;connected=data.configured;
    if(['new_chat','message','reset'].includes(kind))selected=state.activeChatId;
    if(['settings','finish_onboarding','reset'].includes(kind))draft={...state.settings};
    render();return true;
  }catch(e){showError(e.message);return false;}
  finally{pending(false);}
}
async function startChat(){if(await act('new_chat',{remember:$('#remember').checked})){introHidden=true;renderIntro();$('#message').focus();}}
function render(){renderChats();renderConversation();renderIntro();renderPanel();$('#connection').textContent=connected?'Connected locally':'AI not configured';$('#reset').disabled=busy;}
function renderChats(){
  const selector=$('#mobile-history');selector.replaceChildren();const empty=node('option','','Choose a conversation');empty.value='';selector.append(empty);for(const c of [...state.chats].reverse()){const option=node('option','',c.title);option.value=c.id;selector.append(option);}selector.value=selected||'';selector.hidden=!state.chats.length;
  const list=$('#chat-list');list.replaceChildren();
  if(!state.chats.length)list.append(node('p','sidebar-empty','Your conversations will live here. The character continues between them.'));
  for(const chat of [...state.chats].reverse()){
    const row=node('div',`chat-item${chat.id===selected?' current':''}`);
    row.append(button(chat.title,()=>{selected=chat.id;introHidden=true;renderChats();renderConversation();renderIntro();renderPanel();},'chat-button'));
    const del=button('×',async()=>{if(confirm('Delete this conversation? Saved memories will remain.')){if(await act('delete_chat',{chatId:chat.id})){if(selected===chat.id)selected=state.activeChatId;render();}}},'delete-chat');del.setAttribute('aria-label',`Delete ${chat.title}`);row.append(del);list.append(row);
  }
}
function renderConversation(){
  const chat=state.chats.find(c=>c.id===selected),view=$('#conversation');view.replaceChildren();
  $('#chat-title').textContent=chat?.messages.length?chat.title:'Room for a real conversation.';
  if(!chat?.messages.length){
    const welcome=node('div','welcome');const orb=node('div','orb');orb.setAttribute('aria-hidden','true');welcome.append(orb,node('h2','','A familiar voice.\nAn unfolding story.'));
    welcome.append(node('p','','Bring a thought, a question, or just your day. Shape the character, get acquainted, and let a shared history take form.'));
    const starters=node('div','starters');for(const s of ['Something on my mind','Let’s explore an idea','Tell me about yourself'])starters.append(button(s,()=>{$('#message').value=s;$('#message').focus();},'starter'));
    welcome.append(starters);if(!state.onboarding.complete&&introHidden)welcome.append(button('Get acquainted',()=>{introHidden=false;renderIntro();},'button secondary-action'));view.append(welcome);
  }else for(const m of chat.messages){
    const article=node('article',`message ${m.role}`);article.append(node('div','message-label',m.role==='user'?'YOU':'PERSONA'),node('div','message-body',m.text));
    if(m.trace?.memoriesSaved)article.append(node('div','message-meta',`${m.trace.memoriesSaved} detail${m.trace.memoriesSaved===1?'':'s'} remembered`));view.append(article);
  }
  const meta=$('#session-meta');meta.replaceChildren();
  if(chat){meta.append(document.createTextNode(`Character version ${chat.snapshot.settingsVersion} · ${chat.remember?'Memory on':'Session-only memory'} `));
    if(chat.snapshot.settingsVersion!==state.settingsVersion)meta.append(button('Apply saved character here',()=>act('apply_settings',{chatId:chat.id}),'text-button'));
    const mobileNew=button('New conversation',startChat,'text-button');mobileNew.classList.add('mobile-new');meta.append(document.createTextNode(' · '),mobileNew);
  }else meta.textContent='Your saved character will be used for the next conversation.';
  $('#remember').checked=chat?chat.remember:$('#remember').checked;$('#remember').title=chat?'This option applies when you start a new conversation.':'Choose whether the next conversation can create lasting memories.';
  requestAnimationFrame(()=>{view.scrollTop=view.scrollHeight;});
}
function renderIntro(){
  const section=$('#introduction');section.replaceChildren();section.hidden=state.onboarding.complete||introHidden;
  $('#conversation').hidden=!section.hidden&&!state.chats.find(c=>c.id===selected)?.messages.length;
  if(section.hidden)return;
  const step=state.onboarding.step;
  if(step<state.questions.length){
    const question=state.questions[step];section.append(node('div','intro-progress',`GETTING ACQUAINTED · ${step+1} OF ${state.questions.length}`),node('h2','',question.text));
    const input=node('textarea');input.id='intro-answer';input.rows=2;input.maxLength=2000;input.placeholder='Share as much or as little as you like.';input.setAttribute('aria-label',question.text);section.append(input);
    const actions=node('div','intro-actions'),label=node('label'),remember=node('input');remember.type='checkbox';remember.checked=true;remember.id='intro-remember';label.append(remember,document.createTextNode(' Remember this'));
    actions.append(button('Continue',()=>act('onboarding_answer',{answer:input.value,remember:remember.checked}),'button primary'),button('Skip',()=>act('onboarding_answer',{answer:'',remember:false}),'text-button'),label);section.append(actions);
  }else{
    const missing=state.scenes.find(s=>state.onboarding.calibration[s.id]===undefined);
    if(missing){section.append(node('div','intro-progress','FIND YOUR RHYTHM · THREE SMALL SCENES'),node('h2','',missing.situation));missing.choices.forEach((c,i)=>section.append(button(c.text,()=>act('calibrate',{sceneId:missing.id,choice:i}),'intro-choice')));section.append(node('p','intro-footnote','Which response would you prefer? These are authored examples.'));
    }else{
      section.append(node('div','intro-progress','A STARTING POINT, NOT A LABEL'),node('h2','','Your first portrait is ready.'));
      section.append(node('p','panel-intro',`${activeMemories().length} detail${activeMemories().length===1?'':'s'} saved. Review them in Memory whenever you like. You can adjust every character setting.`));
      const portrait=node('ul','portrait');for(const memory of activeMemories())portrait.append(node('li','',memory.quote));section.append(portrait);
      const suggested={...state.settings};for(const scene of state.scenes){const choice=state.onboarding.calibration[scene.id];if(choice!==undefined)Object.assign(suggested,scene.choices[choice].settings);}
      section.append(node('p','help',state.controls.map(c=>`${c.label}: ${suggested[c.id]}`).join(' · ')));
      const actions=node('div','intro-actions');actions.append(button('Use suggested character',async()=>{if(await act('finish_onboarding',{applySuggestions:true}))await startChat();},'button primary'),button('Keep my settings',async()=>{if(await act('finish_onboarding',{applySuggestions:false}))await startChat();},'button'));section.append(actions);
    }
  }
  section.append(button('Start chatting now',()=>{introHidden=true;renderIntro();$('#message').focus();},'text-button intro-footnote'));
}
function renderPanel(){const panel=$('#panel');panel.replaceChildren();document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));if(tab==='character')characterPanel(panel);if(tab==='memory')memoryPanel(panel);if(tab==='review')reviewPanel(panel);if(tab==='state')statePanel(panel);}
function characterPanel(panel){
  panel.append(node('p','panel-intro',`${state.controls.length} dimensions, one character. Adjust the balance and bring it into your next conversation.`));
  for(const c of state.controls){
    const block=node('div','control'),top=node('div','control-top'),label=node('label','',c.label),output=node('output','',String(draft[c.id]));label.htmlFor=`control-${c.id}`;output.htmlFor=`control-${c.id}`;
    const input=node('input');input.type='range';input.id=`control-${c.id}`;input.min='0';input.max='10';input.step='1';input.value=draft[c.id];input.setAttribute('aria-label',c.label);
    input.addEventListener('input',()=>{draft[c.id]=Number(input.value);output.value=input.value;updatePreview();});top.append(label,output);const ends=node('div','control-ends');ends.append(node('span','',c.low),node('span','',c.high));block.append(top,input,ends);panel.append(block);
  }
  panel.append(button('Save character',async()=>{if(await act('settings',{settings:draft}))notice('Character saved. New conversations will use these settings.');},'button primary'));
  panel.append(node('p','help','0-3: low · 4-6: balanced · 7-10: high. Each band has distinct dialogue rules.'));
  const chat=state.chats.find(c=>c.id===selected);if(chat&&chat.snapshot.settingsVersion!==state.settingsVersion)panel.append(button('Apply to this conversation',()=>act('apply_settings',{chatId:chat.id}),'button secondary-action'));
  if(!state.onboarding.complete)panel.append(button('Continue getting acquainted',()=>{introHidden=false;renderIntro();$('#inspector').classList.remove('open');},'button secondary-action'));
  const preview=node('details','preview');preview.append(node('summary','','Illustrative response styles'));const box=node('div');box.id='style-preview';preview.append(box);panel.append(preview);updatePreview();
}
function updatePreview(){
  const box=$('#style-preview');if(!box)return;box.replaceChildren();
  const lines=[draft.warmth>=7?'You put a lot into that. I can see why it stayed with you.':draft.warmth<=3?'That sounds inconvenient.':'That sounds disappointing after all that preparation.',
    draft.independence>=7?'I do not think the conclusion follows. Interest is not the same as commitment.':draft.independence<=3?'Could there be another explanation?':'I see the appeal, but I would test that assumption.',
    draft.initiative>=7?'That connects to something we left unfinished. Shall we pick it up?':draft.initiative<=3?'I would choose the quieter route.':'There might be an interesting connection here.',
    draft.composure>=7?'That landed badly, but let us stay with the actual question.':draft.composure<=3?'That annoys me, and I am going to say so.':'That stung a little. Here is why I still disagree.'];
  for(const line of lines)box.append(node('p','',line));box.append(node('p','help',`${draft.humor>=7?'Playful':draft.humor<=3?'Serious':'Lightly witty'} · ${draft.intellectual_style>=7?'Analytical':draft.intellectual_style<=3?'Plainspoken':'Everyday depth'}. Authored examples, not generated predictions.`));
}
function memoryPanel(panel){
  const memories=activeMemories();
  const episodes=state.runtime?.episodes||[];
  if(episodes.length){const history=node('details','preview');history.append(node('summary','',`${episodes.length} shared conversation episodes`));for(const e of episodes.slice(-8).reverse()){const card=node('div','memory-card');card.append(node('strong','',e.topic),node('p','memory-quote',e.userQuote.slice(0,220)),node('p','help',`Persona: ${e.personaAction.slice(0,220)}`));history.append(card);}panel.append(history);}
  const old=state.memories.filter(m=>m.status==='superseded');
  if(old.length){const versions=node('details','preview');versions.append(node('summary','',`${old.length} earlier fact versions`));for(const m of old)versions.append(node('p','memory-quote',`${m.quote} (superseded)`));panel.append(versions);}
  const cells=state.runtime?.cells||[];
  if(cells.length){const patterns=node('details','preview');patterns.append(node('summary','',`${cells.length} reaction cells with shared experience`));for(const c of cells)patterns.append(node('p','help',`${c.policyId.replaceAll('_',' ')}: ${c.support.length} supporting episodes, ${c.counterexamples.length} counterexamples`));panel.append(patterns);}
  panel.append(node('p','panel-intro',`${memories.length} remembered detail${memories.length===1?'':'s'}. These are your words, with their source. You can correct or forget them.`));
  if(!memories.length)panel.append(node('p','empty','Start with the introduction, add a detail below, or let useful details emerge in conversation.'));
  for(const m of [...memories].reverse()){
    const card=node('div','memory-card');card.append(node('div','memory-category',m.category.replaceAll('_',' ')),node('p','memory-quote',m.quote),node('div','memory-date',`${date(m.createdAt)} · ${m.sourceType.replaceAll('_',' ')}`));
    const actions=node('div','memory-actions');actions.append(button('Edit',()=>{
      actions.replaceChildren();const input=node('textarea','memory-input');input.value=m.quote;input.maxLength=2000;input.setAttribute('aria-label','Correct memory');card.append(input,node('p','help','Saving creates a corrected version. Earlier statements and shared experiences remain available as history.'));
      actions.append(button('Save correction',()=>act('memory_edit',{memoryId:m.id,quote:input.value}),'text-button'),button('Cancel',renderPanel,'text-button'));
    },'text-button'),button('Forget',async()=>{if(confirm('Forget this detail and its earlier corrections from long-term memory? Other memories and saved conversations stay unchanged. The detail may still appear in earlier messages.')){if(await act('memory_forget',{memoryId:m.id}))notice('Detail forgotten. Other memories and conversations are preserved.');}},'text-button'));card.append(actions);panel.append(card);
  }
  const form=node('form','memory-add'),label=node('label','','Something to remember'),input=node('textarea','memory-input');input.id='new-memory';input.rows=3;input.maxLength=2000;label.htmlFor=input.id;input.placeholder='For example: I enjoy architecture and quiet walks.';const save=button('Remember this',()=>{});save.type='submit';form.append(label,input,save);form.addEventListener('submit',async e=>{e.preventDefault();if(await act('memory_add',{quote:input.value}))notice('Detail remembered.');});panel.append(form);
}
const CHANNEL_ORDER=['anger','hurt','tension','amusement','joy','empathy','reflection'];
const svg=(tag,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
const anchorText=id=>state.identity?.anchors?.find(a=>a.id===id)?.text;
function timeline(chat,labels){
  const points=chat.messages.filter(m=>m.role==='assistant'&&m.trace?.affect?.values).slice(-40);
  if(points.length<2)return null;
  const keys=CHANNEL_ORDER.filter(k=>points.some(p=>k in p.trace.affect.values)),row=22,width=300,left=104;
  const box=svg('svg',{viewBox:`0 0 ${width} ${keys.length*row+6}`,class:'timeline',role:'img','aria-label':'Reactions across this conversation'});
  const x=i=>left+i*(width-left-6)/Math.max(1,points.length-1);
  keys.forEach((k,r)=>{
    const base=r*row+row,label=svg('text',{x:0,y:base-6,class:'timeline-label'});label.textContent=labels[k]||k;box.append(label,svg('line',{x1:left,x2:width-6,y1:base,y2:base,class:'timeline-axis'}));
    const coords=points.map((p,i)=>`${x(i)},${base-(p.trace.affect.values[k]||0)*(row-6)}`).join(' ');
    box.append(svg('polyline',{points:coords,class:`timeline-line${k==='reflection'?' cognition':''}`}));
    points.forEach((p,i)=>{if(p.trace.affect.active?.includes(k)||(k==='reflection'&&p.trace.affect.cognition?.engaged)){const dot=svg('circle',{cx:x(i),cy:base-(p.trace.affect.values[k]||0)*(row-6),r:2.2,class:'timeline-dot'});const tip=svg('title');tip.textContent=`${labels[k]||k}: ${Math.round(p.trace.affect.values[k]*100)}%`;dot.append(tip);box.append(dot);}});
  });
  return box;
}
function statePanel(panel){
  const chat=state.chats.find(c=>c.id===selected),trace=chat?.messages.filter(m=>m.role==='assistant').at(-1)?.trace;
  panel.append(node('p','panel-intro','The character stays itself while its reactions and shared history evolve.'));
  if(!trace?.affect){panel.append(node('p','empty','Start a conversation to see the current reactions.'));return;}
  const affect=trace.affect,labels={anger:'Anger',amusement:'Amusement',reflection:'Absorbed thought',empathy:'Empathic resonance',...(state.expressionLabels||{})};
  const now=node('section','review-section');now.append(node('h3','','After the last reply'));
  for(const key of CHANNEL_ORDER.filter(k=>k in affect.values)){
    const value=affect.values[key],live=affect.active.includes(key)||(key==='reflection'&&affect.cognition?.engaged);
    const row=node('div',`reaction-row${live?' live':''}`),label=node('label','',labels[key]||key),meter=node('meter');meter.min=0;meter.max=1;meter.value=value;meter.setAttribute('aria-label',labels[key]||key);
    row.append(label,meter,node('span','',`${Math.round(value*100)}%`));now.append(row);
    const cause=affect.causes?.[key];
    if(live&&cause){const why=node('p','reaction-cause',`Because: “${cause.quote}”`);const touched=(cause.anchors||[]).map(anchorText).filter(Boolean);if(touched.length)why.append(node('span','reaction-anchor',` · touches: ${touched.join(', ')}`));now.append(why);}
  }
  now.append(node('p','help',affect.active.length?`Expressed together: ${affect.active.map(k=>labels[k]||k).join(' + ')}`:'No strong reaction is active.'));
  if(affect.mood){const v=affect.mood.valence;now.append(node('p','help',`Underlying mood: ${Math.abs(v)<0.2?'even':v>0?'lighter':'heavier'} (${v>0?'+':''}${Math.round(v*100)}). Moods fade over hours.`));}
  if(affect.conflictOpen)now.append(node('p','help','Unresolved friction: irritation fades more slowly until it is addressed.'));
  for(const cell of trace.reactionCells?.selected||[])now.append(node('p','help',`Reaction pattern: ${cell.cellId.replaceAll('_',' ')}`));
  if(trace.affectEvent?.reunion)now.append(node('p','help','Glad to pick the conversation up again after a pause.'));
  if(trace.appraisal?.status==='fallback')now.append(node('p','help','Event interpretation was unavailable. Reactions decayed as on an ordinary turn.'));
  else if(trace.appraisal?.dropped?.length)now.append(node('p','help',`Some unsupported interpretation details were discarded (${trace.appraisal.dropped.length}); the reaction itself was kept.`));
  panel.append(now);
  const line=timeline(chat,labels);
  if(line){const history=node('section','review-section');history.append(node('h3','','Across this conversation'),line,node('p','help','Dots mark reactions that were expressed. Values are stored with each reply.'));panel.append(history);}
  const rel=state.runtime?.relationship;
  if(rel){const section=node('section','review-section');section.append(node('h3','','Relationship'));
    for(const [label,value] of [['Familiarity',rel.familiarity],['Affinity',(rel.affinity+1)/2],['Trust',rel.trust]]){const row=node('div','reaction-row'),meter=node('meter');meter.min=0;meter.max=1;meter.value=value;meter.setAttribute('aria-label',label);row.append(node('label','',label),meter,node('span','',`${Math.round(value*100)}%`));section.append(row);}
    section.append(node('p','help',`${rel.events} remembered exchanges. Changes slowly and fades over weeks without contact. Forgetting a detail removes its contribution.`));panel.append(section);}
  const work=state.runtime?.conversations?.[chat.id];
  const section=node('section','review-section');section.append(node('h3','','Conversation threads'));
  for(const topic of work?.topics||[]){const card=node('div','memory-card');card.append(node('strong','',topic.title),node('div','memory-date',topic.id===work.activeTopicId?'Current topic':'Earlier topic'));
    for(const item of topic.entries.filter(e=>e.status==='active'))card.append(node('p','memory-quote',`${item.kind.replaceAll('_',' ')}: ${item.quote}`));section.append(card);}
  panel.append(section);
  const detail=node('details','preview');detail.append(node('summary','','Memory connections and identity'));
  detail.append(node('p','help',`Identity ${chat.snapshot.identityVersion}. ${trace.graph?.nodes||0} memory nodes and ${trace.graph?.edges||0} connections. ${trace.selectedMemoryIds?.length||0} facts and ${trace.selectedEpisodeIds?.length||0} shared episodes recalled.`));
  for(const path of trace.activation||[]){if(!path.via)continue;const memory=state.memories.find(m=>m.id===path.id),episode=state.runtime?.episodes.find(e=>e.id===path.id);detail.append(node('p','help',`${path.type||'linked'}: ${(memory?.quote||episode?.topic||'Earlier episode').slice(0,160)}`));}
  panel.append(detail,node('p','help','State shown is the last completed reply. Recovery is calculated when the next message arrives.'));
}
function reviewPanel(panel){
  const d=state.documents;panel.append(node('p','panel-intro','A separate session reads the persona’s documentation, organizes its memories and checks that nothing was lost.'));
  panel.append(node('div','review-label','DOCUMENTATION'),node('div','review-version',`Version ${d.version}`),node('div','review-label',`Last review: ${date(d.reviewedAt)}`));
  const run=button('Review documentation',async()=>{if(await act('review',{},'Reviewing the complete persona dossier…'))notice('Documentation reviewed. Every active memory was preserved; character settings are unchanged.');},'button primary secondary-action');panel.append(run);
  if(d.checks)panel.append(node('p','help',`${d.manifest.length} documents covered. All active memories preserved. Dialogue suggestions are not applied automatically.`));
  const schedule=node('section','review-section'),label=node('label','schedule-label'),check=node('input');check.type='checkbox';check.checked=state.schedule.enabled;check.addEventListener('change',()=>act('schedule',{enabled:check.checked}));label.append(check,document.createTextNode('Enable periodic reviews'));schedule.append(label,node('p','','After 10 substantive completed chats or 7 days with new material. Reviews use the AI connection while this local server is running.'));
  if(state.schedule.lastFailureAt)schedule.append(node('p','','The last automatic review could not finish. The previous version is preserved; a retry is deferred for one hour.'));
  panel.append(schedule);
  const groups=node('section','review-section');groups.append(node('h3','','Memory organization'));if(!d.groups.length)groups.append(node('p','','No memories to organize yet.'));for(const g of d.groups)groups.append(node('p','',`${g.topic} · ${g.memoryIds.length}`));panel.append(groups);
  if(d.proposals.length){const proposals=node('section','review-section');proposals.append(node('h3','','Suggestions to evaluate'));for(const p of d.proposals)proposals.append(node('p','',state.ruleCatalog[p.ruleId]));proposals.append(node('p','help','Recorded as proposals. Your active dialogue rules are unchanged.'));panel.append(proposals);}
  const method=node('section','review-section');method.append(node('h3','','Research context'),node('p','',d.research?.date?`Local research digest: ${d.research.date}. This review did not browse the web.`:'The next review will use the latest available local research digest.'));panel.append(method);
  if(state.documentHistory.length){const history=node('section','review-section');history.append(node('h3','','Previous versions'));for(const v of [...state.documentHistory].reverse())history.append(button(`Restore version ${v.version}`,async()=>{if(await act('rollback',{version:v.version}))notice('Earlier organization restored as a new version. Current memories were preserved.');},'button history-button'));panel.append(history);}
}
$('#composer').addEventListener('submit',async e=>{
  e.preventDefault();const message=$('#message').value.trim();if(!message||busy)return;
  if(!state.chats.some(c=>c.id===selected)){if(!await act('new_chat',{remember:$('#remember').checked}))return;}
  introHidden=true;renderIntro();if(await act('message',{chatId:selected,message})){$('#message').value='';$('#message').focus();}
});
$('#message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#composer').requestSubmit();}});
$('#new-chat').addEventListener('click',startChat);
$('#mobile-history').addEventListener('change',e=>{if(e.target.value){selected=e.target.value;introHidden=true;render();}});
$('#settings-toggle').addEventListener('click',()=>$('#inspector').classList.toggle('open'));
$('#close-inspector').addEventListener('click',()=>$('#inspector').classList.remove('open'));
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;renderPanel();pending(busy);}));
$('#reset').addEventListener('click',async()=>{if(confirm('Reset this persona? This permanently removes your saved conversations, memories, introduction and settings from this browser profile.')){if(await act('reset',{confirm:'RESET'})){introHidden=false;render();notice('Your persona has been reset.');}}});
void load();
