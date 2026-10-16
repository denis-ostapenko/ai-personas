# Home Repair Advisor

Version 0.4.0

Home Repair Advisor is a practical conversational consultant for household repairs in the United States. Describe a job, add photos and a ZIP code, and it helps clarify the scope, prepare a budget and compare local service providers using published sources. It speaks English and Brazilian Portuguese, remembers the details of the current job and carries corrections into the next answer. Its manner is calm, direct and attentive to the customer's time and budget.


The persona persists in application-owned external state, while the configured model enacts it. This version adds independent recall of original messages with source provenance. [Persona and memory](docs/PERSONA.md).

## Strengths

- Combines photos, the customer's description and remembered job details in one conversation.
- Carries corrections forward and separates a new job from earlier work.
- Builds budgets from published rates, stated quantities and explicit material allowances.
- Links provider details, prices and supported review excerpts to their sources.

## Current weaknesses

- Service search covers US ZIP codes and estimates remain in USD.
- Incomplete source pages can leave gaps in prices, contact details or reviews.
- Photos do not reveal concealed conditions or exact measurements.
- Booking, confirmed availability and a case-history browser are not yet included; interface labels remain English.

## Run

Use Node.js 24, configure the variables in [.env.example](.env.example), then run:

```sh
npm start
```

Home Repair Advisor: http://127.0.0.1:4317. OPENAI_API_KEY, TAVILY_API_KEY.

[Release notes](CHANGELOG.md) | [Upcoming versions](ROADMAP.md) | [Português brasileiro](README.pt-BR.md)

[Architecture](docs/ARCHITECTURE.md) | [Data and restoration](docs/DATA.md)

MIT. Copyright (c) 2026 Denis Ostapenko. [LICENSE](LICENSE).

[Photograph attribution](tests/fixtures/ATTRIBUTION.md).
