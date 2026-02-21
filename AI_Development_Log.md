# AI Development Log - CollabBoard Project

## Tools & Workflow

### Primary Tools Used

**Cursor AI**
- **Role:** Primary code generation and implementation
- **Usage:** Approximately 75% of codebase generated through Cursor
- **Integration Method:** Used Cursor's chat interface with project context
- **Workflow:** Iterative development with specific, task-focused prompts

**Claude**
- **Role:** Architecture planning, debugging strategy, and task breakdown
- **Usage:** Strategic guidance and problem-solving consultation
- **Integration Method:** Separate conversation for planning and debugging

**MCPs Used:** None
- Opted for direct SDK integration where needed
- Time constraints favored proven approaches
- Project scope didn't require MCP overhead

---

## Effective Prompts

### Prompt 1: Text Tool Re-Implementation

**Prompt:**
```
Re-implement the Text tool with a minimal, stable overlay editor that does not 
re-render on zoom/drag while editing and does not duplicate placeholders.

Constraints (must follow):
- The HTML textarea overlay is position: fixed and uses screen coordinates only
- While editing, the overlay does not move or resize when zooming/panning 
  (freeze overlay until commit/cancel)
- The canvas stores canvas coordinates only
- There must be exactly one placeholder behavior: either textarea placeholder OR 
  Konva placeholder — not both at the same time

1. Data model (single source of truth)
Create a textNodes array where each node is:
- id
- x, y (canvas coords)
- text (string)
- fontSize (number, default 16)
- width (optional, default 200)

2. Editing state (separate from nodes)
Add editingText state:
- id (null for new)
- screenX, screenY (fixed screen coords for textarea placement)
- value (current string)
- isNew (boolean)

3. Tool behavior
- Clicking T sets activeTool = "text"
- When activeTool is text and user clicks canvas:
  - Compute canvas coords from pointer
  - Create draft editing state with screenX/screenY from click event
  - Show textarea overlay at screenX/screenY

4. Overlay textarea rules
- position: fixed
- left/top = screenX/screenY
- width = 200px, minHeight = 40px
- fontSize = 16px
- placeholder="Text"
- Auto-focus on mount
- Do not update its position on pan/zoom events while open

5. Commit / cancel (no loops)
- On Escape: close overlay, do not create/update node
- On Blur or Cmd/Ctrl+Enter: commit
- If value.trim() is empty:
  - If editing existing → keep text empty OR delete
  - If new → do nothing (don't create node)
- Important: capture canvasX/canvasY at click time and store it in editingText
- Do NOT do a second conversion back from screen → canvas

6. Rendering rules (no "Text" duplication)
- Konva.Text should render only the saved node.text
- If node.text is empty, render empty string (no placeholder on canvas)
- Placeholders only exist in textarea via placeholder="Text"

7. Performance guardrails (fix lag)
- While editingText is open:
  - Temporarily disable stage dragging and zoom handlers OR early return from them
  - Do not call any "sync viewport to state" effects on every mousemove
- Ensure no effect reattaches event listeners on every render

8. Deliverables
- Provide code changes for:
  - TextTool logic (activate + click-to-edit)
  - TextOverlayTextarea component
  - Minimal updates to Konva render
- Include a short note of what was removed/disabled from the previous implementation 
  to prevent duplicate rendering
```

**Result:** Text box tool working correctly with:
- No coordinate drift
- No placeholder duplication
- No performance issues during editing
- Proper separation between editor overlay and canvas rendering

---

### Prompt 2: Performance Crisis Resolution

**Prompt:**
```
2,888ms INP - App completely blocked

The app has severe performance degradation:
- Input delay: 1,383ms
- Processing duration: 1,401ms
- Presentation delay: 104ms
- Target: <200ms INP

1. Add render counters to detect infinite loops:
   - useBoardData.ts: Track renders, console.error if >100
   - ObjectLayer.tsx: Log render count + visible objects
   - CursorLayer.tsx: Track cursor render frequency

2. Check grid rendering - could be creating thousands of Circle components:
   - Count how many Circle components are being created
   - Consider single Shape with Canvas sceneFunc instead

3. Find what's blocking the main thread:
   - Search for synchronous blocking code
   - Check viewport update frequency
   - Look for cursor updates during pan/zoom
   - Check if cursor updates trigger viewport updates (circular dependency)

4. Measure object array size and viewport culling effectiveness:
   - Log visible vs total objects
   - Verify viewport culling is actually filtering

Root cause requirements:
- Identify exact component/effect causing 160+ renders
- Measure impact from console.log statements
- Find what's triggering re-renders on every frame

Deliverable: Pinpoint blocking code, remove it, verify INP <200ms
```

