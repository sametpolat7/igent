# igent - AI Coding Agent Instructions

## Project Overview

**igent** is a professional Electron desktop application for automated server operations management via SSH. The application emphasizes security, extensibility, and user experience through a modern desktop interface.

**Core Purpose:** Streamline remote server operations with automated workflows, real-time progress tracking, and comprehensive error handling.

**Current Implementation:** Git-based deployment automation for test servers with conflict detection and automatic rollback capabilities.

**Architecture Foundation:** Security-first three-process Electron architecture with type-based agent system designed for unlimited operational extensibility.

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

Multi-layer validation ensures security and reliability:

1. **UI Layer**: Form validation, button states, input sanitization
2. **IPC Layer**: Channel whitelisting, parameter type checking
3. **Type Router**: Agent type validation against enum
4. **Business Logic**: Domain-specific validation (servers, directories, branches)
5. **Execution Layer**: Command validation, timeout enforcement, resource limits
6. **Configuration**: Schema validation on load, required field checks

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

- All handlers defined in `registerIPCHandlers()` function in main/index.js
- Wrap all handlers in try-catch blocks
- Use utility logger functions for error reporting
- Progress updates via `event.sender.send()` for streaming data

**Channel Naming:**

- Prefix all channels with operation scope (e.g., `agent:*`)
- Use descriptive action names (`get-servers`, `plan`, `execute`)
- Whitelist each channel explicitly in preload contextBridge

### Validation Best Practices

**Input Validation:**

- Use validator utilities from `utils/validators.js`
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

**Logger Utilities:**

- `logInfo()` - General progress and informational messages
- `logSuccess()` - Successful operation completions
- `logWarn()` - Non-fatal issues and warnings
- `logError()` - Failures with stack traces
- `logDebug()` - Development and troubleshooting information
- `logStart()` - Operation initiation with parameters

**Logging Conventions:**

- Always include module name as first parameter
- Use structured data objects for complex information
- Timestamp automatically added by logger
- Color-coded output for quick visual scanning

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
- Directory paths are constructed using base path + directory name
- Configuration changes require application restart

**Validation on Load:**

- JSON syntax validation
- Required field presence checks
- Type validation for all properties
- Non-empty array validation for directories
- Structure validation against expected schema

## Progress Tracking Pattern

All long-running operations use the ProgressTracker utility for consistent progress reporting:

```javascript
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

**Automatic Features:**

- Duration calculation per step and total
- Console logging with timestamps
- Real-time UI updates via IPC streaming
- Step numbering and tracking

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

See `src/main/utils/conflictResolver.js` and `src/main/agents/server-update/executor.js` for complete implementation.

## File Editing Agent

The file-editing agent provides a flexible system for remote file modifications via SSH with automatic service restart and restore capabilities.

**Architecture:**

- Function definitions stored in `src/main/config/fileEditFunctions.json`
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

**Configuration (fileEditFunctions.json):**

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

1. Add function definition to `fileEditFunctions.json`
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
- Shell command escaping for user inputs
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
- All handlers wrap in try-catch, use logError on failure
- Progress uses `event.sender.send()` for streaming updates

**Logging:**
Import from `src/main/utils/logger.js`:

- `logDebug()` for routing/flow
- `logInfo()` for progress steps
- `logSuccess()` for completions
- `logError()` for failures (includes stack trace)

**Renderer State Management:**
Global `state` object pattern (see `src/renderer/renderer.js`):

- Stores servers, currentPlan, isExecuting, currentView
- Update state THEN trigger UI changes
- View switching through data attributes: `data-view="view-name"`

## Key Files Reference

- `ARCHITECTURE.js` - Visual architecture diagrams and data flows
- `README.md` - Feature overview and project structure
- `src/main/index.js` - Entry point, IPC handlers, security setup
- `src/main/agents/planner.js` - Type routing dispatcher
- `src/main/agents/executor.js` - Execution routing dispatcher
- `src/main/config/servers.json` - Server whitelist configuration
- `src/main/config/fileEditFunctions.json` - File editing function definitions
- `src/preload/index.cjs` - Security bridge (CommonJS)

## What NOT to Do

- ❌ Don't add Node.js/Electron APIs to renderer - use IPC through preload
- ❌ Don't skip validation layers - security requires all three
- ❌ Don't use CommonJS in main/renderer (only preload)
- ❌ Don't hardcode server paths - use config system
- ❌ Don't execute commands without progress tracking
- ❌ Don't bypass directory whitelist validation
