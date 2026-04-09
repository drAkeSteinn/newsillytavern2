// ============================================
// DESIGN TEMPLATE - TavernFlow UI Components
// ============================================
//
// This file documents the unified design patterns for all editor sections.
// Use these patterns to ensure consistent styling across the application.
//
// Reference: StatsEditor component (stats-editor.tsx)

// ============================================
// 1. SECTION STRUCTURE
// ============================================

/*
<section-pattern>
  - Main container: space-y-4
  - Section header: p-3 bg-muted/50 rounded-lg with flex items-center
  - Accordion sections: border rounded-lg
  - Collapsed items: border rounded-lg bg-muted/30
*/

// ============================================
// 2. MAIN SECTION TOGGLE
// ============================================

/*
<div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
  <div className="flex items-center gap-2">
    <Icon className="w-4 h-4" />
    <span className="font-medium">Section Title</span>
    <Popover> // Info popover
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        // Info content
      </PopoverContent>
    </Popover>
  </div>
  <Switch checked={enabled} onCheckedChange={...} />
</div>
*/

// ============================================
// 3. ACCORDION SECTION
// ============================================

/*
<AccordionItem value="section" className="border rounded-lg">
  <div className="flex items-center px-4">
    <AccordionTrigger className="px-0 hover:no-underline flex-1">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-{color}-500" />
        <span>Section Name</span>
        <Badge variant="secondary" className="ml-2">{count}</Badge>
      </div>
    </AccordionTrigger>
    <Popover> // Section info popover
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">...</PopoverContent>
    </Popover>
  </div>
  <AccordionContent className="px-4 pb-4">
    // Content
  </AccordionContent>
</AccordionItem>
*/

// ============================================
// 4. COLLAPSED/COLLAPSIBLE ITEM
// ============================================

/*
<div className="border rounded-lg bg-muted/30">
  // Header - Clickable
  <div 
    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    onClick={() => setExpanded(!expanded)}
  >
    <div className="flex items-center gap-2">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      <span className="text-lg">{icon}</span>
      <span className="font-medium text-sm">
        {name || `Item #${index + 1}`}
      </span>
      {key && (
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
          {'{{' + key + '}}'}
        </code>
      )}
      <Badge variant="outline" className="text-xs capitalize">
        {type}
      </Badge>
    </div>
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {...}}>
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </div>
  </div>
  
  // Expanded Content
  {expanded && (
    <div className="px-4 pb-4 space-y-4 border-t">
      // Content here
    </div>
  )}
</div>
*/

// ============================================
// 5. FIELD GROUPS
// ============================================

// Simple 2-column grid
/*
<div className="pt-3 grid grid-cols-2 gap-3">
  <div>
    <Label className="text-xs mb-1 block">Field 1</Label>
    <Input className="h-8" />
  </div>
  <div>
    <Label className="text-xs mb-1 block">Field 2</Label>
    <Input className="h-8" />
  </div>
</div>
*/

// Field with tooltip
/*
<div className="flex items-center gap-1.5 mb-1">
  <Label className="text-xs">Field Name</Label>
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <p>Tooltip description</p>
    </TooltipContent>
  </Tooltip>
</div>
*/

// ============================================
// 6. SUB-SECTION BOXES
// ============================================

// Detection/Auto-detection box (amber theme)
/*
<div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
  <div className="flex items-center gap-2">
    <Zap className="w-4 h-4 text-amber-500" />
    <Label className="text-xs font-medium">Detección automática</Label>
    <Tooltip>...</Tooltip>
  </div>
  // Content
</div>
*/

// Cost/Expense box (red theme)
/*
<div className="space-y-2 pt-2 border-t border-red-500/20">
  <div className="flex items-center gap-1.5">
    <Coins className="w-3.5 h-3.5 text-red-400" />
    <Label className="text-xs font-medium text-red-400">Costo de Activación</Label>
  </div>
  // Content
</div>
*/

// Rewards box (green theme)
/*
<div className="space-y-2 pt-2 border-t border-green-500/20">
  <div className="flex items-center gap-1.5">
    <Gift className="w-3.5 h-3.5 text-green-400" />
    <Label className="text-xs font-medium text-green-400">Recompensas</Label>
  </div>
  // Content
</div>
*/

// ============================================
// 7. INLINE REQUIREMENT/COST EDITORS
// ============================================

/*
<div className="flex items-center gap-2 bg-muted/50 rounded p-2 flex-wrap">
  <Select>...</Select>
  <Select>...</Select>
  <Input type="number" className="h-7 w-16 text-xs" />
  <Button variant="ghost" size="icon" className="h-7 w-7">
    <Trash2 className="w-3 h-3 text-muted-foreground" />
  </Button>
</div>
*/

// ============================================
// 8. REWARD ITEM (Compact Style)
// ============================================

/*
<div className="p-2 rounded bg-green-500/5 border border-green-500/10 space-y-2">
  <div className="flex items-center gap-2">
    <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
      ⚡ Trigger
    </Badge>
    <Badge variant="outline" className="text-[10px]">
      {description}
    </Badge>
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10 ml-auto">
      <X className="w-3 h-3" />
    </Button>
  </div>
  <div className="grid grid-cols-3 gap-2">
    <SelectTrigger className="bg-background h-6 text-xs">...</SelectTrigger>
    <Input className="bg-background h-6 text-xs" />
    <SelectTrigger className="bg-background h-6 text-xs">...</SelectTrigger>
  </div>
</div>
*/

