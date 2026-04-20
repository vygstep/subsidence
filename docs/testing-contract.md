# Testing Contract — SUBSIDENCE Critical Workflows

**Purpose:** Document testable workflows covering all critical paths. Tests serve as executable specification of expected behavior.

**Scope:** Frontend integration tests + backend integration tests for Phase 3 interactions.

---

## Frontend — Critical Workflows

### 1. Formation Depth Drag (Debounce + Optimistic Update)

**Flow:**
```
User drags formation top line 50m downward
    ↓ updateFormationDepth(formationId, 450)
    └─ Optimistic update: state.formations[].depth_md = 450 (INSTANT)
    └─ Debounce timer start: 300ms
    ↓ User releases mouse (usually within 300ms)
    └─ Wait 300ms (no new updates)
    ↓ PATCH /api/wells/{wellId}/formations/{formationId} { depth_md: 450 }
    ↓ Backend responds with updated formation
    └─ Merge response, re-sort formations, set state
    ↓ Formation column re-renders at new position
```

**Test name:** `FormationDepthDrag.integration.test.ts`

**Invariants to verify:**
- ✓ Immediate visual feedback (optimistic update works)
- ✓ Multiple drag events cancel previous debounce timer (only 1 PATCH sent)
- ✓ After PATCH response, formations stay sorted by depth_md
- ✓ State merges response correctly (no duplicates, correct order)

**Edge cases:**
- Rapid dragging (updates every 50ms) → debounce timer kept resetting → ONE PATCH at end
- Drag multiple formations quickly → each has independent debounce
- Network delay (PATCH takes 5s) → optimistic update already visible, doesn't get overwritten

---

### 2. Well Switching (Selection Cleanup + Data Reload)

**Flow:**
```
User has Well A loaded with formations [Austin, Wilcox]
    ↓ User switches to Well B in sidebar
    ↓ projectPath/activeWellId changes
    ↓ App.tsx useEffect detects well change
    ↓ Clear selections: selectTrack(null), setSelectedFormationId(null)
    ↓ loadWellInventories() → check if Well B still exists
    ↓ loadWell(wellB_id)
    │   └─ Parallel fetch: well metadata + formations
    │   └─ Convert curves to Float32Array
    │   └─ Sort formations
    │   └─ set state
    ├─ wellDataStore now has: well=B, formations=B's formations
    └─ ViewerWorkspace re-renders with Well B data
```

**Test name:** `WellSwitching.integration.test.ts`

**Invariants to verify:**
- ✓ Selection is cleared (selectedFormationId = null, selectedTrackId = null)
- ✓ Well B formations loaded correctly (no Well A formations in state)
- ✓ Curves are Float32Array (not raw numbers)
- ✓ Formations array is sorted by depth_md
- ✓ No stale references (if Well A gets deleted mid-switch, no crash)

**Edge cases:**
- Switch well while previous well is still loading → race condition
- Well B has no formations → state.formations = [], UI handles gracefully
- Network fails during switch → error state set, UI shows error message

---

### 3. Project Open — Visual Config Hydration

**Flow:**
```
User clicks "Open Project"
    ↓ POST /api/projects/open { path }
    ↓ projectStore.isOpen = true
    ↓ App.tsx useEffect detects isProjectOpen changed
    ↓ loadVisualConfig()
    │   └─ GET /api/projects/visual-config
    │   └─ Response: { depthPerPixel: 0.15, trackWidths: {...}, curveColors: {...} }
    │   └─ viewStore.applyVisualConfig(config)
    ├─ depthPerPixel = 0.15 → visible depth range recalculated
    ├─ trackWidths applied → each track resized
    ├─ curveColors applied → color overrides in state
    ├─ loadWellInventories() → get all wells
    ├─ loadWell(firstWell) → render with correct scale/colors
    └─ UI renders with EXACT same layout as was saved
```

**Test name:** `ProjectOpen.integration.test.ts`

**Invariants to verify:**
- ✓ Visual config loaded before well data rendered
- ✓ depthPerPixel affects visibleDepthRange calculation
- ✓ trackWidths respected (minimum 80px enforced)
- ✓ curveColors override applied to rendered curves
- ✓ If visual config missing → defaults applied (0.2, {}, {})

**Edge cases:**
- Visual config file corrupted → fallback to defaults
- depthPerPixel = 0.05 (zoomed very far in) → no NaN in calculations
- trackWidths = {track1: 30} (below minimum) → normalized to 80

