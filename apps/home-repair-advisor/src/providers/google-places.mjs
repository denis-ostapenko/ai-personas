import { AppError } from '../errors.mjs';
import { safeURL } from '../evidence.mjs';
const mask=['id','displayName','formattedAddress','nationalPhoneNumber','websiteUri','googleMapsUri','rating','userRatingCount','reviews','attributions','businessStatus'].map(s=>'places.'+s).join(',');
export class GooglePlaces {
  constructor({key,fetchFn=fetch}={}) { this.key=key;this.fetchFn=fetchFn;this.calls=0;this.blockedUntil=0;this.failure=null; }
  async search({terms,location}) {
    if(!this.key)return {status:'not_configured',providers:[],message:'Direct Google Maps reviews are not configured.'};
    if(Date.now()<this.blockedUntil)return {status:'unavailable',providers:[],message:this.failure};
    if(this.calls>=60)return {status:'unavailable',providers:[],message:'The local Google Maps request limit has been reached.'};
    this.calls++;
    try {
      const res=await this.fetchFn('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':this.key,'X-Goog-FieldMask':mask},
        body:JSON.stringify({textQuery:`${terms} near ${location.city} ${location.state} ${location.zip}`,pageSize:4,languageCode:'en',regionCode:'US'}),redirect:'error',signal:AbortSignal.timeout(20000)});
      const data=await res.json();
      if(!res.ok){
        const reasons=(data.error?.details||[]).map(x=>x.reason);
        throw new AppError(502,'maps_access',reasons.includes('API_KEY_IP_ADDRESS_BLOCKED')?'Direct Google Maps reviews are unavailable: this server is outside the API key\'s allowed IP addresses.':'Direct Google Maps reviews are temporarily unavailable.');
      }
      const checkedAt=new Date().toISOString();
      const providers=(data.places||[]).filter(p=>p.id&&p.displayName?.text&&p.businessStatus==='OPERATIONAL'&&safeURL(p.googleMapsUri)).map(p=>({
        placeId:p.id,name:p.displayName.text,address:p.formattedAddress||'',phone:p.nationalPhoneNumber||null,website:safeURL(p.websiteUri),url:safeURL(p.googleMapsUri),
        rating:Number.isFinite(p.rating)?p.rating:null,reviewCount:Number.isInteger(p.userRatingCount)?p.userRatingCount:0,
        reviews:(p.reviews||[]).slice(0,3).map(r=>({text:r.text?.text||r.originalText?.text||'',rating:r.rating,author:r.authorAttribution?.displayName||'Google user',authorUrl:safeURL(r.authorAttribution?.uri),avatar:safeURL(r.authorAttribution?.photoUri),url:safeURL(r.googleMapsUri)||safeURL(p.googleMapsUri),date:r.relativePublishTimeDescription||r.publishTime||''})),
        attributions:(p.attributions||[]).map(a=>({name:a.provider,url:safeURL(a.providerUri)})),checkedAt}));
      return {status:providers.length?'live':'no_matches',providers,checkedAt,message:'Google Maps search matches. Confirm service fit and ZIP coverage. Reviews are supplied by Google in relevance order, not a complete or representative sample.'};
    }catch(error){
      this.failure=error instanceof AppError?error.message:'Direct Google Maps reviews could not be retrieved.';this.blockedUntil=Date.now()+300000;
      return {status:'unavailable',providers:[],message:this.failure};
    }
  }
}
