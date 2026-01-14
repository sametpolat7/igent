/**
 * Architecture Visualization
 *
 * This document provides visual understanding of the igent architecture.
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
│  │  index.html      │  │  index.js        │  │  styles.css      │      │
│  │  ─────────────   │  │  ─────────────   │  │  ─────────────   │      │
│  │  • Multi-view UI │  │  • State mgmt    │  │  • Visual design │      │
│  │  • Navigation    │  │  • Event handling│  │  • Animations    │      │
│  │  • 3 Agent views │  │  • API calls     │  │  • Responsive    │      │
│  │  • Progress UI   │  │  • Progress track│  │  • Clock widget  │      │
│  │  • Result display│  │  • Tab switching │  │  • Restore UI    │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                  ↕                                        │
│                 ┌────────────────────────────────────────┐               │
│                 │       AGENT UI MODULES                 │               │
│                 ├────────────────────────────────────────┤               │
│                 │  agents/server-update.js               │               │
│                 │  agents/file-editing.js                │               │
│                 │  agents/queue-control.js               │               │
│                 │  • Dedicated event handlers            │               │
│                 │  • Progress update functions           │               │
│                 │  • View-specific state management      │               │
│                 └────────────────────────────────────────┘               │
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
│  │  • IPC handler registration (server-update:*, queue:*, file-edit:*) │ │
│  │  • Request routing to typed agent system                            │ │
│  │  • Progress streaming via event.sender.send()                       │ │
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
│  │  │  │  SERVER-UPDATE   │  │   FILE-EDITING   │  │QUEUE-CONTROL │ │ ││
│  │  │  │  ──────────────  │  │   ──────────     │  │────────────  │ │ ││
│  │  │  │  planner.js      │  │   planner.js     │  │  planner.js  │ │ ││
│  │  │  │  executor.js     │  │   executor.js    │  │  executor.js │ │ ││
│  │  │  │                  │  │                  │  │              │ │ ││
│  │  │  │  • Validation    │  │  • Function-based│  │• Sidekiq mgmt│ │ ││
│  │  │  │  • Git commands  │  │  • File edits    │  │• Process ops │ │ ││
│  │  │  │  • Rails tasks   │  │  • Auto backup   │  │• PID tracking│ │ ││
│  │  │  │  • SSH execution │  │  • Restore files │  │• SSH execute │ │ ││
│  │  │  │  • Progress track│  │  • Progress track│  │• Progress    │ │ ││
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
│  │  │  • Load fileEdit.json │           │  • Timestamp formatting  │   ││
│  │  │  • Validate structure │           │  • Module-based logging  │   ││
│  │  │  • SSH host mapping   │           │                          │   ││
│  │  │  • Directory whitelist│           │  progressTracker.js      │   ││
│  │  │                       │           │  ──────────────────      │   ││
│  │  │  servers.json         │           │  • Step tracking         │   ││
│  │  │  ─────────────        │           │  • Duration calculation  │   ││
│  │  │  • sshHost            │           │  • Callback emission     │   ││
│  │  │  • allowedDirectories │           │                          │   ││
│  │  │                       │           │  validators.js           │   ││
│  │  │  fileEditConfigs.json │           │  ──────────────────      │   ││
│  │  │  ─────────────────    │           │  • Type validation       │   ││
│  │  │  • Function defs      │           │  • Pattern validation    │   ││
│  │  │  • Target files       │           │  • Whitelist checks      │   ││
│  │  │  • Input schemas      │           │                          │   ││
│  │  │                       │           │  securityHandler.js      │   ││
│  │  │                       │           │  ──────────────────      │   ││
│  │  │                       │           │  • Rate limiting         │   ││
│  │  │                       │           │  • Shell escaping        │   ││
│  │  │                       │           │  • Path validation       │   ││
│  │  │                       │           │                          │   ││
│  │  │                       │           │  conflictResolver.js     │   ││
│  │  │                       │           │  ──────────────────      │   ││
│  │  │                       │           │  • Git conflict detect   │   ││
│  │  │                       │           │  • Auto rollback logic   │   ││
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
   User navigates via tabs (Server Update / File Edit / Queue Control)
   Selects server → Populates directory dropdown
   
   SERVER UPDATE:
     renderer/agents/server-update.js → window.igent.plan()
     preload.cjs → IPC: 'server-update:plan'
     index.js → planProcess(AGENT_TYPES.SERVER_UPDATE, {...})
     agents/server-update/planner.js → planServerUpdate()
       • Validates serverKey, directory, branch
       • Generates git/rails/systemctl commands
       • Returns plan with metadata
   
   FILE EDITING:
     renderer/agents/file-editing.js → window.igent.fileEdit.plan()
     preload.cjs → IPC: 'file-edit:plan'
     index.js → planProcess(AGENT_TYPES.FILE_EDITING, {...})
     agents/file-editing/planner.js → planFileEdit()
       • Validates server, directory, function
       • Loads function definition from fileEditConfigs.json
       • Generates file edit commands with backup
       • Returns plan with target file info
   
   QUEUE CONTROL:
     renderer/agents/queue-control.js → window.igent.queue.plan()
     preload.cjs → IPC: 'queue:plan'
     index.js → planProcess(AGENT_TYPES.QUEUE_CONTROL, {...})
     agents/queue-control/planner.js → planQueueControl()
       • Validates server, directory, action
       • Generates Sidekiq control commands
       • Returns plan with process commands
   
   All plans returned to renderer for user review
   
4. USER CONFIRMATION
   ──────────────────
   User reviews planned commands in UI
   Clicks "Execute" button
   
5. EXECUTION WITH PROGRESS TRACKING
   ────────────────────────────────
   SERVER UPDATE:
     renderer → window.igent.execute(plan)
     preload → IPC: 'server-update:execute'
     index.js → executeProcess(AGENT_TYPES.SERVER_UPDATE, {...})
     agents/server-update/executor.js → executeServerUpdate()
       • ProgressTracker with callback
       • SSH command execution
       • Conflict detection and rollback
       • Progress: 'server-update:progress'
   
   FILE EDITING:
     renderer → window.igent.fileEdit.execute(plan)
     preload → IPC: 'file-edit:execute'
     index.js → executeProcess(AGENT_TYPES.FILE_EDITING, {...})
     agents/file-editing/executor.js → executeFileEdit()
       • File backup → Edit → Verify → Cleanup
       • Service restart after edit
       • Progress: 'file-edit:progress'
   
   RESTORE FILE:
     renderer → window.igent.fileEdit.restore()
     preload → IPC: 'file-edit:restore'
     index.js → restoreFile() direct call
     agents/file-editing/executor.js → restoreFile()
       • Git restore command
       • Service restart
       • Progress: 'file-edit:restore-progress'
   
   QUEUE CONTROL:
     renderer → window.igent.queue.execute(plan)
     preload → IPC: 'queue:execute'
     index.js → executeProcess(AGENT_TYPES.QUEUE_CONTROL, {...})
     agents/queue-control/executor.js → executeQueueControl()
       • Process check → PID extraction
       • Graceful shutdown or start
       • Verification steps
       • Progress: 'queue:progress'
   
   All progress events stream to renderer → update progress bars & steps
   
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

Layer 1: UI Validation (Renderer - index.js & agents/*.js)
         ──────────────────────────────────────────────────
         • Non-empty field checks
         • Enable/disable button states
         • Form validation before submission
         • View switching validation
         • Agent-specific input validation

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

Layer 4: Business Logic Validation (Agent Planners)
         ──────────────────────────────────────────────
         server-update/planner.js:
           • Server existence check against servers.json
           • Directory whitelist validation
           • Branch name regex pattern validation
           • Parameter type validation
         
         file-editing/planner.js:
           • Function ID validation against fileEditConfigs.json
           • Input validation per function definition
           • Required field checks
           • Target file path validation
         
         queue-control/planner.js:
           • Action validation (check/start/stop/restart)
           • Server and directory validation
           • Sidekiq-specific checks

Layer 5: Execution Validation (Agent Executors)
         ──────────────────────────────────────
         • Commands array validation
         • SSH host string validation
         • Timeout enforcement (300s default)
         • Max buffer size enforcement (10MB)
         • Rate limiting via securityHandler
         • Shell argument escaping for user inputs

Layer 6: Config Validation (loadConfig.js)
         ──────────────────────────────────
         servers.json:
           • File existence check
           • JSON syntax validation
           • Structure validation
           • Required fields (sshHost, allowedDirectories)
           • Array validation (non-empty)
         
         fileEditConfigs.json:
           • Function definitions structure
           • Input schema validation
           • Target file path validation
           • Required vs optional inputs

ALL AGENT TYPES FULLY IMPLEMENTED:

  ✓ Server Update (server-update/)
    - Full planning and execution
    - Git operations, Rails migrations, asset compilation
    - Service restart automation
    - Conflict detection and automatic rollback

  ✓ File Editing (file-editing/)
    - Function-based file editing system
    - Configurable edit operations (fileEditConfigs.json)
    - Automatic file backup before edits
    - Git-based restore functionality
    - Hash Data Update function (payments controller)
    - Service restart after edit/restore
  
  ✓ Queue Control (queue-control/)
    - Sidekiq background job management
    - Check queue status with PID tracking
    - Start/Stop/Restart operations
    - Process verification steps
    - Graceful shutdown (TSTP → TERM)

================================================================================

TO ADD A NEW AGENT TYPE:

1. Create Type Directory Structure
   └── src/main/agents/new-type/
       ├── planner.js
       └── executor.js

2. Implement Planner
   └── src/main/agents/new-type/planner.js
       
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
   └── src/main/agents/new-type/executor.js
       
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
   └── src/main/agents/planner.js
       
       import { planNewType } from './new-type/planner.js';
       
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
   
   └── src/main/agents/executor.js
       
       import { exs (Plan & Execute)
   └── src/main/index.js
       
       // Planning handler
       ipcMain.handle('new-type:plan', async (_event, payload) => {
         try {
           return planProcess(AGENT_TYPES.NEW_TYPE, payload);
         } catch (error) {
           logError('IPC', 'New type planning failed', error);
           throw new Error(`Planning failed: ${error.message}`);
         }
       });
       
       // Execution handler with progress streaming
       ipcMain.handle('new-type:execute', async (event, payload) => {
         try {
           const progressCallback = (progressData) => {
             event.sender.send('new-type:progress', progressData);
           };
           
           return await executeProcess(AGENT_TYPES.NEW_TYPE, {
             ...payload,
             progressCallback,
           });
         } catch (error) {
           logError('IPC', 'New type execution failed', error);
           throw new Error(`Execution failed: ${error.message}`);
         }
       });

6. Expose in Preload
   └── src/preload/index.cjs
       
       contextBridge.exposeInMainWorld('igent', {
         // Existing APIs...
         
         newType: {
           plan: (payload) => ipcRenderer.invoke('new-type:plan', payload),
           
           execute: (payload) => ipcRenderer.invoke('new-type:execute', payload),
           
           onProgress: (callback) => {
             ipcRenderer.on('new-type:progress', (_event, data) => callback(data));
           },
           
           removeProgressListener: () => {
             ipcRenderer.removeAllListeners('new-type:progress');
           },
         },
       });

7. Add UI Implementation
   └── src/renderer/index.html
       
       <!-- Add navigation tab -->
       <nav class="nav-tabs">
         <button class="nav-tab" data-view="new-type">New Type</button>
       </nav>
       
       <!-- Add view container -->
       <div id="view-new-type" class="view-container">
         <!-- Add form fields, plan button, progress UI, result display -->
       </div>
   
   └── src/renderer/agents/new-type.js
       
       import { state, elements, ... } from '../index.js';
       
       export function attachEventListeners() {
         // Attach form and button event listeners
       }
       
       export function setupProgressListener() {
         window.igent.newType.onProgress(updateProgress);
       }
       
       async function handlePlan() {
         const plan = await window.igent.newType.plan({ ...params });
         // Display plan
       }
       
       async function handleExecute() {
         const result = await window.igent.newType.execute(plan);
         // Handle result
       }
   
   └── src/renderer/index.js
       
       import * as newTypeAgent from './agents/new-type.js';
       
       function initialize() {
         // Initialize all agents
         newTypeAgent.attachEventListeners();
         newTypeAgent.setupProgressListener();.html
       
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

Security Handler (securityHandler.js):
  • checkRateLimit(operationType, identifier)
  • releaseRateLimit(operationType, identifier)
  • escapeShellArg(arg)
  • buildSafeFileEditCommand(...)
  • sanitizePath(inputPath)
  • validateFilePath(filePath, allowedDirs)
  • Maximum 5 concurrent operations
  • 1-second cooldown between operations

Conflict Resolver (conflictResolver.js):
  • detectConflict(stdout, stderr, exitCode)
  • resolveConflict(conflictType, sshHost, directory, originalHead)
  • CONFLICT_TYPES enum (UNMERGED_INDEX, MERGE_CONFLICT, etc.)
  • Automatic rollback strategies per conflict type

================================================================================
*/
