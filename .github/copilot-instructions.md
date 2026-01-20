# igent - Copilot Development Instructions

## Project Overview

**igent** (Intelligent Agent) is a production-grade Electron desktop application for automated remote server operations management via SSH. The application provides a secure, extensible platform for DevOps automation with real-time progress tracking and intelligent error recovery.

**Core Purpose:** Streamline remote server operations through automated workflows with type-based agent architecture, multi-layer security validation, and comprehensive error handling.

**Current Capabilities:**

- Git-based server updates with automatic conflict detection and rollback
- Remote file editing with backup/restore capabilities
- Sidekiq queue management (check/start/stop/restart)

**Tech Stack:**

- **Framework**: Electron 39.x with three-process security architecture
- **Runtime**: Node.js 16+ with ES Modules
- **Frontend**: Vanilla JavaScript (ES6+) with multi-view navigation
- **Communication**: SSH for remote execution via child_process
- **Code Quality**: ESLint + Prettier
- **Build**: electron-builder for cross-platform distribution

**Architecture Foundation:** Security-first design with strict process isolation, type-based agent system for unlimited operational extensibility, and standardized progress tracking.

## Core Architecture Principles

### 1. Security-First Design

The application implements Electron's recommended security model with strict process isolation:

- **Main Process**: Full Node.js capabilities for system operations, SSH execution, file I/O
- **Preload Script**: Security bridge using contextBridge with explicit API whitelisting
- **Renderer Process**: Sandboxed browser environment with zero Node.js access

**Security Implementation:**

- Context isolation enforced at the Electron level
- All IPC channels explicitly whitelisted in preload
- Multi-layer input validation (UI → IPC → Business Logic → Config)
- No credential storage; relies on SSH key-based authentication
- Directory operations constrained by whitelist configuration

### 2. Type-Based Agent System

Operations are organized into types, each with dedicated planning and execution logic. This pattern enables unlimited extensibility while maintaining code organization.

**Agent Flow:**

```
User Request → IPC Handler → Type Router → Type-Specific Planner → Validation → Plan
Execute Plan → Type Router → Type-Specific Executor → Progress Tracking → Result
```

**Benefits:**

- Clear separation of concerns per operation type
- Independent type implementations (no cross-dependencies)
- Easy addition of new operation types without modifying core
- Consistent validation and error handling patterns

### 3. Progress Tracking System

All long-running operations implement standardized progress tracking with real-time UI updates:

- Step-by-step execution monitoring
- Duration tracking per step and overall operation
- Automatic console logging with timestamps
- IPC-based progress streaming to renderer
- Success/failure state management

### 4. Validation Strategy

Multi-layer validation ensures security and reliability across 6 distinct layers:

1. **UI Layer**: Form validation, button state management, input sanitization
2. **IPC Layer**: Channel whitelisting via contextBridge, parameter type checking
3. **Type Router**: Agent type validation against AGENT_TYPES enum
4. **Business Logic**: Domain-specific validation in agent planners (server existence, directory whitelisting, branch patterns)
5. **Execution Layer**: Command validation, SSH timeout enforcement (300s), max buffer limits (10MB), rate limiting
6. **Configuration**: JSON schema validation, required field checks, path sanitization

Each layer provides independent validation - never skip or trust previous layers.

## Development Guidelines

### Code Organization

**File Structure Conventions:**

- Agent types: `src/main/agents/[type-name]/` with planner.js and executor.js
- Utilities: `src/main/utils/` for shared functionality (logging, validation, progress)
- Configuration: `src/main/config/` with validation layer
- Renderer: Single-page application in `src/renderer/` with view-based navigation

**Module System:**

- ES Modules (`import`/`export`) for all main process and renderer code
- CommonJS (`require`/`module.exports`) only for preload security bridge
- Use `import.meta.url` pattern for file path resolution in ES modules

### IPC Communication Patterns

**Handler Registration:**

- All handlers defined in `registerIPCHandlers()` function in `src/main/index.js`
- Wrap all handlers in try-catch blocks for error safety
- Use utility logger functions (`logError`, `logInfo`) for error reporting
- Progress updates via `event.sender.send()` for streaming real-time data
- Return structured response objects from handlers

