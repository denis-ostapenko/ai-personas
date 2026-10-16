import net from 'node:net';
import { reviewPlatform, sameReviewBusiness, orderProviders } from './reviews.mjs';

export function safeURL(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (net.isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)) return null;
    if (url.port && !['80','443'].includes(url.port)) return null;
    return url.href;
  } catch { return null; }
}
const normalized = value => String(value).normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
const digits = value => String(value).replace(/\D/g, '');
const containsNumber = (text, number) => new RegExp(`(^|[^0-9.])${String(number).replace('.', '\\.')}([^0-9.]|$)`).test(text.replace(/,/g, ''));

export function groundEvidence(data, sources, now = new Date().toISOString()) {
  const index = new Map(sources.map(s => [s.id, s])); const rejected = [];
  function evidence(item, field) {
    const source = index.get(item?.sourceId);
    const quote = String(item?.quote || '').trim();
    if (!source || !safeURL(source.url) || quote.length < 3 || quote.length > 300 || !normalized(source.text).includes(normalized(quote))) {
      rejected.push(field); return null;
    }
    return { sourceId: source.id, url: source.url, title: source.title, quote,
      checkedAt: source.checkedAt, sourceKind: source.kind };
  }
  function claim(item, field, phone = false) {
    if (!item) return null;
    const e = evidence(item, field);
    if (!e || !String(item.value).trim()) return null;
    const matches = phone ? digits(item.value).length >= 10 && digits(e.quote).includes(digits(item.value)) : normalized(e.quote).includes(normalized(item.value));
    if (!matches) { rejected.push(field); return null; }
    return { value: item.value, evidence: e };
  }
  const providers = []; const seen = new Set();
  for (const [i, p] of data.providers.slice(0, 4).entries()) {
    const name = claim(p.name, `provider.${i}.name`), service = claim(p.service, `provider.${i}.service`);
    const profile = index.get(p.profileSourceId);
    if (!name || !service || !profile || !safeURL(profile.url) || seen.has(normalized(name.value))) continue;
    // Require that the linked profile actually contains the extracted business name.
    if (!normalized(profile.text).includes(normalized(name.value))) { rejected.push(`provider.${i}.profile`); continue; }
    seen.add(normalized(name.value));
    const phone = claim(p.phone, `provider.${i}.phone`, true);
    let pricing = null; let reviews = null;
    if (p.pricing) {
      const e = evidence(p.pricing, `provider.${i}.price`);
      const nums = p.pricing.text.match(/\d+(?:[,.]\d+)*/g) || [];
      if (e && nums.every(n => normalized(e.quote).includes(n.toLowerCase()))) pricing = { ...p.pricing, evidence: e };
    }
    if (p.reviews) {
      const e = evidence(p.reviews, `provider.${i}.reviews`), r = p.reviews;
      const reviewSource = index.get(r.sourceId);
      if (e && r.rating >= 0 && r.scale === 5 && r.rating <= r.scale && Number.isInteger(r.reviewCount) && r.reviewCount > 0 && containsNumber(e.quote, r.rating) && containsNumber(e.quote, r.reviewCount) && sameReviewBusiness(reviewSource,{name,phone,profile})) reviews = { ...r, platform:reviewPlatform(reviewSource.url), evidence: e };
      else rejected.push(`provider.${i}.reviews`);
    }
    const reviewSamples = (p.reviewSamples || []).slice(0,1).flatMap(sample=>{
      const e=evidence(sample,`provider.${i}.review_sample`), s=index.get(sample.sourceId);
      if(!e || !sample.text.trim() || sample.text.trim().split(/\s+/).length>25 || !normalized(e.quote).includes(normalized(sample.text)) || !sameReviewBusiness(s,{name,phone,profile}))return [];
      if((sample.author && !normalized(e.quote).includes(normalized(sample.author))) || (sample.date && !normalized(e.quote).includes(normalized(sample.date))))return [];
      return [{text:sample.text,author:sample.author,date:sample.date,platform:reviewPlatform(s.url),evidence:e}];
    });
    providers.push({ name, service, coverage: claim(p.coverage, `provider.${i}.coverage`), phone,
      profileUrl: profile.url, pricing, reviews, reviewSamples, fitReason: p.fitReason, ask: p.ask,
      availability: { status: 'needs_confirmation', label: 'Ask about the next available appointment', checkedAt: null },
      zipCoverage: { status: 'needs_confirmation', label: 'Confirm service to your ZIP' }
    });
  }
  const costEvidence = data.costEvidence.slice(0,4).flatMap((c, i) => {
    const e = evidence(c, `cost.${i}`); return e ? [{ ...c, evidence: e }] : [];
  });
  return { providers:orderProviders(providers), costEvidence, checkedAt: now, rejectedFields: [...new Set(rejected)],
    sourceCount: sources.length, status: providers.length ? 'found' : 'no_verified_matches',
    estimateStatus: costEvidence.length ? 'reference_prices_only' : 'insufficient_price_evidence',
    sources: sources.map(({ id, url, title, kind, checkedAt }) => ({ id, url, title, kind, checkedAt })) };
}