---

### 4. Formation CRUD + Re-sort

**Flow:**

#### 4a. Add Formation
```
User clicks "Add Top", enters name="Austin Chalk", depth_md=450
    ↓ addFormation({ name, depth_md, color, ... })
    ↓ POST /api/wells/{wellId}/formations { name, depth_md, ... }
    ↓ Backend creates record, returns full formation object
    ↓ Frontend: formations.push(new_formation)
    ↓ sortFormations(formations) → sort by depth_md
    ↓ set state (triggers re-render)
    ↓ Formation column re-renders, new formation visible at correct position
```

**Test name:** `FormationCRUD.integration.test.ts`

**Invariants to verify (add):**
- ✓ New formation appears in formations array
- ✓ Formation is sorted correctly (e.g., inserted between existing)
- ✓ ID is auto-generated, unique
- ✓ Default color applied if not specified
- ✓ wellInventories refreshed (formation count increased)

#### 4b. Update Formation
```
User selects formation, changes depth_md: 450 → 500 (via form or drag)
    ↓ updateFormation(formationId, { depth_md: 500 })
    ↓ PATCH /api/wells/{wellId}/formations/{formationId} { depth_md: 500 }
    ↓ Backend updates, returns updated formation
    ↓ Frontend: map state.formations, replace matching ID
    ↓ sortFormations() again (order may change!)
    ↓ set state
    ↓ Formation column updates
```

**Invariants to verify (update):**
- ✓ Formation updated in place (same ID)
- ✓ If depth changed, array re-sorted
- ✓ No duplicates created
- ✓ Non-updated fields preserved (color, name, etc.)

#### 4c. Delete Formation
```
User deletes formation
    ↓ removeFormation(formationId)
    ↓ DELETE /api/wells/{wellId}/formations/{formationId}
    ↓ Backend deletes record
    ↓ Frontend: filter out matching ID
    ↓ set state
    ↓ If formation was selected, clear selection
    ↓ Formation column updates (line disappears)
```

**Invariants to verify (delete):**
- ✓ Formation removed from array
- ✓ selectedFormationId cleared if it was deleted
- ✓ wellInventories refreshed

---

### 5. DataTrack Rendering (Curve Clipping + Scales)

**Flow:**
```
DataTrack receives: config, curves, width=800, height=600
    ↓ visibleDepthRange from viewStore: { min: 1000, max: 2000 }
    ↓ depthWindow = [1000 - 100, 2000 + 100] (10% buffer)
    ↓ Filter curves by mnemonic (only requested curves from config)
    ↓ Clip each curve: only keep points where depth in depthWindow
    ↓ Create scales:
    │   ├─ depthScale: depth → pixel-y (linear, 1000→0, 2000→600)
    │   └─ valueScale: value → pixel-x per curve (linear or log)
    ├─ useCanvasRenderer hook with draw callback
    │   └─ Draws: grid, fills (if any), curves
    │   └─ On resize/data change: re-render
    └─ Canvas element in DOM with correct width/height
```

**Test name:** `DataTrack.integration.test.ts`

**Invariants to verify:**
- ✓ Only curves in config.curves are rendered
- ✓ Curve points clipped to depthWindow + buffer
- ✓ depthScale transforms correctly (min→0, max→height)
- ✓ valueScale transforms correctly (scaleMin→0|width, scaleMax→width|0 if reversed)
- ✓ Grid lines at correct pixel positions
- ✓ Fills rendered before curves (Z-order)
- ✓ Canvas has correct width/height attributes

**Edge cases:**
- Curve with all null values → nothing drawn
- scaleReversed=true (e.g., NPHI) → value scale inverted
- scaleType='logarithmic' → log scale applied
- visibleDepthRange = {min: 1000, max: 1000} (zoom in to single point) → no NaN

---

## Backend — Critical Workflows

### 1. Formation Depth Update (Debounce Response)

**Flow:**
```
Frontend sends: PATCH /api/wells/{wellId}/formations/{formationId}
    body: { depth_md: 450 }
    ↓ Backend validates: depth_md is float, formation exists
    ↓ UPDATE formations SET depth_md=450 WHERE id=formationId
    ↓ SELECT formations WHERE well_id=wellId ORDER BY depth_md
    ↓ Response: 200 + updated formation object
    │   {
    │     id: "...",
    │     name: "Austin Chalk",
    │     depth_md: 450,
    │     color: "#...",
    │     ...
    │   }
```

