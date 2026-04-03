# TavernFlow UI Design System

Este documento define los patrones de diseño unificados para todos los componentes de edición de TavernFlow.

## Principios Generales

- **Consistencia visual**: Todos los componentes deben seguir los mismos patrones de color, espaciado y tipografía.
- **Accesibilidad**: Usar tooltips, popovers y labels descriptivos para guiar al usuario.
- **Responsive**: Los componentes deben adaptarse a diferentes tamaños de pantalla.
- **Modo oscuro/claro**: Usar clases de Tailwind que soporten ambos temas.

---

## 1. Estructura de Secciones

### Contenedor Principal
```tsx
<div className="space-y-4">
  {/* Sección de habilitación */}
  {/* Acordeones */}
</div>
```

### Toggle Principal de Sección
```tsx
<div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
  <div className="flex items-center gap-2">
    <Settings2 className="w-4 h-4" />
    <span className="font-medium">Nombre de Sección</span>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Título</h4>
          <p className="text-xs text-muted-foreground">Descripción...</p>
        </div>
      </PopoverContent>
    </Popover>
  </div>
  <Switch checked={enabled} onCheckedChange={setEnabled} />
</div>
```

---

## 2. Sistema de Acordeones

### Acordeón Raíz
```tsx
<Accordion type="multiple" defaultValue={['section1']} className="space-y-2">
  <AccordionItem value="section1" className="border rounded-lg">
    {/* Contenido */}
  </AccordionItem>
</Accordion>
```

### Item de Acordeón con Info
```tsx
<AccordionItem value="section" className="border rounded-lg">
  <div className="flex items-center px-4">
    <AccordionTrigger className="px-0 hover:no-underline flex-1">
      <div className="flex items-center gap-2">
        <IconComponent className="w-4 h-4 text-{color}-500" />
        <span>Nombre de Sección</span>
        <Badge variant="secondary" className="ml-2">{count}</Badge>
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
      <PopoverContent className="w-72">...</PopoverContent>
    </Popover>
  </div>
  <AccordionContent className="px-4 pb-4">
    {/* Contenido del acordeón */}
  </AccordionContent>
</AccordionItem>
```

---

## 3. Items Colapsables

### Estructura Base
```tsx
<div className="border rounded-lg bg-muted/30">
  {/* Header clickable */}
  <div 
    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    onClick={() => setExpanded(!expanded)}
  >
    <div className="flex items-center gap-2">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      <span className="text-lg">{icon}</span>
      <span className="font-medium text-sm">{name || `Item #${index + 1}`}</span>
      {key && (
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
          {'{{' + key + '}}'}
        </code>
      )}
      <Badge variant="outline" className="text-xs capitalize">{type}</Badge>
    </div>
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {...}}>
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </div>
  </div>
  
  {/* Contenido expandido */}
  {expanded && (
    <div className="px-4 pb-4 space-y-4 border-t">
      {/* Campos */}
    </div>
  )}
</div>
```

---

## 4. Campos y Inputs

### Grid de 2 columnas
```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <Label className="text-xs mb-1 block">Campo 1</Label>
    <Input className="h-8" />
  </div>
  <div>
    <Label className="text-xs mb-1 block">Campo 2</Label>
    <Input className="h-8" />
  </div>
</div>
```

### Campo con Tooltip
```tsx
<div className="flex items-center gap-1.5 mb-1">
  <Label className="text-xs">Nombre del Campo</Label>
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <p>Descripción del campo...</p>
    </TooltipContent>
  </Tooltip>
</div>
```

### Select Compacto
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="h-8">
    <SelectValue placeholder="Seleccionar..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Opción 1</SelectItem>
  </SelectContent>
</Select>
```

---

## 5. Sub-secciones Temáticas

### Sección de Detección (Amber)
```tsx
<div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
  <div className="flex items-center gap-2">
    <Zap className="w-4 h-4 text-amber-500" />
    <Label className="text-xs font-medium">Detección Automática</Label>
    <Tooltip>...</Tooltip>
  </div>
  {/* Contenido */}
</div>
```

