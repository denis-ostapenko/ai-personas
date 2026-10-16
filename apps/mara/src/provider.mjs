import {validate} from './contracts.mjs';
export class Provider {
  constructor(store,{key=process.env.OPENAI_API_KEY,fetchFn=fetch}={}){this.store=store;this.key=key;this.fetchFn=fetchFn;}
  async call({state,kind,instructions,input,schema}) {
    if(!this.key)throw new Error('OPENAI_API_KEY is not configured. Saved experiments remain readable.');
    const id=this.store.reserve(kind,state.id),started=Date.now();
    try {
      const response=await this.fetchFn('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`},
        body:JSON.stringify({model:state.origin.model,reasoning:{effort:state.origin.reasoning},store:false,max_output_tokens:4000,
          instructions,input:JSON.stringify(input),text:{format:{type:'json_schema',name:'evolving_output',strict:true,schema}}})});
      if(!response.ok)throw new Error(`AI service returned HTTP ${response.status}.`);
      const result=await response.json();if(result.status!=='completed')throw new Error('AI response did not complete.');
      const content=(result.output??[]).filter(o=>o.type==='message').flatMap(o=>o.content??[]);
      if(content.some(c=>c.type==='refusal'))throw new Error('AI response was declined.');
      const data=JSON.parse(content.filter(c=>c.type==='output_text').map(c=>c.text).join(''));validate(schema,data);
      this.store.finish(id,{ok:true,model:result.model,responseId:result.id,elapsedMs:Date.now()-started,usage:result.usage});return data;
    }catch(e){this.store.finish(id,{ok:false,elapsedMs:Date.now()-started,error:e.message});throw e;}
  }
}
