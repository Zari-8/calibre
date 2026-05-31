# Calibre Home Rate Battle Upgrade

## Homepage rhythm
- Reduced vertical spacing between homepage sections.
- Tightened hero and search-band padding.
- Reduced Founder Pass strip height.

## Featured rate battle
- Control, Impact and Creativity now operate as functional matrix tabs.
- Each category switches the prompt and rating context.
- Each category keeps its own user rating.
- The live rating matrix updates immediately when a score is submitted.
- Debate is now a separate forum action rather than a fake rating category.

## Battle forum flow
- The Debate button opens a contextual modal for the current matchup.
- The modal leads to `/debates?forum=pedri-vs-jude`.
- Signed-in prototype accounts see the discussion composer and forum posts.
- Signed-out visitors see an account-access gate.

## Account architecture
- Added a frontend account-access handoff modal in the shared shell.
- The prototype stores a local session under `calibre:user` so the interaction can be tested immediately.
- Replace the local session with Supabase, Clerk or another production auth provider before launch.
