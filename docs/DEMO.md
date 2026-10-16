# Demonstration guide

## Offline first

Run `npm test` and `npm run check` from the repository root. Run `npm run demo:persona` for a deterministic UI fixture at port 4347. Its responses are explicitly labeled browser-test replies; it shows the interface and state wiring, not model quality. Stop with Ctrl-C to remove temporary fixture storage. Advisor's tests supply offline fixture models and searches; its normal UI requires live credentials for an actual assessment.

## Advisor: a small repair with a correction

1. Start the Advisor with a new private data directory, OPENAI_API_KEY and TAVILY_API_KEY. Open http://127.0.0.1:4317.
2. Use ZIP 10001 and the included, attributed `tests/fixtures/door-hinge.jpg` as a reference image. Say: "Hypothetical job: one interior door rubs at the top. Keep existing hardware if possible. This image is a public reference, not my home."
3. Correct the symptom: "It rubs at the bottom, not the top. Keep the existing door and hinges." Inspect remembered details and the changed scope.
4. Run the local-options search. Show the budget assumptions and source links. Explicitly describe all appointment and ZIP coverage claims as unconfirmed.
5. Reload the case, then delete the synthetic case. A missing provider or quote is a retrieval limitation; do not fill it with invented contact details.

The release run obtained four supported provider cards from sixteen sources and a USD 70-330 planning estimate. That is a dated synthetic run, not a current directory guarantee or a contractor quote. It had a partial full-review-page warning. Google was not queried.

## Persona: attributed reaction and continuity

1. Start Persona with a new private data directory and OPENAI_API_KEY; open http://127.0.0.1:4346. Skip optional onboarding or use invented details.
2. Say: "My favorite subject is astronomy. Please remember it." Then correct it to urban architecture. In a new chat, ask for the current and former subject.
3. Tell a story about a manager humiliating a colleague while you opposed the manager. Open State: anger can be present, but trust should not be penalized for the manager's action.
4. In a separate synthetic profile, directly demand agreement regardless of evidence. Then distinguish an apology from the manager to a colleague from your own apology to the persona. The latter can repair your conflict.
5. Forget the subject in Memory. In a new chat, ask again. Explain the difference between logical memory removal and retained transcripts.
6. Stop the server, make a cold backup, restore into a new directory and restart with the same browser profile. Demonstrate the complete recovery path separately from the UI export.

The release Persona run used 13 turns and 26 model requests. Median end-to-end turn latency was 12.238 seconds (range 6.438-19.114 seconds). Plan for visible nonstreaming waits; these are one-run measurements, not a service latency commitment.

## Repeat the bounded live protocols

From either app directory run `node scripts/release-live.mjs` only when API usage is intended and credentials are supplied. It refuses to overwrite its checked-in release record: archive that record outside the app or point PERSONA_RELEASE_OUTPUT at a new empty directory. Protocol and ceilings are written before requests. Persona: at most 28 model attempts, no retries. Advisor: at most 8 model, 8 search/extract and 2 ZIP attempts; no Google calls. The scripts report partial failure honestly and remove temporary data. Live outputs and new records should be reviewed before inclusion in a release.
