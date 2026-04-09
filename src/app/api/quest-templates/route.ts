import { NextRequest, NextResponse } from 'next/server';
import {
  loadAllQuestTemplates,
  loadQuestTemplateById,
  saveQuestTemplate,
  deleteQuestTemplate,
  createNewQuestTemplate,
  validateQuestTemplate,
  duplicateQuestTemplate,
  getQuestTemplatesByPriority,
} from '@/lib/quest/quest-storage';
import type { QuestTemplate } from '@/types';

// GET - Load quest templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const priority = searchParams.get('priority') as 'main' | 'side' | 'hidden' | null;

    // Get single template by ID
    if (id) {
      const template = loadQuestTemplateById(id);
      if (!template) {
        return NextResponse.json(
          { error: `Template not found: ${id}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ template });
    }

    // Get templates by priority
    if (priority) {
      const templates = getQuestTemplatesByPriority(priority);
      return NextResponse.json({ templates });
    }

    // Get all templates
    const templates = loadAllQuestTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[API] Error loading quest templates:', error);
    return NextResponse.json(
      { error: 'Failed to load quest templates' },
      { status: 500 }
    );
  }
}

// POST - Create new quest template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, template, id, name, description, sourceId, newId } = body;

    // Duplicate existing template
    if (action === 'duplicate' && sourceId && newId) {
      const source = loadQuestTemplateById(sourceId);
      if (!source) {
        return NextResponse.json(
          { error: `Source template not found: ${sourceId}` },
          { status: 404 }
        );
      }

      const duplicated = duplicateQuestTemplate(source, newId);
      
      // Persist the duplicated template to disk
      saveQuestTemplate(duplicated);
      
      return NextResponse.json({ 
        success: true, 
        template: duplicated,
        message: 'Template duplicated successfully'
      });
    }

    // Create new template with basic info
    if (id && name) {
      const newTemplate = createNewQuestTemplate(id, name, description || '');
      
      // Validate
      const validation = validateQuestTemplate(newTemplate);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        );
      }

      // Save to disk
      saveQuestTemplate(newTemplate);
      
      return NextResponse.json({ 
        success: true, 
        template: newTemplate,
        message: 'Template created successfully'
      });
    }

    // Save full template
    if (template) {
      const validation = validateQuestTemplate(template);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        );
      }

      saveQuestTemplate(template as QuestTemplate);
      
      return NextResponse.json({ 
        success: true, 
        template,
        message: 'Template saved successfully'
      });
    }

    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error saving quest template:', error);
    return NextResponse.json(
      { error: 'Failed to save quest template' },
      { status: 500 }
    );
  }
}

// PUT - Update existing template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { template } = body as { template: QuestTemplate };

    if (!template || !template.id) {
      return NextResponse.json(
        { error: 'Template with ID is required' },
        { status: 400 }
      );
    }

    // Validate
    const validation = validateQuestTemplate(template);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    // Update timestamp
    template.updatedAt = new Date().toISOString();

    // Save to disk
    saveQuestTemplate(template);

    return NextResponse.json({ 
      success: true, 
      template,
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('[API] Error updating quest template:', error);
    return NextResponse.json(
      { error: 'Failed to update quest template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete quest template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Check if template exists
    const existing = loadQuestTemplateById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Template not found: ${id}` },
        { status: 404 }
      );
    }

    // Delete from disk
    deleteQuestTemplate(id);

    return NextResponse.json({ 
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting quest template:', error);
    return NextResponse.json(
      { error: 'Failed to delete quest template' },
      { status: 500 }
    );
  }
}
