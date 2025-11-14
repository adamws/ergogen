# kle-ng Integration: Quick Reference

## The Problem

You want to add "Import Ergogen" functionality to kle-ng while **avoiding ergogen fork maintenance**.

**Current Situation:**
- **Original ergogen** uses `github:ergogen/kle-serial#ergogen` ❌ Incompatible with kle-ng
- **This ergogen fork** uses `github:adamws/kle-serial2` ✅ Compatible with kle-ng
- **kle-ng** uses `github:adamws/kle-serial2` ✅ Same library!

**Why Not Use Original Ergogen?**
- ❌ Different kle-serial fork (dependency conflict)
- ❌ No reverse conversion (Ergogen → KLE) - it's missing!
- ❌ Would need to implement the feature anyway

**Why This Fork Works But...**
- ✅ Already compatible (shares kle-serial2 with kle-ng)
- ✅ Already has reverse conversion implemented and tested
- ❌ **Requires maintaining the fork** (your concern!)

**Your Goal:** Avoid maintaining this ergogen fork entirely.

## Recommended Solution: Standalone Converter Package ⭐

### Create `@adamws/ergogen-kle-converter`

A lightweight npm package (~10KB) that converts ergogen points to KLE format **without** depending on ergogen or kle-serial.

```typescript
import { ergogenToKLE } from '@adamws/ergogen-kle-converter'

// Returns plain JS objects, not kle-serial classes
const keyObjects = ergogenToKLE(ergogenPoints)

// kle-ng wraps with its own kle-serial2:
const keyboard = new Keyboard()
for (const keyObj of keyObjects) {
  keyboard.keys.push(new Key(keyObj))
}
```

### Why This ELIMINATES Fork Maintenance

1. **kle-ng never needs ergogen!** - Only needs the converter package
2. **Converter is independent** - No ergogen dependency, no kle-serial dependency
3. **Simple to maintain** - ~500 lines of pure conversion logic vs ~10,000+ lines of ergogen
4. **After extraction** - This fork can be archived/deleted, no longer needed for kle-ng

### Why This Works

1. **No Conflicts**: Converter uses plain objects, kle-ng uses its own kle-serial2
2. **Tiny Bundle**: Only conversion logic (~10KB), not entire ergogen (~500KB)
3. **Type Safe**: TypeScript interfaces for all data structures
4. **Reusable**: Other projects can use it too
5. **No Fork Dependency**: kle-ng is completely independent

### Architecture

```
┌─────────────────────────────────┐
│ @adamws/ergogen-kle-converter   │
│                                 │
│  ✓ No ergogen dependency        │
│  ✓ No kle-serial dependency     │
│  ✓ Pure TypeScript              │
│  ✓ ~10KB minified               │
└─────────────────────────────────┘
                  │
                  │ Used by kle-ng
                  ▼
          ┌───────────────┐
          │  kle-ng       │
          │               │
          │  kle-serial2  │
          │  converter ✓  │
          │               │
          │  NO ergogen   │
          │  dependency!  │
          └───────────────┘

After extraction, this fork is no longer needed for kle-ng!
```

## Implementation Timeline

### Week 1: Create Converter Package
- Extract conversion logic from `ergogen/src/kle.js`
- Remove kle-serial2 dependency
- Add TypeScript types
- Write unit tests
- Publish to npm

### Week 2: Integrate into Both Projects

**ergogen:**
```javascript
const converter = require('@adamws/ergogen-kle-converter')
const kle = require('kle-serial2')

exports.serialize = (points) => {
  const keyObjects = converter.ergogenToKLE(points)
  // Wrap in kle-serial2 classes...
  return kle.Serial.serialize(keyboard)
}
```

**kle-ng:**
```typescript
import { ergogenToKLE } from '@adamws/ergogen-kle-converter'
import { Keyboard, Key } from 'kle-serial'

function importErgogen(configText: string) {
  const points = parseErgogenConfig(configText)
  const keyObjects = ergogenToKLE(points)
  // Wrap in kle-serial classes...
  return keyboard
}
```

### Week 3: Testing & Documentation
- Unit tests for converter (90%+ coverage)
- Integration tests in both projects
- E2E tests in kle-ng
- User documentation

## Quick Prototype Alternative (Still Requires Fork Maintenance!)

If you need something working **this week** to test feasibility:

### Option 1: Use This Fork Directly
1. **Add dependency** to kle-ng: `"ergogen": "github:adamws/ergogen"`
2. **Import** and use: `import { kle } from 'ergogen'`
3. **Call** `kle.serialize(points)` from Vue component

**Trade-offs:**
- ✅ Fastest (1-2 days)
- ✅ Already tested (8/8 tests passing)
- ✅ No dependency conflicts (both use kle-serial2)
- ❌ **Still requires fork maintenance!**
- ❌ Large bundle (~500KB)

### Option 2: Copy Code
1. **Copy** `src/kle.js` to `kle-ng/src/lib/ergogen-converter.ts`
2. **Keep** kle-serial2 dependency
3. **Add** import dialog UI

**Trade-offs:**
- ✅ Fast (2-3 days)
- ❌ Code duplication
- ❌ Must manually sync updates
- ❌ **Still coupled to this fork's code**

**Important:** Both prototype options still tie kle-ng to this fork. Only the standalone converter (Option A) eliminates fork maintenance.

## Other Options Considered

### ❌ Option: Web Service API
Convert ergogen configs via HTTP endpoint.

**Why Not:**
- Requires internet connection (offline won't work)
- Privacy concerns (users upload configs to server)
- Latency

### ❌ Option: Bundle All of Ergogen
Include entire ergogen library in kle-ng.

**Why Not:**
- Huge bundle size (~500KB+ with all dependencies)
- Still need to manage kle-serial conflict
- Unnecessary (kle-ng only needs conversion, not full ergogen)

## Decision

### To Avoid Fork Maintenance: Choose Option A

**For Your Goal (No Fork Maintenance):**
- ✅ **Standalone Converter Package** (Option A) - ONLY option that eliminates fork dependency
  - kle-ng never needs ergogen
  - Maintain ~500 lines instead of ~10,000+
  - This fork can be archived after extraction

**For Quick Testing:**
- ⚠️ **Use This Fork Directly** - Fast (1-2 days) but still requires fork maintenance
  - Test if integration works
  - Migrate to Option A later

**Timeline:**
- Prototype (using this fork): 1-2 days ⚠️ Still needs fork maintenance
- Production (standalone converter): 2-3 weeks ✅ **Eliminates fork maintenance**

**Fork Lifecycle:**
```
Now: Maintain this ergogen fork
  ↓
Extract converter package
  ↓
kle-ng uses only converter
  ↓
This fork no longer needed for kle-ng ✅
  ↓
Optional: Archive or delete this fork
```

## Next Actions

1. **Review** the full plan: `docs/kle-ng-integration-plan.md`
2. **Decide** on implementation approach
3. **Validate** kle-serial API compatibility
4. **Start** with proof-of-concept

---

**Questions?**
- See full document for detailed implementation
- Code examples included for all phases
- Test strategy and edge cases covered