**Channel Naming Convention:**

- Prefix all channels with operation scope: `server-update:*`, `queue:*`, `file-edit:*`
- Use descriptive action names: `get-servers`, `plan`, `execute`, `check-status`
- Whitelist each channel explicitly in preload's `contextBridge.exposeInMainWorld()`

**IPC Handler Pattern:**

```javascript
ipcMain.handle('agent:action', async (event, payload) => {
  try {
    // Define progress callback for streaming updates
    const progressCallback = (progressData) => {
      event.sender.send('agent:progress', progressData);
    };

    // Execute operation with progress tracking
    return await executeProcess(AGENT_TYPES.AGENT_NAME, {
      ...payload,
      progressCallback,
    });
  } catch (error) {
    logError('IPC', 'Operation failed', error);
    throw new Error('User-friendly error message');
  }
});
```

**Preload Security Bridge** (`src/preload/index.cjs`):

- Uses CommonJS (only file in project)
- Explicitly whitelists all IPC channels via `contextBridge`
- Exposes `window.igent` API with namespaced methods
- Separate namespaces: root (server-update), `queue`, `fileEdit`
- Progress listeners: `onProgress()` and `removeProgressListener()` per agent

**Server Update Parameters:**

```javascript
window.igent.plan({
  serverKey: 'server-name',
  directory: 'app-directory',
  branch: 'branch-name',
  rebuildAssets: false, // optional, defaults to false
});
```

### Validation Best Practices

**Input Validation:**

- Use validator utilities from `utils/validator.js`
- Validate at every layer (never trust previous validation)
- Provide descriptive field names in error messages
- Use whitelist validation for server keys and directories
- Pattern validation for user-provided strings (branches, paths)

**Common Validators:**

- `validateString()` - type checking
- `validateNonEmpty()` - content presence
- `validatePattern()` - regex matching
- `validateIncludes()` - whitelist checking
- `validateArray()`, `validateArrayNotEmpty()` - collection validation

### Error Handling

**Error Flow:**

- Catch errors at execution layer
- Add context to error objects (step, command, metadata)
- Log errors with logger utilities
- Return structured error objects to renderer
- Display user-friendly messages in UI (avoid technical jargon)

**Special Error Types:**

- Conflict errors: Include `isConflict` flag and rollback information
- Validation errors: Clear indication of which field/value failed
- Execution errors: Include stdout, stderr, exit codes

### Logging Strategy

**Logger Utilities** (`src/main/utils/logger.js`):

- `logInfo(module, message, data?)` - General progress and informational messages
- `logSuccess(module, message, data?)` - Successful operation completions
- `logWarn(module, message, data?)` - Non-fatal issues and warnings
- `logError(module, message, error?)` - Failures with stack traces
- `logDebug(module, message, data?)` - Development and troubleshooting information
- `logStart(module, message, data?)` - Operation initiation with parameters

**Logging Features:**

- **Console Output**: Color-coded for quick visual scanning (cyan, green, yellow, red)
- **File Output**: Daily log files in `logs/` directory (`igent-YYYY-MM-DD.log`)
- **Timestamps**: Automatic high-precision timestamps (HH:MM:SS.mmm)
- **Structured Data**: JSON object support for complex information
- **Module Identification**: First parameter for source tracking
- **Auto-initialization**: Log directory created on first write

**Logging Conventions:**

- Always include module name as first parameter (`'serverUpdate'`, `'IPC'`, `'planner'`)
- Use structured data objects for complex information (avoid string concatenation)
- `logError()` automatically captures stack traces
- Use `logDebug()` for routing and flow control information
- Use `logInfo()` for progress steps during execution
- Use `logSuccess()` only for operation completions
- Use `logWarn()` for non-fatal issues that require attention

## Configuration System

Servers defined in `src/main/config/servers.json`:

```json
{
  "serverKey": {
    "sshHost": "hostname-from-ssh-config",
    "allowedDirectories": ["dir1", "dir2"]
  }
}
```

**Configuration Rules:**

- `sshHost` must match entries in `~/.ssh/config`
- All directories must be explicitly whitelisted per server
- Validation occurs on application load and before each operation
- Directory paths are constructed as `/var/webs/{directory}`
- Configuration changes require application restart

