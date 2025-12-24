/**
 * Architecture Visualization
 *
 * This document provides visual understanding of the igent architecture
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
│  │  • Multi-view UI │  │  • State mgmt    │  │  • Visual design │      │
│  │  • Navigation    │  │  • Event handling│  │  • Animations    │      │
│  │  • Progress UI   │  │  • API calls     │  │  • Responsive    │      │
│  │  • Result display│  │  • Progress track│  │  • Clock widget  │      │
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
                          │ • Progress relay│
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
│  │  • App lifecycle management (ready, quit, activate)                 │ │
│  │  • Window creation with security preload                            │ │
│  │  • IPC handler registration (agent:get-servers, :plan, :execute)   │ │
│  │  • Request routing to typed agent system                            │ │
│  │  • Error boundary & logging                                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    TYPED AGENT SYSTEM                                ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │                                                                       ││
│  │  ┌───────────────────────┐           ┌──────────────────────────┐   ││
│  │  │     planner.js        │           │     executor.js          │   ││
│  │  │  ──────────────────   │           │  ──────────────────────  │   ││
│  │  │  • Type routing       │───────────→  • Type routing          │   ││
│  │  │  • AGENT_TYPES enum   │           │  • Async execution       │   ││
│  │  │  • Dispatch to types  │           │  • Progress callbacks    │   ││
│  │  └──────────┬────────────┘           └──────────┬───────────────┘   ││
│  │             ↓                                    ↓                    ││
│  │  ┌────────────────────────────────────────────────────────────────┐ ││
│  │  │                    AGENT TYPES LAYER                            │ ││
│  │  ├────────────────────────────────────────────────────────────────┤ ││
│  │  │                                                                  │ ││
│  │  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │ ││
│  │  │  │  SERVER-UPDATE   │  │   FILE-EDIT      │  │QUEUE-CONTROL │ │ ││
│  │  │  │  ──────────────  │  │   ──────────     │  │────────────  │ │ ││
│  │  │  │  planner.js      │  │   (Future)       │  │  (Future)    │ │ ││
│  │  │  │  executor.js     │  │                  │  │              │ │ ││
│  │  │  │                  │  │                  │  │              │ │ ││
│  │  │  │  • Validation    │  │                  │  │              │ │ ││
│  │  │  │  • Git commands  │  │                  │  │              │ │ ││
│  │  │  │  • Rails tasks   │  │                  │  │              │ │ ││
│  │  │  │  • SSH execution │  │                  │  │              │ │ ││
│  │  │  │  • Progress track│  │                  │  │              │ │ ││
│  │  │  └──────────────────┘  └──────────────────┘  └──────────────┘ │ ││
│  │  │                                                                  │ ││
│  │  └────────────────────────────────────────────────────────────────┘ ││
│  │                                                                       ││
│  │  ┌───────────────────────┐           ┌──────────────────────────┐   ││
│  │  │  CONFIG SYSTEM        │           │  UTILS SYSTEM            │   ││
│  │  ├───────────────────────┤           ├──────────────────────────┤   ││
│  │  │  loadConfig.js        │           │  logger.js               │   ││
│  │  │  ──────────────────   │           │  ──────────────────      │   ││
│  │  │  • Load servers.json  │           │  • Colored console logs  │   ││
│  │  │  • Validate structure │           │  • Timestamp formatting  │   ││
│  │  │  • SSH host mapping   │           │  • Module-based logging  │   ││
│  │  │  • Directory whitelist│           │                          │   ││
│  │  │                       │           │  progressTracker.js      │   ││
│  │  │  servers.json         │           │  ──────────────────      │   ││
│  │  │  ─────────────        │           │  • Step tracking         │   ││
│  │  │  • sshHost            │           │  • Duration calculation  │   ││
│  │  │  • allowedDirectories │           │  • Callback emission     │   ││
│  │  │                       │           │                          │   ││
│  │  │                       │           │  validators.js           │   ││
│  │  │                       │           │  ──────────────────      │   ││
│  │  │                       │           │  • Type validation       │   ││
│  │  │                       │           │  • Pattern validation    │   ││
│  │  │                       │           │  • Whitelist checks      │   ││
│  │  └───────────────────────┘           └──────────────────────────┘   ││
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

1. APPLICATION INITIALIZATION
   ──────────────────────────
   app.whenReady() → registerIPCHandlers()
   index.js → Creates secure BrowserWindow with preload
   renderer.js → initialize() loads servers via IPC
   UI → Populates server dropdown and starts clock widget
   
2. USER INTERACTION
   ────────────────
   User selects server → Populates directory dropdown
   User selects directory and enters branch name
   Clicks "Create Plan"
   
3. VALIDATION & PLANNING
   ──────────────────────
   renderer.js → window.igent.plan({ serverKey, directory, branch })
   preload.cjs → IPC channel: 'agent:plan'
   index.js → IPC handler routes to planner.planProcess()
   planner.js → Routes to AGENT_TYPES.SERVER_UPDATE
   types/server-update/planner.js → planServerUpdate()
     • Validates serverKey against servers.json
     • Validates directory against allowedDirectories whitelist
     • Validates branch name pattern
     • Generates command sequence (git, rails, systemctl)
     • Returns plan object with commands and metadata
   Plan returned to renderer for review
   
4. USER CONFIRMATION
   ──────────────────
   User reviews planned commands in UI
   Clicks "Execute" button
   
5. EXECUTION WITH PROGRESS TRACKING
   ────────────────────────────────
   renderer.js → window.igent.execute(plan)
   preload.cjs → IPC channel: 'agent:execute'
   index.js → IPC handler routes to executor.executeProcess()
   executor.js → Routes to AGENT_TYPES.SERVER_UPDATE
   types/server-update/executor.js → executeServerUpdate()
     • Validates commands array and sshHost
     • Creates ProgressTracker instance with callback
     • Executes commands sequentially via SSH
     • Each command chains with previous (maintains session state)
     • Progress emitted after each step completion/failure
   Progress events → preload → renderer updates progress bar
   
6. RESULT DISPLAY
   ──────────────
   Success:
     • Green result panel with stdout
     • Total duration and step count displayed
   
   Failure:
     • Red result panel with stderr
     • Failed step details with exit code
     • Partial progress shown

================================================================================
                         VALIDATION LAYERS
================================================================================

Layer 1: UI Validation (renderer.js)
         ─────────────────────────────
         • Non-empty field checks
         • Enable/disable button states
         • Form validation before submission
         • View switching validation

Layer 2: IPC Validation (preload.cjs)
         ─────────────────────────────
         • Context isolation enforcement
         • Only whitelisted IPC channels exposed
         • Type-safe API exposure via contextBridge

Layer 3: Type Routing (planner.js, executor.js)
         ───────────────────────────────────────
         • AGENT_TYPES enum validation
         • Switch-case routing to type handlers
         • Unknown type rejection with error

Layer 4: Business Logic Validation (types/server-update/planner.js)
         ──────────────────────────────────────────────────────────
         • Server existence check against servers.json
         • Directory whitelist validation (allowedDirectories)
         • Branch name regex pattern validation
         • Parameter type validation (string, non-empty)
         • SSH host configuration validation

Layer 5: Execution Validation (types/server-update/executor.js)
         ──────────────────────────────────────────────────────
         • Commands array validation (array, not empty)
         • Individual command string validation
         • SSH host string validation
         • Timeout enforcement (300s)
         • Max buffer size enforcement (10MB)

Layer 6: Config Validation (loadConfig.js)
         ──────────────────────────────────
         • File existence check
         • JSON syntax validation
         • Structure validation (object, properties)
         • Required fields check (sshHost, allowedDirectories)
         • Array validation (allowedDirectories not empty)

================================================================================
                       EXTENSIBILITY POINTS
================================================================================

CURRENT IMPLEMENTATION STATUS:
───────────────────────────────

IMPLEMENTED:
  ✓ Server Update (server-update/)
    - Full planning and execution
    - Git operations, Rails migrations, asset compilation
    - Service restart automation

PLANNED (UI placeholders exist):
  ○ File Edit (file-edit/ - empty)
    - Remote file editing capability
  
  ○ Queue Control (queue-control/ - empty)
    - Background job management

================================================================================

TO ADD A NEW AGENT TYPE:

1. Create Type Directory Structure
   └── src/main/agent/types/new-type/
       ├── planner.js
       └── executor.js

2. Implement Planner
   └── src/main/agent/types/new-type/planner.js
       
       export function planNewType({ ...params }) {
         // Load config if needed
         const config = loadServersConfig();
         
         // Validate parameters
         validateString(param, 'Parameter name');
         validateIncludes(value, allowedValues, 'Field name');
         
         // Generate command sequence
         const commands = generateCommands({ ...params });
         
         // Return plan object
         return {
           ...params,
           commands,
           metadata: { ... },
           createdAt: new Date().toISOString()
         };
       }

3. Implement Executor
   └── src/main/agent/types/new-type/executor.js
       
       export async function executeNewType({ commands, ...params }) {
         // Validate inputs
         validateArray(commands, 'Commands');
         
         // Create progress tracker
         const progress = new ProgressTracker(
           'newType',
           commands.length,
           progressCallback
         );
         
         // Execute with progress
         progress.start('Starting operation');
         
         for (const command of commands) {
           progress.stepStart(command);
           // Execute command
           progress.stepComplete(command, stdout, stderr);
         }
         
         progress.complete();
         
         return {
           success: true,
           ...metadata
         };
       }

4. Register in Router
   └── src/main/agent/planner.js
       
       import { planNewType } from './types/new-type/planner.js';
       
       export const AGENT_TYPES = {
         SERVER_UPDATE: 'server-update',
         NEW_TYPE: 'new-type',  // Add here
       };
       
       export function planProcess(agentType, params) {
         switch (agentType) {
           case AGENT_TYPES.NEW_TYPE:
             return planNewType(params);
           // ...
         }
       }
   
   └── src/main/agent/executor.js
       
       import { executeNewType } from './types/new-type/executor.js';
       
       export async function executeProcess(agentType, params) {
         switch (agentType) {
           case AGENT_TYPES.NEW_TYPE:
             return await executeNewType(params);
           // ...
         }
       }

5. Add IPC Handler
   └── src/main/index.js
       
       ipcMain.handle('agent:new-type', async (_event, payload) => {
         try {
           return await planProcess(AGENT_TYPES.NEW_TYPE, payload);
         } catch (error) {
           logError('IPC', 'New type failed', error);
           throw new Error(`Error: ${error.message}`);
         }
       });

6. Expose in Preload
   └── src/preload/index.cjs
       
       contextBridge.exposeInMainWorld('igent', {
         // Existing...
         newType: (payload) => ipcRenderer.invoke('agent:new-type', payload),
       });

7. Add UI Implementation
   └── src/renderer/index.html
       
       <div id="view-new-type" class="view-container">
         <!-- Add form fields and controls -->
       </div>
   
   └── src/renderer/renderer.js
       
       async function handleNewType() {
         const result = await window.igent.newType({ ...params });
         // Handle result
       }

================================================================================

UTILITY SYSTEM USAGE:

Logger (logger.js):
  • logInfo(module, message, data)
  • logSuccess(module, message, data)
  • logWarn(module, message, data)
  • logError(module, message, error)
  • logDebug(module, message)
  • logStart(module, operation, params)

ProgressTracker (progressTracker.js):
  • new ProgressTracker(operationName, totalSteps, callback)
  • start(message)
  • stepStart(command)
  • stepComplete(command, stdout, stderr)
  • stepFailed(command, error, stdout, stderr, exitCode)
  • complete()
  • getTotalDuration()

Validators (validators.js):
  • validateString(value, fieldName)
  • validateNonEmpty(value, fieldName)
  • validateArray(value, fieldName)
  • validateArrayNotEmpty(value, fieldName)
  • validatePattern(value, pattern, fieldName)
  • validateIncludes(value, allowedValues, fieldName)
  • validateObject(value, fieldName)
  • validateProperty(obj, property, objectName)

================================================================================
*/
