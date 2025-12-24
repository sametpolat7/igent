# igent

Intelligent Operations Manager - A Electron desktop application for automated server updates and operations management.

## Overview

igent is a professional-grade update automation tool built with security, extensibility, and user experience as core principles. The application provides a clean, type-safe architecture for managing remote server operations through a modern desktop interface.

**Current Focus:** Automated Git-based updates to test servers with comprehensive validation and real-time progress tracking.

**Architecture Philosophy:** Type-based agent system designed for seamless extensibility to support multiple operational workflows beyond update.

## Features

**Security First**

- Three-process architecture following Electron security best practices
- Context isolation with secure IPC communication
- Directory whitelisting and parameter validation
- SSH-based authentication without credential storage

**update Automation**

- Automated Git pull operations with branch switching
- Rails database migration execution
- Asset compilation and caching management
- Service restart automation
- Sequential command execution with session state preservation

**User Experience**

- Real-time progress tracking with step-by-step feedback
- Multi-view navigation interface
- Detailed execution logs with success and error states
- Live clock widget for timestamping operations

**Code Quality**

- TypeScript-style validation layer
- Comprehensive error handling and logging
- ESLint and Prettier integration
- ES Modules throughout the codebase

## Technology Stack

- Electron 39 - Cross-platform desktop framework
- Node.js (ES Modules) - Backend runtime environment
- Vanilla JavaScript - Lightweight frontend without framework overhead
- SSH - Secure remote command execution
- ESLint - Code quality enforcement

## Prerequisites

- Node.js v16 or higher
- npm v7 or higher
- SSH access configured for target servers
- SSH keys set up in ~/.ssh/config

## Installation

```bash
git clone <repository-url>
cd igent
npm install
```

## Development

```bash
npm start
```

## Building for Production

```bash
# Build for current platform
npm run build

# Platform-specific builds
npm run build:mac
npm run build:win
npm run build:linux
```

## Project Structure

```
igent/
├── src/
│   ├── main/                           # Main Process (Node.js)
│   │   ├── index.js                   # Application entry, IPC handlers
│   │   ├── agent/                     # Type-based agent system
│   │   │   ├── planner.js            # Route to type-specific planners
│   │   │   ├── executor.js           # Route to type-specific executors
│   │   │   └── types/                # Agent type implementations
│   │   │       ├── server-update/    # Server update type
│   │   │       │   ├── planner.js   # update planning
│   │   │       │   └── executor.js  # SSH execution
│   │   │       ├── file-edit/        # Future: File editing
│   │   │       └── queue-control/    # Future: Job queue management
│   │   ├── config/                    # Configuration management
│   │   │   ├── loadConfig.js         # Config loader with validation
│   │   │   └── servers.json          # Server definitions
│   │   └── utils/                     # Shared utilities
│   │       ├── logger.js             # Colored console logging
│   │       ├── progressTracker.js    # Progress tracking system
│   │       └── validators.js         # Type validation functions
│   ├── preload/                       # Security Bridge
│   │   └── index.cjs                 # Context bridge for IPC
│   └── renderer/                      # Renderer Process (UI)
│       ├── index.html                # Application interface
│       ├── renderer.js               # Client-side logic
│       └── styles.css                # Application styling
├── assets/                            # Application resources
│   ├── icons/                        # Platform-specific icons
│   └── logo/                         # Brand assets
├── package.json                       # Project configuration
├── eslint.config.mjs                  # Linting rules
├── ARCHITECTURE.js                    # Architecture documentation
├── LICENSE                            # MIT License
└── README.md                          # This file
```

## Architecture

### Electron Security Model

igent implements Electron's recommended three-process security architecture:

**Main Process** - Full system access (Node.js)

- Application lifecycle management
- Window creation with security preload injection
- IPC handler registration and request routing
- Agent system coordination
- Configuration loading and validation

**Preload Script** - Security bridge (CommonJS)

- Context isolation enforcement
- Selective API exposure via contextBridge
- IPC channel whitelisting
- Progress event relay to renderer

**Renderer Process** - Sandboxed browser environment

- User interface and interaction handling
- State management and form validation
- IPC communication via exposed window.igent API
- No direct access to Node.js or Electron APIs

### Type-Based Agent System

The application uses a type-routing architecture that separates concerns and enables easy extensibility:

