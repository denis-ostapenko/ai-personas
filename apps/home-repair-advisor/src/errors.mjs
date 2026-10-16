export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export async function postJSON(url, key, body, { timeout = 90000, fetchFn = fetch } = {}) {
  let response;
  try {
    response = await fetchFn(url, {
      method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeout)
    });
  } catch (error) {
    throw new AppError(502, 'upstream_unreachable', error.name === 'TimeoutError' ? 'The service took too long. Please try again.' : 'The service could not be reached. Your case has been preserved.');
  }
  if (!response.ok) {
    // Never return provider bodies: they may contain submitted private input.
    const code = response.status === 401 || response.status === 403 ? 'provider_access' : response.status === 429 ? 'provider_limit' : 'provider_error';
    const error = new AppError(502, code, `The upstream service returned HTTP ${response.status}. Please try again after its access or service issue is resolved.`);
    error.upstreamStatus = response.status;
    error.requestId = response.headers.get('x-request-id');
    throw error;
  }
  try { return await response.json(); } catch { throw new AppError(502, 'provider_format', 'The upstream service returned an unreadable response.'); }
}
