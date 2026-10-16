# Security and data handling

The supplied app runs on loopback for one trusted local operator. It checks Host and Origin, accepts bounded JSON requests, constrains profile identifiers and renders conversation text without executing it. API credentials stay in the server environment.

Profiles and conversation identities are data scopes, not authenticated users. The database and backups are plaintext. Avoid exposing the server through a public proxy without adding an authentication and deployment layer. [Data documentation](docs/DATA.md) describes what is sent to the model API.

Before sharing an issue or reproduction, remove keys, `.env`, databases, backups, private messages and request transcripts. For a security-sensitive finding, use a private contact channel offered by the repository maintainer rather than posting the secret or exploit data in a public issue.

For development, run `npm test` and `npm run check`. The local release verifier checks its explicit file list, hashes and secret/data patterns before export.
