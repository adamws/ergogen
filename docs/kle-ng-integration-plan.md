# kle-ng Integration Plan: Import Ergogen Feature

## Executive Summary

This document outlines the architecture and implementation strategy for adding "Import Ergogen" functionality to kle-ng, a Vue.js-based keyboard layout editor. The primary challenge is managing the kle-serial dependency conflict between ergogen (which uses kle-serial2) and kle-ng (which uses the original kle-serial).

## Current Architecture

### Ergogen (this repository)
- **Language**: JavaScript (Node.js)
- **Build**: Rollup → UMD bundle
- **KLE Library**: kle-serial2 (fork by @adamws)
- **Conversion**: Bidirectional (KLE ↔ Ergogen)
- **Entry Points**:
  - `kle.convert(kleJson)` - KLE → Ergogen
  - `kle.serialize(points)` - Ergogen → KLE
  - CLI: `--to-kle` flag

### kle-ng (target application)
- **Language**: TypeScript + Vue.js
- **Build**: Vite
- **KLE Library**: kle-serial (original version, assumed)
- **Environment**: Browser-only (SPA)
- **Architecture**: Modern Vue 3 with Composition API (likely)

## Dependency Conflict Analysis

### The Problem

Both applications use different forks of kle-serial:

```
ergogen                      kle-ng
   ├── kle-serial2              ├── kle-serial
   │   (@adamws fork)           │   (original)
   │                            │
   └── Uses: Key, Keyboard,     └── Uses: Key, Keyboard,
       Serial classes               Serial classes (same API?)
```

### Why This Matters

1. **Type Incompatibility**: If both versions are loaded, TypeScript may reject objects created by one library when passed to the other
2. **Bundle Size**: Including both libraries duplicates code (~50-100KB)
3. **Version Drift**: kle-serial2 may have features or bug fixes not in original
4. **Maintenance Burden**: Need to track two dependencies

## Integration Options

### Option A: Standalone Conversion Package ⭐ RECOMMENDED

**Architecture:**
```
@adamws/ergogen-kle-converter (new package)
    ├── No kle-serial dependency
    ├── Pure conversion logic
    └── Types: ErgogenPoint[] → KLELayoutData

ergogen                      kle-ng
   ├── kle-serial2              ├── kle-serial
   ├── Uses converter           ├── Uses converter
   └── Wraps with serialize     └── Wraps with deserialize
```

**Implementation:**
1. Extract conversion logic from `src/kle.js`
2. Remove kle-serial2 dependency from converter
3. Work with plain JavaScript objects (not Key/Keyboard classes)
4. Both ergogen and kle-ng use converter + their own kle-serial

**Pros:**
- ✅ No dependency conflict - each app uses its own kle-serial
- ✅ Smaller bundle size (converter is pure logic, ~10KB)
- ✅ Type-safe - converter uses plain objects
- ✅ Easy to test - no library dependencies
- ✅ Reusable - other projects can use it

**Cons:**
- ❌ Requires new package maintenance
- ❌ Conversion logic duplicated (but small cost)
- ❌ Need to refactor ergogen's kle.js

**Estimated Effort**: 2-3 days

---

### Option B: Use kle-serial2 in kle-ng

**Architecture:**
```
ergogen                      kle-ng
   ├── kle-serial2              ├── kle-serial2 (migrated)
   └── kle.serialize()          └── kle.deserialize() + serialize()
```

**Implementation:**
1. Replace kle-serial with kle-serial2 in kle-ng
2. Import ergogen as npm dependency
3. Call `ergogen.kle.serialize(points)` from Vue component

**Pros:**
- ✅ Single kle-serial version across both projects
- ✅ Can directly use ergogen library
- ✅ Simpler architecture

**Cons:**
- ❌ Breaking change for kle-ng (if API differs)
- ❌ Couples kle-ng to ergogen's fork choice
- ❌ Larger bundle size (entire ergogen + dependencies)
- ❌ May require kle-ng changes if API incompatible

**Estimated Effort**: 1-2 days (+ testing kle-ng compatibility)

---

### Option C: Ergogen as Web Service

**Architecture:**
```
ergogen-api (new service)        kle-ng (client)
   ├── Express/Fastify              ├── Fetch API
   └── POST /convert                └── HTTP calls
       Input: ergogen YAML
       Output: KLE JSON
```

**Implementation:**
1. Create lightweight Express API wrapper around ergogen
2. Deploy to cloud function (Vercel, Netlify, AWS Lambda)
3. kle-ng makes HTTP requests for conversion

**Pros:**
- ✅ Zero dependency conflicts - separate processes
- ✅ No ergogen code in kle-ng bundle
- ✅ Can update ergogen independently
- ✅ Could add rate limiting, validation, etc.