**Result:** 

Discovered 3 critical issues:

**Issue 1: Grid Rendering (2,576ms → 1,608ms)**
- **Problem:** Grid dots rendered as thousands of individual `<Circle>` components
- **Detection:** Counted 10,000+ Circle components being created on large canvas
- **Solution:** Replaced with single `<Shape>` using Canvas 2D API (sceneFunc)
- **Code change:**
  ```typescript
  // Before: Thousands of components 
  gridDots.map(dot => <Circle x={dot.x} y={dot.y} />)
  
  // After: Single shape
  <Shape sceneFunc={(context) => {
    gridDots.forEach(dot => {
      context.arc(dot.x, dot.y, 2, 0, Math.PI * 2)
    })
    context.fill()
  }} />
  ```
- **Impact:** INP improved from 2,576ms → 1,608ms (38% improvement)

**Issue 2: Infinite Loop in useBoardData (1,608ms → 208ms)**
- **Problem:** Viewport updates → cursor updates → viewport updates (circular dependency)
- **Detection:** Render counter showed 160+ renders per second
- **Root cause:** `onViewportChange` callback in cursor sync effect
- **Solution:** Removed cursor update from viewport change effect
- **Code change:**
  ```typescript
  // Before: Cursor syncs on viewport change (WRONG)
  useEffect(() => {
    syncCursor() // This triggers viewport update!
  }, [viewport])
  
  // After: Cursor syncs only on mouse movement
  const handleMouseMove = (e) => {
    if (!isPanning) {
      syncCursor(e)
    }
  }
  ```
- **Impact:** INP improved from 1,608ms → 208ms (87% improvement)

**Issue 3: Cursor Updates During Pan (208ms → 48ms)**
- **Problem:** Cursor position syncing during pan/zoom operations
- **Detection:** Logs showed cursor updates every frame during pan
- **Solution:** Skip cursor updates when `isPanning === true`
- **Impact:** INP improved from 208ms → 48ms

**Additional optimizations applied:**
- Throttled viewport updates to 33ms (30fps) during pan using `requestAnimationFrame`
- Viewport culling with 300px padding to only render visible objects
- Memoized expensive components (`CursorLayer`, `ObjectLayer`)
- Limited minimum zoom to 10% to prevent extreme rendering loads at tiny zoom levels

**Final performance:** 48ms INP (met <200ms target, actually achieved <50ms)
```

**Result:** Full testing infrastructure operational in under 30 minutes

---

### Prompt 3: Coordinate System Bug Fix

**Prompt:**
```
Apply guard rails to ALL object placement
Objects placed at wrong locations due to inconsistent coordinate conversion

Guard Rails:
1. Canvas coordinates are ONLY source of truth
2. Coordinate conversion happens ONCE at object creation:
   const canvasX = (pointerPos.x - viewport.x) / viewport.scale;
   const canvasY = (pointerPos.y - viewport.y) / viewport.scale;
3. Never convert back to screen coordinates for storage

Apply this pattern to: createSticky, createShape, createEmoji, createComment

