# Configuration and clean setup

Prerequisite: Node.js 24. No global packages, npm install, database server or bundler are required.

`npm start` in either app runs Node directly and reads the process environment. It does not read a personal key file. Set variables in your shell, or copy the app's `.env.example` to a private file, fill the required keys, and run `node --env-file=.env src/server.mjs` from that app. `.env` is ignored. Never place credentials in client-side files, test reports or the repository.

The optional `npm run start:owner` wrapper supports a shell-readable `PERSONA_KEYS_FILE`, or `~/.api-keys` when OPENAI_API_KEY is absent. This is a convenience only; an ordinary installation does not need either file. It works independently of any owner's username or checkout location.

| Variable | App | Default / meaning |
|---|---|---|
| OPENAI_API_KEY | Both | Required for live model calls; no bundled value |
| TAVILY_API_KEY | Advisor | Required for live contractor/web evidence search |
| GOOGLE_MAPS_API_KEY | Advisor | Optional Google Places adapter; leave unset for the verified release demo |
| PERSONA_MODEL | Advisor | gpt-6.1-sol |
| PERSONA_REASONING | Advisor | low |
| PERSONA_PROVIDER | Advisor | openai; other IDs are rejected |
| PERSONA_PORT | Advisor | 4317 |
| PERSONA_DATA_DIR | Advisor | Explicit private storage path, otherwise the home-directory default below |
| PERSONA_COMPANION_MODEL | Persona | gpt-6.1-sol |
| PERSONA_COMPANION_REASONING | Persona | low |
| PERSONA_COMPANION_APPRAISAL_MODEL | Persona | Optional override for the first call only |
| PERSONA_COMPANION_APPRAISAL_REASONING | Persona | Optional override for the first call only |
| PERSONA_COMPANION_MAX_CALLS | Persona | 120 attempts per process, retries included; positive integer |
| PERSONA_COMPANION_PORT | Persona | 4346 |
| PERSONA_COMPANION_DATA_DIR | Persona | Explicit private storage path, otherwise the home-directory default below |
| PERSONA_KEYS_FILE | Owner wrapper only | Optional shell-readable credential file |

Default private data folders are `~/Library/Application Support/AI Personas/home-repair-advisor/` and `~/Library/Application Support/AI Personas/conversation-persona/`. Set explicit data directories outside this repository to use another location.

The default model is `gpt-6.1-sol`. Alternative models must support the required image inputs and structured outputs. The runtime uses the OpenAI adapter.

## Errors and limits

Both servers bind to loopback, reject inappropriate Host/Origin headers, keep credentials server-side, reject malformed output and preserve the saved state on failed turns. Persona's appraiser may fail and fall back to neutral decay while dialogue still proceeds; the trace records this distinction. OpenAI retries in Persona count toward its process budget. Advisor caps model calls at 60 per process and does not silently retry them. These limits reset on restart and are not billing controls or multi-user quotas.

A configuration error leaves the interface available. A stale revision or same-profile overlapping action requires a reload/retry after the current action finishes. Persona locks its data directory against a second server; Advisor's same-case lock is in-process, so run only one Advisor process per data directory. Optional Persona reviews are disabled initially and run only inside the local server.

Before any intentional live test, choose synthetic input, confirm the model, set a finite call cap and record the protocol. API usage may be billed to the configured accounts; no prices or subscriptions are assumed here.
