import { AppError, postJSON } from '../errors.mjs';
import { validate } from '../schema.mjs';

export class OpenAIProvider {
  constructor({ key, model = 'gpt-6.1-sol', reasoning = 'low', fetchFn = fetch } = {}) {
    this.key = key; this.model = model; this.reasoning = reasoning; this.fetchFn = fetchFn;
    this.id = 'openai'; this.calls = 0;
  }
  async structured({ instructions, input, schema, name }) {
    if (!this.key) throw new AppError(503, 'ai_not_configured', 'The AI connection is not configured.');
    if (++this.calls > 60) throw new AppError(429, 'local_usage_limit', 'This local server has reached its 60-request development limit. Restart it to continue.');
    const started = Date.now();
    const response = await postJSON('https://api.openai.com/v1/responses', this.key, {
      model: this.model, reasoning: { effort: this.reasoning }, store: false,
      instructions, input, max_output_tokens: 6000,
      text: { format: { type: 'json_schema', name, strict: true, schema } }
    }, { fetchFn: this.fetchFn });
    const parts = (response.output || []).filter(x => x.type === 'message').flatMap(x => x.content || []);
    if (parts.some(x => x.type === 'refusal')) throw new AppError(422, 'model_refusal', 'I could not assess this request. Please describe the household job you need help with.');
    if (response.status !== 'completed') throw new AppError(502, 'incomplete_response', 'The assessment did not finish. Please try again.');
    let data;
    try { data = JSON.parse(parts.filter(x => x.type === 'output_text').map(x => x.text).join('')); validate(schema, data); }
    catch { throw new AppError(502, 'invalid_model_output', 'The assessment did not pass its format checks. Please try again.'); }
    return { data, trace: { provider: this.id, model: response.model || this.model, responseId: response.id, elapsedMs: Date.now() - started, usage: response.usage || null } };
  }
}
export function createProvider(env = process.env) {
  const id = env.PERSONA_PROVIDER || 'openai';
  if (id !== 'openai') throw new AppError(503, 'unsupported_provider', `Provider '${id}' has no verified adapter yet. Select openai.`);
  return new OpenAIProvider({ key: env.OPENAI_API_KEY, model: env.PERSONA_MODEL, reasoning: env.PERSONA_REASONING });
}
