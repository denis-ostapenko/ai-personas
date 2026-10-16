import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {groundRates,calculateEstimate} from '../src/estimate.mjs';
import {reviewPlatform,sameReviewBusiness,orderProviders} from '../src/reviews.mjs';
import {GooglePlaces} from '../src/providers/google-places.mjs';
import {CaseStore} from '../src/store.mjs';
// Synthetic fixtures only.
const location={city:'New York',state:'NY',zip:'10001'};
const source={id:'s1',url:'https://fixture-repairs.com/prices',title:'Fixture',text:'New York handyman labor costs $90 to $120 per hour. A minimum of 2 hours is billed.',checkedAt:'2026-10-11T00:00:00Z',kind:'page_extract'};
const rate=()=>({kind:'hourly_labor',low:90,high:120,unit:'hour',geography:'local',area:'New York',includesMaterials:false,minimumHours:2,minimumHoursQuote:'A minimum of 2 hours is billed.',label:'Handyman rate',applicability:'Small repairs',sourceId:'s1',quote:'New York handyman labor costs $90 to $120 per hour.'});
const assessment=()=>({status:'ready',observations:[{basis:'photo'}],estimatePlan:{laborHoursLow:1,laborHoursHigh:3,materialsLow:10,materialsHigh:25,quantity:1,unit:'job',quantityBasis:'assumption',assumptions:['One door'],exclusions:['Tax'],uncertainty:'medium',rationale:'Hinge-only adjustment'}});
test('estimate honors visit minimum, materials and outward rounding',()=>{
 const e=calculateEstimate(assessment(),groundRates([rate()],[source],location),location);
 assert.equal(e.low,190);assert.equal(e.high,390);assert.deepEqual(e.work,{low:180,high:360});assert.equal(e.photoBased,true);
});
test('invented rates, false minimum and false ZIP localization are rejected',()=>{
 assert.equal(groundRates([{...rate(),low:80}],[source],location).length,0);
 const r=groundRates([{...rate(),area:'Boston',minimumHours:3}],[source],location)[0];assert.equal(r.geography,'unknown');assert.equal(r.minimumHours,null);assert.equal(calculateEstimate(assessment(),[r],location).status,'unavailable');
});
test('national fallback is labeled and scope corrections change arithmetic',()=>{
 const r={...groundRates([rate()],[source],location)[0],geography:'national'},a=assessment();let e=calculateEstimate(a,[r],location);assert.equal(e.confidence,'low');assert.match(e.assumptions.join(' '),/National rate/);
 Object.assign(a.estimatePlan,{laborHoursHigh:5,materialsLow:0,materialsHigh:0});e=calculateEstimate(a,[r],location);assert.equal(e.high,600);assert.equal(e.materials.high,0);
});
test('project rates avoid duplicate materials and guessed square footage',()=>{
 const s={...source,text:'New York wall painting costs $2 to $4 per square foot including paint.'};const r=groundRates([{...rate(),kind:'project',unit:'sq_ft',low:2,high:4,includesMaterials:true,quote:s.text}],[s],location),a=assessment();Object.assign(a.estimatePlan,{quantity:100,unit:'sq_ft'});
 assert.equal(calculateEstimate(a,r,location).status,'unavailable');a.estimatePlan.quantityBasis='customer';const e=calculateEstimate(a,r,location);assert.equal(e.low,200);assert.equal(e.high,400);assert.equal(e.materials.high,0);
});
test('starting ads and unscoped or unsafe work do not produce budgets',()=>{
 const s={...source,text:'New York installations start at $90 and premium mounts cost $120.'};assert.equal(groundRates([{...rate(),kind:'project',unit:'job',quote:s.text}],[s],location).length,0);
 const starting={...source,text:'New York handyman rates start at $90 per hour.'};assert.equal(groundRates([{...rate(),low:90,high:90,quote:starting.text}],[starting],location).length,0);
 const a=assessment();a.status='urgent';assert.equal(calculateEstimate(a,[],location).status,'unavailable');a.status='ready';a.estimatePlan.laborHoursHigh=Infinity;assert.equal(calculateEstimate(a,[],location).status,'unavailable');
});
test('only business-specific review profiles qualify',()=>{
 for(const u of ['https://www.yelp.com/search?x=1','https://fake-yelp.com/biz/a','https://www.thumbtack.com/ny/new-york/tv-mounting'])assert.equal(reviewPlatform(u),null);
 assert.equal(reviewPlatform('https://www.yelp.com/biz/fixture'),'Yelp');assert.equal(reviewPlatform('https://reviews.birdeye.com/fixture-123456789'),'Birdeye');
});
test('same-name reviews need a phone or official-domain match',()=>{
 const b={name:{value:'Fixture Repair'},phone:{value:'212-555-0100'},profile:source};const s={url:'https://www.yelp.com/biz/fixture',text:'Fixture Repair in Boston 617-555-0100'};
 assert.equal(sameReviewBusiness(s,b),false);s.text+=' https://fixture-repairs.com/about';assert.equal(sameReviewBusiness(s,b),true);s.text='Fixture Repair (212) 555-0100';assert.equal(sameReviewBusiness(s,b),true);
});
test('call ranking balances volume and score',()=>{
 const p=(name,rating,reviewCount)=>({name:{value:name},phone:{value:'212-555-0100'},reviews:{rating,reviewCount,scale:5,platform:'Yelp'}});
 assert.equal(orderProviders([p('new',5,1),p('established',4.8,150)])[0].name.value,'established');
});
test('Google request is bounded and preserves review attribution',async()=>{
 const c=new GooglePlaces({key:'fixture',fetchFn:async(url,opts)=>{assert.equal(JSON.parse(opts.body).pageSize,4);assert.match(opts.headers['X-Goog-FieldMask'],/reviews/);return Response.json({places:[{id:'fixture',displayName:{text:'Synthetic service'},businessStatus:'OPERATIONAL',googleMapsUri:'https://maps.google.com/?cid=1',rating:4.5,userRatingCount:123,reviews:[{text:{text:'Fixture review.'},rating:4,authorAttribution:{displayName:'Fixture reviewer'},googleMapsUri:'https://maps.google.com/review/1'}]}]});}});
 assert.equal((await c.search({terms:'handyman',location})).providers[0].reviews[0].author,'Fixture reviewer');
});
test('Google access failure redacts secrets and avoids repeated calls',async()=>{
 let calls=0;const c=new GooglePlaces({key:'secret',fetchFn:async()=>{calls++;return Response.json({error:{message:'secret',details:[{reason:'API_KEY_IP_ADDRESS_BLOCKED'}]}},{status:403});}});
 const r=await c.search({terms:'handyman',location});assert.equal(r.status,'unavailable');assert.match(r.message,/allowed IP/);assert.ok(!r.message.includes('secret'));await c.search({terms:'handyman',location});assert.equal(calls,1);
});
test('transient Google content is never persisted in case files',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'persona-reviews-'));t.after(()=>rm(dir,{recursive:true,force:true}));const s=new CaseStore(dir),id=randomUUID();
 await s.save({id,owner:'a',report:{estimate:{status:'estimated'},directory:{providers:[{name:'Transient Google name'}]}}});assert.ok(!(await readFile(s.file(id),'utf8')).includes('Transient'));assert.equal((await s.get(id,'a')).report.estimate.status,'estimated');
});
