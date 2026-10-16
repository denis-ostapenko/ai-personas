# Contributing

Use Node.js 24 or later. There is no npm dependency installation or frontend build.

```sh
npm test
npm run check
```

Keep source, prompts, architecture and development notes in English. Public overview, release notes and roadmap have English and Brazilian Portuguese versions. Preserve exact message and evidence quotations.

For runtime changes, cover the outcome that matters: persistence, evidence scope, concurrency, budget accounting or a meaningful behavior boundary. For interface changes, inspect Conversation, Memory, About Mara, archived chats and Settings on wide and narrow screens. Keep raw technical records available without putting them in the main conversation flow.

Preserve origin hashes and old data. Changes to storage require a migration or compatible reader and a regression using existing state. Do not reset histories to make an update easier. Never commit databases, environment files, keys, personal transcripts, backups or downloaded model files.

Learning changes should declare their criteria before model evaluation and preserve failures. Model responses, outcome-controller transitions and human longitudinal development are different measurements. A fixed result or deterministic fixture must not be presented as a live model result.

Use new output directories for optional live runners. They use the configured API account and persist finite request limits. Ordinary tests and package checks need no API key.
