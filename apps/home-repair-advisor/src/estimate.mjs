// Published rates are evidence; quantities and effort are explicit planning assumptions.
import { safeURL } from './evidence.mjs';
const normal = x => String(x || '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const finite = x => typeof x === 'number' && Number.isFinite(x);
const moneyIn = (text, value) => {
  const numbers=[...text.matchAll(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g)].map(m=>m[1]);
  for(const m of text.matchAll(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:-|\u2013|\u2014|to)\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)/gi))numbers.push(m[2]);
  return numbers.some(n=>Number(n.replaceAll(',',''))===value);
};
const numberIn = (text, value) => new RegExp(`(^|[^\\d.])${String(value).replace('.','\\.')}([^\\d.]|$)`).test(text);
export function groundRates(rates = [], sources = [], location = {}) {
  const byID=new Map(sources.map(s=>[s.id,s]));
  return rates.slice(0,4).flatMap(r=>{
    const s=byID.get(r.sourceId), q=String(r.quote||'');
    if(!s || !safeURL(s.url) || q.length<5 || q.length>300 || !normal(s.text).includes(normal(q)))return [];
    if(!finite(r.low)||!finite(r.high)||r.low<=0||r.high<r.low||r.high>20000||!moneyIn(q,r.low)||!moneyIn(q,r.high))return [];
    if(r.kind==='hourly_labor' && (r.unit!=='hour'||r.high>1000||!/\b(hour|hourly|hr)\b/i.test(q)))return [];
    if(/\b(start(?:s|ing)? at|from only|as low as)\b/i.test(q))return [];
    if(r.kind==='project' && (r.unit==='hour'||r.low===r.high))return [];
    let geography=r.geography;
    if(geography==='local') {
      const area=normal(r.area), city=normal(location.city), zip=String(location.zip||'');
      const cityName=x=>['nyc','new york city'].includes(x)?'new york':x;
      if(!area || !normal(s.text).includes(area) || !((city&&cityName(area).includes(cityName(city)))||(zip&&area.includes(zip))))geography='unknown';
    }
    let minimumHours=null;
    if(finite(r.minimumHours)&&r.minimumHours>0&&r.minimumHours<=8&&r.minimumHoursQuote&&normal(s.text).includes(normal(r.minimumHoursQuote))&&numberIn(r.minimumHoursQuote,r.minimumHours)&&/minimum|at least/i.test(r.minimumHoursQuote))minimumHours=r.minimumHours;
    return [{...r,geography,minimumHours,minimumHoursQuote:minimumHours?r.minimumHoursQuote:null,evidence:{sourceId:s.id,url:s.url,title:s.title,quote:q,checkedAt:s.checkedAt,sourceKind:s.kind}}];
  });
}
export function calculateEstimate(assessment, rates, location, now=new Date().toISOString()) {
  const p=assessment.estimatePlan;
  const unavailable=reason=>({status:'unavailable',reason,checkedAt:now,currency:'USD'});
  if(!p||['urgent','out_of_scope'].includes(assessment.status))return unavailable('A few more job details are needed before a useful budget can be calculated.');
  if(![p.laborHoursLow,p.laborHoursHigh,p.materialsLow,p.materialsHigh,p.quantity].every(finite)||p.laborHoursLow<=0||p.laborHoursHigh<p.laborHoursLow||p.laborHoursHigh>40||p.materialsLow<0||p.materialsHigh<p.materialsLow||p.materialsHigh>10000||p.quantity<=0||p.quantity>10000)return unavailable('The scope needs a clearer quantity or labor allowance.');
  const eligible=rates.filter(r=>r.geography!=='unknown' && (r.kind==='hourly_labor'||(r.unit===p.unit && (r.unit!=='sq_ft'||p.quantityBasis==='customer'))));
  eligible.sort((a,b)=>(a.geography==='local'?0:2)+(a.kind==='project'?0:1)-((b.geography==='local'?0:2)+(b.kind==='project'?0:1)));
  const basis=eligible[0];
  if(!basis)return unavailable('No comparable published rate was verified. Use the job brief to request an estimate.');
  const minimum=basis.minimumHours||0;
  const quantity=basis.kind==='hourly_labor'?{low:Math.max(p.laborHoursLow,minimum),high:Math.max(p.laborHoursHigh,minimum)}:{low:p.quantity,high:p.quantity};
  const work={low:basis.low*quantity.low,high:basis.high*quantity.high};
  const materials=basis.includesMaterials?{low:0,high:0}:{low:p.materialsLow,high:p.materialsHigh};
  const exact={low:work.low+materials.low,high:work.high+materials.high};
  return {status:'estimated',currency:'USD',low:Math.floor(exact.low/10)*10,high:Math.ceil(exact.high/10)*10,
    confidence:basis.geography==='national'?'low':p.uncertainty,location:`${location.city}, ${location.state} ${location.zip}`,
    geography:basis.geography,photoBased:assessment.observations.some(x=>x.basis==='photo'),checkedAt:now,
    work,materials,quantity,basis,minimumHours:minimum,
    assumptions:[...p.assumptions, ...(basis.geography==='national'?['National rate used: a local ZIP-specific rate was not verified.']:[]), ...(minimum?[]:['No verified call-out minimum; a small job may cost more if the provider has a minimum visit charge.'])],
    exclusions:[...p.exclusions],rationale:p.rationale,
    formula:`${basis.kind==='hourly_labor'?'Estimated worker-hours':'Scope quantity'} × published rate${basis.includesMaterials?' (materials included in rate)':' + estimated material allowance'}`,
    notice:'Planning estimate, not a contractor quote. Final scope and hidden conditions need confirmation.'};
}
