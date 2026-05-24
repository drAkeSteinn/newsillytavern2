# Task 3: Objective Visibility Type Support

## Summary
Added visibility type dropdown and conditional editors to the `SortableObjectiveItem` component in `src/components/settings/quest-template-manager.tsx`.

## Changes Made

### 1. Type Imports (lines 12-33)
Added 5 new type imports from `@/types`:
- `QuestObjectiveVisibilityType`
- `QuestAttributeOperator`
- `QuestAttributeCondition`
- `QuestObjectiveCondition`
- `QuestVisibilityConditionGroup`

### 2. SortableObjectiveItemProps Interface (lines 417-429)
Added two new props:
- `allTemplates: QuestTemplate[]` — List of all quest templates for the objective condition editor
- `currentTemplateId: string` — Current template ID to exclude from "other missions" selector

### 3. SortableObjectiveItem Component Updates

#### Accordion Header Badges (lines 545-556)
Added visibility type indicator badges:
- `by_attribute` → Orange/amber badge with Filter icon and text "Cond. Atributo"
- `by_objective` → Purple badge with Target icon and text "Cond. Objetivo"
- `normal` → No badge (default)

#### Visibility Type Dropdown (lines 621-669)
Placed between "Basic Fields" (ID + Type) and "Description":
- Label: "Tipo de Visibilidad"
- Options:
  - `normal` → "Normal (siempre activo)" with Eye icon
  - `by_attribute` → "Por Atributo" with Filter icon
  - `by_objective` → "Por Objetivo" with Target icon
- On change, initializes `visibilityConditions` properly:
  - `by_attribute`: `{ attributeConditions: [{ targetId: '', attributeKey: '', operator: 'eq', value: '' }], logic: 'and' }`
  - `by_objective`: `{ objectiveConditions: [{ objectiveId: '' }], logic: 'and' }`
  - `normal`: `undefined`

#### by_attribute Conditional Editor (lines 671-842)
Shown when `visibilityType === 'by_attribute'`:
- Amber-themed container with Filter icon
- AND/OR logic toggle (Switch component)
- Attribute Conditions List, each with:
  - Target selector: All characters + `__user__` "Persona (Usuario)"
  - Attribute Key input (text)
  - Operator selector: has_attribute, missing_attribute, is_true, is_false, gt, gte, lt, lte, eq, neq, contains, not_contains
  - Value input: Only shown for operators that need it (hidden for has_attribute, missing_attribute, is_true, is_false). Number input for numeric operators, text for contains/not_contains.
  - Remove button (X)
- "Agregar condición de atributo" button
- Info text explaining the feature

#### by_objective Conditional Editor (lines 844-977)
Shown when `visibilityType === 'by_objective'`:
- Purple-themed container with Target icon
- AND/OR logic toggle (Switch component)
- Objective Conditions List, each with:
  - Mission selector: "Esta misión" (__this__) + other quest templates (excluding current)
  - Objective selector: Dynamically shows objectives from selected mission template
  - Remove button (X)
- "Agregar condición de objetivo" button
- Info text explaining the feature

### 4. QuestTemplateEditorDialog Update (lines 2469-2482)
Now passes two additional props to `SortableObjectiveItem`:
- `allTemplates={allTemplates}` — from the existing `allTemplates` prop
- `currentTemplateId={id}` — from the local `id` state

## Lint
- ✅ `bun run lint` passes with no errors
