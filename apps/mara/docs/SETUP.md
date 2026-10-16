# Setup and configuration

## Requirements

- Node.js 24 or later, including built-in `node:sqlite`.
- An OpenAI API key and access to a model supporting the Responses API and structured JSON output.
- A modern browser. No npm installation or frontend build is required.

Copy `.env.example` to `.env`, set your own key, and run `npm start`. The Node entrypoint loads `.env` if it exists; exported environment variables take precedence. Keep `.env` out of Git. Open `http://127.0.0.1:4351`.

Without a configured key you can inspect existing histories, search local memory, manage profiles and restore prior versions. Model actions are disabled in the interface.

## Settings

| Variable | Default | Effect |
| --- | --- | --- |
| `OPENAI_API_KEY` | None | Server-side model credential |
| `PORT` | `4351` | Loopback HTTP port |
| `EVOLVING_DB` | `data/personas.sqlite` beside the app | Complete profile and call database |
| `EVOLVING_MAX_CALLS` | `60` | Initial total request limit for a new database, 1-200 |
| `MARA_MODEL` | `gpt-6.1-sol` | Model for newly created profiles |
| `MARA_REASONING` | `low` | Reasoning setting for newly created profiles |
| `MARA_EMBED_PYTHON` | Project `.venv`, then an existing local RAG runtime if found | Optional Python executable |
| `MARA_EMBED_CACHE` | FastEmbed's default cache | Optional model-cache directory |

The model default reflects the development configuration. Set an exact model identifier available to your API account. Each profile pins the chosen model in its origin. Changing the environment does not silently migrate existing profiles. Unsupported model or reasoning combinations return a provider error.

Each model call reserves one request before contacting the API. A turn can include dialogue, rule discovery and memory summaries. The app does not calculate a currency budget. The API account's own usage controls remain separate.

## Change the request limit

```sh
npm run budget
npm run budget -- --limit 200
```

This explicitly sets the database's total allowed attempts; it does not add a fresh allowance or erase already-used attempts. The command accepts an integer from 1 to 1,000,000, never below the number already used. Setting `EVOLVING_MAX_CALLS` again only affects a new database.

## Optional semantic memory search

Keyword search works without Python. To add local semantic matching, create a project virtual environment and install the pinned optional requirement:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-embeddings.txt
.venv/bin/python scripts/prepare-embeddings.py
npm start
```

On Windows use `.venv\Scripts\python.exe` for the Python commands. The app checks both virtual-environment layouts. If using another environment, set `MARA_EMBED_PYTHON` to the absolute executable path.

The preparation command downloads the model and performs one local embedding. If using `MARA_EMBED_CACHE`, use the same value for preparation and the server. During normal use the worker requests local files only; conversation generation still uses the model API. If the worker cannot start, keyword retrieval remains active. Restart the server after repairing the optional environment.

FastEmbed 0.8.0 and the multilingual MiniLM model are optional, separately licensed components. Neither their packages nor model weights are bundled in the release.

## Routine commands

```sh
npm test
npm run check
npm run backup -- ./backup-october
npm run restore -- ./backup-october ./restored-october
```

Use a new destination directory for backup and restore. The parent directory must already exist. Set `EVOLVING_DB=./restored-october/personas.sqlite` when starting to use that restored copy. Stop the server with Ctrl-C.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Offline in Settings | Export the key or add it to `.env`, then restart the server |
| Provider HTTP error | Check model access, credential validity and the API account's status |
| Request limit reached | Inspect `npm run budget`, then explicitly set the intended total |
| Memory organization paused | The reply is already saved; inspect the connection/limit, then organize memory again |
| Keyword fallback | Prepare the optional local model and restart, or keep using keyword search |
| Profile changed concurrently | Refresh after the other operation finishes; do not run two servers on one database |
| Port already in use | Stop the other Mara process or select another `PORT` |
| Need the old history | Verify `EVOLVING_DB`, profile and conversation identity before creating anything new |

For operation behind a shared network service, authentication and deployment controls would need to be implemented separately. The supplied server is intentionally bound to the local computer.