**Test name:** `test_formation_depth_update.py`

**Invariants to verify:**
- ✓ Formation depth updated in DB
- ✓ Response includes all fields (id, name, depth_md, color, etc.)
- ✓ Response sorted by depth_md (if query returns multiple)
- ✓ Concurrent updates don't lose data (no race condition)

**Edge cases:**
- depth_md = negative value → validation error (or allowed?)
- depth_md > well.td_md → validation error (exceeds well depth?)
- Update while concurrent read → read gets new or old data (consistency)?

---

### 2. Formation CRUD + Inventory Refresh

**Flow:**

#### 2a. Add Formation
```
POST /api/wells/{wellId}/formations
    body: { name: "Cretaceous", depth_md: 800, ... }
    ↓ Validate: well exists, depth is valid
    ↓ INSERT INTO formations (well_id, name, depth_md, ...)
    ↓ SELECT id, name, depth_md, ... FROM formations WHERE id = (LAST_INSERT_ID)
    ↓ Response: 200 + created formation
    ↓ Frontend loadWellInventories()
    │   └─ Formation count += 1
```

**Test name:** `test_formation_add.py`

**Invariants to verify:**
- ✓ Formation inserted with correct well_id
- ✓ Created at object returned with auto-generated ID
- ✓ Subsequent GET /api/wells/{wellId} includes new formation
- ✓ Inventory count matches formation count

#### 2b. Delete Formation
```
DELETE /api/wells/{wellId}/formations/{formationId}
    ↓ Validate: formation exists, belongs to well
    ↓ DELETE FROM formations WHERE id=formationId
    ↓ Response: 204 No Content (or 200 {})
    ↓ Frontend loadWellInventories()
    │   └─ Formation count -= 1
```

**Invariants to verify (delete):**
- ✓ Formation deleted from DB
- ✓ Subsequent GET /api/wells/{wellId} no longer includes it
- ✓ No orphaned references (if formations link to strat charts, handle cascade)

---

### 3. Well Switching — State Consistency

**Flow:**
```
Frontend loads Well A:
    GET /api/wells/A
    GET /api/wells/A/formations
    ↓ state: well=A, formations=A's formations

Then switches to Well B:
    GET /api/wells/B
    GET /api/wells/B/formations
    ↓ state: well=B, formations=B's formations (NOT A's!)
    ↓ No cross-contamination
```

**Test name:** `test_well_switching_consistency.py`

**Invariants to verify:**
- ✓ Well B data completely replaces Well A (no lingering A data)
- ✓ Formations correctly filtered by well_id
- ✓ No foreign key violations if well deleted

---

### 4. Project Open — Visual Config Save/Load

**Flow:**
```
User opens project, modifies: depthPerPixel=0.15, trackWidth[track1]=250
    ↓ Debounce 500ms
    ↓ PATCH /api/projects/visual-config
    │   body: { depthPerPixel: 0.15, trackWidths: { track1: 250 } }
    ├─ Backend: UPDATE visual_config SET config_json = {...}
    └─ 200 OK

Later, user closes and re-opens project:
    ↓ GET /api/projects/visual-config
    ← Response: { depthPerPixel: 0.15, trackWidths: { track1: 250 } }
    ↓ Frontend hydrates with exact same config
```

**Test name:** `test_visual_config_persistence.py`

**Invariants to verify:**
- ✓ Config saved on PATCH
- ✓ Config loaded on GET (exact match)
- ✓ If no saved config, defaults returned

---

## Test File Structure

```
frontend/src/__tests__/
├── integration/
│   ├── FormationDepthDrag.integration.test.ts
│   ├── WellSwitching.integration.test.ts
│   ├── ProjectOpen.integration.test.ts
│   ├── FormationCRUD.integration.test.ts
│   └── DataTrack.integration.test.ts
└── setup.ts

app/tests/
├── conftest.py
├── integration/
│   ├── test_formation_depth_update.py
│   ├── test_formation_crud.py
│   ├── test_well_switching_consistency.py
│   └── test_visual_config_persistence.py
└── fixtures/
    ├── well_fixtures.py
    └── formation_fixtures.py
```

---

## Execution

```bash
# Frontend
npm run test

# Backend
pytest
```

---

## Pass Criteria

- ✅ All tests pass locally
- ✅ All tests pass in CI
- ✅ No flaky tests (no random failures)
- ✅ Coverage ≥ 80% for critical paths