**Cons:**
- ❌ Requires network connection (offline won't work)
- ❌ Latency for conversion
- ❌ Infrastructure cost/maintenance
- ❌ Privacy concerns (users may not want to upload configs)

**Estimated Effort**: 2-3 days (+ infrastructure setup)

---

### Option D: Browser-Based Ergogen Bundle

**Architecture:**
```
ergogen-browser.js (new UMD bundle)
    ├── Ergogen core + kle.serialize
    ├── Self-contained (no external deps)
    └── Global: window.Ergogen

kle-ng
    ├── kle-serial (keep existing)
    ├── <script src="ergogen-browser.js">
    └── window.Ergogen.process() + serialize()
```

**Implementation:**
1. Create ergogen browser bundle with inlined dependencies
2. Use different global namespace (avoid kle-serial conflict)
3. Load via script tag or dynamic import
4. Convert in browser, pass plain JSON between libraries

**Pros:**
- ✅ Works offline
- ✅ No kle-ng dependency changes needed
- ✅ Isolates ergogen in separate bundle
- ✅ Can lazy-load ergogen only when needed

**Cons:**
- ❌ Large bundle size (~500KB+ with all deps)
- ❌ Still potential for global conflicts
- ❌ Need to build/maintain separate bundle
- ❌ Manual coordination between versions

**Estimated Effort**: 2 days

---

## Recommendation: Option A (Standalone Converter)

### Why Option A is Best

1. **Clean Separation**: Conversion logic is independent of serialization libraries
2. **Type Safety**: Works with plain TypeScript interfaces
3. **Performance**: Smallest bundle impact (~10KB converter vs ~500KB ergogen)
4. **Flexibility**: Both projects can evolve independently
5. **Testability**: Pure functions, easy to unit test

### Implementation Plan

#### Phase 1: Extract Converter Package (Week 1)

Create `@adamws/ergogen-kle-converter`:

```typescript
// packages/ergogen-kle-converter/src/index.ts

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

export interface KLEKey {
  x: number
  y: number
  width?: number
  height?: number
  rotation_angle?: number
  rotation_x?: number
  rotation_y?: number
  label: string
}

export interface ConversionOptions {
  spacingUnit?: number
  standardWidth?: number
  standardHeight?: number
}

/**
 * Convert ergogen points to KLE key objects
 * Returns plain JS objects, not kle-serial Key instances
 */
export function ergogenToKLE(
  points: Record<string, ErgogenPoint>,
  options?: ConversionOptions
): KLEKey[] {
  // Extracted logic from src/kle.js serialize()
  // Works with plain objects only
  // Returns array of key objects ready for kle.Serial.serialize()
}

/**
 * Auto-detect ergogen unit system from point data
 */
export function detectUnits(
  points: Record<string, ErgogenPoint>
): ConversionOptions {
  // Extract unit detection logic
}
```

**Package structure:**
```
packages/ergogen-kle-converter/
├── src/
│   ├── index.ts              (main exports)
│   ├── converter.ts          (conversion logic)
│   ├── units.ts              (unit detection)
│   └── types.ts              (TypeScript interfaces)
├── test/
│   └── converter.test.ts     (unit tests)
├── package.json
├── tsconfig.json
└── README.md
```

#### Phase 2: Integrate into Ergogen (Week 1-2)

Refactor `src/kle.js`:

```javascript
// src/kle.js
const kle = require('kle-serial2')
const converter = require('@adamws/ergogen-kle-converter')

exports.serialize = (points, logger) => {
  // Use converter to get plain key objects
  const keyObjects = converter.ergogenToKLE(points)

  // Wrap in kle-serial2 classes for serialization
  const keyboard = new kle.Keyboard()
  for (const keyObj of keyObjects) {
    const key = new kle.Key()
    Object.assign(key, keyObj)
    keyboard.keys.push(key)
  }

  return kle.Serial.serialize(keyboard)
}
```

**Migration checklist:**
- [ ] Extract unit detection to converter
- [ ] Extract position normalization to converter
- [ ] Extract rotation handling to converter
- [ ] Update tests to use converter
- [ ] Verify all tests pass
- [ ] Update documentation

#### Phase 3: Integrate into kle-ng (Week 2)

Create Vue composable for ergogen import:

```typescript
// src/composables/useErgogenImport.ts
import { ergogenToKLE, detectUnits } from '@adamws/ergogen-kle-converter'
import { Serial, Keyboard, Key } from 'kle-serial' // kle-ng's existing dep
import type { ErgogenPoint } from '@adamws/ergogen-kle-converter'

export function useErgogenImport() {
  /**
   * Parse ergogen YAML/JSON config
   */
  async function parseErgogenConfig(configText: string): Promise<Record<string, ErgogenPoint>> {
    // Use js-yaml to parse (kle-ng likely already has this)
    const config = yaml.load(configText)

    // Run ergogen's point generation
    // Option 1: Bundle minimal ergogen (just points.js)
    // Option 2: Parse pre-generated points from config

    // For MVP, assume user provides processed points
    return config.points
  }

  /**
   * Import ergogen config and convert to KLE keyboard
   */
  async function importErgogen(configText: string): Promise<Keyboard> {
    // Get ergogen points
    const points = await parseErgogenConfig(configText)

    // Convert using standalone converter
    const keyObjects = ergogenToKLE(points)

    // Create kle-serial Keyboard (kle-ng's version)
    const keyboard = new Keyboard()
    for (const keyObj of keyObjects) {
      const key = new Key()
      Object.assign(key, keyObj)
      keyboard.keys.push(key)
    }

    return keyboard
  }

  return {
    importErgogen
  }
}
```

**UI Component:**

```vue
<!-- src/components/ImportErgogenDialog.vue -->
<template>
  <Dialog v-model="isOpen">
    <DialogTitle>Import Ergogen Configuration</DialogTitle>

    <textarea
      v-model="configText"
      placeholder="Paste your ergogen config (YAML or JSON)"
      rows="20"
    />

    <Button @click="handleImport">Import</Button>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useErgogenImport } from '@/composables/useErgogenImport'
import { useKeyboardStore } from '@/stores/keyboard' // kle-ng's state

const { importErgogen } = useErgogenImport()
const keyboardStore = useKeyboardStore()

const isOpen = ref(false)
const configText = ref('')

async function handleImport() {
  try {
    const keyboard = await importErgogen(configText.value)
    keyboardStore.loadKeyboard(keyboard)
    isOpen.value = false
  } catch (error) {
    console.error('Import failed:', error)
    // Show error toast
  }
}
</script>
```

**Menu integration:**

```typescript
// Add to main menu
{
  label: 'Import',
  items: [
    { label: 'From KLE Raw Data...', action: 'import:kle' },
    { label: 'From Ergogen Config...', action: 'import:ergogen' }, // NEW
    { label: 'From JSON File...', action: 'import:json' }
  ]
}
```

#### Phase 4: Testing & Documentation (Week 3)

**Test coverage:**
- [ ] Unit tests for converter package (90%+ coverage)
- [ ] Integration tests in ergogen (existing + new)
- [ ] E2E tests in kle-ng (Playwright)
- [ ] Test cases:
  - [ ] Basic grid layouts
  - [ ] Custom key sizes
  - [ ] Rotated keys
  - [ ] Staggered columns
  - [ ] Custom unit configurations
  - [ ] Edge cases (empty, single key, etc.)

**Documentation:**
- [ ] Converter package README with API docs
- [ ] Ergogen docs update (migration guide)
- [ ] kle-ng user guide (how to import ergogen)
- [ ] Example configs in both repos

## Alternative: Quick Prototype (Option B)

If time is critical and kle-serial2 is API-compatible with kle-serial:

### Week 1: Quick Integration

1. **Test kle-serial2 compatibility with kle-ng:**
   ```bash
   cd kle-ng
   npm install kle-serial2
   # Run tests, check if anything breaks
   ```

2. **If compatible, bundle ergogen's kle.js:**
   ```typescript
   // kle-ng/src/lib/ergogen-converter.ts
   // Copy-paste kle.serialize() from ergogen
   import { Keyboard, Key, Serial } from 'kle-serial2'

   export function convertErgogenToKLE(points) {
     // ... full implementation from ergogen/src/kle.js
   }
   ```

3. **Add UI integration (same as Phase 3 above)**

**Risks:**
- Code duplication (kle.js copied to kle-ng)
- Must manually sync updates
- Potential bundle size increase

**When to use:**
- Need working prototype ASAP (< 1 week)
- Can refactor to Option A later
- Testing feasibility before full implementation

## Decision Matrix

| Criteria | Option A | Option B | Option C | Option D |
|----------|----------|----------|----------|----------|
| Bundle Size | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| Offline Support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Maintenance | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Type Safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Implementation Speed | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Flexibility | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Total** | **27/30** | **21/30** | **23/30** | **21/30** |

## Conclusion

**Primary Recommendation**: Option A (Standalone Converter Package)
- Best long-term solution
- Cleanest architecture
- Minimal dependency conflicts

**Fallback**: Option B (Quick Prototype)
- If need immediate results
- Can migrate to Option A later

**Not Recommended**:
- Option C - Offline support is critical for keyboard design tools
- Option D - Bundle size and maintenance concerns

## Next Steps

1. **Validate kle-serial API compatibility**
   - Compare kle-serial vs kle-serial2 APIs
   - Identify any breaking changes
   - Document differences

2. **Create proof-of-concept**
   - Implement minimal converter (Option A)
   - Test with 2-3 ergogen configs
   - Verify KLE output matches ergogen

3. **Get stakeholder approval**
   - Review this document
   - Choose implementation option
   - Confirm timeline and resources

4. **Begin implementation** (if approved)
   - Follow phased approach above
   - Set up CI/CD for new package
   - Coordinate releases

---

**Document Status**: Draft for Review
**Created**: 2025-11-14
**Author**: Claude (AI Assistant)
**Review Required**: @adamws
