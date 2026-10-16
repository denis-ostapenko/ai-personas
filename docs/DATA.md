# Memory, local data and restoration

## Home Repair Advisor

Each case is an atomically replaced JSON file. It contains owner binding, images, transcript, quoted active facts, correction journal, latest assessment/report and request traces. The UI gets a reduced view without the owner hash or complete source pages. A correction replaces the active fact, invalidates the old report and preserves the correction history. A new job epoch clears old active job facts and photos. A failed assessment leaves the previous saved case intact. Optional Google Places data is excluded from persistent case reports.

An HttpOnly cookie binds the browser to its cases; browser storage retains the current case ID. Starting another case does not delete the older one. There is no case-history browser or cross-case personal memory. Delete a case through the UI to remove its local file. This does not erase previous backups or information already sent to APIs.

## Persona

A browser profile has a SQLite database with complete profile state and chat snapshots, fact versions, shared episodes, reaction cells, typed links and affect events. A successful action commits them together. Facts are exact user quotations; corrections keep historical versions, while forgetting removes the selected fact chain, explicitly dependent episodes and corresponding relationship deltas. Interpersonal friction is recomputed from surviving attributed events. Logical forgetting masks matching details in subsequent context, but does not erase retained source transcripts or backups and cannot guarantee paraphrase detection.

Session-only chats store their own working memory and affect, without contributing profile facts, episodes or relationship changes. Deleting a chat removes its local working state while preserving separately committed long-term memory. Identity and authored temperament are versioned separately from current emotional state. The profile is not a public login account.

The UI's `Export` is a readable JSON data export. It omits full compiled chat snapshots and has no UI restore operation. Use the complete cold snapshot below for tested restoration. Do not substitute the public export.

## Complete cold snapshot for either app

Stop the app before copying its data. Keep the same source release and private browser cookie/profile if you want to resume the same identity. From the selected app directory:

```sh
node scripts/backup.mjs backup /private/app-data /private/new-backup.json
node scripts/backup.mjs restore /private/new-backup.json /private/new-restored-data
```

The parent of the restore destination must exist and the destination itself must not exist. The tool preserves full SQLite or case files, checks SHA-256, rejects symlinks, invalid paths and unexpected files, and writes private permissions. It refuses to overwrite a backup or an existing restore directory. Its snapshot limit is 128 MB of raw files. Backups contain personal data and are not encrypted. Keep them outside the repository and any public synchronization.

Restart the matching app version with PERSONA_COMPANION_DATA_DIR or PERSONA_DATA_DIR pointing to the restored directory. Keep the original browser cookie; for Advisor also retain the current case ID. A lost cookie cannot be reconstructed from its stored hash. Account recovery, profile reassignment and browser-cookie migration are not implemented. Tested recovery is a stopped-server data restoration with the same owner binding, not arbitrary cross-device account migration.

## Upgrading Persona 0.4.0

The 0.4.1 controller preserves emotion and memories, clears unattributed old friction on the next transition and recompiles an intact older reaction core lazily. It does not silently rewrite old stored trust deltas: historical attribution errors can therefore remain in a pre-existing relationship. New profiles have clean history. Retain a complete cold snapshot before upgrades if historical rollback is required. A stored profile is not guaranteed readable by older source code after a newer release writes it.

No private owner profiles were used in release verification. Tests use temporary synthetic storage and remove it afterward.