// ============================================
// 9. EMPTY STATE
// ============================================

/*
{items.length === 0 && (
  <p className="text-xs text-muted-foreground italic">Sin items - mensaje descriptivo</p>
)}
*/

// Disabled section empty state
/*
{!enabled && (
  <div className="text-center py-8 text-muted-foreground">
    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
    <p>Activa el sistema para configurar...</p>
  </div>
)}
*/

// ============================================
// 10. BUTTON STYLES
// ============================================

// Add button (full width)
/*
<Button variant="outline" size="sm" onClick={addItem} className="w-full">
  <Plus className="w-4 h-4 mr-2" /> Agregar Item
</Button>
*/

// Add button (header)
/*
<Button variant="outline" size="sm" className="h-6 text-xs" onClick={...}>
  <Plus className="w-3 h-3 mr-1" /> Agregar
</Button>
*/

// Themed add button (green)
/*
<Button
  variant="outline"
  size="sm"
  className="h-6 text-xs border-green-500/30 hover:bg-green-500/10"
  onClick={...}
>
  <Plus className="w-3 h-3 mr-1" /> Agregar Trigger
</Button>
*/

// ============================================
// 11. ICON COLORS BY CATEGORY
// ============================================

/*
Attributes:    emerald-500 (Sparkles)
Skills:        amber-500 (Sword)
Intentions:    blue-500 (Target)
Invitations:   purple-500 (Mail)
Stats:         cyan-500 (Activity)
Costs:         red-400 (Coins)
Rewards:       green-400 (Gift)
Detection:     amber-500 (Zap)
Settings:      muted-foreground (Settings2)
*/

// ============================================
// 12. TEXT SIZES
// ============================================

/*
- Section title: font-medium (default size)
- Accordion header: default size, span
- Field label: text-xs
- Badge count: text-xs
- Input text: text-xs or text-sm
- Description text: text-xs text-muted-foreground
- Code/template keys: text-xs font-mono
- Help text: text-[10px] text-muted-foreground
*/

// ============================================
// 13. SPACING
// ============================================

/*
- Main container: space-y-4
- Accordion items: space-y-2
- Field groups: space-y-3 or gap-3
- Inline items: gap-2
- Section padding: p-3 or p-4
- Collapsed item padding: px-4 pb-4
*/

// ============================================
// 14. COMPONENTS TO USE
// ============================================

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, GripVertical, HelpCircle, ChevronDown, ChevronUp,
  Sparkles, Sword, Target, Mail, Settings2, AlertCircle, Info,
  Zap, Coins, Gift, X, // ... other icons
} from 'lucide-react';

// ============================================
// 15. EXAMPLE: COMPLETE SECTION TEMPLATE
// ============================================

/*
<AccordionItem value="items" className="border rounded-lg">
  <div className="flex items-center px-4">
    <AccordionTrigger className="px-0 hover:no-underline flex-1">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-{color}-500" />
        <span>Section Name</span>
        <Badge variant="secondary" className="ml-2">{items.length}</Badge>
      </div>
    </AccordionTrigger>
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Section Name</h4>
          <p className="text-xs text-muted-foreground">
            Description of what this section does.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  </div>
  <AccordionContent className="px-4 pb-4">
    <div className="space-y-2">
      {items.map((item, index) => (
        <ItemEditor
          key={item.id}
          item={item}
          index={index}
          onChange={updateItem}
          onDelete={deleteItem}
        />
      ))}
      <Button variant="outline" size="sm" onClick={addItem} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Agregar Item
      </Button>
    </div>
  </AccordionContent>
</AccordionItem>
*/

// ============================================
// EXPORT: Design tokens for programmatic use
// ============================================

export const DESIGN_TOKENS = {
  // Icon colors
  colors: {
    attributes: 'emerald',
    skills: 'amber',
    intentions: 'blue',
    invitations: 'purple',
    stats: 'cyan',
    costs: 'red',
    rewards: 'green',
    detection: 'amber',
  },
  
  // Spacing
  spacing: {
    section: 'space-y-4',
    accordion: 'space-y-2',
    fields: 'gap-3',
    inline: 'gap-2',
  },
  
  // Text sizes
  text: {
    label: 'text-xs',
    badge: 'text-[10px]',
    description: 'text-xs text-muted-foreground',
    code: 'text-xs font-mono',
  },
  
  // Control heights
  heights: {
    input: 'h-8',
    inputCompact: 'h-7',
    inputSmall: 'h-6',
    button: 'h-8',
    buttonSmall: 'h-7',
    buttonCompact: 'h-6',
    icon: 'h-7 w-7',
    iconSmall: 'h-6 w-6',
  },
  
  // Container classes
  containers: {
    section: 'p-3 bg-muted/50 rounded-lg',
    item: 'border rounded-lg bg-muted/30',
    subSection: 'p-3 bg-muted/50 rounded-lg border',
    costSection: 'space-y-2 pt-2 border-t border-red-500/20',
    rewardSection: 'space-y-2 pt-2 border-t border-green-500/20',
  },
  
  // Badge styles
  badges: {
    count: 'variant="secondary" className="ml-2"',
    type: 'variant="outline" className="text-xs capitalize"',
    trigger: 'variant="outline" className="text-[10px] text-green-400 border-green-500/30"',
  },
};

export default DESIGN_TOKENS;