```
Agent Request → Planner Router → Type-Specific Planner → Validation & Command Generation
                      ↓
Agent Response ← Executor Router ← Type-Specific Executor ← SSH Execution & Progress
```

**Current Implementation:**

SERVER_UPDATE Type:

- Planner: Validates server, directory, branch; generates Git and Rails commands
- Executor: Executes commands sequentially via SSH with progress callbacks

**Future Types (UI placeholders exist):**

FILE_EDIT Type: Remote file editing operations
QUEUE_CONTROL Type: Background job queue management

### Data Flow

**Planning Phase:**

1. User selects server, directory, and branch in UI
2. Form validation ensures all fields are populated
3. Click "Create Plan" triggers IPC call to main process
4. Main process routes to appropriate agent type planner
5. Planner validates against configuration and whitelist
6. Command sequence generated and returned to UI
7. User reviews planned commands before execution

**Execution Phase:**

1. User confirms by clicking "Execute"
2. IPC call sends plan to main process executor
3. Executor creates progress tracker with callback
4. Commands executed sequentially via SSH
5. Each command completion triggers progress event
6. Progress events relayed to renderer via IPC
7. UI updates progress bar and step display in real-time
8. Final result displayed with success/error state

### Configuration System

**Server Configuration** (servers.json)

```json
{
  "server-key": {
    "sshHost": "hostname-or-alias",
    "allowedDirectories": ["app1", "app2", "app3"]
  }
}
```

- Centralized server definitions
- SSH host mapping for connection
- Directory whitelisting for security
- Extensible for additional metadata

### Validation Architecture

Six-layer validation ensures security and reliability:

1. UI Layer: Form validation and button state management
2. IPC Layer: Context isolation and channel whitelisting
3. Router Layer: Agent type validation and routing
4. Business Logic Layer: Server, directory, and branch validation
5. Execution Layer: Command, host, and resource validation
6. Configuration Layer: File structure and schema validation

### Utilities System

**Logger** (logger.js)

- Colored, timestamped console output
- Module-based log organization
- Multiple log levels (info, success, warn, error, debug)
- Structured data formatting

**ProgressTracker** (progressTracker.js)

- Step-by-step execution tracking
- Duration calculation for steps and total operation
- Callback-based progress emission
- Console logging integration

**Validators** (validators.js)

- Type validation (string, array, object)
- Content validation (non-empty, pattern matching)
- Whitelist validation (includes checks)
- Descriptive error messages

## Usage

### Server Update Workflow

1. Launch the application
2. Select target server from the dropdown
3. Select application directory (filtered by server)
4. Enter the Git branch name to deploy
5. Click "Create Plan" to generate and review commands
6. Review the planned command sequence
7. Click "Execute" to begin update
8. Monitor real-time progress updates
9. Review execution results

### Typical Update Sequence

The server update process executes the following operations:

1. Navigate to application directory
2. Fetch latest changes from Git remote
3. Stash local changes (if any)
4. Checkout and pull main branch
5. Checkout and pull target branch
6. Restore stashed changes
7. Run database migrations
8. Clear compiled assets
9. Precompile new assets
10. Restart application service

### Configuration

Edit [src/main/config/servers.json](src/main/config/servers.json) to add or modify servers:

```json
{
  "server-identifier": {
    "sshHost": "server-hostname",
    "allowedDirectories": ["app-directory-1", "app-directory-2"]
  }
}
```

Ensure SSH access is configured in ~/.ssh/config for each sshHost value.

## Extending igent

### Adding a New Agent Type

The type-based architecture makes adding new operational workflows straightforward:

**Step 1: Create Type Directory**

```bash
mkdir -p src/main/agent/types/new-type
```

**Step 2: Implement Planner**

Create [src/main/agent/types/new-type/planner.js](src/main/agent/types/new-type/planner.js):

```javascript
import { loadServersConfig } from '../../../config/loadConfig.js';
import { validateString, validateNonEmpty } from '../../../utils/validators.js';

export function planNewType({ param1, param2 }) {
  // Load and validate configuration
  const config = loadServersConfig();

  // Validate parameters
  validateString(param1, 'Parameter 1');
  validateNonEmpty(param1, 'Parameter 1');

  // Generate commands
  const commands = generateCommands({ param1, param2 });

  // Return plan
  return {
    param1,
    param2,
    commands,
    createdAt: new Date().toISOString(),
  };
}

function generateCommands({ param1, param2 }) {
  return [`command1 ${param1}`, `command2 ${param2}`];
}
```

