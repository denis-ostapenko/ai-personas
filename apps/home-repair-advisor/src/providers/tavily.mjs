import { AppError, postJSON } from '../errors.mjs';
import { safeURL } from '../evidence.mjs';
import { reviewPlatform } from '../reviews.mjs';

export class TavilySearch {
  constructor({ key, fetchFn = fetch } = {}) { this.key = key; this.fetchFn = fetchFn; this.id = 'tavily'; }
  async search({ terms, location, category }) {
    if (!this.key) throw new AppError(503, 'search_not_configured', 'Web search is not configured. Your job assessment is still available.');
    const area = `${location.city}, ${location.state} ${location.zip}`;
    const simple = category==='mounting' && /\btv\b|television/i.test(terms)?'TV mounting':({door:'handyman door repair',painting:'painting handyman',lawn:'lawn mowing',lighting:'handyman light bulb replacement'}[category]||terms.split(' ').slice(0,5).join(' '));
    const queries = [`${simple} ${area} local service phone pricing`, `${simple} ${area} cost price hourly labor materials`,
      `${simple} ${location.city} reviews rating site:reviews.birdeye.com`];
    const responses = await Promise.allSettled(queries.map(query => postJSON('https://api.tavily.com/search', this.key, {
      query, search_depth: 'basic', max_results: 4, topic: 'general',
      include_answer: false, include_raw_content: 'markdown', include_images: false, include_usage: true
    }, { fetchFn: this.fetchFn, timeout: 45000 })));
    const sources = []; const seen = new Set(); const warnings = []; let credits = 0;
    for (const [i, result] of responses.entries()) {
      if (result.status === 'rejected') { warnings.push(`Search ${i + 1} could not be completed.`); continue; }
      credits += result.value.usage?.credits || 0;
      for (const row of result.value.results || []) {
        const url = safeURL(row.url);
        if (!url || seen.has(url)) continue;
        const text = String(row.raw_content || row.content || '').slice(0,10000);
        if (!text.trim()) continue;
        seen.add(url);
        sources.push({ id: `s${sources.length + 1}`, url, title: String(row.title || url), text,
          kind: row.raw_content ? 'page_extract' : 'search_excerpt', checkedAt: new Date().toISOString() });
      }
    }
    if (responses.every(r => r.status === 'rejected')) throw new AppError(502, 'search_failed', 'Local web search failed. Your assessment is saved; retry the search later.');
    const extracts=await this.extractProfiles(sources); credits+=extracts.credits;warnings.push(...extracts.warnings);
    return { sources, warnings, queries, credits, provider: this.id };
  }
  async reviews({providers,location,offset=0}) {
    const targets=providers.map((p,index)=>({p,index})).filter(x=>!x.p.reviews).slice(0,3);
    const queries=targets.map(({p})=>`"${p.name.value}" ${location.city} reviews rating`);
    const responses=await Promise.allSettled(queries.map(query=>postJSON('https://api.tavily.com/search',this.key,{
      query,search_depth:'basic',max_results:3,include_raw_content:'markdown',include_answer:false,include_usage:true,
      include_domains:['reviews.birdeye.com','yelp.com','thumbtack.com','angi.com']
    },{fetchFn:this.fetchFn,timeout:30000})));
    const sources=[];const seen=new Set();let credits=0;const warnings=[];
    for(const result of responses){
      if(result.status==='rejected'){warnings.push('Some individual review profiles could not be checked.');continue;}
      credits+=result.value.usage?.credits||0;
      for(const row of result.value.results||[]){const url=safeURL(row.url);if(!url||!reviewPlatform(url)||seen.has(url))continue;
        const text=String(row.raw_content||row.content||'').slice(0,10000);if(!text)continue;seen.add(url);
        sources.push({id:`s${offset+sources.length+1}`,url,title:String(row.title||url),text,kind:row.raw_content?'page_extract':'search_excerpt',checkedAt:new Date().toISOString()});
      }
    }
    const extracts=await this.extractProfiles(sources);credits+=extracts.credits;warnings.push(...extracts.warnings);
    return {sources,queries,credits,warnings};
  }

  async extractProfiles(sources){
    const urls=sources.filter(s=>reviewPlatform(s.url)).slice(0,4).map(s=>s.url);
    if(!urls.length)return {credits:0,warnings:[]};
    try {
      const data=await postJSON('https://api.tavily.com/extract',this.key,{urls,extract_depth:'basic',format:'markdown',include_usage:true},{fetchFn:this.fetchFn,timeout:20000});
      for(const row of data.results||[]){const source=sources.find(s=>s.url===row.url);if(source&&row.raw_content){source.text=String(row.raw_content).slice(0,14000);source.kind='page_extract';source.checkedAt=new Date().toISOString();}}
      return {credits:data.usage?.credits||0,warnings:data.failed_results?.length?['Some full review profiles were unavailable; remaining excerpts keep their source labels.']:[]};
    }catch{return {credits:0,warnings:['Full review pages could not be refreshed; only supported search excerpts are used.']};}
  }

}

export async function resolveZIP(zip, fetchFn = fetch) {
  if (!/^\d{5}$/.test(zip)) throw new AppError(400, 'invalid_zip', 'Enter a five-digit US ZIP code.');
  let response;
  try { response = await fetchFn(`https://api.zippopotam.us/us/${zip}`, { redirect: 'error', signal: AbortSignal.timeout(12000) }); }
  catch { throw new AppError(502, 'location_unavailable', 'The ZIP lookup is temporarily unavailable. Please try again.'); }
  if (response.status === 404) throw new AppError(400, 'unknown_zip', 'That ZIP code could not be found. Please check it.');
  if (!response.ok) throw new AppError(502, 'location_unavailable', 'The ZIP lookup is temporarily unavailable.');
  const data = await response.json(); const place = data.places?.[0];
  if (!place || data['country abbreviation'] !== 'US') throw new AppError(502, 'location_unavailable', 'The ZIP lookup did not return a US location.');
  return { zip, city: place['place name'], state: place['state abbreviation'], source: 'Zippopotam.us', checkedAt: new Date().toISOString() };
}
