# Resources and architectural background

Based on the project's October 10 synthesis and October 12 weekly research record; prepared October 14, 2026.

## Components actually used

- Node.js ES modules, built-in HTTP, fetch, crypto, test runner and filesystem APIs. Persona uses Node's bundled [SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html); Advisor uses atomic JSON files. No third-party npm runtime libraries or agent framework are installed. Verified execution environment: Node 24.11.1, Apple Silicon macOS.
- OpenAI Responses, model `gpt-6.1-sol`, reasoning `low`, strict schema outputs, server-side keys and `store: false`. [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [image inputs](https://developers.openai.com/api/docs/guides/images-vision), [model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol).
- Advisor additionally uses [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search) and [Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract), plus [Zippopotam.us](https://api.zippopotam.us/) for US ZIP location. It has an optional [Google Places](https://developers.google.com/maps/documentation/places/web-service/text-search) adapter with transient display.
- Development used AI-assisted coding/review in Codex and Claude, local source files, offline RAG over project documents, local development and review tools.

## Research ideas considered, not imported implementations

| Source | How it informed the questions | Limit here |
|---|---|---|
| [EMA: A process model of appraisal dynamics](https://stacymarsella.org/publications/pdf/EMA_Dynamics.pdf), 2009 | Separate interpretation/appraisal from reaction and later reappraisal | No EMA code is bundled; numeric coefficients are authored engineering choices |
| [ALMA: A Layered Model of Affect](https://www.dfki.de/en/web/research/projects-and-publications/publication/1782/), 2005 | Distinguish emotion, mood and enduring personality | Similar layer separation is not a reproduction or validation of ALMA |
| [LongMemEval](https://arxiv.org/html/2410.10813v2), v2 March 4, 2025 | Evaluate temporal updates, multi-session recall and abstention separately | No LongMemEval benchmark was run; local scenarios are custom integration checks |
| [A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110v11), v11 October 8, 2025 | Linked memory and retrieval as a design alternative | No A-MEM library, embedding index or automatic self-editing memory implementation is used |
| [PersMem](https://arxiv.org/abs/2609.34372v1), September 28, 2026 | Candidate comparison of personality-conditioned and ordinary retrieval | Proposed experiment; the app does not implement its dual-pathway method |
| [SPIN](https://arxiv.org/abs/2610.08328v1), October 6, 2026 | Candidate comparison of stable core, contextual state and decision stages | Research context, not imported code or proof of psychological validity |
| [Benchmarking Psychological Dynamics in Generative Agents](https://arxiv.org/abs/2610.04246v1), October 3, 2026 | Test within-person trajectories and recovery rather than average trait scores alone | No such benchmark or human longitudinal validation was completed here |

The project also examined MemGPT/Letta, Mem0, Graphiti/Zep, Hindsight, activation control and voice systems in its wider research archive. None is a runtime dependency in this package. The included bibliography is intentionally selective; the full downloaded archive is excluded. The unresolved date conflict around arXiv 2610.00010 in the wider research collection is not used as release evidence.

## Proposed next work

Repeated held-out trait comparisons, actor-rich interpretation, reaction calibration, event-order/recovery measurements, larger-history retrieval, streaming responses and provider migration experiments. Voice, human replication, autonomous enduring personality changes, billing and hosted accounts are not implemented by these two apps.
