# Data, persistence and backups

## What is stored

The database contains independent profile snapshots, immutable starting configurations, current selves, source episodes and replies, conversation sessions, memories and summaries, learning rules/trials/receipts, change versions, mood and relationship state. It also contains the request ledger and cached local embeddings.

API keys are read from the server environment and are not included in the database. The request ledger stores request kind, profile, timing, model, usage metadata and sanitized transport errors. The application provider does not store full request bodies in that ledger. Explicit experiment runners can save their synthetic input/output evidence in separate data directories.

The browser remembers the selected profile and conversation identity in local storage. Clearing browser storage does not delete server history. Select the same profile and identity again in Settings.

## What leaves the computer

Model requests send the supplied message, current self, relevant memories, excerpts and structured context to the configured OpenAI API. Requests specify `store:false`. Your API account's processing terms apply. Local database storage does not make model generation local.

Optional embeddings are computed in a local Python process. Their setup command downloads the model; normal embedding requests use offline model files. The app has no analytics collector or external messaging tool.

## Back up

Wait for an active turn to finish so its final state is included:

```sh
npm run backup -- ./backup-october
```

The command creates a new directory with `personas.sqlite` and `snapshot.json`. It uses SQLite's backup API, so committed WAL data is included. The manifest records a SHA-256 digest. All profiles, request counts, memory vectors, learning rules and version history are included. No environment file or API key is copied.

A backup made while a model request is in progress can contain its reserved attempt and the preceding profile state. Pending attempts remain counted after restore. Store backups outside the source export and protect them like the original conversations.

## Restore

```sh
npm run restore -- ./backup-october ./restored-october
```

Restore validates the checksum, SQLite integrity, required tables and origin hashes, then writes into a new directory. It refuses to overwrite an existing destination. Point `EVOLVING_DB` at the new `personas.sqlite` and restart the app. Keep the original until you have checked the restored history.

Snapshots do not include Python packages or embedding model files. Those can be installed again; cached vectors and original text are already in the database. Snapshots also do not include API credentials.

## Updates and versions

Replacing application files does not replace the selected database. Current memory fields are initialized lazily for earlier profiles. Existing model/origin configurations are preserved. Legacy rule histories remain readable; newly started action trials carry unique phase identifiers to prevent delayed feedback crossing a rollback boundary.

Restoring a personality version within the interface is different from restoring a database snapshot. The interface changes current self and learned rules while preserving all existing conversation/outcome history. A database restore reproduces the complete database at the snapshot point.

Original source messages are retained when summaries are compacted. There is currently no selective delete or correction UI. Stop the server before manually moving database files. Use snapshots rather than copying only the main SQLite file while WAL writes are active.
