import { safeURL } from './evidence.mjs';
const text = x=>String(x||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const digits=x=>String(x||'').replace(/\D/g,'');
export function reviewPlatform(url) {
  try { const u=new URL(url),h=u.hostname.replace(/^www\./,'');
    if(h==='yelp.com' && u.pathname.startsWith('/biz/'))return 'Yelp';
    if(h==='thumbtack.com' && u.pathname.includes('/service/'))return 'Thumbtack';
    if(h==='angi.com' && /-reviews-\d+\.htm$/.test(u.pathname))return 'Angi';
    if(h==='reviews.birdeye.com' && /-\d{8,}\/?$/.test(u.pathname))return 'Birdeye';
    if(h==='trustpilot.com' && u.pathname.startsWith('/review/'))return 'Trustpilot';
  }catch{} return null;
}
export function sameReviewBusiness(source, {name,phone,profile}) {
  if(!reviewPlatform(source.url)||!text(source.text).includes(text(name.value)))return false;
  if(source.url===profile.url || String(profile.text).includes(source.url))return true;
  const number=digits(phone?.value);
  if(number.length>=10 && digits(source.text).includes(number.slice(-10)))return true;
  // A link to the official business domain ties the profile to this entity.
  const host=new URL(profile.url).hostname.replace(/^www\./,'');
  return !reviewPlatform(profile.url) && [...String(source.text).matchAll(/https?:\/\/[^\s<>"\])]+/g)].some(m=>{
    const safe=safeURL(m[0]);return safe && new URL(safe).hostname.replace(/^www\./,'')===host;
  });
}
export function orderProviders(providers) {
  const rank=p=>{
    const r=p.reviews; const valid=r&&r.scale===5&&r.reviewCount>0;
    const adjusted=valid?(r.rating*r.reviewCount+4*20)/(r.reviewCount+20):0;
    return (p.phone?20:0)+(valid?10:0)+adjusted;
  };
  return [...providers].sort((a,b)=>rank(b)-rank(a)).map((p,i)=>({...p,recommendation:{position:i+1,
    label:i===0&&p.phone?'Suggested first call':p.phone?'Another option to call':'View profile / request contact',
    reason:p.reviews?`${p.reviews.rating}/${p.reviews.scale} from ${p.reviews.reviewCount} ratings on ${p.reviews.platform}${p.phone?', with a sourced phone number':''}.`:'Relevant listed service; no independently supported review score found.',
    method:'Call order favors a contact number and an attributable rating, then balances the star score with review volume. It is a comparison aid, not a quality or availability guarantee.'}}));
}
