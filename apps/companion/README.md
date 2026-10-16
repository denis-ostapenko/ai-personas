# Persona

Version 0.5.0

Persona is a conversational character with a recognizable voice, adjustable temperament and a shared history that carries across chats. Six controls shape its humor, warmth, independence, initiative, intellectual manner and composure. It can discuss an idea, disagree, return to an unfinished topic or recall a shared joke in English or Brazilian Portuguese. Its enduring character, memories and changing emotional state are maintained separately.


The persona persists in application-owned external state, while the configured model enacts it. This version adds independent recall of original messages with source provenance. [Persona and memory](docs/PERSONA.md).

## Strengths

- Six controls make the character's manner adjustable without discarding shared history.
- Memory retains attributed facts, corrections, shared episodes and unfinished topics across chats.
- Emotional reactions change with events and time; relationship changes depend on who did what.
- Local storage, selective forgetting and complete snapshots give the owner direct control over saved data.

## Current weaknesses

- Messages involving several actors can still be compressed into an incomplete interpretation.
- A normal exchange uses separate appraisal and dialogue calls, which adds latency and API cost.
- Forgetting can miss paraphrases in retained transcripts.
- The interface is in English, and access to saved profiles depends on the browser cookie.

## Run

Use Node.js 24, configure the variables in [.env.example](.env.example), then run:

```sh
npm start
```

Persona: http://127.0.0.1:4346. OPENAI_API_KEY.

[Release notes](CHANGELOG.md) | [Upcoming versions](ROADMAP.md) | [Português brasileiro](README.pt-BR.md)

[Architecture](docs/ARCHITECTURE.md) | [Data and restoration](docs/DATA.md)

MIT. Copyright (c) 2026 Denis Ostapenko. [LICENSE](LICENSE).
