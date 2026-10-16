# User guide

## Your first conversation

Open Mara and write in the message box. Enter sends; Shift + Enter adds a line. The suggestion buttons fill the box without sending. **Let Mara start** invites her to bring up an interest or unfinished thread.

English and Brazilian Portuguese are supported in conversation. Ask for a language explicitly or use it in your message. Internal summaries and development records are in English; original messages and quotations retain their language.

## Conversation history

**New** beside Conversations opens a fresh chat. Earlier messages remain available in the sidebar. Clicking an old chat opens its saved transcript. **Back to current conversation** returns to the active chat. A new conversation starts with relevant memories and summaries from the preceding conversations.

In **Settings**, keep the same conversation identity to continue the same history. Use lowercase letters, digits, and hyphens. Different identities separate raw conversations and retrieval within a profile. A profile still has one developing personality; use a separate profile when you want a fully separate trajectory.

## Memory

Open **Memory** and search for a name, detail, or topic. Results can include original episodes, segment summaries, conversation overviews, and themes. **Read source** opens the original message and Mara's reply.

Memory organization runs as conversation segments accumulate, when a new conversation opens, and approximately every six hours while the server is running. **Organize memory** requests a pass immediately. Closing the server pauses this periodic work. Organization keeps original messages and rebuilds derived summaries and topic groups.

If optional local embeddings are unavailable, keyword search continues to work. Search results contain a selected part of the archive; try a more specific phrase if the detail does not appear.

## Views and habits

**About Mara** shows her self-description, interests, views, habits, and temperament. Under **What is changing**:

| Label | Meaning |
| --- | --- |
| Taking shape | A provisional rule awaiting outcomes from later attempts |
| Practiced | A habit supported by prospective successful use |
| Let go | A habit no longer used as the default |
| Supported | A belief strengthened by observed signals |
| Reconsidered | A belief whose initial confidence has fallen |

For useful feedback, say what you tried and what actually happened. Mara can link an explicit result to an earlier recommendation. Agreement, repetition, and her own generated answer are not new outcome evidence.

**Reflect now** reviews eligible recent outcomes. It may produce a provisional rule or leave things as they are. Repeated failures across different task families can retire a habit. Returning to it requires new successful attempts after retirement.

## Earlier versions

Open **History and earlier versions** in About Mara. Choose an earlier version, click **Restore this version**, review the confirmation, and restore. This restores the self and learned rules as a new version. Conversations, outcomes and the previous version history remain in the database.

## Profiles

**Settings > Advanced** selects another profile or creates one from the starting personality. **Keep the starting personality fixed** creates a comparison profile that remembers conversations without adopting persistent self changes. Profiles are independent; all profiles in a database share its request limit.

## Connection and request limit

Settings shows the active model and the number of API attempts used. A normal turn can also trigger a discovery pass or memory summary. See [Setup](SETUP.md) to connect your key, choose the model for new profiles, and change the total request limit without clearing history.

## Backups

Wait for the current reply to finish, then run from the application directory:

```sh
npm run backup -- ./backup-october
npm run restore -- ./backup-october ./restored-october
```

Both destinations must be new directories. Start with `EVOLVING_DB=./restored-october/personas.sqlite` to use the restored copy. [Data and backups](DATA.md) explains exactly what is preserved.
