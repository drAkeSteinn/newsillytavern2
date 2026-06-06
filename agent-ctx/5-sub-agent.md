# Task 5: Update TTS Settings Panel for OmniVoice Voice Profiles and Archetypes

## Task Summary
Updated `src/components/tavern/tts-settings-panel.tsx` to properly display and select OmniVoice voice profiles and archetypes in the "Voces" tab.

## Changes Made

### File: `src/components/tavern/tts-settings-panel.tsx`

1. **Import update** (line 58): Added `VoiceInfo`, `OmniVoiceProfile`, `OmniVoiceArchetype`, `OmniVoiceEngine` to the import from `@/types`

2. **Removed local VoiceInfo interface** (was lines 125-130): Deleted the local interface that only had `id`, `name`, `path`, `language` fields. Now uses the enhanced `VoiceInfo` from `@/types` which includes `type`, `description`, and `engineId`.

3. **Added state variables** (lines 185-189):
   - `omniVoiceProfiles` (OmniVoiceProfile[])
   - `omniVoiceArchetypes` (OmniVoiceArchetype[])
   - `omniVoiceEngines` (OmniVoiceEngine[])
   - `isLoadingProfiles` (boolean)
   - `isLoadingArchetypes` (boolean)

4. **Updated useEffect** (lines 206-216): Added `ttsConfig.provider` to dependency array. When provider is 'omnivoice', also calls `loadOmniVoiceProfiles()` and `loadOmniVoiceArchetypes()`.

5. **Updated loadAvailableVoices** (lines 283-303): Now captures `data.engines` from the API response and stores it in `omniVoiceEngines` state. Clears engines on error.

6. **Added 3 new functions** (lines 305-364):
   - `loadOmniVoiceProfiles()`: Fetches from `/api/tts/omnivoice/profiles`
   - `loadOmniVoiceArchetypes()`: Fetches from `/api/tts/omnivoice/archetypes`
   - `applyArchetype()`: POST to `/api/tts/omnivoice/archetypes/use` to create a voice profile from archetype

7. **Replaced "Voces" tab** (lines 1272-1645): Complete redesign:
   - Load button that triggers profile/archetype loading for OmniVoice
   - "Perfiles de Voz" card (emerald border) with profile cards showing name, demo/locked badges, language, instruct
   - "Arquetipos de Voz" card (purple border) with archetype cards showing facets, use_case, featured badge, "Usar" button
   - "Voces del Sistema/Voces Disponibles" card with type badges (Perfil/OpenAI)
   - "Motores TTS Disponibles" card showing engine availability
   - Voice upload card preserved

8. **Fixed lint error**: Renamed `useArchetype` → `applyArchetype` to avoid react-hooks/rules-of-hooks false positive.

## Verification
- `bun run lint` passes with no errors
- Dev server running correctly on port 3000