**Validation on Load:**

- JSON syntax validation
- Required field presence checks (`sshHost`, `allowedDirectories`)
- Type validation for all properties
- Non-empty array validation for directories
- Structure validation against expected schema
- SSH host sanitization for security

## Security & Rate Limiting

**Rate Limiting System** (`src/main/utils/securityHandler.js`):

- **Concurrent Operations**: Maximum 5 simultaneous operations
- **Cooldown Period**: 1000ms between operations of the same type
- **Operation Tracking**: Map-based tracker with active/inactive states
- **Error Handling**: `RateLimitError` with wait time information

**Security Functions:**

- `checkRateLimit(operationType, identifier)` - Validates rate limits before execution
- `releaseRateLimit(operationType, identifier)` - Marks operation complete
- `sanitizeSSHHost(host)` - Validates SSH hostname format
- `sanitizeDirectoryName(dir)` - Validates directory name against injection
- `escapeShellArg(arg)` - Shell argument escaping for user inputs
- `buildSafeFileEditCommand()` - Constructs secure file edit commands

**SSH Command Execution:**

- Timeout: 300 seconds (5 minutes)
- Max Buffer: 10MB
- Shell escaping for all user-provided arguments
- No direct shell interpolation of user input

**Path Validation:**

- Whitelist-based directory validation
- No parent directory traversal (`../`) allowed
- Absolute path construction with base directory
- Pattern validation for branch names, file paths

## Progress Tracking Pattern

All long-running operations use the ProgressTracker utility for consistent progress reporting:

```javascript
import { ProgressTracker } from '../utils/progressTracker.js';

const tracker = new ProgressTracker(
  'OperationName',
  totalSteps,
  progressCallback
);

tracker.start('Starting operation...');

for (const step of steps) {
  tracker.stepStart(stepCommand);
  // ... execute operation ...
  tracker.stepComplete(stepCommand, stdout, stderr);
}

tracker.complete();
```

**Progress Event Flow:**

```
Executor → Progress Callback → IPC Event → Preload Bridge → Renderer UI Update
```

**Progress States:**

- `started` - Operation initialization
- `running` - Step execution in progress
- `step-complete` - Individual step success
- `step-failed` - Individual step failure
- `completed` - Full operation success
- `failed` - Operation termination with error

**ProgressTracker Methods:**

- `start(message)` - Initialize operation with timestamp
- `stepStart(command)` - Begin step execution, increment counter
- `stepUpdate(command)` - Update step status without incrementing
- `stepComplete(command, stdout, stderr)` - Mark step success with output
- `stepFailed(command, error, stderr)` - Mark step failure with error details
- `complete()` - Mark overall operation success
- `failed()` - Mark overall operation failure

**Automatic Features:**

- Duration calculation per step (milliseconds precision) and total operation
- Console logging with timestamps via logger utilities
- Real-time UI updates via IPC streaming
- Step numbering and progress tracking (currentStep/totalSteps)
- Automatic emission of progress data to callback function

## Git Conflict Handling (Server Update)

The server-update executor includes sophisticated conflict detection and automatic rollback:

**Conflict Detection Patterns:**

- `UNMERGED_INDEX` - Repository in MERGING/REBASING state preventing stash operations
- `MERGE_CONFLICT` - Conflicting changes between local and remote branches
- `STASH_CONFLICT` - Stashed changes conflict with newly pulled updates
- `UNMERGED_FILE` - Unresolved merge conflicts in working directory

**Automatic Rollback Strategy:**

For merge conflicts:

1. Abort merge operation (`git merge --abort`)
2. Reset to original HEAD commit
3. Attempt to restore stashed changes

For stash conflicts:

1. Hard reset to clean state (`git reset --hard`)
2. Reset to original HEAD commit
3. Attempt to restore stashed changes

**Error Communication:**

- User receives simplified, non-technical error message
- Error object includes conflict metadata (type, directory, branch)
- Renderer displays conflict status with appropriate visual indicators
- Automatic cleanup ensures repository remains in consistent state

**Implementation Details:**