Validation: Test at zoom 50%, 100%, 200% and various pan positions
```

**Result:** Coordinate bug resolved across entire application, objects place accurately at all zoom/pan levels

---

### Prompt 4: AI Agent Architecture Migration

**Prompt:**
```
Move OpenAI API calls to Firebase Cloud Functions (backend)
Can't call OpenAI from browser due to CORS
1. Initialize Cloud Functions: firebase init functions
2. Install openai in functions folder
3. Create processAICommand Cloud Function with tool definitions
4. Update client-side to call Cloud Function instead of OpenAI directly
5. Deploy: firebase deploy --only functions
```

**Result:** AI agent working without CORS errors, proper serverless architecture established

---



---

## Code Analysis

### Overall Statistics

**Total Codebase:** ~8,500 lines

**Code Generation Breakdown:**
- **Low human guidance (~75%):** AI successfully implemented with minimal direction
- **High human guidance (~15%):** Required detailed human diagnosis, architectural decisions, or problem-solving before AI could implement
- **Iterative refinement (~10%):** AI's first attempt required human-guided debugging and fixes

---

## Strengths & Limitations

### Where AI Excelled

#### Boilerplate Generation
- Firebase initialization and configuration
- Component scaffolding with proper imports
- Service function templates
- Test file structure

#### Following Established Patterns
- Once a pattern was defined (e.g., object creation), AI replicated it perfectly
- Consistent code style across similar functions
- Proper TypeScript typing when examples provided

#### Testing Infrastructure
- Vitest configuration with jsdom environment
- Playwright setup across multiple browsers
- Firebase Emulator configuration

#### Documentation Generation
- Automatic JSDoc comments via Cursor rules
- Consistent @param, @returns, @example tags
- Batch documentation of existing code

#### Refactoring and Reorganization
- Moving code between files
- Updating import statements
- Restructuring folder organization

---

### Where AI Struggled

#### Debugging Novel Problems
- Coordinate transformation bugs required extensive logging to diagnose
- AI couldn't identify root cause without human-guided investigation
- Multiple iterations needed to isolate issues

#### Performance Optimization
- Didn't recognize console.log overhead as performance bottleneck
- Required explicit instruction to remove debug statements
- Couldn't proactively identify re-render issues
- Initial performance suggestions were generic (memoization, throttling)
- Couldn't identify infinite loop without explicit diagnostic logging
- Required human interpretation of render counter data (160+ renders)
- Needed multiple iterations to find viewport → cursor → viewport cycle
- Grid rendering issue not caught until rendering thousands of objects
- Didn't recognize that thousands of individual components would be slow

#### Architecture Decisions
- Client-side vs server-side placement for AI agent
- Data model design for real-time sync
- Security rule structure

#### Complex State Management
- Multi-step workflows with interdependent state
- Real-time sync conflict resolution
- Undo/redo stack management
- Circular dependencies between effects

#### Edge Cases
- Handling disconnection during collaboration
- Cursor disappearance on inactive tabs
- Object updates during simultaneous edits

---

## Key Learnings

### 1. Prompt Specificity Determines Quality

Generic prompts yield generic results; specific prompts with constraints yield effective results.
Always include:
- Specific problem statement
- Concrete action items
- Success criteria
- Constraints

---

### 2. Incremental Development Prevents Compounding Errors

Large, multi-part prompts create buggy, incomplete code. Small, focused prompts create clean, testable implementations.
- Break complex features into single-purpose tasks
- Test each before moving forward

---

### 3. Establish Standards Early for Compound Benefits

Setting project-wide standards (documentation, code style, patterns) at the start pays exponential dividends.
Example:
- Cursor rules file for documentation created once at project start
- Auto-applied to all future code
- Zero ongoing documentation effort
- Consistent style across 8,500 lines
Define standards before scaling development

---

### 4. Testing Infrastructure Enables Confident Iteration

AI-built test suite gave confidence to refactor and experiment without fear of breaking existing functionality.
- Caught regressions immediately
- Enabled aggressive refactoring
- Validated AI-generated code automatically
- Reduced manual QA time
Invest in testing infrastructure early, leverage AI to build it quickly

---

### 5. Diagnostic Logging Reveals What AI Cannot See

AI cannot directly observe runtime behavior or performance bottlenecks. Adding instrumentation enables AI to identify issues.
When performance issues arise:
1. First add diagnostic logging (render counters, timing logs, state snapshots)
2. Provide AI with the actual data from logs
3. AI can then pattern-match and identify root causes

**Example from this project:**
```typescript
// Added diagnostic counter
let renderCount = 0
useEffect(() => {
  renderCount++
  if (renderCount > 100) {
    console.error(`🚨 INFINITE LOOP in useBoardData - rendered ${renderCount} times`)
  }
})
```
This immediately revealed "160+ renders" which led AI to find the viewport; cursor circular dependency.
Instrumentation transforms vague performance problems into concrete, solvable issues. AI excels at pattern recognition once you provide the data.

---

### 6. Performance Optimization Requires Incremental Measurement

**The performance crisis was solved through iteration:**

1. **Add diagnostics** → Measure baseline (2,888ms INP)
2. **Fix grid rendering** → Measure again (1,608ms INP) - 46% improvement
3. **Fix infinite loop** → Measure again (208ms INP) - 87% improvement  
4. **Optimize cursors** → Measure again (48ms INP) - 77% improvement
Learned: 
- Fix one thing at a time
- Measure after each fix
- Don't assume the first fix solved everything
- Some issues only become visible after fixing bigger ones

---

### Quality Metrics

**Bugs introduced by AI:**
- Critical: 0
- Major: 3 (infinite loop, coordinate drift, resize creating instead of resizing)
- Minor: ~5-8 (styling inconsistencies, edge cases)

**Bugs prevented by AI:**
- Type safety caught ~10-15 potential runtime errors
- Consistent patterns prevented common React mistakes