# kle-ng Integration Plan: Import Ergogen Feature

## Executive Summary

This document outlines the architecture and implementation strategy for adding "Import Ergogen" functionality to kle-ng, a Vue.js-based keyboard layout editor. The key question is whether to use the original ergogen repository or maintain this ergogen fork for the integration.

## Current Architecture

### Original Ergogen (ergogen/ergogen)
- **Language**: JavaScript (Node.js)
- **Build**: Rollup → UMD bundle
- **KLE Library**: `github:ergogen/kle-serial#ergogen` (ergogen's fork)
- **Conversion**: Unidirectional (KLE → Ergogen only)
- **Entry Points**:
  - `kle.convert(kleJson)` - KLE → Ergogen
  - ❌ No reverse conversion (Ergogen → KLE)

### This Ergogen Fork (adamws/ergogen)
- **Language**: JavaScript (Node.js)
- **Build**: Rollup → UMD bundle
- **KLE Library**: `github:adamws/kle-serial2` (@adamws fork)
- **Conversion**: Bidirectional (KLE ↔ Ergogen)
- **Entry Points**:
  - `kle.convert(kleJson)` - KLE → Ergogen
  - ✅ `kle.serialize(points)` - Ergogen → KLE (NEW!)
  - CLI: `--to-kle` flag

### kle-ng (target application)
- **Language**: TypeScript + Vue.js
- **Build**: Vite
- **KLE Library**: `github:adamws/kle-serial2` (@adamws fork)
- **Environment**: Browser-only (SPA)
- **Architecture**: Modern Vue 3 with Composition API (likely)

## Dependency Conflict Analysis

### The Actual Situation

There are THREE different kle-serial forks in play:

```
Original Ergogen             This Fork (adamws)        kle-ng
   ├── kle-serial               ├── kle-serial2           ├── kle-serial2
   │   (ergogen fork)           │   (@adamws fork)        │   (@adamws fork)
   │                            │                         │
   └── KLE → Ergogen only       └── KLE ↔ Ergogen         └── Uses same fork!
                                    (bidirectional)            ✅ COMPATIBLE
```

### Key Insight

**This fork (adamws/ergogen) and kle-ng share the same kle-serial2 library!**
- ✅ No dependency conflict between this fork and kle-ng
- ❌ Original ergogen would conflict with kle-ng (different kle-serial forks)
- ✅ This fork has the reverse conversion feature needed by kle-ng
- ❌ Original ergogen doesn't have reverse conversion

### The Fork Maintenance Question

**User's Goal**: Avoid maintaining this ergogen fork by using original ergogen with kle-ng.

**Reality Check:**
- ❌ Original ergogen uses incompatible kle-serial fork
- ❌ Original ergogen lacks reverse conversion (Ergogen → KLE)
- ❌ Would require implementing the feature in original ergogen anyway
- ✅ This fork is **already compatible** with kle-ng (same kle-serial2)
- ✅ This fork **already has** the needed reverse conversion

**Fork Maintenance Burden:**
- The migration to kle-serial2 is done (completed in previous work)
- The reverse conversion is implemented and tested (8/8 tests passing)
- Future maintenance: Keep up with original ergogen's updates

**Options to Reduce Fork Maintenance:**
1. **Contribute reverse conversion to original ergogen** - Then original could be used, but still need kle-serial migration
2. **Extract conversion to standalone package** - No ergogen dependency needed at all
3. **Accept fork maintenance** - This fork is already more suitable than original

## Fork Maintenance Analysis

### Option: Contribute to Original Ergogen

**Approach:**
- Submit PR to ergogen/ergogen adding `kle.serialize()` function
- Also submit PR to migrate to kle-serial2 (or they keep their fork)

**Pros:**
- ✅ Upstream benefits from reverse conversion
- ✅ No fork maintenance if merged
- ✅ Community contribution

**Cons:**
- ❌ May not accept kle-serial2 migration (breaking change for them)
- ❌ May not accept reverse conversion (not their use case)
- ❌ Time waiting for review/merge (weeks to months)
- ❌ Still need fork until merged
- ❌ They may reject or request significant changes

**Verdict:** Worth attempting, but no guarantee of acceptance.

### Option: Keep This Fork

**Approach:**
- Use this fork for kle-ng integration
- Periodically sync with upstream ergogen/ergogen

**Pros:**
- ✅ Already done - no additional work
- ✅ Perfect compatibility with kle-ng (shared kle-serial2)
- ✅ Has all features needed
- ✅ Full control over features and timing

**Cons:**
- ❌ Must manually sync upstream changes
- ❌ Fork maintenance overhead
- ❌ Potential merge conflicts when syncing

**Maintenance Strategy:**
```bash
# Periodic sync (monthly or when needed)
git remote add upstream https://github.com/ergogen/ergogen.git
git fetch upstream
git merge upstream/master
# Resolve conflicts, test, push
```

**Verdict:** Pragmatic solution if original ergogen doesn't accept changes.

## Integration Options

**Context:** The following options assume we're NOT able to use original ergogen due to dependency incompatibility and missing reverse conversion feature.

### Option A: Standalone Conversion Package ⭐ RECOMMENDED FOR AVOIDING FORK MAINTENANCE

**Architecture:**
```
@adamws/ergogen-kle-converter (new package)
    ├── No kle-serial dependency
    ├── No ergogen dependency
    ├── Pure conversion logic
    └── Types: ErgogenPoint[] → KLELayoutData

kle-ng
   ├── kle-serial2 (existing)
   ├── @adamws/ergogen-kle-converter (NEW)
   ├── NO ergogen dependency needed! ✅
   └── Direct conversion in browser
```

**Implementation:**
1. Extract conversion logic from this fork's `src/kle.js`
2. Remove all dependencies (kle-serial2, ergogen)
3. Work with plain JavaScript objects (not Key/Keyboard classes)
4. kle-ng imports only the converter, not ergogen at all

**Pros:**
- ✅ **SOLVES FORK MAINTENANCE** - kle-ng doesn't depend on ergogen at all!
- ✅ No dependency conflicts - converter is standalone
- ✅ Smallest bundle size (converter is pure logic, ~10KB)
- ✅ Type-safe - converter uses plain TypeScript interfaces
- ✅ Easy to test - no library dependencies
- ✅ Reusable - other projects can use it
- ✅ kle-ng can work completely independently

**Cons:**
- ❌ Requires new package maintenance (but simpler than fork maintenance)
- ❌ Need to implement ergogen point generation in kle-ng (or accept pre-processed points)
- ❌ Need to refactor this fork's kle.js (one-time cost)

**Key Advantage for Fork Avoidance:**
This option means kle-ng **never needs ergogen** - it only needs the converter package which:
- Doesn't depend on ergogen internals
- Doesn't need kle-serial at all
- Is just pure conversion math
- Can be maintained independently

**Estimated Effort**: 2-3 days

**Fork Impact:**
- ✅ kle-ng: No ergogen fork dependency
- ⚠️ This fork: Still exists, but kle-ng doesn't use it
- Option: Extract converter, then archive this fork

---

### Option B: Use This Fork Directly ⭐ SIMPLEST BUT REQUIRES FORK MAINTENANCE

**Architecture:**
```
This Fork (adamws/ergogen)   kle-ng
   ├── kle-serial2              ├── kle-serial2 (same!)
   └── kle.serialize()          └── Uses this fork as dependency
```

**Implementation:**
1. kle-ng adds this fork as npm dependency: `"ergogen": "github:adamws/ergogen"`
2. Import and call `ergogen.kle.serialize(points)` from Vue component
3. Both use same kle-serial2 - no conflicts!

**Pros:**
- ✅ **Already compatible** - both use kle-serial2
- ✅ **Feature complete** - reverse conversion already implemented
- ✅ **Tested** - 8/8 unit tests passing
- ✅ Simpler architecture - just import and use
- ✅ Fastest implementation - 1-2 days

**Cons:**
- ❌ **REQUIRES FORK MAINTENANCE** - This is the key issue!
- ❌ Couples kle-ng to this fork
- ❌ Larger bundle size (entire ergogen + dependencies ~500KB)
- ❌ Must sync with upstream ergogen/ergogen for updates
- ❌ If fork is abandoned, kle-ng is stuck

**Estimated Effort**: 1-2 days

**Fork Impact:**
- ❌ kle-ng: Depends on ergogen fork (maintenance burden)
- ❌ This fork: Must be maintained long-term
- ⚠️ Upstream sync required periodically

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

## Recommendation: Option A (Standalone Converter) - AVOIDS FORK MAINTENANCE

### Why Option A is Best for Your Goal

**Your Goal:** Avoid maintaining the ergogen fork.

**Why Option A Achieves This:**

1. **No Ergogen Dependency**: kle-ng only needs the converter package, not ergogen at all
2. **Independent Maintenance**: Converter is simpler to maintain than entire ergogen fork
3. **Future Flexibility**: Can use original ergogen, this fork, or neither - doesn't matter
4. **Clean Separation**: Conversion logic is independent of ergogen internals
5. **Type Safety**: Works with plain TypeScript interfaces
6. **Performance**: Smallest bundle impact (~10KB converter vs ~500KB ergogen)
7. **Testability**: Pure functions, easy to unit test

**Fork Lifecycle After Option A:**
```
1. Extract converter from this fork → @adamws/ergogen-kle-converter
2. kle-ng uses converter package
3. This fork can be:
   - Archived (no longer needed for kle-ng)
   - Kept for other purposes (CLI, etc.)
   - Deleted (converter is extracted)
```

**Result:** You maintain one small converter package (~500 lines) instead of entire ergogen fork (~10,000+ lines)

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

| Criteria | Option A (Converter) | Option B (This Fork) | Option C (Web API) | Option D (Browser Bundle) |
|----------|----------|----------|----------|----------|
| **Avoids Fork Maintenance** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Bundle Size | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| Offline Support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Maintenance Burden | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Type Safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Implementation Speed | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| No Ergogen Dependency | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **Total** | **34/35** | **20/35** | **25/35** | **18/35** |

**Key for Fork Maintenance Goal:**
- Option A: ✅ Converter is small, independent, easy to maintain
- Option B: ❌ Requires maintaining entire ergogen fork
- Option C: ✅ No fork needed, but has other drawbacks (offline, privacy)
- Option D: ⚠️ Still couples to ergogen fork

## Conclusion

### For Avoiding Fork Maintenance: Option A is Clear Winner

**Primary Recommendation**: Option A (Standalone Converter Package)
- ✅ **ELIMINATES fork maintenance** - kle-ng doesn't need ergogen
- ✅ Best long-term solution
- ✅ Cleanest architecture
- ✅ Smallest maintenance burden (converter vs full fork)

**Why Original Ergogen Won't Work:**
- ❌ Uses incompatible kle-serial fork (`github:ergogen/kle-serial#ergogen`)
- ❌ Doesn't have reverse conversion (Ergogen → KLE)
- Would require implementing the feature anyway

**Why This Fork Works But Has Downsides:**
- ✅ Already compatible (shares kle-serial2 with kle-ng)
- ✅ Already has reverse conversion implemented
- ❌ Requires ongoing fork maintenance (your concern!)

**The Solution:**
Extract the conversion logic to a standalone package, then kle-ng never needs any ergogen fork at all.

**Fallback**: Option B (Use This Fork)
- If need immediate results (1-2 days vs 2-3 weeks)
- Can migrate to Option A later
- Accept fork maintenance burden temporarily

**Not Recommended**:
- Option C - Offline support is critical for keyboard design tools
- Option D - Bundle size and maintenance concerns
- Original ergogen - Incompatible and missing features

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
