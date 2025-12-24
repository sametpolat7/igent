/**
 * Architecture Visualization
 *
 * This document provides visual understanding of the refactored architecture
 */

/*
================================================================================
                           SYSTEM ARCHITECTURE
================================================================================

┌─────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                              │
│                         (Renderer Process - Sandboxed)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │  index.html      │  │  renderer.js     │  │  styles.css      │      │
│  │  ─────────────   │  │  ─────────────   │  │  ─────────────   │      │
│  │  • Form layout   │  │  • State mgmt    │  │  • Visual design │      │
│  │  • Structure     │  │  • Event handling│  │  • Animations    │      │
│  │  • Accessibility │  │  • API calls     │  │  • Responsive    │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                  ↕                                        │
│                          window.igent API                                │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↕
                          ┌─────────────────┐
                          │ SECURITY BRIDGE │
                          │  (Preload CJS)  │
                          ├─────────────────┤
                          │ • contextBridge │
                          │ • IPC validation│
                          │ • API exposure  │
                          └─────────────────┘
                                   ↕
┌─────────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS (Node.js)                         │
│                        Full System Access & Privileges                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                          index.js                                   │ │
│  │  ────────────────────────────────────────────────────────────────  │ │
│  │  • App lifecycle management                                         │ │
│  │  • Window creation & management                                     │ │
│  │  • IPC handler registration (GLOBAL)                                │ │
│  │  • Request routing to agent system                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                         AGENT SYSTEM                                 ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │                                                                       ││
│  │  ┌───────────────────────┐           ┌──────────────────────────┐   ││
│  │  │     planner.js        │           │     executor.js          │   ││
│  │  │  ──────────────────   │           │  ──────────────────────  │   ││
│  │  │  • Validate request   │───────────→  • Execute via SSH       │   ││
│  │  │  • Check whitelist    │           │  • Timeout protection    │   ││
│  │  │  • Generate commands  │           │  • Error handling        │   ││
│  │  │  • Return plan        │           │  • Return results        │   ││
│  │  └───────────────────────┘           └──────────────────────────┘   ││
│  │           ↕                                                           ││
│  │  ┌───────────────────────┐                                           ││
│  │  │  CONFIG SYSTEM        │                                           ││
│  │  ├───────────────────────┤                                           ││
│  │  │  loadConfig.js        │                                           ││
│  │  │  ──────────────────   │                                           ││
│  │  │  • Load servers.json  │                                           ││
│  │  │  • Validate structure │                                           ││
│  │  │  • Provide config     │                                           ││
│  │  └───────────────────────┘                                           ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                   ↕
                          ┌─────────────────┐
                          │  REMOTE SERVER  │
                          │  (via SSH)      │
                          ├─────────────────┤
                          │ • Git operations│
                          │ • DB migrations │
                          │ • Asset compile │
                          │ • Service restart│
                          └─────────────────┘

================================================================================
                              DATA FLOW
================================================================================

1. USER INTERACTION
   ────────────────
   User fills form (server, directory, branch)
   Clicks "Plan Deployment"
   
2. VALIDATION & PLANNING
   ──────────────────────
   renderer.js → window.igent.plan()
   preload.cjs → IPC channel: 'agent:plan'
   index.js → IPC handler routes to planner
   planner.js → Validates against servers.json
   planner.js → Generates command sequence
   planner.js → Returns plan to renderer
   
3. USER CONFIRMATION
   ──────────────────
   User reviews planned commands
   Clicks "Execute Deployment"
   
4. EXECUTION
   ──────────
   renderer.js → window.igent.executeProcess()
   preload.cjs → IPC channel: 'agent:execute'
   index.js → IPC handler routes to executor
   executor.js → Builds SSH command
   executor.js → Executes on remote server
   executor.js → Returns result (success/error)
   
5. FEEDBACK
   ─────────
   Renderer displays result with color coding
   Success: Green with stdout
   Error: Red with stderr + error details

================================================================================
                         VALIDATION LAYERS
================================================================================

Layer 1: UI (renderer.js)
         ─────────────────
         • Non-empty field checks
         • Enable/disable buttons
         • Form validation

Layer 2: Planner (planner.js)
         ────────────────────────
         • Server exists check
         • Directory whitelist check
         • Branch name regex validation
         • Parameter type validation

Layer 3: Config Loader (loadConfig.js)
         ──────────────────────────────
         • File exists check
         • JSON syntax validation
         • Structure validation
         • Required fields check

Layer 4: Executor (executor.js)
         ──────────────────────
         • Array validation
         • SSH host validation
         • Command string validation
         • Timeout enforcement

================================================================================
                       EXTENSIBILITY POINTS
================================================================================

To Add New Action (e.g., Rollback):

1. Create command generator:
   └── src/main/agent/planner.js
       └── export function generateRollbackCommands({ ... })

2. Add IPC handler:
   └── src/main/index.js
       └── ipcMain.handle('agent:rollback', ...)

3. Expose in preload:
   └── src/preload/index.cjs
       └── rollback: (payload) => ipcRenderer.invoke('agent:rollback', payload)

4. Add UI:
   └── src/renderer/
       ├── index.html (add rollback button)
       └── renderer.js (add handleRollback function)

To Add AI Integration:

1. Create AI module:
   └── src/main/ai/
       ├── advisor.js (strategy selection)
       └── predictor.js (risk assessment)

2. Integrate with planner:
   └── src/main/agent/planner.js
       └── Use AI to suggest optimal deployment strategy

3. Add UI feedback:
   └── src/renderer/ (show AI recommendations)

================================================================================
*/
