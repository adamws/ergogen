# kle-ng Integration: Quick Reference

## The Problem

You want to add "Import Ergogen" functionality to kle-ng, but there's a dependency conflict:
- **ergogen** uses `kle-serial2` (your fork)
- **kle-ng** uses `kle-serial` (original)

Loading both would cause conflicts and bloat.

## Recommended Solution: Standalone Converter Package

### Create `@adamws/ergogen-kle-converter`

A lightweight npm package (~10KB) that converts ergogen points to KLE format **without** depending on any kle-serial library.

```typescript
import { ergogenToKLE } from '@adamws/ergogen-kle-converter'

// Returns plain JS objects, not kle-serial classes
const keyObjects = ergogenToKLE(ergogenPoints)

// Each app then wraps with its own kle-serial:
// ergogen: new kle2.Key(keyObj)
// kle-ng:  new kle.Key(keyObj)
```

### Why This Works

1. **No Conflict**: Converter uses plain objects, each app uses its own kle-serial
2. **Tiny Bundle**: Only conversion logic, no library dependencies
3. **Type Safe**: TypeScript interfaces for all data structures
4. **Reusable**: Other projects can use it too

### Architecture

```
┌─────────────────────────────────┐
│ @adamws/ergogen-kle-converter   │
│                                 │
│  ✓ No kle-serial dependency     │
│  ✓ Pure TypeScript              │
│  ✓ ~10KB minified               │
└─────────────────────────────────┘
           ▲         ▲
           │         │
    ┌──────┴───┐ ┌──┴─────────┐
    │ ergogen  │ │  kle-ng    │
    │          │ │            │
    │ uses     │ │ uses       │
    │ kle-     │ │ kle-serial │
    │ serial2  │ │ (original) │
    └──────────┘ └────────────┘
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

## Quick Prototype Alternative

If you need something working **this week**, you can:

1. **Copy** `ergogen/src/kle.js` to `kle-ng/src/lib/ergogen-converter.ts`
2. **Install** `kle-serial2` in kle-ng
3. **Add** import dialog UI

Then **refactor** to the standalone package later.

**Trade-offs:**
- ✅ Fast (2-3 days)
- ❌ Code duplication
- ❌ Must manually sync updates
- ❌ Larger bundle

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

**Choose:**
- ✅ **Standalone Package** (Option A) - For production
- ✅ **Quick Prototype** (Option B) - For testing feasibility

**Timeline:**
- Prototype: 2-3 days
- Production: 2-3 weeks

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