**Step 3: Implement Executor**

Create [src/main/agent/types/new-type/executor.js](src/main/agent/types/new-type/executor.js):

```javascript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { ProgressTracker } from '../../../utils/progressTracker.js';
import { validateArray } from '../../../utils/validators.js';

const execAsync = promisify(exec);

export async function executeNewType({ commands, progressCallback }) {
  validateArray(commands, 'Commands');

  const progress = new ProgressTracker(
    'newType',
    commands.length,
    progressCallback
  );
  progress.start('Starting new type operation');

  for (const command of commands) {
    progress.stepStart(command);

    try {
      const { stdout, stderr } = await execAsync(command);
      progress.stepComplete(command, stdout, stderr);
    } catch (error) {
      progress.stepFailed(command, error.message);
      throw error;
    }
  }

  progress.complete();

  return {
    success: true,
    totalSteps: commands.length,
    totalDuration: progress.getTotalDuration(),
  };
}
```

**Step 4: Register Agent Type**

Update [src/main/agent/planner.js](src/main/agent/planner.js):

```javascript
import { planNewType } from './types/new-type/planner.js';

export const AGENT_TYPES = {
  SERVER_UPDATE: 'server-update',
  NEW_TYPE: 'new-type',
};

export function planProcess(agentType, params) {
  switch (agentType) {
    case AGENT_TYPES.NEW_TYPE:
      return planNewType(params);
    // ... other cases
  }
}
```

Update [src/main/agent/executor.js](src/main/agent/executor.js):

```javascript
import { executeNewType } from './types/new-type/executor.js';

export async function executeProcess(agentType, params) {
  switch (agentType) {
    case AGENT_TYPES.NEW_TYPE:
      return await executeNewType(params);
    // ... other cases
  }
}
```

**Step 5: Add IPC Handler**

Update [src/main/index.js](src/main/index.js):

```javascript
ipcMain.handle('agent:new-type', async (_event, payload) => {
  try {
    return planProcess(AGENT_TYPES.NEW_TYPE, payload);
  } catch (error) {
    logError('IPC', 'New type failed', error);
    throw new Error(`Error: ${error.message}`);
  }
});
```

**Step 6: Expose in Preload**

Update [src/preload/index.cjs](src/preload/index.cjs):

```javascript
contextBridge.exposeInMainWorld('igent', {
  // ... existing methods
  newType: (payload) => ipcRenderer.invoke('agent:new-type', payload),
});
```

**Step 7: Implement UI**

Add view container in [src/renderer/index.html](src/renderer/index.html) and handler in [src/renderer/renderer.js](src/renderer/renderer.js).

## Troubleshooting

**SSH Connection Failures**

- Verify SSH keys are configured in ~/.ssh/config
- Test connection manually: `ssh hostname`
- Ensure SSH agent is running: `ssh-add -l`

**Permission Denied Errors**

- Verify user has sudo privileges for systemctl commands
- Check directory ownership and write permissions
- Confirm user is in appropriate groups

**Command Execution Timeouts**

- Default timeout is 300 seconds (5 minutes)
- Adjust EXECUTION_TIMEOUT_MS in executor.js if needed
- Check for hung processes on remote server

**Configuration Not Loading**

- Validate JSON syntax in servers.json
- Ensure all required fields are present
- Check file permissions for readability

**Progress Not Updating**

- Verify progress callback is passed to executor
- Check preload IPC channel registration
- Inspect browser console for renderer errors

## Development Guidelines

**Code Style**

- Use ES Modules (import/export) in all new code
- Follow ESLint rules defined in eslint.config.mjs
- Use async/await for asynchronous operations
- Prefer descriptive variable names over abbreviations

**Error Handling**

- Use try-catch blocks for all async operations
- Throw descriptive Error objects with context
- Log errors using logger utility functions
- Provide user-friendly error messages in UI

**Validation**

- Validate all inputs at the earliest possible layer
- Use validator utility functions for consistency
- Provide clear error messages indicating the issue
- Never trust client-side validation alone

**Testing Workflow**

- Test with actual SSH connections to verify behavior
- Validate error states and edge cases
- Ensure progress tracking updates correctly
- Check UI responsiveness during long operations

## License

MIT License