- Original HEAD captured before operation begins
- Each command output analyzed for conflict patterns
- Cleanup commands executed before returning error
- Progress tracking includes rollback steps for transparency

See `src/main/utils/conflictHandler.js` and `src/main/agents/server-update/executor.js` for complete implementation.

## Queue Control Agent

The queue-control agent manages Sidekiq background job processes on remote Rails servers.

**Architecture:**

- Real-time process status checking via `ps aux | grep sidekiq`
- PID extraction and tracking for active processes
- Graceful shutdown using SIGTSTP (pause) and SIGTERM (terminate)
- Process verification after state changes
- Safe signal handling with fallback mechanisms

**Supported Actions:**

- `check` - Display current Sidekiq process status and PID
- `start` - Launch Sidekiq with nohup for persistent background execution
- `stop` - Gracefully terminate Sidekiq process
- `restart` - Stop then start sequence with verification

**Implementation Details:**

- Start command: `setsid nohup bundle exec sidekiq -e production -C config/sidekiq.yml > sidekiq.log 2>&1 < /dev/null &`
- Process detection pattern: `sidekiq.*{directory}` with grep filtering
- Working directory: `/var/webs/{directory}`
- Progress tracking for all state transitions

See `src/main/agents/queue-control/` for implementation.

## File Editing Agent

The file-editing agent provides a flexible system for remote file modifications via SSH with automatic service restart and restore capabilities.

**Architecture:**

- Function definitions stored in `src/main/config/fileEditConfigs.json`
- Each function specifies: name, target file, and required inputs
- Planner generates shell commands based on function type
- Executor runs commands via SSH with progress tracking
- Restore functionality reverts changes using `git restore` with service restart

**Command Flow:**

```
Plan → cd → backup → transform → verify → restart service
Restore → cd → git restore → restart service
```

**Current Functions:**

### Hash Data Update

Updates the `hash_data` method in Rails payments controller to return a static value:

- **Target File:** `app/controllers/api/v1/payments_controller.rb`
- **Behavior:** Comments out method body, adds new return value
- **Use Case:** Testing payment integrations with predictable hash values

**Configuration (fileEditConfigs.json):**

```json
{
  "hash-data-update": {
    "name": "Hash Data Update",
    "targetFile": "app/controllers/api/v1/payments_controller.rb",
    "inputs": [
      {
        "key": "newValue",
        "label": "New Hash Data Value",
        "placeholder": "e.g., hello",
        "type": "text",
        "required": true
      }
    ]
  }
}
```

**Adding New Functions:**

1. Add function definition to `fileEditConfigs.json`
2. Add function ID to `FILE_EDIT_FUNCTIONS` enum in planner.js
3. Add case to `generateFileEditCommands()` switch statement
4. Implement command generation function (return array of shell commands)
5. UI automatically renders inputs based on `inputs` config

**Restore Feature:**

- Checks for uncommitted changes via `git diff --name-only`
- Uses `planRestore()` to generate restore commands
- Executes `git restore` followed by service restart
- Shows step-by-step progress in UI
- Disables Plan button during restore operation

**Safety Features:**

- Automatic file backup before modification (`.backup` extension)
- Rollback to backup on execution failure
- Backup cleanup on successful completion
- Service restart after both edit and restore operations

**Planner Functions:**

- `planFileEdit()` - Creates edit plan with transformation commands
- `planRestore()` - Creates restore plan with git restore + service restart
- `generateRestoreCommands()` - Generates restore command array

See `src/main/agents/file-editing/` for implementation.

## Development Workflows

**Run development:**

```bash
npm start          # Normal mode
npm run dev        # With inspector for debugging
```

**Code quality (run before commits):**

```bash
npm run lint       # Check linting
npm run format     # Auto-format code
```

**Build:**

```bash
npm run build      # Current platform
npm run build:mac  # macOS universal
```

## File Organization Conventions

- **Agent types**: Each gets own directory under `src/main/agents/[type-name]/`
- **Utils**: Shared utilities in `src/main/utils/` (logger, validators, progressTracker)
- **Config**: All config files in `src/main/config/` with validation in loadConfig.js
- **Renderer**: Single-page app structure in `src/renderer/` with view switching

## Common Patterns to Follow

