'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import type { 
  Item, 
  ItemCategory, 
  ItemRarity, 
  ItemSlot,
  ItemStat,
  ItemEffect,
} from '@/types';

// ============================================
// Constants
// ============================================

const CATEGORIES: ItemCategory[] = [
  'weapon',
  'armor',
  'accessory',
  'consumable',
  'material',
  'key',
  'book',
  'tool',
  'treasure',
  'clothing',
  'misc',
];

const RARITIES: ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'unique',
  'cursed',
];

const SLOTS: ItemSlot[] = [
  'main_hand',
  'off_hand',
  'head',
  'chest',
  'legs',
  'feet',
  'hands',
  'accessory1',
  'accessory2',
  'back',
  'none',
];

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  accessory: 'Accesorio',
  consumable: 'Consumible',
  material: 'Material',
  key: 'Llave/Quest',
  book: 'Libro',
  tool: 'Herramienta',
  treasure: 'Tesoro',
  clothing: 'Ropa',
  misc: 'Otro',
};

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
  unique: 'Único',
  cursed: 'Maldito',
};

const SLOT_LABELS: Record<ItemSlot, string> = {
  main_hand: 'Mano Principal',
  off_hand: 'Mano Secundaria',
  head: 'Cabeza',
  chest: 'Pecho',
  legs: 'Piernas',
  feet: 'Pies',
  hands: 'Manos',
  accessory1: 'Accesorio 1',
  accessory2: 'Accesorio 2',
  back: 'Espalda',
  none: 'Sin Slot',
};

// ============================================
// Get initial state from item
// ============================================

function getInitialState(item: Item | null | undefined) {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    category: item?.category ?? 'misc',
    rarity: item?.rarity ?? 'common',
    slot: item?.slot ?? 'none',
    icon: item?.icon ?? '',
    imageUrl: item?.imageUrl ?? '',
    stackable: item?.stackable ?? false,
    maxStack: item?.maxStack ?? 1,
    value: item?.value,
    weight: item?.weight,
    usable: item?.usable ?? false,
    consumable: item?.consumable ?? false,
    equippable: item?.equippable ?? false,
    triggerKeywords: item?.triggerKeywords?.join(', ') ?? '',
    contextKeys: item?.contextKeys?.join(', ') ?? '',
    tags: item?.tags?.join(', ') ?? '',
    stats: item?.stats ?? [],
    effects: item?.effects ?? [],
  };
}

// ============================================
// Item Editor Component
// ============================================

interface ItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onSave: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
}