### Sección de Costos (Rojo)
```tsx
<div className="space-y-2 pt-2 border-t border-red-500/20">
  <div className="flex items-center gap-1.5">
    <Coins className="w-3.5 h-3.5 text-red-400" />
    <Label className="text-xs font-medium text-red-400">Costos de Activación</Label>
  </div>
  {/* Contenido */}
</div>
```

### Sección de Recompensas (Verde)
```tsx
<div className="space-y-2 pt-2 border-t border-green-500/20">
  <div className="flex items-center gap-1.5">
    <Gift className="w-3.5 h-3.5 text-green-400" />
    <Label className="text-xs font-medium text-green-400">Recompensas</Label>
  </div>
  {/* Contenido */}
</div>
```

### Sección de Cadena/Sonido (Azul)
```tsx
<div className="space-y-3 p-3 border rounded-lg bg-blue-500/5 border-blue-500/20">
  {/* Contenido */}
</div>
```

---

## 6. Colores por Categoría

| Categoría | Color Principal | Clases |
|-----------|----------------|--------|
| Atributos | emerald | `text-emerald-500`, `bg-emerald-500/10` |
| Habilidades | amber | `text-amber-500`, `bg-amber-500/10` |
| Intenciones | blue | `text-blue-500`, `bg-blue-500/10` |
| Invitaciones | purple | `text-purple-500`, `bg-purple-500/10` |
| Estadísticas | cyan | `text-cyan-500`, `bg-cyan-500/10` |
| Costos | red | `text-red-400`, `border-red-500/20` |
| Recompensas | green | `text-green-400`, `border-green-500/20` |
| Detección | amber | `text-amber-500`, `bg-amber-500/10` |
| Sprites | purple | `text-purple-500`, `bg-purple-500/10` |
| Triggers | amber | `text-amber-500`, `bg-amber-500/10` |
| Sonido | blue | `text-blue-500`, `bg-blue-500/10` |
| Fondo | cyan | `text-cyan-500`, `bg-cyan-500/10` |

---

## 7. Tamaños de Texto

| Uso | Clase | Ejemplo |
|-----|-------|---------|
| Título de sección | `font-medium` (default) | "Sistema de Stats" |
| Label de campo | `text-xs` | "Nombre" |
| Badge de conteo | `text-xs` | "3" |
| Badge pequeño | `text-[10px]` | "⚡ Trigger" |
| Texto de input | `text-xs` o `text-sm` | - |
| Descripción | `text-xs text-muted-foreground` | "Descripción..." |
| Código/template | `text-xs font-mono` | `{{key}}` |

---

## 8. Alturas de Controles

| Control | Clase | Uso |
|---------|-------|-----|
| Input estándar | `h-8` | Campos normales |
| Input compacto | `h-7` | Inline, tablas |
| Input pequeño | `h-6` | Muy compacto |
| Button estándar | `h-8` | Acciones principales |
| Button pequeño | `h-7` | Acciones secundarias |
| Button compacto | `h-6` | Inline, muy compacto |
| Icon button | `h-7 w-7` | Botones de icono |
| Icon button small | `h-6 w-6` | Iconos compactos |

---

## 9. Espaciado

| Uso | Clase |
|-----|-------|
| Contenedor principal | `space-y-4` |
| Items de acordeón | `space-y-2` |
| Grupos de campos | `gap-3` |
| Items inline | `gap-2` |
| Padding de sección | `p-3` o `p-4` |
| Padding de item expandido | `px-4 pb-4` |

---

## 10. Estados Vacíos

### Estado deshabilitado
```tsx
{!enabled && (
  <div className="text-center py-8 text-muted-foreground">
    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
    <p>Activa el sistema para configurar...</p>
  </div>
)}
```

### Lista vacía
```tsx
{items.length === 0 && (
  <p className="text-xs text-muted-foreground italic text-center py-2">
    Sin items - mensaje descriptivo
  </p>
)}
```

### Advertencia
```tsx
<div className="text-center py-4 text-amber-600 bg-amber-500/5 border border-amber-500/20 rounded-lg">
  <Package className="w-6 h-6 mx-auto mb-2" />
  <p className="text-sm font-medium">Título de Advertencia</p>
  <p className="text-xs mt-1">Descripción de la advertencia</p>
</div>
```

