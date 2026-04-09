import { NextRequest, NextResponse } from 'next/server';
import {
  readAllPersistentData,
  writePersistentData,
  initializeDataFiles,
  VALID_DATA_TYPES,
  type DataType,
} from '@/lib/persistence';

// Initialize data files on server start
initializeDataFiles();

// GET - Read all persistent data or specific data type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('type') as DataType | null;

    if (dataType) {
      if (!VALID_DATA_TYPES.includes(dataType)) {
        return NextResponse.json(
          { error: `Invalid data type. Valid types: ${VALID_DATA_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const allData = readAllPersistentData();
      return NextResponse.json({ data: allData[dataType] });
    }

    // Return all data
    const allData = readAllPersistentData();
    return NextResponse.json({ data: allData });
  } catch (error) {
    console.error('Error reading persistent data:', error);
    return NextResponse.json(
      { error: 'Failed to read persistent data' },
      { status: 500 }
    );
  }
}

// POST - Write data to file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body as { type: DataType; data: unknown };

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, data' },
        { status: 400 }
      );
    }

    if (!VALID_DATA_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid data type. Valid types: ${VALID_DATA_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const success = writePersistentData(type, data);

    if (success) {
      return NextResponse.json({ success: true, message: `${type} saved successfully` });
    } else {
      return NextResponse.json(
        { error: `Failed to save ${type}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error writing persistent data:', error);
    return NextResponse.json(
      { error: 'Failed to write persistent data' },
      { status: 500 }
    );
  }
}

// Write specific data type with safety check
function safeWritePersistentData(dataType: DataType, data: unknown): boolean {
  // Validate data is serializable before attempting write
  try {
    JSON.stringify(data);
  } catch {
    console.warn(`[Persistence] Skipping ${dataType}: data is not serializable`);
    return false;
  }
  return writePersistentData(dataType, data);
}

// PUT - Sync all data at once
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      // Core data
      characters, sessions, groups, personas, settings, lorebooks,
      // LLM & TTS
      llmConfigs, ttsConfigs, promptTemplates,
      // Sound system
      soundTriggers, soundCollections, soundSequenceTriggers,
      // Visual systems
      backgrounds, backgroundPacks, spritePacks, sprites, hudTemplates,
      // Advanced systems
      atmosphere, memory, quests, dialogue, inventory,
      // Active states
      activeStates,
    } = body;

    const results: Record<string, boolean> = {};

    // Core data
    if (characters !== undefined) results.characters = safeWritePersistentData('characters', characters);
    if (sessions !== undefined) results.sessions = safeWritePersistentData('sessions', sessions);
    if (groups !== undefined) results.groups = safeWritePersistentData('groups', groups);
    if (personas !== undefined) results.personas = safeWritePersistentData('personas', personas);
    if (settings !== undefined) results.settings = safeWritePersistentData('settings', settings);
    if (lorebooks !== undefined) results.lorebooks = safeWritePersistentData('lorebooks', lorebooks);

    // LLM & TTS
    if (llmConfigs !== undefined) results.llmConfigs = safeWritePersistentData('llmConfigs', llmConfigs);
    if (ttsConfigs !== undefined) results.ttsConfigs = safeWritePersistentData('ttsConfigs', ttsConfigs);
    if (promptTemplates !== undefined) results.promptTemplates = safeWritePersistentData('promptTemplates', promptTemplates);

    // Sound system
    if (soundTriggers !== undefined) results.soundTriggers = safeWritePersistentData('soundTriggers', soundTriggers);
    if (soundCollections !== undefined) results.soundCollections = safeWritePersistentData('soundCollections', soundCollections);
    if (soundSequenceTriggers !== undefined) results.soundSequenceTriggers = safeWritePersistentData('soundSequenceTriggers', soundSequenceTriggers);

    // Visual systems
    if (backgrounds !== undefined) results.backgrounds = safeWritePersistentData('backgrounds', backgrounds);
    if (backgroundPacks !== undefined) results.backgroundPacks = safeWritePersistentData('backgroundPacks', backgroundPacks);
    if (spritePacks !== undefined) results.spritePacks = safeWritePersistentData('spritePacks', spritePacks);
    if (sprites !== undefined) results.sprites = safeWritePersistentData('sprites', sprites);
    if (hudTemplates !== undefined) results.hudTemplates = safeWritePersistentData('hudTemplates', hudTemplates);

    // Advanced systems
    if (atmosphere !== undefined) results.atmosphere = safeWritePersistentData('atmosphere', atmosphere);
    if (memory !== undefined) results.memory = safeWritePersistentData('memory', memory);
    if (quests !== undefined) results.quests = safeWritePersistentData('quests', quests);
    if (dialogue !== undefined) results.dialogue = safeWritePersistentData('dialogue', dialogue);
    if (inventory !== undefined) results.inventory = safeWritePersistentData('inventory', inventory);

    // Active states
    if (activeStates !== undefined) results.activeStates = safeWritePersistentData('activeStates', activeStates);

    const allSuccess = Object.values(results).every(v => v);

    // Return 200 even with partial failures — only return 500 if everything failed
    const failedKeys = Object.entries(results).filter(([, v]) => !v).map(([k]) => k);
    if (failedKeys.length > 0 && failedKeys.length < Object.keys(results).length) {
      // Partial failure — return 200 with warnings
      console.warn(`[Persistence] Partial save failure: ${failedKeys.join(', ')}`);
      return NextResponse.json({ success: true, results, warnings: failedKeys });
    } else if (failedKeys.length === Object.keys(results).length && failedKeys.length > 0) {
      // Total failure
      console.warn(`[Persistence] All saves failed: ${failedKeys.join(', ')}`);
      return NextResponse.json(
        { error: 'All data failed to save', results },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error syncing persistent data:', error);
    return NextResponse.json(
      { error: 'Failed to sync persistent data' },
      { status: 500 }
    );
  }
}
