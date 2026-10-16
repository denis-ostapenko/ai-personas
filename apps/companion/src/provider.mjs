import { AppError, validate } from './core.mjs';
const retryable=status=>status===429||status>=500;
export class OpenAIProvider {
  // Every attempt, including a retry, counts toward maxCalls so the cost ceiling stays honest.
  constructor({key, model='gpt-6.1-sol', reasoning='low', fetchFn=fetch, maxCalls=120, retries=2, retryDelayMs=800, sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
    Object.assign(this,{key,model:model||'gpt-6.1-sol',reasoning:reasoning||'low',fetchFn,maxCalls,retries,retryDelayMs,sleep}); this.calls=0;
  }
  async structured({instructions,input,schema,name,model,reasoning}) {
    if(!this.key) throw new AppError(503,'not_configured','The AI connection is not configured. Your saved persona is available.');
    for(let attempt=0;;attempt++) {
      try { return await this.attempt({instructions,input,schema,name,model:model||this.model,reasoning:reasoning||this.reasoning}); }
      catch(error) {
        if(!error.retryable||attempt>=this.retries)throw error;
        await this.sleep(this.retryDelayMs*Math.pow(2,attempt));
      }
    }
  }
  async attempt({instructions,input,schema,name,model,reasoning}) {
    if(this.calls>=this.maxCalls) throw new AppError(429,'usage_limit','The local development API limit has been reached. Restart the server to continue.');
    this.calls++;
    const started=Date.now(); let response;
    try {
      response=await this.fetchFn('https://api.openai.com/v1/responses',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),
        headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,reasoning:{effort:reasoning},store:false,instructions,input,
          max_output_tokens:5000,text:{format:{type:'json_schema',name,strict:true,schema}}})
      });
    } catch { throw Object.assign(new AppError(502,'unreachable','The AI connection timed out or could not be reached. Your saved state is unchanged.'),{retryable:true}); }
    if(!response.ok) throw Object.assign(new AppError(502,'provider_error',`The AI service returned HTTP ${response.status}. Your saved state is unchanged.`),{retryable:retryable(response.status)});
    let result;
    try { result=await response.json(); } catch { throw new AppError(502,'provider_format','The AI service returned an unreadable response.'); }
    const parts=(result.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
    if(parts.some(x=>x.type==='refusal')) throw new AppError(422,'refusal','The model could not answer this message. You can rephrase it.');
    if(result.status!=='completed') throw new AppError(502,'incomplete','The response did not finish. Please try again.');
    let data;
    try { data=JSON.parse(parts.filter(x=>x.type==='output_text').map(x=>x.text).join('')); validate(schema,data); }
    catch { throw new AppError(502,'invalid_output','The response failed its format checks. Your saved state is unchanged.'); }
    return {data,trace:{model:result.model||model,responseId:result.id,elapsedMs:Date.now()-started,usage:result.usage||null}};
  }
}