export function ItemEditor({ open, onOpenChange, item, onSave, onDelete }: ItemEditorProps) {
  // Use key to reset state when item changes
  const itemKey = item?.id ?? 'new';
  
  const initialState = useMemo(() => getInitialState(item), [item]);
  
  const [name, setName] = useState(initialState.name);
  const [description, setDescription] = useState(initialState.description);
  const [category, setCategory] = useState<ItemCategory>(initialState.category);
  const [rarity, setRarity] = useState<ItemRarity>(initialState.rarity);
  const [slot, setSlot] = useState<ItemSlot>(initialState.slot);
  const [icon, setIcon] = useState(initialState.icon);
  const [imageUrl, setImageUrl] = useState(initialState.imageUrl);
  const [stackable, setStackable] = useState(initialState.stackable);
  const [maxStack, setMaxStack] = useState(initialState.maxStack);
  const [value, setValue] = useState<number | undefined>(initialState.value);
  const [weight, setWeight] = useState<number | undefined>(initialState.weight);
  const [usable, setUsable] = useState(initialState.usable);
  const [consumable, setConsumable] = useState(initialState.consumable);
  const [equippable, setEquippable] = useState(initialState.equippable);
  const [triggerKeywords, setTriggerKeywords] = useState(initialState.triggerKeywords);
  const [contextKeys, setContextKeys] = useState(initialState.contextKeys);
  const [tags, setTags] = useState(initialState.tags);
  const [stats, setStats] = useState<ItemStat[]>(initialState.stats);
  const [effects, setEffects] = useState<ItemEffect[]>(initialState.effects);
  
  // Derived values for category-based auto-adjustments
  const isAutoStackable = category === 'consumable' || category === 'material';
  const effectiveStackable = isAutoStackable ? true : stackable;
  const effectiveMaxStack = isAutoStackable ? 99 : maxStack;
  
  const handleCategoryChange = (newCategory: ItemCategory) => {
    setCategory(newCategory as ItemCategory);
    // Auto-adjust stackable based on category directly in handler
    if (newCategory === 'consumable' || newCategory === 'material') {
      setMaxStack(99);
    } else {
      setMaxStack(1);
    }
  };
  
  const handleSave = () => {
    if (!name.trim()) return;
    
    const newItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      description: description.trim(),
      category,
      rarity,
      slot: equippable ? slot : undefined,
      icon: icon.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      stackable: effectiveStackable,
      maxStack: effectiveMaxStack,
      value,
      weight,
      usable,
      consumable: usable ? consumable : undefined,
      equippable,
      triggerKeywords: triggerKeywords.trim() 
        ? triggerKeywords.split(',').map(k => k.trim()).filter(Boolean)
        : undefined,
      contextKeys: contextKeys.trim()
        ? contextKeys.split(',').map(k => k.trim()).filter(Boolean)
        : undefined,
      tags: tags.trim()
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : undefined,
      stats: stats.length > 0 ? stats : undefined,
      effects: effects.length > 0 ? effects : undefined,
    };
    
    onSave(newItem);
    onOpenChange(false);
  };
  
  const addStat = () => {
    setStats([...stats, { name: '', value: 0, isPercentage: false }]);
  };
  
  const updateStat = (index: number, updates: Partial<ItemStat>) => {
    setStats(stats.map((s, i) => i === index ? { ...s, ...updates } : s));
  };
  
  const removeStat = (index: number) => {
    setStats(stats.filter((_, i) => i !== index));
  };
  
  const addEffect = () => {
    setEffects([...effects, { type: 'buff', name: '', description: '' }]);
  };
  
  const updateEffect = (index: number, updates: Partial<ItemEffect>) => {
    setEffects(effects.map((e, i) => i === index ? { ...e, ...updates } : e));
  };
  
  const removeEffect = (index: number) => {
    setEffects(effects.filter((_, i) => i !== index));
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={itemKey}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Editar Item' : 'Crear Nuevo Item'}
          </DialogTitle>
          <DialogDescription>
            Define las propiedades del item para el inventario.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="basic" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full shrink-0">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto mt-4">
          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Espada del Destino"
              />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Una espada legendaria..."
                rows={3}
              />
            </div>
            
            {/* Category & Rarity */}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Rareza</Label>
                <Select value={rarity} onValueChange={(v) => setRarity(v as ItemRarity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map(r => (
                      <SelectItem key={r} value={r}>
                        <span className={`
                          ${r === 'legendary' ? 'text-amber-500' : ''}
                          ${r === 'unique' ? 'text-red-500' : ''}
                          ${r === 'epic' ? 'text-purple-500' : ''}
                          ${r === 'rare' ? 'text-blue-500' : ''}
                          ${r === 'uncommon' ? 'text-green-500' : ''}
                          ${r === 'cursed' ? 'text-fuchsia-500' : ''}
                        `}>
                          {RARITY_LABELS[r]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Icon */}
            <div className="space-y-2">
              <Label htmlFor="icon">Icono (emoji)</Label>
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="⚔️"
                className="w-24"
              />
            </div>
            
            <Separator />
            
            {/* Properties */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Propiedades</h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Value */}
                <div className="space-y-2">
                  <Label htmlFor="value">Valor (oro)</Label>
                  <Input
                    id="value"
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => setValue(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="100"
                  />
                </div>
                
                {/* Weight */}
                <div className="space-y-2">
                  <Label htmlFor="weight">Peso</Label>
                  <Input
                    id="weight"
                    type="number"
                    value={weight ?? ''}
                    onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.5"
                    step="0.1"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                {/* Usable */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={usable}
                    onCheckedChange={setUsable}
                  />
                  <Label>Utilizable</Label>
                </div>
                
                {usable && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={consumable}
                      onCheckedChange={setConsumable}
                    />
                    <Label>Consumible</Label>
                  </div>
                )}
                
                {/* Equippable */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={equippable}
                    onCheckedChange={setEquippable}
                  />
                  <Label>Equipable</Label>
                </div>
              </div>
              
              {/* Equipment Slot */}
              {equippable && (
                <div className="space-y-2">
                  <Label>Slot de Equipo</Label>
                  <Select value={slot} onValueChange={(v) => setSlot(v as ItemSlot)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLOTS.filter(s => s !== 'none').map(s => (
                        <SelectItem key={s} value={s}>
                          {SLOT_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Stackable */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={effectiveStackable}
                    onCheckedChange={setStackable}
                    disabled={isAutoStackable}
                  />
                  <Label>Apilable</Label>
                </div>
                
                {effectiveStackable && (
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground">Max:</Label>
                    <Input
                      type="number"
                      value={effectiveMaxStack}
                      onChange={(e) => setMaxStack(parseInt(e.target.value) || 1)}
                      className="w-20"
                      min={1}
                      disabled={isAutoStackable}
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-sm">Estadísticas</h4>
              <Button variant="outline" size="sm" onClick={addStat}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar Stat
              </Button>
            </div>
            
            {stats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin estadísticas definidas
              </p>
            ) : (
              <div className="space-y-2">
                {stats.map((stat, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Input
                      value={stat.name}
                      onChange={(e) => updateStat(index, { name: e.target.value })}
                      placeholder="Nombre (ej: Ataque)"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={stat.value}
                      onChange={(e) => updateStat(index, { value: parseInt(e.target.value) || 0 })}
                      className="w-20"
                    />
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={stat.isPercentage}
                        onCheckedChange={(v) => updateStat(index, { isPercentage: v })}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStat(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <Separator />
            
            {/* Effects */}
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-sm">Efectos</h4>
              <Button variant="outline" size="sm" onClick={addEffect}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar Efecto
              </Button>
            </div>
            
            {effects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin efectos definidos
              </p>
            ) : (
              <div className="space-y-2">
                {effects.map((effect, index) => (
                  <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={effect.type}
                        onValueChange={(v) => updateEffect(index, { type: v as ItemEffect['type'] })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buff">Buff</SelectItem>
                          <SelectItem value="debuff">Debuff</SelectItem>
                          <SelectItem value="heal">Curación</SelectItem>
                          <SelectItem value="damage">Daño</SelectItem>
                          <SelectItem value="special">Especial</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={effect.name}
                        onChange={(e) => updateEffect(index, { name: e.target.value })}
                        placeholder="Nombre del efecto"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEffect(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      value={effect.description || ''}
                      onChange={(e) => updateEffect(index, { description: e.target.value })}
                      placeholder="Descripción del efecto"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={effect.value ?? ''}
                        onChange={(e) => updateEffect(index, { value: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="Valor"
                        className="w-24"
                      />
                      <Input
                        type="number"
                        value={effect.duration ?? ''}
                        onChange={(e) => updateEffect(index, { duration: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="Duración (turnos)"
                        className="w-32"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Triggers Tab */}
          <TabsContent value="triggers" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Keywords de Trigger</Label>
              <p className="text-xs text-muted-foreground">
                Palabras clave que detectan este item en los mensajes (separadas por coma)
              </p>
              <Input
                value={triggerKeywords}
                onChange={(e) => setTriggerKeywords(e.target.value)}
                placeholder="espada del destino, legendary sword"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Keywords de Contexto</Label>
              <p className="text-xs text-muted-foreground">
                Keywords adicionales que TAMBIÉN deben estar presentes (separadas por coma)
              </p>
              <Input
                value={contextKeys}
                onChange={(e) => setContextKeys(e.target.value)}
                placeholder="encuentras, obtienes"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tags</Label>
              <p className="text-xs text-muted-foreground">
                Tags para organización y búsqueda (separados por coma)
              </p>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="arma, legendario, fuego"
              />
            </div>
          </TabsContent>
          </div>
          {/* End scrollable content */}
        </Tabs>
        
        <DialogFooter className="gap-2 mt-auto pt-4 border-t border-border/50 shrink-0">
          {item && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {item ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItemEditor;
