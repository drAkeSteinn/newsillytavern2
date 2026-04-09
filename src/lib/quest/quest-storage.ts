// ============================================
// Quest Template Storage
// ============================================
// Handles reading/writing individual quest template JSON files
// Each template is stored in /data/quest-templates/[id].json

import fs from 'fs';
import path from 'path';
import type { 
  QuestTemplate, 
  QuestObjectiveTemplate, 
  QuestReward,
  QuestActivationConfig,
  QuestCompletionConfig,
} from '@/types';

// ============================================
// Constants
// ============================================

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'quest-templates');
const FILE_EXTENSION = '.json';

// ============================================
// Storage Functions
// ============================================

/**
 * Get all quest template files
 */
export function getQuestTemplateFiles(): string[] {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
      return [];
    }
    
    const files = fs.readdirSync(TEMPLATES_DIR);
    return files
      .filter(file => file.endsWith(FILE_EXTENSION))
      .map(file => file.replace(FILE_EXTENSION, ''));
  } catch (err) {
    console.error('[QuestStorage] Error reading templates directory:', err);
    return [];
  }
}

/**
 * Load all quest templates from disk
 */
export function loadAllQuestTemplates(): QuestTemplate[] {
  const files = getQuestTemplateFiles();
  const templates: QuestTemplate[] = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(TEMPLATES_DIR, `${file}${FILE_EXTENSION}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const template = JSON.parse(content) as QuestTemplate;
      templates.push(template);
    } catch (err) {
      console.error(`[QuestStorage] Error loading template ${file}:`, err);
    }
  }
  
  return templates;
}

/**
 * Load a single quest template by ID
 */
export function loadQuestTemplateById(id: string): QuestTemplate | null {
  const files = getQuestTemplateFiles();
  
  for (const file of files) {
    if (file === id) {
      try {
        const filePath = path.join(TEMPLATES_DIR, `${file}${FILE_EXTENSION}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as QuestTemplate;
      } catch (err) {
        console.error(`[QuestStorage] Error loading template ${id}:`, err);
        return null;
      }
    }
  }
  
  return null;
}

/**
 * Save a quest template to disk
 */
export function saveQuestTemplate(template: QuestTemplate): void {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    }
    
    const filePath = path.join(TEMPLATES_DIR, `${template.id}${FILE_EXTENSION}`);
    const content = JSON.stringify(template, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    console.error(`[QuestStorage] Error saving template ${template.id}:`, err);
    
    // Provide helpful error message for permission issues
    if (error.code === 'EACCES') {
      throw new Error(
        `Permission denied: Cannot write to quest-templates directory. ` +
        `Please run: sudo chown -R $USER:$USER ${path.join(process.cwd(), 'data')}`
      );
    }
    throw err;
  }
}

/**
 * Delete a quest template from disk
 */
