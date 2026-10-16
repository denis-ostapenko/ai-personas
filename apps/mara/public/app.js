const $ = id => document.getElementById(id);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const readPreference = key => { try { return localStorage.getItem(`mara-${key}`); } catch { return null; } };
const savePreference = (key, value) => { try { localStorage.setItem(`mara-${key}`, value); } catch {} };
let state, page = 'chat', selectedSession = null, busy = false, configured = false, budget, restoreVersion;
let partner = readPreference('partner') || 'visitor';
let refreshNumber = 0, searchNumber = 0;
$('partner').value = partner;
const date = value => new Date(value).toLocaleDateString('en', {month:'short', day:'numeric'});
const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const titleCase = value => value.replaceAll('_', ' ').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
const currentSession = () => state?.memory?.sessions.findLast(s => s.partner === partner && !s.closedAt);
const sessions = () => state?.memory?.sessions.filter(s => s.partner === partner) || [];
const visibleTurns = () => state?.turns.filter(t => t.partner === partner && (!state.memory || t.sessionId === (selectedSession || currentSession()?.id))) || [];
const notify = (text = '', error = false) => { $('notice').textContent = text; $('notice').classList.toggle('error', error); };
async function api(path, data) {
  const response = await fetch(path, data ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)} : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}
function empty(target, title, text) {
  const block = node('div', undefined, 'empty-state');
  block.append(node('h3', title), node('p', text)); target.append(block);
}
function rawRecord(record) {
  const details = node('details'); details.append(node('summary', 'Technical details'), node('pre', JSON.stringify(record, null, 2))); return details;
}
function sourceButton(id) {
  const button = node('button', 'Read source', 'source-link'); button.type = 'button';
  button.onclick = () => {
    const source = state.experiences.find(e => e.id === id && e.partner === partner);
    if (!source) return notify('This source belongs to another conversation identity.');
    $('source-content').replaceChildren(node('p', `${date(source.at)} · ${source.partner}`, 'meta'), node('p', source.source, 'source-quote'));
    if (source.reply) $('source-content').append(node('div', `Mara\n${source.reply}`, 'source-reply'));
    $('source-dialog').showModal();
  }; return button;
}
function setBusy(value) {
  busy = value; $('messages').setAttribute('aria-busy', String(value));
  document.querySelectorAll('button,select,input,textarea').forEach(control => {
    if (control.matches('[data-page],[data-close],#open-settings,.conversation-item,.source-link')) return;
    control.disabled = value;
  });
  for (const id of ['send','initiative','reflect','tidy-memory']) $(id).disabled = value || !configured || budget?.used >= budget?.limit;
}
function showPage(next) {
  page = next;
  document.querySelectorAll('[data-page]').forEach(button => {
    if (button.dataset.page === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  for (const name of ['chat','memory','about']) $(`page-${name}`).hidden = name !== page;
  const titles = {chat:['CONVERSATION', selectedSession ? conversationTitle(selectedSession) : 'A little room to think.'], memory:['MEMORY', 'The threads we keep.'], about:['ABOUT MARA', 'A character, taking shape.']};
  $('page-label').textContent = titles[page][0]; $('page-title').textContent = titles[page][1];
}
function conversationTitle(sessionId) {
  const turn = state.turns.find(t => t.partner === partner && t.sessionId === sessionId && t.text);
  return turn ? turn.text.slice(0, 65) : 'New conversation';
}
function renderHistory() {
  const list = $('conversation-list'); list.replaceChildren();
  const choices = [...sessions()].reverse();
  if (!choices.length) choices.push({id:'legacy', startedAt:state.versions[0].at, closedAt:null});
  for (const session of choices) {
    const current = !session.closedAt;
    const button = node('button', undefined, 'conversation-item'); button.type = 'button';
    button.append(node('strong', conversationTitle(session.id)), node('span', `${date(session.startedAt)}${current ? ' · Current' : ''}`));
    if ((selectedSession || currentSession()?.id || 'legacy') === session.id) button.setAttribute('aria-current', 'true');
    button.onclick = () => { selectedSession = current ? null : session.id; renderHistory(); renderChat(); showPage('chat'); };
    list.append(button);
  }
}
function renderChat() {
  const messages = $('messages'); messages.replaceChildren();
  const turns = visibleTurns();
  for (const turn of turns) {
    if (turn.text) { const item = node('div', undefined, 'message user'); item.append(node('span', 'YOU', 'speaker'), node('div', turn.text)); messages.append(item); }
    const reply = node('div', undefined, 'message'); reply.append(node('span', 'MARA', 'speaker'), node('div', turn.reply)); messages.append(reply);
  }
  if (!turns.length) {
    const welcome = node('div', undefined, 'welcome');
    welcome.append(node('p', 'HELLO, I’M MARA', 'welcome-label'), node('h2', 'What has your curiosity today?'), node('p', 'An idea to untangle, a small experiment, or something you noticed. We can start there.'));
    const suggestions = node('div', undefined, 'suggestions');
    for (const [label, text] of [['Explore an idea','I have an idea I would like to think through.'],['Plan a small experiment','Help me find a small, practical experiment to try.'],['Pick up a thread','What were we working on in our earlier conversations?']]) {
      const button = node('button', label); button.type = 'button'; button.onclick = () => { $('message').value = text; $('message').focus(); }; suggestions.append(button);
    }
    welcome.append(suggestions); messages.append(welcome);
  }
  $('archived-note').hidden = !selectedSession; $('chat').hidden = !!selectedSession;
  messages.scrollTop = messages.scrollHeight;
}
function renderMemory() {
  const m = state.memory, target = $('memory-results'); target.replaceChildren();
  const summaries = m?.summaries.filter(s => s.partner === partner) || [];
  $('memory-heading').textContent = 'From our conversations';
  $('memory-status').textContent = `${countLabel(sessions().length, 'conversation')} · ${countLabel(summaries.length, 'summary', 'summaries')}`;
  if (m?.maintenanceError) $('memory-status').textContent += ' · Organization is paused; existing memories are available.';
  for (const summary of [...summaries].reverse().slice(0, 15)) {
    const card = node('article', undefined, 'memory-card'); card.append(node('div', date(summary.to), 'meta'));
    for (const item of summary.items) {
      card.append(node('p', item.text));
      for (const ref of item.references) card.append(sourceButton(ref.id));
    }
    target.append(card);
  }
  if (!summaries.length) empty(target, 'A history starts with a conversation.', 'Details collect here as you talk. You can also search the original messages.');
}
function renderAbout() {
  $('self-cards').replaceChildren();
  const labels = {selfDescription:'A sense of self', interests:'Interests', opinions:'Views', habits:'Habits', dispositions:'Temperament'};
  for (const [key, value] of Object.entries(state.current)) {
    const card = node('article', undefined, 'self-card'); card.append(node('h3', labels[key] || titleCase(key)), node('p', value)); $('self-cards').append(card);
  }
  const target = $('learning-cards'); target.replaceChildren();
  const names = {trial:'Taking shape', consolidated:'Practiced', retired:'Let go', revised:'Reconsidered', supported:'Supported'};
  for (const rule of state.learning?.rules || []) {
    const card = node('article', undefined, 'rule-card'), meta = node('div', undefined, 'meta');
    meta.append(node('span', names[rule.status] || rule.status, `status-tag ${rule.status}`), node('span', `${countLabel(rule.observations.length, 'outcome')} · ${rule.contexts.join(', ')}`));
    card.append(meta, node('h3', rule.kind === 'habit' ? titleCase(rule.action) : rule.proposition), node('p', rule.reason));
    if (rule.kind === 'belief') card.append(node('p', `Current expectation: ${Math.round(rule.probability * 100)}%`, 'muted'));
    const details = node('details'); details.append(node('summary', 'Experience behind this'));
    for (const ref of [...rule.evidence, ...rule.counterevidence]) details.append(sourceButton(ref.id));
    for (const observation of rule.observations.slice(-8)) {
      const row = node('div'); row.append(node('span', `${observation.value ? 'Worked' : 'Did not work'} · ${titleCase(observation.family || observation.domain)} `, 'muted'), sourceButton(observation.episodeId)); details.append(row);
    }
    card.append(details); target.append(card);
  }
  if (!target.children.length) empty(target, 'Room to develop.', 'Views and habits take shape through concrete experiences and their results.');
  const history = $('change-history'); history.replaceChildren();
  for (const change of [...state.changes].reverse()) {
    const card = node('article', undefined, 'change-card'); card.append(node('div', `${date(change.at)} · ${change.version !== undefined ? `Version ${change.version}` : change.status}`, 'meta'));
    if (change.mechanism === 'prospective_learning') {
      for (const field of ['habits','opinions']) if (change.before[field] !== change.after[field]) card.append(node('h3', titleCase(field)), node('p', change.after[field]));
    } else card.append(node('p', change.candidate?.rationale || `Restored version ${change.targetVersion}`));
    card.append(rawRecord(change)); history.append(card);
  }
  if (!state.changes.length) empty(history, 'The beginning.', 'Earlier versions will appear here as Mara develops.');
  if (state.version > 0) {
    const label = node('label', 'Earlier version'), select = node('select'); select.id = 'restore-version'; label.htmlFor = select.id;
    for (const version of state.versions.filter(v => v.version !== state.version)) { const option = node('option', `Version ${version.version} · ${date(version.at)}`); option.value = version.version; select.append(option); }
    const button = node('button', 'Restore this version', 'secondary'); button.type = 'button'; button.onclick = () => { restoreVersion = Number(select.value); $('restore-description').textContent = `Mara’s current self and learned rules will return to version ${restoreVersion}. This creates a new entry in the version history.`; $('restore-dialog').showModal(); };
    history.append(label, select, button);
  }
}
async function refresh(id = state?.id || readPreference('profile')) {
  const request = ++refreshNumber;
  const result = await api(`/api/state${id ? `?id=${encodeURIComponent(id)}` : ''}`);
  if (request !== refreshNumber) return;
  if (!result.state && result.instances.length) return refresh(result.instances.some(i => i.id === 'mara') ? 'mara' : result.instances[0].id);
  state = result.state; configured = result.configured; budget = result.budget;
  $('instance').replaceChildren(...result.instances.map(item => { const option = node('option', item.id); option.value = item.id; return option; }));
  if (!state) return;
  $('instance').value = state.id; savePreference('profile', state.id);
  if (selectedSession && !sessions().some(s => s.id === selectedSession)) selectedSession = null;
  $('connection').textContent = configured ? 'Connected' : 'Offline';
  $('connection-details').textContent = configured ? `Connected · ${state.origin.model}` : 'Add OPENAI_API_KEY to the server environment to start a conversation.';
  $('budget-details').textContent = `${budget.used} of ${budget.limit} API requests used. The setup guide explains how to change this limit.`;
  $('app-version').textContent = result.appVersion || '';
  $('profile-details').textContent = `${state.id} · Version ${state.version} · ${state.developing ? 'Developing' : 'Fixed personality'}`;
  $('profile-badge').hidden = state.id === 'mara' && !state.synthetic && !state.fixture;
  $('profile-badge').textContent = `${state.id}${state.synthetic ? ' · Simulation' : state.fixture ? ' · Example' : ''}`;
  $('origin-details').replaceChildren(node('p', state.origin.history), rawRecord(state.origin));
  $('technical-records').textContent = JSON.stringify({version:state.version, mood:state.mood, relationships:state.relationships, hypotheses:state.hypotheses, pendingTrials:state.learning?.trials.filter(t => !state.learning.receipts.some(r => r.trialId === t.id)).slice(-10), memory:state.memory && {lastMaintenance:state.memory.lastMaintenance,error:state.memory.maintenanceError}}, null, 2);
  renderHistory(); renderChat(); renderMemory(); renderAbout(); showPage(page); setBusy(busy);
}
async function act(path, data = {}) {
  if (busy) return; setBusy(true);
  const messages = { '/api/turn':'Mara is thinking…', '/api/initiative':'Mara is finding a thread…', '/api/session':'Opening a conversation…', '/api/memory':'Organizing memories…', '/api/reflect':'Reflecting on recent experience…', '/api/rollback':'Restoring the earlier version…' };
  notify(messages[path] || 'Saving…');
  const profile = state?.id;
  try {
    const result = await api(path, {id:profile, partner, ...data});
    if (path === '/api/turn') $('message').value = '';
    if (['/api/session','/api/create'].includes(path)) selectedSession = null;
    await refresh(path === '/api/create' ? data.id : profile);
    const warning = result.warning || result.reflectionError;
    notify(warning ? `Saved. A background step paused: ${warning}` : path === '/api/memory' ? 'Memory is up to date.' : path === '/api/reflect' ? 'Reflection complete.' : '');
    if (path === '/api/session') showPage('chat');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(false); if (page === 'chat' && !selectedSession) $('message').focus(); }
}
$('chat').onsubmit = event => { event.preventDefault(); if ($('message').value.trim()) act('/api/turn', {text:$('message').value.trim()}); };
$('message').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy && !$('send').disabled) $('chat').requestSubmit(); } };
$('new-session').onclick = () => act('/api/session');
$('return-current').onclick = () => { selectedSession = null; renderHistory(); renderChat(); showPage('chat'); };
$('initiative').onclick = () => act('/api/initiative');
$('reflect').onclick = () => act('/api/reflect');
$('tidy-memory').onclick = () => act('/api/memory');
$('open-settings').onclick = () => $('settings').showModal();
$('save-partner').onclick = async () => { if (!$('partner').reportValidity() || !$('partner').value.trim()) return; partner = $('partner').value.trim(); savePreference('partner', partner); selectedSession = null; searchNumber++; try { await refresh(); $('settings').close(); showPage('chat'); } catch (error) { $('settings').close(); notify(error.message, true); } };
$('instance').onchange = async () => { selectedSession = null; searchNumber++; try { await refresh($('instance').value); $('settings').close(); } catch (error) { notify(error.message, true); } };
$('create').onsubmit = async event => { event.preventDefault(); await act('/api/create', {id:$('new-id').value, developing:!$('fixed').checked}); if (state?.id === $('new-id').value) { $('settings').close(); showPage('chat'); } };
$('confirm-restore').onclick = () => { $('restore-dialog').close(); act('/api/rollback', {version:restoreVersion}); };
$('search-memory').onsubmit = async event => {
  event.preventDefault(); const request = ++searchNumber, id = state.id, identity = partner, button = event.target.querySelector('button'); button.disabled = true;
  $('memory-status').textContent = 'Searching…';
  try {
    const result = await api('/api/search', {id, partner:identity, query:$('memory-query').value});
    if (request !== searchNumber || state.id !== id || partner !== identity) return;
    const seen = new Set(), matches = [...result.memories].sort((a,b) => Number(b.level === 'episode') - Number(a.level === 'episode')).filter(memory => { const key = [...memory.sourceIds].sort().join('|'); if (seen.has(key)) return false; seen.add(key); return true; });
    $('memory-heading').textContent = 'Search results'; $('memory-status').textContent = `${countLabel(matches.length, 'match', 'matches')}${result.manifest.searchMode === 'lexical-fallback' ? ' · Keyword search' : ''}`;
    $('memory-results').replaceChildren();
    for (const memory of matches) {
      const card = node('article', undefined, 'memory-card'); card.append(node('div', `${date(memory.at)} · ${titleCase(memory.level)}`, 'meta'), node('p', memory.text));
      for (const source of memory.sourceIds.slice(0,3)) card.append(sourceButton(source)); $('memory-results').append(card);
    }
    if (!matches.length) empty($('memory-results'), 'No matching memory yet.', 'Try another word, a person’s name, or a more specific detail.');
  } catch (error) { if (request === searchNumber) $('memory-status').textContent = error.message; }
  finally { button.disabled = busy; }
};
document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => showPage(button.dataset.page));
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
refresh().catch(async () => { try { await refresh(''); } catch (error) { notify(error.message, true); } });
