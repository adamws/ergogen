# Ergogen Integration Guide for kle-ng

**Purpose:** Add "Import Ergogen Configuration" feature to kle-ng
**Strategy:** Use original ergogen + dependency override + port conversion logic
**Result:** No fork maintenance required
**Estimated Effort:** 2-3 weeks

---

## Table of Contents

1. [Strategy Overview](#strategy-overview)
2. [Why This Approach](#why-this-approach)
3. [Implementation Steps](#implementation-steps)
4. [Complete Conversion Code](#complete-conversion-code)
5. [Testing Requirements](#testing-requirements)
6. [Integration Example](#integration-example)
7. [Troubleshooting](#troubleshooting)

---

## Strategy Overview

### The Solution

Use **original ergogen** (no fork maintenance!) by:
1. Adding ergogen as dependency: `github:ergogen/ergogen`
2. Forcing it to use kle-serial2 via npm override
3. Porting conversion logic (~230 lines) to kle-ng

### Architecture

```
kle-ng
├── package.json
│   ├── dependencies:
│   │   ├── ergogen: "github:ergogen/ergogen"     ← Original!
│   │   └── kle-serial2: "github:adamws/kle-serial2"
│   └── overrides:
│       └── ergogen.kle-serial → kle-serial2      ← Force override
│
├── src/lib/ergogen-converter.ts                  ← Port conversion (~230 lines)
└── src/composables/useErgogenImport.ts           ← Integration logic
```

### Workflow

```
User pastes Ergogen YAML
    ↓
ergogen.process() generates points  ← Uses original ergogen + kle-serial2 override
    ↓
ergogenPointsToKLE() converts       ← Your ported conversion function
    ↓
kle-ng displays layout              ← Existing KLE functionality
```

---

## Why This Approach

| Aspect | This Solution | Alternative (Fork) |
|--------|---------------|-------------------|
| **Fork Maintenance** | ✅ None (uses original) | ❌ Required |
| **Code to Maintain** | ✅ ~230 lines | ❌ ~10,000+ lines |
| **Accepts YAML** | ✅ Yes | ✅ Yes |
| **Bundle Size** | ⚠️ ~500KB | ⚠️ ~500KB |
| **Offline Support** | ✅ Yes | ✅ Yes |
| **API Compatibility** | ✅ Verified | ✅ Same |

**Key Advantage:** When upstream ergogen updates, just run `npm update` - no fork to maintain!

---

## Implementation Steps

### Step 1: Add Dependencies and Override

**For npm (package.json):**

```json
{
  "dependencies": {
    "ergogen": "github:ergogen/ergogen",
    "kle-serial2": "github:adamws/kle-serial2"
  },
  "overrides": {
    "ergogen": {
      "kle-serial": "npm:kle-serial2@github:adamws/kle-serial2"
    }
  }
}
```

**For yarn (package.json):**

```json
{
  "dependencies": {
    "ergogen": "github:ergogen/ergogen",
    "kle-serial2": "github:adamws/kle-serial2"
  },
  "resolutions": {
    "ergogen/kle-serial": "github:adamws/kle-serial2"
  }
}
```

**For pnpm (package.json):**

```json
{
  "dependencies": {
    "ergogen": "github:ergogen/ergogen",
    "kle-serial2": "github:adamws/kle-serial2"
  },
  "pnpm": {
    "overrides": {
      "ergogen>kle-serial": "github:adamws/kle-serial2"
    }
  }
}
```

**Install:**
```bash
npm install
# or
yarn install
# or
pnpm install
```

**Verify override worked:**
```bash
npm ls kle-serial
# Should show: kle-serial2 (via override)
```

### Step 2: Create Conversion Module

**File:** `src/lib/ergogen-converter.ts`

See [Complete Conversion Code](#complete-conversion-code) section below.

### Step 3: Create Import Composable

**File:** `src/composables/useErgogenImport.ts`

```typescript
import ergogen from 'ergogen'
import { ergogenPointsToKLE } from '@/lib/ergogen-converter'
import { useKeyboardStore } from '@/stores/keyboard'

export function useErgogenImport() {
  const keyboardStore = useKeyboardStore()

  async function importErgogenConfig(yamlText: string): Promise<void> {
    try {
      // Step 1: Parse YAML (ergogen expects an object)
      const configObject = parseErgogenYAML(yamlText)

      // Step 2: Process with ergogen to generate points
      const results = ergogen.process(configObject)

      if (!results.points) {
        throw new Error('Ergogen processing failed: no points generated')
      }

      // Step 3: Convert points to KLE format
      const kleLayout = ergogenPointsToKLE(results.points)

      // Step 4: Load into kle-ng (using existing deserialization)
      keyboardStore.loadFromKLE(kleLayout)
    } catch (error) {
      console.error('Ergogen import failed:', error)
      throw new Error(`Failed to import Ergogen config: ${error.message}`)
    }
  }

  function parseErgogenYAML(yamlText: string): any {
    // Use js-yaml or similar (ergogen already includes it)
    // For now, assuming it's already parsed or using ergogen's parser
    // You may need to import yaml parser separately
    return yamlText // Placeholder - implement proper YAML parsing
  }

  return {
    importErgogenConfig
  }
}
```

### Step 4: Create UI Component

**File:** `src/components/ImportErgogenDialog.vue`

```vue
<template>
  <Dialog v-model="isOpen" title="Import Ergogen Configuration">
    <div class="import-ergogen">
      <textarea
        v-model="configText"
        placeholder="Paste your ergogen config (YAML format)"
        rows="20"
        class="config-input"
      />

      <div v-if="error" class="error">
        {{ error }}
      </div>

      <div class="actions">
        <button @click="handleCancel">Cancel</button>
        <button @click="handleImport" :disabled="!configText || loading">
          {{ loading ? 'Importing...' : 'Import' }}
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useErgogenImport } from '@/composables/useErgogenImport'

const { importErgogenConfig } = useErgogenImport()

const isOpen = defineModel<boolean>()
const configText = ref('')
const error = ref('')
const loading = ref(false)

async function handleImport() {
  error.value = ''
  loading.value = true

  try {
    await importErgogenConfig(configText.value)
    isOpen.value = false
    configText.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Import failed'
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  isOpen.value = false
  configText.value = ''
  error.value = ''
}
</script>

<style scoped>
.import-ergogen {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 600px;
}

.config-input {
  font-family: monospace;
  font-size: 0.9rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
}

.error {
  color: red;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
```

### Step 5: Add to Main Menu

Add menu item for ergogen import:

```typescript
// In your menu configuration
{
  label: 'Import',
  items: [
    { label: 'From KLE Raw Data...', action: 'import:kle' },
    { label: 'From Ergogen Config...', action: 'import:ergogen' }, // NEW
    { label: 'From JSON File...', action: 'import:json' }
  ]
}
```

---

## Complete Conversion Code

**File:** `src/lib/ergogen-converter.ts`

```typescript
import { Key, Keyboard, Serial } from 'kle-serial2'

/**
 * TypeScript interfaces for Ergogen data structures
 */
export interface ErgogenPoint {
  x: number
  y: number
  r?: number
  meta?: {
    width?: number
    height?: number
    padding?: number
    label?: string
    name?: string
    origin?: [number, number]
  }
}

export type ErgogenPoints = Record<string, ErgogenPoint>

/**
 * Convert ergogen points to KLE format
 *
 * This function is ported from adamws/ergogen fork's src/kle.js serialize() function.
 * It handles:
 * - Auto-detection of ergogen's unit system (spacing, width, height)
 * - Conversion to KLE's unified "U" unit system
 * - Proper handling of rotated keys
 * - Position normalization (offset to origin)
 *
 * @param points - Ergogen points object (from ergogen.process().points)
 * @returns KLE layout array (can be passed to Serial.serialize or used directly)
 */
export function ergogenPointsToKLE(points: ErgogenPoints): Array<any> {
  const keyboard = new Keyboard()

  // ========================================================================
  // UNIT DETECTION
  // ========================================================================
  // Ergogen allows custom unit configuration:
  // - $default_width: 'u-1' (typically 18)
  // - $default_height: 'u-1' (typically 18)
  // - $default_padding: 'u' (typically 19)
  // - $default_spread: 'u' (typically 19)
  //
  // We detect the actual values by finding the most common values in the data.

  const widths: number[] = []
  const heights: number[] = []
  const paddings: number[] = []

  for (const point of Object.values(points)) {
    if (point.meta) {
      if (point.meta.width !== undefined) widths.push(point.meta.width)
      if (point.meta.height !== undefined) heights.push(point.meta.height)
      if (point.meta.padding !== undefined) paddings.push(point.meta.padding)
    }
  }

  // Find most common padding (this is the spacing unit) - do this FIRST
  let spacingUnit = 19 // default fallback
  if (paddings.length > 0) {
    const paddingCounts: Record<number, number> = {}
    for (const p of paddings) {
      paddingCounts[p] = (paddingCounts[p] || 0) + 1
    }
    spacingUnit = Number(
      Object.keys(paddingCounts).reduce((a, b) =>
        paddingCounts[Number(a)] > paddingCounts[Number(b)] ? a : b
      )
    )
  }

  // Find most common width (this is the standard key size)
  // For keyboards with few keys, default to (spacing - 1) which is ergogen's standard
  let standardWidth = spacingUnit > 1 ? spacingUnit - 1 : 18
  if (widths.length >= 2) {
    // Need at least 2 keys to reliably determine standard
    const widthCounts: Record<number, number> = {}
    for (const w of widths) {
      widthCounts[w] = (widthCounts[w] || 0) + 1
    }
    standardWidth = Number(
      Object.keys(widthCounts).reduce((a, b) =>
        widthCounts[Number(a)] > widthCounts[Number(b)] ? a : b
      )
    )
  }

  // Find most common height (this is the standard key height)
  let standardHeight = spacingUnit > 1 ? spacingUnit - 1 : 18
  if (heights.length >= 2) {
    const heightCounts: Record<number, number> = {}
    for (const h of heights) {
      heightCounts[h] = (heightCounts[h] || 0) + 1
    }
    standardHeight = Number(
      Object.keys(heightCounts).reduce((a, b) =>
        heightCounts[Number(a)] > heightCounts[Number(b)] ? a : b
      )
    )
  }

  // ========================================================================
  // NORMALIZATION FUNCTIONS
  // ========================================================================
  // KLE uses a unified "U" unit system:
  // - For POSITIONS: use spacing unit (the grid/padding)
  // - For WIDTH: use standard width (most common key width)
  // - For HEIGHT: use standard height (most common key height)

  const normalizePosition = (value: number): number => value / spacingUnit

  const normalizeWidth = (value: number): number => {
    const normalized = value / standardWidth
    // Round to nearest 0.25U for cleaner output
    return Math.round(normalized * 4) / 4
  }

  const normalizeHeight = (value: number): number => {
    const normalized = value / standardHeight
    // Round to nearest 0.25U for cleaner output
    return Math.round(normalized * 4) / 4
  }

  // ========================================================================
  // CONVERT POINTS TO ARRAY AND SORT
  // ========================================================================

  const pointsArray = Object.entries(points).map(([name, point]) => ({
    name,
    x: point.x,
    y: point.y,
    r: point.r || 0,
    meta: point.meta || {}
  }))

  // Sort by y first, then x to group into rows
  pointsArray.sort((a, b) => {
    const yDiff = a.y - b.y
    if (Math.abs(yDiff) < 0.1) {
      // tolerance for floating point
      return a.x - b.x
    }
    return yDiff
  })

  // ========================================================================
  // GROUP BY ROTATION
  // ========================================================================
  // KLE requires rotation groups to be in separate rows

  const rotationGroups = new Map<string, typeof pointsArray>()

  for (const point of pointsArray) {
    // Create a key for the rotation group
    // Use rotation angle and a grid-snapped origin
    const rotKey = `${point.r.toFixed(2)}`

    if (!rotationGroups.has(rotKey)) {
      rotationGroups.set(rotKey, [])
    }
    rotationGroups.get(rotKey)!.push(point)
  }

  // ========================================================================
  // PROCESS EACH POINT INTO KLE KEY
  // ========================================================================

  for (const [rotKey, group] of rotationGroups) {
    for (const point of group) {
      const key = new Key()

      // Get key dimensions from metadata (default to standard sizes if not specified)
      const keyWidth = point.meta.width !== undefined ? point.meta.width : standardWidth
      const keyHeight = point.meta.height !== undefined ? point.meta.height : standardHeight

      // Normalize dimensions to KLE units (standard → 1U, 2x standard → 2U, etc.)
      const width = normalizeWidth(keyWidth)
      const height = normalizeHeight(keyHeight)

      key.width = width
      key.height = height

      // Handle rotation
      if (point.r !== 0) {
        key.rotation_angle = -point.r // Flip rotation direction

        // Get the rotation origin from ergogen's metadata
        // In ergogen, origin is the offset from key center where rotation happens
        let originX = 0
        let originY = 0
        if (point.meta.origin && Array.isArray(point.meta.origin)) {
          originX = point.meta.origin[0] || 0
          originY = point.meta.origin[1] || 0
        }

        // Calculate the absolute rotation origin in ergogen coordinates
        // The rotation happens at (key_position + origin_offset)
        const rotOriginAbsX = point.x + originX
        const rotOriginAbsY = point.y + originY

        // Convert rotation origin to KLE units (using position normalization)
        key.rotation_x = normalizePosition(rotOriginAbsX)
        key.rotation_y = normalizePosition(-rotOriginAbsY) // Flip Y axis

        // Key position is relative to the rotation origin in KLE
        // offset = key_position - rotation_origin
        key.x = normalizePosition(-originX) - (width - 1) / 2
        key.y = normalizePosition(originY) - (height - 1) / 2
      } else {
        // For non-rotated keys, use absolute position
        // Convert positions to KLE units (using position normalization)
        key.x = normalizePosition(point.x) - (width - 1) / 2
        key.y = normalizePosition(-point.y) - (height - 1) / 2 // Flip Y axis
      }

      // Set label if available
      const label = point.meta.label || point.meta.name || point.name || ''
      key.labels[0] = label

      keyboard.keys.push(key)
    }
  }

  // ========================================================================
  // NORMALIZE POSITIONS TO ORIGIN
  // ========================================================================
  // Offset everything so the minimum x and y are at 0
  // This makes the layout start at the origin, which is more intuitive

  if (keyboard.keys.length > 0) {
    // Find minimum x and y across all keys
    let minX = Infinity
    let minY = Infinity

    for (const key of keyboard.keys) {
      // For rotated keys, we need to consider the rotation origin
      const x = key.rotation_angle !== 0 ? key.rotation_x : key.x
      const y = key.rotation_angle !== 0 ? key.rotation_y : key.y

      if (x < minX) minX = x
      if (y < minY) minY = y
    }

    // Offset all keys by the minimum values
    for (const key of keyboard.keys) {
      if (key.rotation_angle !== 0) {
        // For rotated keys, offset only the rotation origin
        // The x, y values are relative to the rotation origin, so leave them alone
        key.rotation_x -= minX
        key.rotation_y -= minY
      } else {
        // For non-rotated keys, offset the position
        key.x -= minX
        key.y -= minY
      }

      // Round all positions to 3 decimal places for cleaner output
      key.x = Math.round(key.x * 1000) / 1000
      key.y = Math.round(key.y * 1000) / 1000
      if (key.rotation_x !== undefined) {
        key.rotation_x = Math.round(key.rotation_x * 1000) / 1000
      }
      if (key.rotation_y !== undefined) {
        key.rotation_y = Math.round(key.rotation_y * 1000) / 1000
      }

      // Round dimensions to 3 decimal places
      if (key.width !== 1) {
        key.width = Math.round(key.width * 1000) / 1000
      }
      if (key.height !== 1) {
        key.height = Math.round(key.height * 1000) / 1000
      }
    }
  }

  // ========================================================================
  // SERIALIZE TO KLE FORMAT
  // ========================================================================

  return Serial.serialize(keyboard)
}
```

---

## Testing Requirements

### Unit Tests

Port these test cases from the adamws/ergogen fork (test/unit/kle.js):

1. **Basic Grid Layouts**
   - 1x1 grid (single key)
   - 2x2 grid
   - 3x3 grid

2. **Custom Key Sizes**
   - 1U keys (standard)
   - 1.5U keys
   - 2U keys (spacebar)

3. **Staggered Columns**
   - Keys with Y-axis offsets

4. **Rotated Keys**
   - Keys with rotation angles
   - Keys with rotation origins

5. **Custom Unit Configurations**
   - Non-standard spacing
   - Non-standard key sizes

6. **Position Normalization**
   - Layouts offset from origin
   - Verify minimum position is (0,0)

### Test Helper Functions

```typescript
// test/ergogen-converter.test.ts

import { describe, it, expect } from 'vitest'
import { ergogenPointsToKLE } from '@/lib/ergogen-converter'
import { Serial } from 'kle-serial2'

/**
 * Parse KLE output to extract absolute key positions
 * KLE uses relative positioning, this converts to absolute for testing
 */
function parseKLEPositions(kleOutput: Array<any>): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  let absoluteY = 0

  for (const row of kleOutput) {
    let absoluteX = 0
    let pendingProps: any = {}

    for (const item of row) {
      if (typeof item === 'object') {
        if (item.x !== undefined) absoluteX += item.x
        if (item.y !== undefined) absoluteY += item.y
        Object.assign(pendingProps, item)
      } else if (typeof item === 'string') {
        if (pendingProps.rx !== undefined) {
          positions[item] = {
            x: pendingProps.rx,
            y: pendingProps.ry || absoluteY
          }
        } else {
          positions[item] = { x: absoluteX, y: absoluteY }
        }
        absoluteX += 1
        pendingProps = {}
      }
    }
    absoluteY += 1
  }

  return positions
}

/**
 * Verify key position matches expected values within tolerance
 */
function verifyKeyPosition(
  kleOutput: Array<any>,
  keyLabel: string,
  expectedX: number,
  expectedY: number,
  tolerance = 0.01
): void {
  const positions = parseKLEPositions(kleOutput)
  const pos = positions[keyLabel]

  expect(pos).toBeDefined()
  expect(Math.abs(pos.x - expectedX)).toBeLessThan(tolerance)
  expect(Math.abs(pos.y - expectedY)).toBeLessThan(tolerance)
}

describe('ergogenPointsToKLE', () => {
  it('converts 2x2 grid correctly', () => {
    const points = {
      col0_r0: { x: 0, y: 0, meta: { width: 18, height: 18, padding: 19 } },
      col1_r0: { x: 19, y: 0, meta: { width: 18, height: 18, padding: 19 } },
      col0_r1: { x: 0, y: -19, meta: { width: 18, height: 18, padding: 19 } },
      col1_r1: { x: 19, y: -19, meta: { width: 18, height: 18, padding: 19 } }
    }

    const kleOutput = ergogenPointsToKLE(points)

    // Verify positions
    verifyKeyPosition(kleOutput, 'col0_r0', 0, 1)
    verifyKeyPosition(kleOutput, 'col1_r0', 1, 1)
    verifyKeyPosition(kleOutput, 'col0_r1', 0, 0)
    verifyKeyPosition(kleOutput, 'col1_r1', 1, 0)
  })

  it('handles 2U keys correctly', () => {
    const points = {
      normal: { x: 0, y: 0, meta: { width: 18, height: 18, padding: 19 } },
      spacebar: { x: 0, y: -19, meta: { width: 36, height: 18, padding: 19 } }
    }

    const kleOutput = ergogenPointsToKLE(points)
    const keyboard = Serial.deserialize(kleOutput)

    const spacebarKey = keyboard.keys.find(k => k.labels[0] === 'spacebar')
    expect(spacebarKey?.width).toBe(2)
  })

  // Add more tests for rotation, stagger, custom units, etc.
})
```

### Integration Test

```typescript
import ergogen from 'ergogen'
import { ergogenPointsToKLE } from '@/lib/ergogen-converter'

it('full integration: YAML → Points → KLE', () => {
  const ergogenConfig = {
    points: {
      zones: {
        matrix: {
          columns: {
            outer: { key: {} },
            inner: { key: {} }
          },
          rows: {
            bottom: { key: {} },
            top: { key: {} }
          }
        }
      }
    }
  }

  // Process with ergogen
  const results = ergogen.process(ergogenConfig)
  expect(results.points).toBeDefined()

  // Convert to KLE
  const kleOutput = ergogenPointsToKLE(results.points)
  expect(Array.isArray(kleOutput)).toBe(true)
  expect(kleOutput.length).toBeGreaterThan(0)

  // Verify can deserialize
  const keyboard = Serial.deserialize(kleOutput)
  expect(keyboard.keys.length).toBe(4)
})
```

---

## Integration Example

### Complete Usage Example

```typescript
// Example: Import ergogen config and display in kle-ng

import ergogen from 'ergogen'
import { ergogenPointsToKLE } from '@/lib/ergogen-converter'
import { Serial } from 'kle-serial2'

const ergogenYAML = `
points:
  zones:
    matrix:
      columns:
        pinky:
          key:
            splay: -5
        ring:
          key:
            stagger: 0.5u
        middle:
          key: {}
        index:
          key:
            stagger: -0.25u
      rows:
        bottom:
          key: {}
        home:
          key: {}
        top:
          key: {}
`

async function importErgogenLayout() {
  // 1. Parse YAML (use js-yaml or ergogen's parser)
  const config = parseYAML(ergogenYAML)

  // 2. Process with ergogen to generate points
  const results = ergogen.process(config)

  if (!results.points) {
    throw new Error('No points generated')
  }

  // 3. Convert to KLE
  const kleLayout = ergogenPointsToKLE(results.points)

  // 4. Deserialize and use
  const keyboard = Serial.deserialize(kleLayout)
  console.log(`Imported ${keyboard.keys.length} keys`)

  // 5. Display in kle-ng (use your existing keyboard loading logic)
  loadKeyboard(keyboard)
}
```

---

## Troubleshooting

### Issue 1: Dependency Override Not Working

**Symptom:**
```
Error: Cannot find module 'kle-serial'
```

**Diagnosis:**
```bash
npm ls kle-serial
# Should show kle-serial2, not the original kle-serial
```

**Solutions:**

1. **Check npm version** (overrides require npm 8.3.0+):
   ```bash
   npm --version
   # Upgrade if needed: npm install -g npm@latest
   ```

2. **Try alternative override syntax:**
   ```json
   {
     "overrides": {
       "kle-serial": "npm:kle-serial2@github:adamws/kle-serial2"
     }
   }
   ```

3. **Clear cache and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Use patch-package as last resort:**
   ```bash
   npm install patch-package
   # Manually edit ergogen's package.json in node_modules
   npx patch-package ergogen
   ```

### Issue 2: TypeScript Type Errors

**Symptom:**
```
Property 'rotation_x' does not exist on type 'Key'
```

**Solution:**

Ensure kle-serial2 types are loaded:

```typescript
// If types are missing, declare them
declare module 'kle-serial2' {
  export class Key {
    x: number
    y: number
    width: number
    height: number
    rotation_x: number
    rotation_y: number
    rotation_angle: number
    labels: string[]
    // ... other properties
  }

  export class Keyboard {
    keys: Key[]
    meta: any
  }

  export namespace Serial {
    function deserialize(rows: Array<any>): Keyboard
    function serialize(kbd: Keyboard): Array<any>
  }
}
```

### Issue 3: Position Mismatch

**Symptom:**
Keys appear in wrong positions after import

**Diagnosis:**
- Check unit detection is working correctly
- Verify Y-axis flip is applied
- Test with simple layouts first (2x2 grid)

**Solution:**
Add logging to conversion:

```typescript
console.log('Detected units:', { spacingUnit, standardWidth, standardHeight })
console.log('Point positions before:', points)
console.log('Key positions after:', keyboard.keys.map(k => ({ x: k.x, y: k.y })))
```

### Issue 4: Ergogen Processing Fails

**Symptom:**
```
Error in ergogen.process()
```

**Solutions:**

1. **Validate YAML syntax:**
   ```typescript
   import yaml from 'js-yaml'

   try {
     const parsed = yaml.load(yamlText)
   } catch (err) {
     console.error('Invalid YAML:', err)
   }
   ```

2. **Check ergogen config structure:**
   ```typescript
   if (!config.points) {
     throw new Error('Config must have "points" section')
   }
   ```

3. **Handle ergogen errors:**
   ```typescript
   try {
     const results = ergogen.process(config)
   } catch (err) {
     console.error('Ergogen processing error:', err)
     // Show user-friendly error message
   }
   ```

---

## Success Criteria

✅ Dependency override works (`npm ls kle-serial` shows kle-serial2)
✅ Can import simple ergogen YAML (2x2 grid)
✅ Key positions match expected values
✅ Rotated keys work correctly
✅ Custom unit configurations handled
✅ All unit tests pass
✅ UI allows pasting YAML and importing
✅ Error handling for invalid configs
✅ Documentation complete

---

## Additional Resources

- **Ergogen Documentation:** https://docs.ergogen.xyz/
- **KLE Format Spec:** http://www.keyboard-layout-editor.com/
- **kle-serial2 Repository:** https://github.com/adamws/kle-serial2
- **Original Ergogen:** https://github.com/ergogen/ergogen

---

## Contact / Questions

If you encounter issues not covered here, check:
1. The source repository that created this: `github:adamws/ergogen`
2. The conversion tests: `test/unit/kle.js` in that repository
3. The implementation reference: `src/kle.js` in that repository

---

**Document Version:** 1.0
**Created:** 2025-11-14
**Source:** adamws/ergogen fork (claude/migrate-erogen-kle-serial2-*)
**License:** Same as ergogen (MIT)