export function deleteQuestTemplate(id: string): void {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${id}${FILE_EXTENSION}`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    console.error(`[QuestStorage] Error deleting template ${id}:`, err);
    
    // Provide helpful error message for permission issues
    if (error.code === 'EACCES') {
      throw new Error(
        `Permission denied: Cannot delete from quest-templates directory. ` +
        `Please run: sudo chown -R $USER:$USER ${path.join(process.cwd(), 'data')}`
      );
    }
    throw err;
  }
}

/**
 * Create a new quest template with defaults
 */
export function createNewQuestTemplate(
  id: string,
  name: string,
  description: string = ''
): QuestTemplate {
  const now = new Date().toISOString();
  
  return {
    id,
    name,
    description,
    activation: {
      key: '',
      keys: [],
      caseSensitive: false,
      method: 'keyword',
    },
    objectives: [],
    completion: {
      key: '',
      keys: [],
      caseSensitive: false,
    },
    rewards: [],
    priority: 'side',
    icon: '📋',
    color: 'blue',
    isRepeatable: false,
    isHidden: false,
    prerequisites: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate a quest template
 */
export function validateQuestTemplate(template: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const t = template as Partial<QuestTemplate>;
  
  if (!t.id || typeof t.id !== 'string') {
    errors.push('Template ID must be a non-empty string');
  }
  
  if (!t.name || typeof t.name !== 'string') {
    errors.push('Template name must be a non-empty string');
  }
  
  if (!t.activation?.key) {
    errors.push('Activation key is required');
  }
  
  if (!t.completion?.key) {
    errors.push('Completion key is required');
  }
  
  // Validate objectives
  if (t.objectives && Array.isArray(t.objectives)) {
    for (let i = 0; i < t.objectives.length; i++) {
      const obj = t.objectives[i];
      if (!obj.id) {
        errors.push(`Objective ${i} is missing ID`);
      }
      if (!obj.description) {
        errors.push(`Objective ${i} is missing description`);
      }
      if (!obj.completion?.key) {
        errors.push(`Objective ${i} is missing completion key`);
      }
    }
  }
  
  // Validate rewards
  if (t.rewards && Array.isArray(t.rewards)) {
    for (let i = 0; i < t.rewards.length; i++) {
      const reward = t.rewards[i];
      if (!reward.id) {
        errors.push(`Reward ${i} is missing ID`);
      }
      if (!reward.key) {
        errors.push(`Reward ${i} is missing key`);
      }
      if (!reward.type) {
        errors.push(`Reward ${i} is missing type`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Duplicate a quest template with a new ID
 */
export function duplicateQuestTemplate(
  template: QuestTemplate,
  newId: string
): QuestTemplate {
  const now = new Date().toISOString();
  
  return {
    ...template,
    id: newId,
    name: `${template.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get templates by priority
 */
export function getQuestTemplatesByPriority(
  priority: 'main' | 'side' | 'hidden'
): QuestTemplate[] {
  const templates = loadAllQuestTemplates();
  return templates.filter(t => t.priority === priority);
}

/**
 * Get templates that have specific prerequisites
 */
export function getQuestTemplatesWithPrerequisites(
  prerequisiteId: string
): QuestTemplate[] {
  const templates = loadAllQuestTemplates();
  return templates.filter(t => 
    t.prerequisites?.includes(prerequisiteId)
  );
}

// ============================================
// Default Template Creator
// ============================================

/**
 * Create a default example template (for new users)
 */
export function createDefaultQuestTemplate(): QuestTemplate {
  const now = new Date().toISOString();
  
  return {
    id: 'ejemplo-mision',
    name: 'Misión de Ejemplo',
    description: 'Esta es una misión de ejemplo para mostrar cómo funciona el sistema de misiones.',
    activation: {
      key: 'mision:ejemplo',
      keys: ['mission:example', 'quest:ejemplo'],
      caseSensitive: false,
      method: 'keyword',
    },
    objectives: [
      {
        id: 'obj-saludo',
        description: 'Saludar al personaje',
        type: 'talk',
        completion: {
          key: 'saludo:completo',
          keys: ['greeting:complete'],
          caseSensitive: false,
        },
        targetCount: 1,
        isOptional: false,
      },
      {
        id: 'obj-pregunta',
        description: 'Hacer una pregunta',
        type: 'talk',
        completion: {
          key: 'pregunta:hecha',
          keys: ['question:asked'],
          caseSensitive: false,
        },
        targetCount: 1,
        isOptional: false,
      },
    ],
    completion: {
      key: 'mision:completada',
      keys: ['mission:complete'],
      caseSensitive: false,
    },
    rewards: [
      {
        id: 'reward-exp',
        type: 'attribute',
        key: 'exp',
        value: 10,
        action: 'add',
      },
    ],
    priority: 'side',
    icon: '📜',
    color: 'blue',
    isRepeatable: true,
    isHidden: false,
    prerequisites: [],
    createdAt: now,
    updatedAt: now,
  };
}
