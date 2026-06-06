# Task 3 - OmniVoice Voice Profiles & Archetypes API Routes

## Agent: Sub Agent

## Task
Create two new API routes for OmniVoice Studio's voice profiles and archetypes system, plus an archetype preview audio endpoint.

## Files Created
1. `/home/z/my-project/src/app/api/tts/omnivoice/profiles/route.ts` - Voice Profiles API (GET)
2. `/home/z/my-project/src/app/api/tts/omnivoice/archetypes/route.ts` - Archetypes API (GET + POST use)
3. `/home/z/my-project/src/app/api/tts/omnivoice/archetypes/preview/route.ts` - Archetype Preview API (GET streaming audio)

## Key Decisions
- Followed existing code patterns from `/api/tts/speech/route.ts` and `/api/tts/available-voices/route.ts`
- Used `AbortSignal.timeout()` for timeout handling (5s for data, 15s for audio)
- Used `[OmniVoice-*]` console log prefixes for consistent log filtering
- All endpoints accept `?endpoint=` query param for OmniVoice server URL
- Preview route returns binary audio with proper Content-Type, Cache-Control, and Accept-Ranges headers
- POST use endpoint requires `id` in body, optional `name` and `language`
- Error responses use appropriate HTTP status codes (400 for bad request, 502 for upstream errors, 504 for timeouts)

## Verification
- `bun run lint` passes with no errors
- Dev server running correctly on port 3000
