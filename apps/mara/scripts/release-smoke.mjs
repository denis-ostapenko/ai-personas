import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from '../src/store.mjs';
import {Provider} from '../src/provider.mjs';
import {Engine} from '../src/engine.mjs';
import {Memory} from '../src/memory.mjs';
import {LocalEmbeddings} from '../src/embeddings.mjs';
const directory=resolve(process.argv[2]||'data/release-review/live');
if(existsSync(directory))throw new Error('Choose a new review directory.');
mkdirSync(directory,{recursive:true});
writeFileSync(resolve(directory,'registered.json'),JSON.stringify({at:new Date().toISOString(),maxCalls:12,checks:['English reply','Brazilian Portuguese reply','New conversation and grounded recall','Partner separation','Initiative'],retries:0},null,2));
const store=new Store(resolve(directory,'mara.sqlite'),{maxCalls:12}),provider=new Provider(store),embeddings=new LocalEmbeddings(store),engine=new Engine(store,provider,{adaptive:true,memory:new Memory(provider,{embedder:embeddings})});
store.create('mara',{synthetic:true});const output={turns:[],errors:[]};
try{
 for(const text of ['For this fictional review, the spare projector cable is in a cobalt box on shelf D-4. Please acknowledge in English.','Pode responder em português brasileiro? Onde está o cabo reserva do projetor?'])output.turns.push({text,...await engine.turn('mara',text,'reviewer')});
 output.session=await engine.startSession('mara','reviewer');
 output.turns.push({text:'Which shelf holds the spare cable?',...await engine.turn('mara','Which shelf holds the spare cable?','reviewer')});
 output.isolation=await engine.search('mara','other','projector cable');
 output.initiative=await engine.initiate('mara','reviewer');
 output.checks={recall:output.turns.at(-1).reply.includes('D-4'),separatePartner:!JSON.stringify(output.isolation).includes('cobalt'),noReflectionErrors:output.turns.every(t=>!t.reflectionError),newSession:store.get('mara').memory.sessions.filter(s=>s.partner==='reviewer').length===2};
}catch(error){output.errors.push(error.message);process.exitCode=1;}
finally{output.calls=store.calls();output.budget=store.budget();writeFileSync(resolve(directory,'observations.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({checks:output.checks,budget:output.budget,errors:output.errors}));embeddings.close();store.close();}
