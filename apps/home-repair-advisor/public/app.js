const $ = id => document.getElementById(id);
let current = null; let pendingImages = []; let busy = false;
const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
function showError(message) { $('error').textContent=message; $('error').hidden=!message; }
function setBusy(value, text='') { busy=value; $('job-form').setAttribute('aria-busy',String(value)); document.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=value); $('status').hidden=!value; $('status').textContent=text; }
async function api(url, method='GET', data) {
  const options={method,headers:{'X-Persona-Client':'1'},credentials:'same-origin'};
  if(data!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(data);}
  const response=await fetch(url,options); const result=await response.json();
  if(!response.ok)throw new Error(result.error?.message||'The request did not finish.');
  return result;
}
function link(text, url, cls) { const n=el('a',text,cls); n.href=url; n.target='_blank'; n.rel='noopener noreferrer'; return n; }
function citation(e) { const n=link('Source',e.url,'source-link'); n.title=`${e.title}. Retrieved ${new Date(e.checkedAt).toLocaleString()}. ${e.sourceKind.replaceAll('_',' ')}`; return n; }
function listSection(title, items) { const section=el('section'); section.append(el('h3',title)); const list=el('ul'); items.forEach(t=>list.append(el('li',t))); section.append(list); return section; }
function renderPhotos(images) { $('photo-preview').replaceChildren(...images.map((src,i)=>{const img=el('img');img.src=src;img.alt=`Job photo ${i+1}`;return img;})); }
function render() {
  $('empty').hidden=!!current; $('assessment').hidden=!current; $('conversation').hidden=!current; $('case-actions').hidden=!current;
  if(!current){$('providers').hidden=true;$('budget').hidden=true;return;}
  localStorage.setItem('home-repair-case',current.id);
  const a=current.assessment; $('zip').value=current.location.zip;
  $('description-label').textContent='Add details or answer the questions'; $('message').placeholder='Answer a question above, correct a detail, or add anything that changes the job.';
  $('submit').replaceChildren(document.createTextNode('Update my job'),el('span','↗'));
  const card=el('article',undefined,'panel assessment-card');
  card.append(el('div',`${current.location.city}, ${current.location.state} ${current.location.zip}`,'section-label'),el('h2',a.title),el('p',current.report?a.summary:a.reply));
  const grid=el('div',undefined,'detail-grid');
  grid.append(listSection('Likely work',a.scope),listSection('Materials & preparation',a.materials.length?a.materials:['To be confirmed with the provider.']));card.append(grid);
  if(a.duration)card.append(el('p',`Provisional timing: ${a.duration}`,'meta'));
  if(a.assumptions.length)card.append(el('p',`Assumptions: ${a.assumptions.join(' ')}`,'meta'));
  if(a.caution)card.append(el('p',a.caution,'error'));
  if(a.questions.length){const qs=el('div',undefined,'questions');qs.append(listSection('A few details to check',a.questions));card.append(qs);}
  const observed=el('details',undefined,'source-list');observed.append(el('summary','What I can see and what remains a possibility'));
  for(const o of a.observations)observed.append(el('p',`${o.basis==='photo'?'Photo':'You told me'}: ${o.detail}`));
  for(const h of a.hypotheses)observed.append(el('p',`Possible explanation: ${h}`));card.append(observed);
  if(current.memory?.facts.length){const remembered=el('details',undefined,'source-list');remembered.append(el('summary','Details I am using for this job'));
    remembered.append(el('p',`Current ZIP: ${current.location.zip}. These are your details; you can correct them below.`,'meta'));
    remembered.append(listSection('You told me',current.memory.facts.map(f=>f.evidence.quote)));card.append(remembered);}
  const brief=el('div',undefined,'brief');brief.append(el('strong','Your job brief','section-label'),el('p',a.jobBrief));
  const copy=el('button','Copy job brief','text-button');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(a.jobBrief);copy.textContent='Copied';}catch{showError('Select and copy the job brief above.');}};brief.append(copy);card.append(brief);
  if(a.searchReady){const find=el('button',current.report?'Refresh local options':'Find local options','primary');find.type='button';find.onclick=()=>findHelp();card.append(find);}
  $('assessment').replaceChildren(card);
  $('messages').replaceChildren(...current.messages.map(m=>{const n=el('div',undefined,'chat-message');n.append(el('strong',m.role==='user'?'YOU':'HOME REPAIR ADVISOR'),document.createTextNode(m.text));return n;}));
  renderReport();
}
function fact(parent,label,value,evidence){const p=el('p');p.append(el('strong',`${label}: `),document.createTextNode(value));if(evidence)p.append(citation(evidence));parent.append(p);}
const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
function renderBudget(report) {
  const estimate=report?.estimate;$('budget').hidden=!estimate;if(!estimate)return;
  const c=el('article',undefined,'panel budget-card');c.append(el('div','YOUR PRELIMINARY BUDGET','section-label'));
  if(estimate.status!=='estimated'){c.append(el('h2','A little more information first'),el('p',estimate.reason));$('budget').replaceChildren(c);return;}
  c.append(el('h2',`${usd(estimate.low)} - ${usd(estimate.high)}`),el('p',`${estimate.photoBased?'Photo + job details':'Job details'} · ${estimate.location} · ${estimate.confidence} confidence`,'meta'));
  const breakdown=el('div',undefined,'budget-breakdown');
  fact(breakdown,estimate.basis.kind==='hourly_labor'?'Estimated labor':'Published scope range',`${usd(estimate.work.low)} - ${usd(estimate.work.high)}`);
  fact(breakdown,'Materials allowance',estimate.basis.includesMaterials?'Included in the published rate':`${usd(estimate.materials.low)} - ${usd(estimate.materials.high)}`);
  c.append(breakdown,el('p',estimate.notice,'meta'));
  if(estimate.geography==='national')c.append(el('p','National price baseline. A local rate for this ZIP was not verified.','meta'));
  const details=el('details',undefined,'estimate-details');details.append(el('summary','How this estimate was calculated'));
  details.append(el('p',estimate.formula),el('p',`${estimate.quantity.low} - ${estimate.quantity.high} ${estimate.basis.kind==='hourly_labor'?'worker-hours':estimate.basis.unit+' units'} × ${usd(estimate.basis.low)} - ${usd(estimate.basis.high)} per ${estimate.basis.unit}. Total rounded outwards to $10.`),el('blockquote',estimate.basis.quote),citation(estimate.basis.evidence),el('p',estimate.basis.applicability,'meta'));
  if(estimate.minimumHours)details.append(el('p',`Published minimum: ${estimate.minimumHours} hours. ${estimate.basis.minimumHoursQuote}`,'meta'));
  details.append(listSection('Assumptions',estimate.assumptions),listSection('Not included',estimate.exclusions),el('p',estimate.rationale,'meta'));c.append(details);
  const first=report.providers.find(p=>p.phone);
  if(first){const callout=el('div',undefined,'first-call');callout.append(el('strong',`Suggested first call: ${first.name.value}`),el('p',first.recommendation?.reason||first.fitReason,'meta'));const a=el('a',`Call ${first.phone.value}`,'call');a.href=`tel:${first.phone.value.replace(/[^+0-9]/g,'')}`;callout.append(a);c.append(callout);}
  $('budget').replaceChildren(c);
}
function renderDirectory(directory,parent) {
  if(!directory?.providers?.length)return;
  const group=el('section',undefined,'panel google-directory');
  const attribution=el('span','Google Maps','google-attribution');attribution.setAttribute('translate','no');group.append(attribution,el('p',directory.message,'meta'));
  for(const p of directory.providers){const card=el('article',undefined,'google-place');card.append(el('h3',p.name),el('p',p.address),link('View on Google Maps',p.url));
    if(p.rating!==null)card.append(el('p',`${p.rating}/5 · ${p.reviewCount} ratings`));
    if(p.phone){const call=el('a',`Call ${p.phone}`,'call');call.href=`tel:${p.phone.replace(/[^+0-9]/g,'')}`;card.append(call);}
    for(const review of p.reviews){const d=el('details',undefined,'review-sample');d.append(el('summary',`${review.rating}/5 · ${review.author} · ${review.date}`));
      if(review.avatar){const img=el('img');img.src=review.avatar;img.alt=review.author;img.referrerPolicy='no-referrer';img.width=32;img.height=32;d.append(img);}
      if(review.authorUrl)d.append(link(review.author,review.authorUrl));d.append(el('blockquote',review.text),link('Read this review on Google Maps',review.url));card.append(d);}
    for(const a of p.attributions)card.append(a.url?link(a.name,a.url):el('span',a.name));group.append(card);
  }parent.append(group);
}
function renderReport() {
  const report=current?.report;renderBudget(report); $('providers').hidden=!report;if(!report)return;
  const section=el('div',undefined,'provider-section');section.append(el('h2','Who to call & why'),el('p',`Checked ${new Date(report.checkedAt).toLocaleString()}. Confirm scope, price and appointment directly.`,'meta'));
  renderDirectory(report.directory,section);
  if(report.warnings.length)section.append(el('p',report.warnings.join(' '),'error'));
  if(report.costEvidence.length){const costs=el('details',undefined,'panel price-panel');costs.append(el('summary','Other prices found online'),el('p','Reference prices for comparison. Your job has not received a contractor quote.','meta'));
    report.costEvidence.forEach(c=>{const row=el('div',undefined,'price-item');row.append(el('p',`${c.label} · ${c.geography}`,'meta'),el('blockquote',c.quote),el('p',c.limitation,'meta'),citation(c.evidence));costs.append(row);});section.append(costs);
  }
  for(const p of report.providers){const c=el('article',undefined,'panel provider-card');if(p.recommendation)c.append(el('div',`${p.recommendation.position}. ${p.recommendation.label}`,'rank-label'));const name=el('h3',p.name.value);name.append(citation(p.name.evidence));c.append(name);
    const service=el('p',p.service.value,'service');service.append(citation(p.service.evidence));c.append(service,el('p',p.fitReason));
    const facts=el('div',undefined,'provider-facts');
    fact(facts,'Published price',p.pricing?p.pricing.quote:'No verified price found',p.pricing?.evidence);
    if(p.pricing)fact(facts,'Price type',`${p.pricing.kind.replaceAll('_',' ')}. ${p.pricing.scope}`);
    fact(facts,'Reviews',p.reviews?`${p.reviews.rating}/${p.reviews.scale}, ${p.reviews.reviewCount} reviews on ${p.reviews.platform}`:'No verified rating and review count found',p.reviews?.evidence);
    for(const sample of p.reviewSamples||[]){const review=el('div',undefined,'review-sample');review.append(el('blockquote',sample.text),el('p',`${sample.author||'Author not available in extract'}${sample.date?' · '+sample.date:''} · ${sample.platform}`,'meta'),citation(sample.evidence));facts.append(review);}
    if(p.coverage)fact(facts,'Reported area',p.coverage.value,p.coverage.evidence);
    fact(facts,'Your ZIP',p.zipCoverage.label);fact(facts,'Availability',p.availability.label);c.append(facts,el('p',`Ask: ${p.ask}`,'meta'));
    const actions=el('div',undefined,'provider-actions');if(p.phone){const call=el('a',`Call ${p.phone.value}`,'call');call.href=`tel:${p.phone.value.replace(/[^+0-9]/g,'')}`;actions.append(call,citation(p.phone.evidence));}actions.append(link('View provider source ↗',p.profileUrl));c.append(actions);section.append(c);
  }
  if(!report.providers.length)section.append(el('p','I could not verify a suitable local provider from these results. Your job brief is ready to use; you can refine the request or try the search again.','panel provider-card'));
  if(report.providers.length)section.append(el('p',report.providers[0].recommendation?.method||'Compare source details before contacting a provider.','meta'));
  const sources=el('details',undefined,'source-list');sources.append(el('summary',`Sources checked (${report.sourceCount})`));report.sources.forEach(s=>sources.append(link(`${s.title} (${s.kind.replaceAll('_',' ')})`,s.url)));section.append(sources);
  $('providers').replaceChildren(section);
}
async function findHelp(nested=false){if(busy&&!nested)return;showError('');setBusy(true,'Calculating your budget and checking providers, ratings and reviews...');try{current=await api(`/api/cases/${current.id}/search`,'POST',{revision:current.revision,force:!!current.report});render();}catch(e){showError(e.message);}finally{setBusy(false);}}
$('job-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;showError('');setBusy(true,'Looking at the job and your photos...');
  try{const data={zip:$('zip').value,message:$('message').value,images:pendingImages};
    current=await api(current?`/api/cases/${current.id}/messages`:'/api/cases','POST',current?{...data,revision:current.revision}:data);
    pendingImages=[];$('photos').value='';$('message').value='';renderPhotos(current.images.map(x=>x.dataUrl));render();
    if(current.assessment.searchReady)await findHelp(true);
  }catch(error){showError(error.message);}finally{setBusy(false);}
});
async function encodePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15000000)throw new Error('Use a JPG, PNG or WebP image smaller than 15 MB.');
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const encoded=canvas.toDataURL('image/jpeg',.86);if(encoded.length>2600000)throw new Error('Please choose a smaller photo.');return encoded;
}
$('photos').addEventListener('change',async()=>{setBusy(true,'Preparing your photos...');try{showError('');const files=[...$('photos').files];if(files.length>3)throw new Error('Choose up to three photos.');pendingImages=await Promise.all(files.map(encodePhoto));renderPhotos(pendingImages);}catch(error){pendingImages=[];$('photos').value='';renderPhotos(current?.images.map(x=>x.dataUrl)||[]);showError(error.message);}finally{setBusy(false);}});
function reset(){current=null;pendingImages=[];localStorage.removeItem('home-repair-case');$('job-form').reset();$('photo-preview').replaceChildren();$('description-label').textContent='What would you like done?';$('submit').replaceChildren(document.createTextNode('Assess my job'),el('span','↗'));showError('');render();}
$('new-case').onclick=()=>{if(!busy)reset();};
$('delete-case').onclick=async()=>{if(!current||busy)return;setBusy(true,'Deleting this saved case...');try{await api(`/api/cases/${current.id}`,'DELETE');reset();}catch(error){showError(error.message);}finally{setBusy(false);}};
(async()=>{try{const health=await api('/api/health');const ready=health.connections.ai&&health.connections.search;$('connection').textContent=ready?'Advisor connected':'Connection needs setup';$('connection').classList.toggle('ready',ready);
  const id=localStorage.getItem('home-repair-case');if(id){current=await api(`/api/cases/${id}`);renderPhotos(current.images.map(x=>x.dataUrl));render();}
}catch(error){showError(error.message);}})();