---

## 11. Botones

### Botón Agregar (Full Width)
```tsx
<Button variant="outline" size="sm" onClick={addItem} className="w-full">
  <Plus className="w-4 h-4 mr-2" /> Agregar Item
</Button>
```

### Botón Agregar (Header)
```tsx
<Button variant="outline" size="sm" className="h-6 text-xs" onClick={addItem}>
  <Plus className="w-3 h-3 mr-1" /> Agregar
</Button>
```

### Botón Temático (Verde)
```tsx
<Button
  variant="outline"
  size="sm"
  className="h-6 text-xs border-green-500/30 hover:bg-green-500/10"
  onClick={addReward}
>
  <Plus className="w-3 h-3 mr-1" /> Agregar Recompensa
</Button>
```

---

## 12. Banners Informativos

### Banner con gradiente
```tsx
<div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-3">
  <div className="flex items-start gap-3">
    <div className="p-2 bg-purple-500/20 rounded-lg">
      <ImageIcon className="w-5 h-5 text-purple-500" />
    </div>
    <div className="flex-1">
      <h4 className="text-sm font-medium text-purple-600">Título del Banner</h4>
      <p className="text-xs text-muted-foreground mt-1">
        Descripción del banner con <strong>texto destacado</strong>.
      </p>
      <div className="flex gap-2 mt-2">
        <Badge variant="outline" className="text-xs">Tag 1</Badge>
        <Badge variant="outline" className="text-xs">Tag 2</Badge>
      </div>
    </div>
  </div>
</div>
```

---

## 13. Items de Recompensa/Costo Inline

```tsx
<div className="flex items-center gap-2 bg-muted/50 rounded p-2 flex-wrap">
  <Select>...</Select>
  <Select>...</Select>
  <Input type="number" className="h-7 w-16 text-xs" />
  <Button variant="ghost" size="icon" className="h-7 w-7">
    <Trash2 className="w-3 h-3 text-muted-foreground" />
  </Button>
</div>
```

---

## 14. Componentes Requeridos

```tsx
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
  Zap, Coins, Gift, X, Crown, Star, Shuffle, List, Layers,
  Package, Play, Volume2, Image as ImageIcon, Edit, Copy
} from 'lucide-react';
```

---

## 15. Ejemplo Completo

```tsx
<AccordionItem value="skills" className="border rounded-lg">
  <div className="flex items-center px-4">
    <AccordionTrigger className="px-0 hover:no-underline flex-1">
      <div className="flex items-center gap-2">
        <Sword className="w-4 h-4 text-amber-500" />
        <span>Habilidades</span>
        <Badge variant="secondary" className="ml-2">{skills.length}</Badge>
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
          <h4 className="font-medium text-sm">Habilidades</h4>
          <p className="text-xs text-muted-foreground">
            Acciones especiales que el personaje puede realizar.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  </div>
  <AccordionContent className="px-4 pb-4">
    <div className="space-y-2">
      {skills.map((skill, index) => (
        <SkillEditor
          key={skill.id}
          skill={skill}
          index={index}
          availableAttributes={attributes}
          onChange={updateSkill}
          onDelete={deleteSkill}
        />
      ))}
      <Button variant="outline" size="sm" onClick={addSkill} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Agregar Habilidad
      </Button>
    </div>
  </AccordionContent>
</AccordionItem>
```

---

## Checklist de Revisión

Al crear o actualizar componentes, verificar:

- [ ] Usa `space-y-4` para el contenedor principal
- [ ] Los items colapsables tienen `bg-muted/30` y `border rounded-lg`
- [ ] Los campos usan `h-8` o `h-7` para inputs
- [ ] Los labels tienen `text-xs`
- [ ] Los tooltips/popovers usan `Info` o `HelpCircle` con tamaño `w-3.5 h-3.5`
- [ ] Los botones de acción usan `h-7 w-7` para iconos
- [ ] Los colores de sección siguen la tabla de categorías
- [ ] Los estados vacíos tienen el formato correcto
- [ ] Los badges de conteo usan `variant="secondary"`
