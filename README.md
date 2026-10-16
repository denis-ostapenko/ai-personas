# AI Personas: companion applications

Three local applications by Denis Ostapenko, accompanying *AI Personas: Character, Memory, and Development*. All three converse in English and Brazilian Portuguese.

| Application | What to inspect | Version |
| --- | --- | --- |
| [Persona](apps/companion/README.md) | Authored character, adjustable temperament and source-backed memory | 0.5.0 |
| [Home Repair Advisor](apps/home-repair-advisor/README.md) | Case-scoped evidence and practical repair consultation | 0.4.0 |
| [Mara](apps/mara/README.md) | Recorded experience and bounded changes to habits and views | 0.3.0 |

## Start

Install Node.js 24 or later. No npm installation or build is required. In the selected app folder, copy `.env.example` to `.env` and configure your own API access. The software is free under MIT; model and search providers may charge for usage.

On macOS, use the matching `Start [application].command` file; on Windows, use its `.cmd` counterpart. A terminal can use:

```sh
node scripts/start-app.mjs persona
node scripts/start-app.mjs advisor
node scripts/start-app.mjs mara
```

The interfaces open at http://127.0.0.1:4346 for Persona, http://127.0.0.1:4317 for Advisor and http://127.0.0.1:4351 for Mara. Run the command, then open the matching local address in a browser. The launchers do not install software, read a personal key store or send model requests themselves.

[Setup and configuration](docs/CONFIGURATION.md) · [Mara setup](apps/mara/docs/SETUP.md) · [Teaching laboratory](laboratory/README.md) · [Source-reading index](book/source-reading-index.md)

[Free book and companion page](https://denisostapenko.com/books/ai-personas/companion) · [Português brasileiro](README.pt-BR.md)

## Evidence and limits

These packages preserve the tested application versions. Their local software checks and bounded synthetic model tests do not establish human benefit, general personality fidelity or broad developmental continuity. The full independent harm/shutdown controller described in the book is not implemented here. The laboratory demonstrates selected storage boundaries and uses temporary synthetic databases; it makes no model calls.

## License

[MIT](LICENSE), copyright (c) 2026 Denis Ostapenko. Third-party material retains its own [notices](THIRD_PARTY_NOTICES.md); Mara's [notices](apps/mara/THIRD_PARTY_NOTICES.md) also apply. The book has separate publication terms.
