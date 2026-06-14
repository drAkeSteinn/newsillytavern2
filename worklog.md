---
Task ID: 2
Agent: Main Agent
Task: Fix critical group chat lorebook bug and clean up dead code

Work Log:
- Traced complete lorebook flow in single-character chat (working correctly)
- Traced complete lorebook flow in group chat — found critical bug
- BUG: `useGroupLorebooks = lorebooks.length > 0` in group-stream/route.ts was always true
  when group has no lorebooks (client sends ALL character lorebooks), causing
  per-character filtering branch to never execute
- FIX: Changed to `useGroupLorebooks = !characterLorebooksMap || Object.keys(characterLorebooksMap).length === 0`
- FIX: Updated per-character variable initialization to be conditional on `useGroupLorebooks`
- Deleted `src/lib/lorebook/attribute-evaluator.ts` — dead code with 0 imports
- Deleted `src/components/tavern/lorebook-attribute-editor.tsx` — broken component with
  9 missing types and 4 missing constants, writes to wrong storage path
- Verified lint passes cleanly
- Verified app compiles and renders (GET / 200, all APIs 200)

Stage Summary:
- Critical bug fixed: group chat now correctly uses per-character lorebooks when group has none
- Dead code removed: attribute-evaluator.ts (0 imports) and lorebook-attribute-editor.tsx (broken)
- No compilation errors or lint issues
- App verified working via browser

---
Task ID: 1
Agent: Main Agent
Task: Clone https://github.com/drAkeSteinn/newsillytavern2 and set it up as the project

Work Log:
- Stopped existing dev server
- Cleaned current project directory (preserved .env and .git)
- Cloned repo to /tmp/newsillytavern2/
- Used rsync to copy all files from cloned repo to /home/z/my-project/
- Ensured .env file has correct DATABASE_URL=file:/home/z/my-project/db/custom.db
- Ran `bun install` - 849 packages installed successfully
- Ran `bun run db:push` - Prisma schema in sync, client generated
- Updated next.config.ts to add '.space-z.ai' to allowedDevOrigins
- Started dev server - it compiles and serves pages successfully
- Verified with agent-browser: TavernFlow app renders correctly with all components
  - Sessions sidebar with chat list
  - Character panel with 11 characters
  - Active chat with Decemone character
  - HUD display with stats
  - Background images and sprites
  - Quick reply buttons
  - TTS controls, voice recording, etc.

Stage Summary:
- Repository successfully cloned and set up
- All dependencies installed
- Database configured and in sync
- Dev server works (compiles and serves pages at localhost:3000)
- App verified working via agent-browser - full UI renders correctly
- Note: Server process dies after ~20-30s as background process (sandbox limitation), needs to be restarted for each session
- The app is TavernFlow - a modern LLM frontend for AI character interactions
