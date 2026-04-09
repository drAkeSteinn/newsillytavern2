'use client';

/**
 * HUDManager Component
 * 
 * Settings tab for managing HUD templates.
 * Allows creating, editing, duplicating, and deleting HUD templates.
 */

import { useState, useEffect } from 'react';
import { useTavernStore } from '@/store';
import { motion } from 'framer-motion';
import type { HUDTemplate, HUDField, HUDFieldType, HUDPosition, HUDStyle, HUDFieldStyle } from '@/types';
import { cn, generateId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Save } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  Layers,
  LayoutDashboard,
  Palette,
  Type,
  Eye,
  Settings2,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Info,
  Monitor,
  Grid3X3,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  Hash,
  List,
  Binary,
  ArrowUpRight,
  ArrowDownLeft,
  Box,
  PanelTop,
  Columns,
  Clock,
  Zap,
  FileText,
  MoreHorizontal,
} from 'lucide-react';

// ============================================
// Main Component
// ============================================

export function HUDManager() {
  const [editingTemplate, setEditingTemplate] = useState<HUDTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const hudTemplates = useTavernStore((state) => state.hudTemplates);
  const createHUDTemplate = useTavernStore((state) => state.createHUDTemplate);
  const updateHUDTemplate = useTavernStore((state) => state.updateHUDTemplate);
  const deleteHUDTemplate = useTavernStore((state) => state.deleteHUDTemplate);
  const duplicateHUDTemplate = useTavernStore((state) => state.duplicateHUDTemplate);
  const activeHUDTemplateId = useTavernStore((state) => state.activeHUDTemplateId);
  
  const handleCreate = () => {
    setIsCreating(true);
    setEditingTemplate(null);
  };
  
  const handleEdit = (template: HUDTemplate) => {
    setIsCreating(false);
    setEditingTemplate(template);
  };
  
  const handleDuplicate = (template: HUDTemplate) => {
    duplicateHUDTemplate(template.id);
  };
  
  const handleDelete = (template: HUDTemplate) => {
    if (confirm(`¿Eliminar el template "${template.name}"?`)) {
      deleteHUDTemplate(template.id);
    }
  };
  
  const handleSave = (template: Partial<HUDTemplate>) => {
    if (isCreating) {
      createHUDTemplate({
        name: template.name || 'Nuevo HUD',
        description: template.description || '',
        fields: template.fields || [],
        position: template.position || 'top-right',
        style: template.style || 'card',
        opacity: template.opacity ?? 0.9,
        compact: template.compact ?? false,
      });
    } else if (editingTemplate) {
      updateHUDTemplate(editingTemplate.id, template);
    }
    setEditingTemplate(null);
    setIsCreating(false);
  };

  const handleClose = () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };

  // Position icons mapping - visual indicators
  const positionLabels: Record<HUDPosition, string> = {
    'top-left': '↖',
    'top-right': '↗',
    'bottom-left': '↙',
    'bottom-right': '↘',
  };

  // Style icons mapping with all styles
  const styleIcons: Record<HUDStyle, React.ReactNode> = {
    'minimal': <Columns className="w-3.5 h-3.5" />,
    'card': <Box className="w-3.5 h-3.5" />,
    'panel': <PanelTop className="w-3.5 h-3.5" />,
    'glass': <Sparkles className="w-3.5 h-3.5" />,
    'neon': <Zap className="w-3.5 h-3.5" />,
    'holographic': <Layers className="w-3.5 h-3.5" />,
    'fantasy': <span className="text-xs">⚔</span>,
    'retro': <Monitor className="w-3.5 h-3.5" />,
  };

  // Style preview classes for template cards
  const stylePreviewClasses: Record<HUDStyle, string> = {
    'minimal': 'bg-transparent border border-white/20',
    'card': 'bg-gradient-to-br from-slate-900/80 to-slate-800/60 border border-white/10',
    'panel': 'bg-gradient-to-br from-slate-900/90 to-slate-800/80 border-2 border-white/20',
    'glass': 'bg-white/5 border border-white/20',
    'neon': 'bg-slate-900/80 border-2 border-cyan-500/50',
    'holographic': 'bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-cyan-400/30',
    'fantasy': 'bg-gradient-to-br from-amber-950/80 to-stone-900/80 border-2 border-amber-600/40',
    'retro': 'bg-black/90 border-4 border-green-500/70',
  };
  
  return (
    <div className={(editingTemplate || isCreating) ? "h-full flex flex-col" : "h-full overflow-y-auto p-6"}>
      {(editingTemplate || isCreating) ? (
        <HUDEditorPanel
          template={editingTemplate}
          isNew={isCreating}
          onSave={handleSave}
          onClose={handleClose}
        />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                  <Layers className="w-5 h-5 text-emerald-500" />
                </div>
                HUD Templates
              </h2>
              <p className="text-muted-foreground text-sm ml-12">
                Crea plantillas de HUD para mostrar información durante el chat
              </p>
            </div>
            <Button 
              onClick={handleCreate}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-emerald-500/40"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Template
            </Button>
          </div>
          
          {/* Template List */}
          {hudTemplates.length === 0 ? (
            <Card className="border-dashed border-2 bg-gradient-to-br from-muted/50 to-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-500/10 to-slate-600/10 mb-4">
                  <Layers className="w-12 h-12 text-slate-400" />
                </div>
                <p className="text-muted-foreground text-center mb-2 font-medium">
                  No hay templates de HUD creados
                </p>
                <p className="text-muted-foreground/60 text-sm text-center max-w-xs mb-6">
                  Los templates te permiten definir qué información mostrar en el chat y cómo visualizarla
                </p>
                <Button variant="outline" className="gap-2" onClick={handleCreate}>
                  <Sparkles className="w-4 h-4" />
                  Crear primer template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {hudTemplates.map((template) => {
                const isActive = template.id === activeHUDTemplateId;
                return (
                  <Card 
                    key={template.id} 
                    className={cn(
                      "group relative overflow-hidden transition-all duration-300",
                      "hover:shadow-xl hover:shadow-slate-500/10 hover:-translate-y-1",
                      "border",
                      isActive 
                        ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" 
                        : "border-border/60 bg-gradient-to-br from-card to-muted/30 hover:border-emerald-500/30"
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                    )}
                    
                    {/* Background decoration */}
                    <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/5 to-teal-500/5 group-hover:scale-150 transition-transform duration-500" />
                    
                    <CardHeader className="pb-3 relative">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                            {isActive && (
                              <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shrink-0">
                                <Zap className="w-3 h-3 mr-1" />
                                Activo
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <CardDescription className="mt-1.5 line-clamp-2">
                              {template.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "ml-2 shrink-0 font-mono",
                            "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20"
                          )}
                        >
                          {template.fields.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 relative">
                      {/* Preview of fields */}
                      <div className="flex flex-wrap gap-1.5">
                        {template.fields.slice(0, 4).map((field) => (
                          <Badge
                            key={field.id}
                            variant="outline"
                            className="text-xs bg-background/50 border-border/50 hover:bg-background transition-colors"
                          >
                            {field.icon && <span className="mr-1">{field.icon}</span>}
                            {field.name}
                          </Badge>
                        ))}
                        {template.fields.length > 4 && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-muted/50 border-border/50"
                          >
                            +{template.fields.length - 4}
                          </Badge>
                        )}
                      </div>

                      {/* Template info with visual style preview */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20"
                        >
                          <span className="font-mono text-sm">{positionLabels[template.position]}</span>
                          {template.position.replace('-', ' ')}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "w-4 h-4 rounded-sm border",
                            stylePreviewClasses[template.style]
                          )} />
                          <Badge
                            variant="secondary"
                            className="text-xs gap-1 bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20"
                          >
                            {styleIcons[template.style]}
                            {template.style}
                          </Badge>
                        </div>
                        {template.compact && (
                          <Badge
                            variant="secondary"
                            className="text-xs gap-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20"
                          >
                            <Grid3X3 className="w-3 h-3" />
                            compacto
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20 ml-auto"
                        >
                          <Eye className="w-3 h-3" />
                          {Math.round(template.opacity * 100)}%
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 transition-colors"
                          onClick={() => handleEdit(template)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:bg-slate-500/10 hover:text-slate-600 hover:border-slate-500/30 transition-colors"
                          onClick={() => handleDuplicate(template)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Duplicar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 transition-colors"
                          onClick={() => handleDelete(template)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// HUD Editor Panel (Full-Screen)
// ============================================

interface HUDEditorPanelProps {
  template: HUDTemplate | null;
  isNew: boolean;
  onSave: (template: Partial<HUDTemplate>) => void;
  onClose: () => void;
}

function HUDEditorPanel({ template, isNew, onSave, onClose }: HUDEditorPanelProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [fields, setFields] = useState<HUDField[]>(template?.fields || []);
  const [position, setPosition] = useState<HUDPosition>(template?.position || 'top-right');
  const [style, setStyle] = useState<HUDStyle>(template?.style || 'card');
  const [opacity, setOpacity] = useState(template?.opacity ?? 0.9);
  const [compact, setCompact] = useState(template?.compact ?? false);
  const [editingField, setEditingField] = useState<HUDField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  
  // Context state
  const [contextEnabled, setContextEnabled] = useState(template?.context?.enabled ?? false);
  const [contextContent, setContextContent] = useState(template?.context?.content || '');
  const [contextPosition, setContextPosition] = useState<number>(template?.context?.position ?? 0);
  const [contextScanDepth, setContextScanDepth] = useState(template?.context?.scanDepth ?? 5);
  
  const handleAddField = () => {
    setEditingField(null);
    setShowFieldEditor(true);
  };
  
  const handleEditField = (field: HUDField) => {
    setEditingField(field);
    setShowFieldEditor(true);
  };
  
  const handleSaveField = (field: HUDField) => {
    if (editingField) {
      setFields(fields.map((f) => (f.id === field.id ? field : f)));
    } else {
      setFields([...fields, field]);
    }
    setShowFieldEditor(false);
    setEditingField(null);
  };
  
  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };
  
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };
  
  const handleSave = () => {
    onSave({
      name,
      description,
      fields,
      position,
      style,
      opacity,
      compact,
      // Include context configuration if enabled or has content
      context: contextEnabled || contextContent.trim() ? {
        enabled: contextEnabled,
        content: contextContent,
        position: contextPosition as import('@/types').HUDContextPosition,
        scanDepth: contextScanDepth,
      } : undefined,
    });
  };

  // Position options with visual grid indicator
  const positionOptions: { value: HUDPosition; label: string; corner: string }[] = [
    { value: 'top-left', label: 'Superior Izq.', corner: 'top-0 left-0' },
    { value: 'top-right', label: 'Superior Der.', corner: 'top-0 right-0' },
    { value: 'bottom-left', label: 'Inferior Izq.', corner: 'bottom-0 left-0' },
    { value: 'bottom-right', label: 'Inferior Der.', corner: 'bottom-0 right-0' },
  ];

  // Style options with visual descriptions and icons
  const styleOptions: { value: HUDStyle; label: string; icon: React.ReactNode; desc: string; preview: string }[] = [
    {
      value: 'minimal',
      label: 'Minimal',
      icon: <Columns className="w-4 h-4" />,
      desc: 'Sin fondo, solo texto',
      preview: 'bg-transparent border border-white/20'
    },
    {
      value: 'card',
      label: 'Tarjeta',
      icon: <Box className="w-4 h-4" />,
      desc: 'Fondo con bordes suaves',
      preview: 'bg-gradient-to-br from-slate-900/80 to-slate-800/60 border border-white/10'
    },
    {
      value: 'panel',
      label: 'Panel',
      icon: <PanelTop className="w-4 h-4" />,
      desc: 'Panel expandido elegante',
      preview: 'bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 border-2 border-white/20'
    },
    {
      value: 'glass',
      label: 'Cristal',
      icon: <Sparkles className="w-4 h-4" />,
      desc: 'Efecto glassmorphism',
      preview: 'bg-white/5 border border-white/20 backdrop-blur-xl'
    },
    {
      value: 'neon',
      label: 'Neón',
      icon: <Zap className="w-4 h-4" />,
      desc: 'Brillo cyberpunk cyan',
      preview: 'bg-slate-900/80 border-2 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
    },
    {
      value: 'holographic',
      label: 'Holográfico',
      icon: <Layers className="w-4 h-4" />,
      desc: 'Efecto futurista iridiscente',
      preview: 'bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-cyan-400/30'
    },
    {
      value: 'fantasy',
      label: 'Fantasía',
      icon: <span className="text-sm">⚔</span>,
      desc: 'Estilo medieval antiguo',
      preview: 'bg-gradient-to-br from-amber-950/80 via-stone-900/80 to-amber-950/80 border-2 border-amber-600/40'
    },
    {
      value: 'retro',
      label: 'Retro',
      icon: <Monitor className="w-4 h-4" />,
      desc: 'Estilo pixelado verde',
      preview: 'bg-black/90 border-4 border-green-500/70 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
    },
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
              {isNew ? <Plus className="w-5 h-5 text-emerald-500" /> : <Pencil className="w-5 h-5 text-emerald-500" />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{isNew ? 'Crear Nuevo Template' : 'Editar Template'}</h2>
              <p className="text-xs text-muted-foreground">Configura los campos y la apariencia del HUD</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim()}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_300px] gap-6 p-6">
          {/* Left Column - Editor Sections */}
          <div className="space-y-6">
            {/* Section: Información básica */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-slate-500/10">
                  <FileText className="w-4 h-4 text-slate-500" />
                </div>
                Información básica
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                <div className="space-y-2">
                  <Label htmlFor="template-name" className="text-xs text-muted-foreground">Nombre del template</Label>
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Sistema Combate RPG"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-desc" className="text-xs text-muted-foreground">Descripción (opcional)</Label>
                  <Input
                    id="template-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe el propósito de este HUD..."
                    className="bg-background"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />
            
            {/* Section: Apariencia */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-purple-500/10">
                  <Palette className="w-4 h-4 text-purple-500" />
                </div>
                Apariencia
              </div>

              <div className="pl-8 space-y-5">
                {/* Position Selector with visual grid */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Posición en pantalla</Label>
                  <div className="flex items-center gap-4">
                    {/* Visual position grid */}
                    <div className="relative w-24 h-20 bg-muted/30 rounded-lg border border-border/50">
                      {positionOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPosition(opt.value)}
                          className={cn(
                            "absolute w-5 h-5 rounded-sm border-2 transition-all",
                            opt.corner,
                            position === opt.value
                              ? "bg-emerald-500 border-emerald-400 scale-110"
                              : "bg-muted border-muted-foreground/30 hover:bg-muted/80"
                          )}
                          title={opt.label}
                        />
                      ))}
                    </div>
                    {/* Position labels */}
                    <div className="flex flex-col gap-1">
                      {positionOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPosition(opt.value)}
                          className={cn(
                            "text-xs px-2 py-1 rounded transition-all text-left",
                            position === opt.value
                              ? "text-emerald-600 dark:text-emerald-400 font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Style Selector with visual preview */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Estilo visual</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {styleOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStyle(opt.value)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm w-full transition-all text-left",
                          style === opt.value
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border/50 bg-background hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        {/* Style preview mini box */}
                        <div className={cn(
                          "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                          opt.preview
                        )}>
                          <span className={cn(
                            "text-[8px] font-bold",
                            opt.value === 'retro' && "text-green-400 font-mono",
                            opt.value === 'fantasy' && "text-amber-400",
                            opt.value === 'neon' && "text-cyan-400",
                            opt.value === 'holographic' && "text-cyan-300",
                            !['retro', 'fantasy', 'neon', 'holographic'].includes(opt.value) && "text-white/80"
                          )}>
                            HUD
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{opt.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity & Compact */}
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Opacidad</Label>
                      <Badge variant="secondary" className="text-xs font-mono bg-slate-500/10">
                        {Math.round(opacity * 100)}%
                      </Badge>
                    </div>
                    <Slider
                      value={[opacity]}
                      onValueChange={([v]) => setOpacity(v)}
                      min={0.3}
                      max={1}
                      step={0.05}
                      className="py-2"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>30% Transparente</span>
                      <span>100% Sólido</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Modo de visualización</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCompact(false)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm transition-all",
                          !compact
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border/50 bg-background hover:bg-muted/50"
                        )}
                      >
                        <ToggleRight className="w-5 h-5" />
                        <span className="text-xs font-medium">Normal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompact(true)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm transition-all",
                          compact
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border/50 bg-background hover:bg-muted/50"
                        )}
                      >
                        <Grid3X3 className="w-5 h-5" />
                        <span className="text-xs font-medium">Compacto</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      El modo compacto reduce el espaciado entre campos
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />
            
            {/* Section: Campos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-orange-500/10">
                    <Type className="w-4 h-4 text-orange-500" />
                  </div>
                  Campos del HUD
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddField}
                  className="hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar Campo
                </Button>
              </div>
              
              {fields.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
                  <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-3">
                    <Type className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-1">No hay campos definidos</p>
                  <p className="text-muted-foreground/60 text-xs">Agrega campos para mostrar información en el HUD</p>
                </div>
              ) : (
                <div className="space-y-2 pl-8">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-r from-background to-muted/20 group hover:border-border hover:shadow-sm transition-all"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleMoveField(index, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleMoveField(index, 'down')}
                          disabled={index === fields.length - 1}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        {field.icon && (
                          <span className="text-xl w-8 text-center shrink-0">{field.icon}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">{field.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50">
                              {field.type}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50">
                              {field.style}
                            </Badge>
                            {field.color && field.color !== 'default' && (
                              <div 
                                className={cn("w-3 h-3 rounded-full", 
                                  field.color === 'red' && 'bg-red-500',
                                  field.color === 'green' && 'bg-green-500',
                                  field.color === 'blue' && 'bg-blue-500',
                                  field.color === 'yellow' && 'bg-yellow-500',
                                  field.color === 'purple' && 'bg-purple-500',
                                  field.color === 'orange' && 'bg-orange-500',
                                  field.color === 'pink' && 'bg-pink-500',
                                  field.color === 'cyan' && 'bg-cyan-500',
                                )}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-emerald-500/10 hover:text-emerald-600"
                          onClick={() => handleEditField(field)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => handleDeleteField(field.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-border/50" />

            {/* Section: Contexto */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-cyan-500/10">
                    <FileText className="w-4 h-4 text-cyan-500" />
                  </div>
                  Contexto
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20">
                    Inyección de Prompt
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Activar</Label>
                  <Switch
                    checked={contextEnabled}
                    onCheckedChange={setContextEnabled}
                  />
                </div>
              </div>

              <div className={cn(
                "pl-8 space-y-4 transition-opacity",
                !contextEnabled && "opacity-50 pointer-events-none"
              )}>
                {/* Position selector */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Posición de inyección</Label>
                  <Select value={String(contextPosition)} onValueChange={(v) => setContextPosition(Number(v))}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Seleccionar posición" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Después del System Prompt</SelectItem>
                      <SelectItem value="1">Después del mensaje del usuario</SelectItem>
                      <SelectItem value="2">Antes del mensaje del usuario</SelectItem>
                      <SelectItem value="3">Después del mensaje del asistente</SelectItem>
                      <SelectItem value="4">Antes del mensaje del asistente</SelectItem>
                      <SelectItem value="5">Al inicio del chat (antes del historial)</SelectItem>
                      <SelectItem value="6">Al final del chat (después del historial)</SelectItem>
                      <SelectItem value="7">Después del Lorebook (Author's Note)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Define dónde se inyectará el texto de contexto en el prompt enviado al LLM.
                    Las variables como {`{{user}}`}, {`{{char}}`} y {`{{resistencia}}`} se resolverán automáticamente.
                  </p>
                </div>

                {/* Scan depth */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Profundidad de escaneo</Label>
                    <Badge variant="secondary" className="text-xs font-mono bg-slate-500/10">
                      {contextScanDepth} mensajes
                    </Badge>
                  </div>
                  <Slider
                    value={[contextScanDepth]}
                    onValueChange={([v]) => setContextScanDepth(v)}
                    min={1}
                    max={20}
                    step={1}
                    className="py-2"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Cuántos mensajes hacia atrás considerar para el contexto (próximamente: filtrado dinámico)
                  </p>
                </div>

                {/* Context content */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Contenido del contexto</Label>
                  <textarea
                    value={contextContent}
                    onChange={(e) => setContextContent(e.target.value)}
                    placeholder="Escribe aquí el texto que se inyectará en el prompt...&#10;&#10;Ejemplo:&#10;El personaje está en un combate intenso.&#10;Mantén un tono dramático y tenso.&#10;El HP actual del personaje es bajo."
                    className="w-full min-h-[150px] p-3 rounded-lg border border-border/50 bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                    disabled={!contextEnabled}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-muted-foreground">
                      Este texto se inyectará SIEMPRE si está activo (no detecta keys como los lorebooks)
                    </p>
                    <Badge variant="secondary" className="text-xs bg-slate-500/10">
                      {contextContent.length} caracteres
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Preview (visible on 2xl) */}
          <div className="hidden 2xl:block space-y-4">
            <div className="sticky top-0 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-slate-500/10">
                  <Eye className="w-4 h-4 text-slate-500" />
                </div>
                Resumen del Template
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10">
                  <h4 className="font-medium text-sm mb-3">{name || 'Sin nombre'}</h4>
                  {description && (
                    <p className="text-xs text-muted-foreground mb-3">{description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Campos</span>
                      <Badge variant="secondary" className="text-xs">{fields.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Posición</span>
                      <span className="font-medium">{position.replace('-', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Estilo</span>
                      <span className="font-medium capitalize">{style}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Opacidad</span>
                      <span className="font-medium">{Math.round(opacity * 100)}%</span>
                    </div>
                    {contextEnabled && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Contexto</span>
                        <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20">Activo</Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Field summary */}
                {fields.length > 0 && (
                  <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10">
                    <h4 className="font-medium text-xs text-muted-foreground mb-2">Campos ({fields.length})</h4>
                    <div className="space-y-1.5">
                      {fields.map((field, i) => (
                        <div key={field.id} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-4 text-center">{i + 1}</span>
                          {field.icon && <span className="w-4 text-center">{field.icon}</span>}
                          <span className="font-medium truncate">{field.name}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/50 ml-auto">{field.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Field Editor Dialog */}
      {showFieldEditor && (
        <HUDFieldEditorDialog
          field={editingField}
          onSave={handleSaveField}
          onClose={() => {
            setShowFieldEditor(false);
            setEditingField(null);
          }}
        />
      )}
    </motion.div>
  );
}

// ============================================
// HUD Field Editor Dialog
// ============================================

interface HUDFieldEditorDialogProps {
  field: HUDField | null;
  onSave: (field: HUDField) => void;
  onClose: () => void;
}

// Style options with descriptions
const STYLE_OPTIONS: { value: HUDFieldStyle; label: string; description: string; icon: string; bestFor: HUDFieldType[] }[] = [
  { value: 'default', label: 'Por defecto', description: 'Etiqueta y valor', icon: '📝', bestFor: ['string', 'number', 'enum', 'boolean'] },
  { value: 'progress', label: 'Barra', description: 'Barra horizontal', icon: '📊', bestFor: ['number'] },
  { value: 'badge', label: 'Badge', description: 'Fondo colorido', icon: '🏷️', bestFor: ['string', 'enum', 'number'] },
  { value: 'icon', label: 'Icono', description: 'Icono grande', icon: '🎯', bestFor: ['string', 'number', 'boolean'] },
  { value: 'chip', label: 'Chip', description: 'Pequeño chip', icon: '🔸', bestFor: ['string', 'enum'] },
  { value: 'status', label: 'Estado', description: 'Punto de color', icon: '🟢', bestFor: ['boolean', 'enum', 'string'] },
  { value: 'gauge', label: 'Gauge', description: 'Medidor circular', icon: '⭕', bestFor: ['number'] },
  { value: 'separator', label: 'Separador', description: 'Línea divisoria', icon: '➖', bestFor: ['string'] },
  { value: 'label-only', label: 'Solo etiqueta', description: 'Solo nombre', icon: '📋', bestFor: ['string', 'enum'] },
  { value: 'pill', label: 'Píldora', description: 'Redondeado', icon: '💊', bestFor: ['string', 'enum', 'number'] },
  { value: 'meter', label: 'Medidor', description: 'Barra vertical', icon: '📈', bestFor: ['number'] },
  { value: 'dots', label: 'Puntos', description: '1-5 puntos', icon: '•••', bestFor: ['number', 'boolean'] },
];

// Info tooltip component
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="ml-1 text-muted-foreground cursor-help inline-flex items-center justify-center" title={text}>
      <Info className="w-3.5 h-3.5" />
    </span>
  );
}

// Color options
const COLOR_OPTIONS = [
  { value: 'default', color: 'bg-slate-400', label: 'Default' },
  { value: 'red', color: 'bg-red-500', label: 'Rojo' },
  { value: 'green', color: 'bg-emerald-500', label: 'Verde' },
  { value: 'yellow', color: 'bg-amber-500', label: 'Amarillo' },
  { value: 'purple', color: 'bg-purple-500', label: 'Púrpura' },
  { value: 'orange', color: 'bg-orange-500', label: 'Naranja' },
  { value: 'pink', color: 'bg-pink-500', label: 'Rosa' },
  { value: 'cyan', color: 'bg-cyan-500', label: 'Cyan' },
];

function HUDFieldEditorDialog({ field, onSave, onClose }: HUDFieldEditorDialogProps) {
  const [name, setName] = useState(field?.name || '');
  const [key, setKey] = useState(field?.key || '');
  const [keys, setKeys] = useState(field?.keys?.join(', ') || '');
  const [caseSensitive, setCaseSensitive] = useState(field?.caseSensitive ?? false);
  const [type, setType] = useState<HUDFieldType>(field?.type || 'string');
  const [style, setStyle] = useState<HUDFieldStyle>(field?.style || 'default');
  const [color, setColor] = useState(field?.color || 'default');
  const [icon, setIcon] = useState(field?.icon || '');
  const [min, setMin] = useState(field?.min ?? 0);
  const [max, setMax] = useState(field?.max ?? 100);
  const [defaultValue, setDefaultValue] = useState<string | number | boolean>(
    field?.defaultValue ?? ''
  );
  const [options, setOptions] = useState(field?.options?.join(', ') || '');
  const [unit, setUnit] = useState(field?.unit || '');
  const [showLabel, setShowLabel] = useState(field?.showLabel ?? true);
  const [showValue, setShowValue] = useState(field?.showValue ?? true);
  
  // Filter styles by type
  const availableStyles = STYLE_OPTIONS.filter(s => s.bestFor.includes(type));
  
  // Get current style (reset to default if not available for current type)
  const currentStyle = availableStyles.find(s => s.value === style) ? style : 'default';
  
  const handleSave = () => {
    // Parse alternative keys
    const alternativeKeys = keys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    
    const newField: HUDField = {
      id: field?.id || generateId(),
      name: name.trim() || 'Campo',
      key: key.trim() || name.trim().toLowerCase().replace(/\s+/g, '_'),
      keys: alternativeKeys.length > 0 ? alternativeKeys : undefined,
      caseSensitive: caseSensitive || undefined,
      type,
      style,
      color: color === 'default' ? undefined : color,
      icon: icon.trim() || undefined,
      min: type === 'number' ? min : undefined,
      max: type === 'number' ? max : undefined,
      defaultValue,
      options: type === 'enum' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      unit: unit.trim() || undefined,
      showLabel,
      showValue,
    };
    
    onSave(newField);
  };
  
  // Preview field
  const previewField: HUDField = {
    id: 'preview',
    name: name || 'Campo',
    key: key || 'campo',
    type,
    style,
    color: color === 'default' ? undefined : color,
    icon: icon || undefined,
    min,
    max,
    defaultValue,
    options: type === 'enum' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
    unit,
    showLabel,
    showValue,
  };

  // Type options
  const typeOptions = [
    { value: 'string', label: 'Texto', icon: <Type className="w-4 h-4" />, desc: 'Cualquier texto' },
    { value: 'number', label: 'Número', icon: <Hash className="w-4 h-4" />, desc: 'Valor numérico' },
    { value: 'enum', label: 'Opciones', icon: <List className="w-4 h-4" />, desc: 'Lista fija' },
    { value: 'boolean', label: 'Booleano', icon: <Binary className="w-4 h-4" />, desc: 'Sí/No' },
  ];
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30">
              {field ? <Pencil className="w-5 h-5 text-orange-500" /> : <Plus className="w-5 h-5 text-orange-500" />}
            </div>
            {field ? 'Editar Campo' : 'Nuevo Campo'}
            {name && (
              <Badge variant="secondary" className="ml-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                {name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr_280px] gap-6 py-6">
            {/* Editor */}
            <div className="space-y-6">
              {/* Section: Nombre */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-emerald-500/10">
                    <Type className="w-4 h-4 text-emerald-500" />
                  </div>
                  Nombre del campo
                  <InfoTooltip text="Nombre visible que se mostrará en el HUD" />
                </div>
                <div className="pl-8">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: HP, Turno, Intensidad..."
                    className="bg-background"
                  />
                </div>
              </div>

              <Separator className="bg-border/50" />
              
              {/* Key Detection Section - MANTENER ASÍ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-cyan-500/10">
                    <Settings2 className="w-4 h-4 text-cyan-500" />
                  </div>
                  Detección de Keys
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20">
                    Cómo el LLM actualiza este campo
                  </Badge>
                </div>
                
                <div className="pl-8 p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 space-y-4">
                  {/* Primary Key */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Key principal</Label>
                    <Input
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="hp, turno, intensidad..."
                      className="bg-background font-mono text-sm"
                    />
                  </div>
                  
                  {/* Alternative Keys */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                      Keys alternativas (separadas por coma)
                      <InfoTooltip text="Permite detectar variaciones de la key" />
                    </Label>
                    <Input
                      value={keys}
                      onChange={(e) => setKeys(e.target.value)}
                      placeholder="HP:, HP=, hp:, hp=, Health"
                      className="bg-background font-mono text-sm"
                    />
                    {keys && (
                      <div className="flex flex-wrap gap-1">
                        {keys.split(',').map((k, i) => k.trim() && (
                          <Badge key={i} variant="secondary" className="text-xs font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                            {k.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Case Sensitivity */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/40">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-medium">Distinguir mayúsculas/minúsculas</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Si está desactivado, "HP" y "hp" serán equivalentes
                      </p>
                    </div>
                    <Switch
                      checked={caseSensitive}
                      onCheckedChange={setCaseSensitive}
                    />
                  </div>
                  
                  {/* Detection Examples */}
                  <div className="text-xs bg-background/50 p-3 rounded-lg border border-border/40">
                    <p className="font-medium mb-2 text-muted-foreground flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5" />
                      Formatos detectados:
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> [hp=10]
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> HP: 10
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> hp= 10
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> HP = 10
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />
              
              {/* Section: Tipo de dato */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-violet-500/10">
                    <Binary className="w-4 h-4 text-violet-500" />
                  </div>
                  Tipo de dato
                  <InfoTooltip text="Determina cómo se procesa y valida el valor" />
                </div>
                <div className="pl-8">
                  <div className="grid grid-cols-4 gap-2">
                    {typeOptions.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value as HUDFieldType)}
                        className={cn(
                          "flex flex-col items-center p-3 rounded-xl border text-center transition-all",
                          type === t.value
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                            : "border-border/50 bg-background hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg mb-2",
                          type === t.value ? "bg-emerald-500/20" : "bg-muted/50"
                        )}>
                          {t.icon}
                        </div>
                        <span className="text-xs font-medium">{t.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />
              
              {/* Section: Estilo de visualización */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-pink-500/10">
                    <Palette className="w-4 h-4 text-pink-500" />
                  </div>
                  Estilo de visualización
                </div>
                <div className="pl-8">
                  <ScrollArea className="h-48 rounded-lg border border-border/50 bg-muted/10 p-2">
                    <div className="grid grid-cols-3 gap-2">
                      {availableStyles.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setStyle(s.value)}
                          className={cn(
                            "flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all",
                            style === s.value
                              ? "border-emerald-500/50 bg-emerald-500/10 shadow-sm"
                              : "border-border/50 bg-background hover:bg-muted/50 hover:border-border"
                          )}
                        >
                          <span className="text-base mt-0.5">{s.icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium block">{s.label}</span>
                            <p className="text-[10px] text-muted-foreground truncate">{s.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <Separator className="bg-border/50" />
              
              {/* Section: Color e Icono */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-amber-500/10">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  Color e Icono
                </div>
                <div className="pl-8 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Color del campo</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                            c.color,
                            color === c.value 
                              ? "border-white ring-2 ring-white/30 scale-110" 
                              : "border-transparent"
                          )}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Icono (emoji)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        placeholder="❤️ ⚔️ 🎲"
                        className="bg-background text-xl text-center font-normal h-10 w-10 p-0"
                      />
                      <div className="flex-1 flex items-center gap-1 text-sm text-muted-foreground">
                        {icon && <span className="text-2xl">{icon}</span>}
                        <span className="text-xs">Click para editar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />
              
              {/* Section: Valor por defecto y opciones */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-teal-500/10">
                    <Hash className="w-4 h-4 text-teal-500" />
                  </div>
                  Configuración del valor
                </div>
                <div className="pl-8 space-y-4">
                  {/* Type-specific options */}
                  {type === 'number' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Mínimo</Label>
                        <Input
                          type="number"
                          value={min}
                          onChange={(e) => setMin(Number(e.target.value))}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Máximo</Label>
                        <Input
                          type="number"
                          value={max}
                          onChange={(e) => setMax(Number(e.target.value))}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Unidad</Label>
                        <Input
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          placeholder="%, pts..."
                          className="bg-background"
                        />
                      </div>
                    </div>
                  )}
                  
                  {type === 'enum' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Opciones disponibles (separadas por coma)</Label>
                      <Input
                        value={options}
                        onChange={(e) => setOptions(e.target.value)}
                        placeholder="baja, media, alta, extrema"
                        className="bg-background"
                      />
                    </div>
                  )}
                  
                  {/* Default Value */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Valor por defecto</Label>
                    {type === 'boolean' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDefaultValue(true)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all",
                            defaultValue === true
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-border/50 bg-background hover:bg-muted/50"
                          )}
                        >
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Verdadero</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDefaultValue(false)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all",
                            defaultValue === false
                              ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                              : "border-border/50 bg-background hover:bg-muted/50"
                          )}
                        >
                          <X className="w-4 h-4" />
                          <span className="text-sm">Falso</span>
                        </button>
                      </div>
                    ) : type === 'number' ? (
                      <Input
                        type="number"
                        value={Number(defaultValue)}
                        onChange={(e) => setDefaultValue(Number(e.target.value))}
                        className="bg-background"
                      />
                    ) : type === 'enum' && options ? (
                      <Select
                        value={String(defaultValue)}
                        onValueChange={setDefaultValue}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {options.split(',').map((o) => o.trim()).filter(Boolean).map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={String(defaultValue)}
                        onChange={(e) => setDefaultValue(e.target.value)}
                        placeholder="Valor inicial..."
                        className="bg-background"
                      />
                    )}
                  </div>
                  
                  {/* Display options */}
                  <div className="flex items-center gap-6 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="showLabel"
                        checked={showLabel}
                        onCheckedChange={setShowLabel}
                      />
                      <Label htmlFor="showLabel" className="text-xs cursor-pointer">Mostrar etiqueta</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="showValue"
                        checked={showValue}
                        onCheckedChange={setShowValue}
                      />
                      <Label htmlFor="showValue" className="text-xs cursor-pointer">Mostrar valor</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Preview Panel */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                <div className="p-1.5 rounded-md bg-slate-500/10">
                  <Eye className="w-4 h-4 text-slate-500" />
                </div>
                Vista previa
              </div>
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 min-h-[300px] backdrop-blur-sm border border-white/10 shadow-xl sticky top-12">
                <div className="flex items-center justify-center min-h-[200px]">
                  <HUDFieldPreview field={previewField} value={defaultValue} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Así se verá el campo en el HUD durante el chat. El valor mostrado es el valor por defecto configurado.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="pt-4 border-t border-border/50">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim()}
            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
          >
            {field ? 'Guardar Cambios' : 'Agregar Campo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// HUD Field Preview Component
// ============================================

interface HUDFieldPreviewProps {
  field: HUDField;
  value: string | number | boolean;
}

function HUDFieldPreview({ field, value }: HUDFieldPreviewProps) {
  const color = field.color || 'default';
  
  // Color classes
  const colorClasses: Record<string, string> = {
    red: 'text-red-400',
    green: 'text-emerald-400',
    blue: 'text-blue-400',
    yellow: 'text-amber-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
    cyan: 'text-cyan-400',
    default: 'text-white/80',
  };
  
  const bgColorClasses: Record<string, string> = {
    red: 'bg-red-500/20 border-red-500/30',
    green: 'bg-emerald-500/20 border-emerald-500/30',
    blue: 'bg-blue-500/20 border-blue-500/30',
    yellow: 'bg-amber-500/20 border-amber-500/30',
    purple: 'bg-purple-500/20 border-purple-500/30',
    orange: 'bg-orange-500/20 border-orange-500/30',
    pink: 'bg-pink-500/20 border-pink-500/30',
    cyan: 'bg-cyan-500/20 border-cyan-500/30',
    default: 'bg-white/10 border-white/20',
  };
  
  const progressColorClasses: Record<string, string> = {
    red: 'bg-red-500',
    green: 'bg-emerald-500',
    blue: 'bg-blue-500',
    yellow: 'bg-amber-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    cyan: 'bg-cyan-500',
    default: 'bg-white/50',
  };
  
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  
  // Format value
  const formatValue = (): string => {
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'number') return String(value);
    return String(value);
  };
  
  // Render based on style
  switch (field.style) {
    case 'progress': {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      return (
        <div className="space-y-2 w-full max-w-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {field.icon && <span className="text-lg">{field.icon}</span>}
              {field.showLabel !== false && (
                <span className="text-sm text-white/50">{field.name}</span>
              )}
            </div>
            {field.showValue !== false && (
              <span className="text-sm font-medium text-white/80">
                {formatValue()}{field.unit && <span className="text-white/40 ml-1">{field.unit}</span>}
              </span>
            )}
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${progressColor}`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
      );
    }
    
    case 'badge':
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-lg">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-sm text-white/50">{field.name}:</span>}
          <span className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium ${bgColor} ${textColor}`}>
            {formatValue()}
          </span>
        </div>
      );
    
    case 'icon':
      return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${bgColor}`}>
          {field.icon && <span className="text-3xl">{field.icon}</span>}
          <span className={`text-xl font-bold ${textColor}`}>{formatValue()}</span>
        </div>
      );
    
    case 'chip':
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${bgColor} ${textColor}`}>
            {field.showLabel !== false && <span className="mr-1.5 opacity-60">{field.name}:</span>}
            {formatValue()}
          </span>
        </div>
      );
    
    case 'status': {
      const statusColor = typeof value === 'boolean' 
        ? (value ? 'bg-emerald-500' : 'bg-red-500')
        : progressColor;
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`} />
          {field.showLabel !== false && <span className="text-sm text-white/50">{field.name}:</span>}
          <span className={`text-sm font-medium ${textColor}`}>{formatValue()}</span>
        </div>
      );
    }
    
    case 'gauge': {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      const circumference = 2 * Math.PI * 35;
      const offset = circumference - (percentage / 100) * circumference;
      return (
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="none"
                strokeDasharray={circumference} strokeDashoffset={offset}
                className={textColor} style={{ transition: 'stroke-dashoffset 0.5s' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-bold text-white">{formatValue()}</span>
            </div>
          </div>
          {field.showLabel !== false && (
            <div className="flex flex-col">
              <span className="text-sm text-white/50">{field.name}</span>
              {field.unit && <span className="text-xs text-white/30">{field.unit}</span>}
            </div>
          )}
        </div>
      );
    }
    
    case 'separator':
      return (
        <div className="flex items-center gap-3 w-full max-w-xs">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          {field.name && <span className="text-xs text-white/40">{field.name}</span>}
          <div className="flex-1 h-px bg-white/20" />
        </div>
      );
    
    case 'label-only':
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-lg">{field.icon}</span>}
          <span className={`text-base font-medium ${textColor}`}>{field.name}</span>
        </div>
      );
    
    case 'pill':
      return (
        <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full ${bgColor}`}>
          {field.icon && <span className="text-base">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-xs text-white/60">{field.name}:</span>}
          <span className={`text-sm font-semibold ${textColor}`}>{formatValue()}</span>
        </div>
      );
    
    case 'meter': {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      return (
        <div className="flex items-end gap-3 h-16">
          <div className="relative w-8 h-full bg-white/10 rounded-md overflow-hidden">
            <div className={`absolute bottom-0 w-full transition-all duration-300 ${progressColor}`}
              style={{ height: `${percentage}%` }} />
          </div>
          <div className="flex flex-col justify-end pb-1">
            {field.showLabel !== false && <span className="text-xs text-white/50">{field.name}</span>}
            <span className={`text-sm font-bold ${textColor}`}>{formatValue()}</span>
          </div>
        </div>
      );
    }
    
    case 'dots': {
      const numDots = typeof value === 'boolean' ? (value ? 5 : 0) : Math.min(5, Math.max(0, Number(value)));
      return (
        <div className="flex items-center gap-3">
          {field.icon && <span className="text-base">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-sm text-white/50">{field.name}:</span>}
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`w-3 h-3 rounded-full transition-colors ${i <= numDots ? progressColor : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
      );
    }
    
    default: // 'default' style
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-lg">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-sm text-white/50 min-w-[70px]">{field.name}:</span>}
          <span className={`text-sm font-medium px-3 py-1 rounded-lg border ${bgColor} ${textColor}`}>
            {formatValue()}
            {field.unit && <span className="text-white/40 ml-1">{field.unit}</span>}
          </span>
        </div>
      );
  }
}

export default HUDManager;
