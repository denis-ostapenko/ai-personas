# Maintaining the prepared repository

This tree is generated from two canonical app directories. It is a focused distribution, not the complete research workspace. Runtime files are copied byte-for-byte; curated release-facing documentation replaces workspace navigation and historical archives.

In the original workspace, run `node releases/first-two/build.mjs`, then `node releases/first-two/verify.mjs`. The builder uses a fixed allowlist, rejects symlinks and records hashes/provenance. It writes to a fresh staging directory, checks the existing exported manifest for untracked edits, then replaces the previous generated tree. It preserves the local `.git` metadata if present. Make intended source changes in the canonical app directories and release templates, then regenerate and commit the resulting local repository. Do not edit the generated copy directly.

For an independent checkout, develop inside `apps/` and use root `npm test` and `npm run check`. The original workspace builder is not a runtime dependency and is intentionally outside this publishable tree.

Offline checks run without API credentials. To repeat live checks, choose a fresh PERSONA_RELEASE_OUTPUT directory and explicitly authorize API usage. The built-in recorded budgets do not authorize unlimited repetitions. Current release evidence must match the exact tested source hashes. Do not relabel historical reports as current verification.

MIT was selected by Denis Ostapenko on October 14, 2026. Preserve LICENSE and the photograph's separate attribution. Publishing to GitHub still requires the owner's explicit instruction.
