# Task 2 - Sub Agent: Fix OmniVoice voice listing parser

## Task
Fix and enhance `/api/tts/available-voices/route.ts` to properly parse OmniVoice Studio's voice listing response.

## Changes Made
- Updated `VoiceInfo` interface with `type`, `description`, `engineId` fields
- Added `OmniVoiceEngine` interface for engines array typing
- Split voice parsing into provider-specific branches (omnivoice vs tts-webui)
- OmniVoice: maps `voice_id` → `id`, captures `type`, `language`, `description`
- Captures `engines` array from OmniVoice response
- Associates voices with default available engine
- Returns `grouped` object (profiles, aliases, other) for OmniVoice UX
- Preserved TTS-WebUI parsing unchanged

## Verification
- `bun run lint` passes with no errors
- Dev server running correctly on port 3000