**IPC Communication:**

- Handlers registered in `src/main/index.js` `registerIPCHandlers()`
- All handlers wrap in try-catch, use `logError()` on failure
- Progress uses `event.sender.send()` for streaming updates
- Return structured objects with success/failure indicators

**Logging:**

Import from `src/main/utils/logger.js`:

```javascript
import { logDebug, logInfo, logSuccess, logError } from '../utils/logger.js';
```

- `logDebug(module, message, data)` - for routing/flow control
- `logInfo(module, message, data)` - for progress steps
- `logSuccess(module, message, data)` - for operation completions
- `logError(module, message, error)` - for failures (includes stack trace)

**Validation:**

Import from `src/main/utils/validator.js`:

```javascript
import {
  validateString,
  validateNonEmpty,
  validatePattern,
  validateIncludes,
  validateArray,
  validateArrayNotEmpty,
} from '../utils/validator.js';
```

- Use validators at every layer (UI, IPC, Business Logic, Execution)
- Provide descriptive field names in validation calls
- Chain validators: type check, then content check, then pattern/whitelist

**Agent Structure:**

Each agent type follows consistent structure:

```
src/main/agents/{agent-name}/
  planner.js  - Validation + command generation
  executor.js - SSH execution + progress tracking
```

Planner exports:

- Main planning function (e.g., `planServerUpdate`)
- Action/function enums if applicable
- Helper functions for command generation

Executor exports:

- Main execution function (e.g., `executeServerUpdate`)
- Additional utilities (status checks, restore operations)

**Renderer Architecture:**
Modular agent-based structure with central coordination:

- **Entry Point**: `src/renderer/index.js` - Shared state, elements, utilities
- **Agent Modules**: `src/renderer/agents/{server-update,file-editing,queue-control}.js`
  - Each exports `attachEventListeners()` and `setupProgressListener()`
  - Delegates agent-specific logic from central entry point
  - Maintains independent state within global `state` object
- **Global State**: Stores servers, plans, execution status, view state
- **Element References**: Centralized in `elements` object for all DOM queries
- **View Switching**: Data attribute pattern `data-view="view-name"`
- **Pattern**: Always update state THEN trigger UI changes

## Key Files Reference

**Documentation:**

- `ARCHITECTURE.js` - Visual architecture diagrams, data flows, validation layers
- `README.md` - Feature overview, project structure, usage instructions
- `.github/copilot-instructions.md` - This file (development guidelines)

**Main Process:**

- `src/main/index.js` - Application entry point, IPC handler registration, window creation
- `src/main/agents/planner.js` - Type routing dispatcher for plan generation
- `src/main/agents/executor.js` - Type routing dispatcher for execution
- `src/main/agents/{server-update,file-editing,queue-control}/` - Agent-specific implementations

**Configuration:**

- `src/main/config/servers.json` - Server whitelist and directory configuration
- `src/main/config/fileEditConfigs.json` - File editing function definitions
- `src/main/config/loadConfig.js` - Configuration loader with validation

**Utilities:**

- `src/main/utils/logger.js` - Colored console logging with file output
- `src/main/utils/validator.js` - Input validation functions
- `src/main/utils/progressTracker.js` - Progress tracking utility class
- `src/main/utils/securityHandler.js` - Rate limiting, shell escaping, path sanitization
- `src/main/utils/conflictHandler.js` - Git conflict detection and rollback

**Security Bridge:**

- `src/preload/index.cjs` - IPC security bridge using contextBridge (CommonJS only)

**Renderer:**

- `src/renderer/index.html` - Multi-view UI structure
- `src/renderer/index.js` - Central entry point, shared state and utilities
- `src/renderer/agents/{server-update,file-editing,queue-control}.js` - Agent-specific UI logic
- `src/renderer/styles.css` - Visual design and animations

## What NOT to Do

- ❌ Don't add Node.js/Electron APIs to renderer - use IPC through preload
- ❌ Don't skip validation layers - security requires all three
- ❌ Don't use CommonJS in main/renderer (only preload)
- ❌ Don't hardcode server paths - use config system
- ❌ Don't execute commands without progress tracking
- ❌ Don't bypass directory whitelist validation
