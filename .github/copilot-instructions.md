# igent - AI Coding Agent Instructions

## Project Overview

**igent** is an Electron desktop app for automated server operations via SSH. Current focus: Git-based updates to test servers with real-time progress tracking. Built with security-first three-process architecture and type-based agent system for extensibility.

## Critical Architecture Patterns

### Type-Based Agent System

All operations route through the agent system with type-specific planners and executors:

```
IPC Request → planner.js → types/[agent-type]/planner.js → Validation & Command Generation
            → executor.js → types/[agent-type]/executor.js → SSH Execution & Progress
```

**When adding new agent types:**

1. Create `src/main/agent/types/[type-name]/planner.js` and `executor.js`
2. Add type to `AGENT_TYPES` enum in `src/main/agent/planner.js`
3. Add switch case in both `planner.js` and `executor.js` routers
4. Follow existing `server-update` structure as template

Example: [types/server-update/planner.js](../src/main/agent/types/server-update/planner.js), [types/server-update/executor.js](../src/main/agent/types/server-update/executor.js)

### Electron Security Model

**Three-process separation is mandatory:**

- **Main Process** (Node.js, full access): App lifecycle, IPC handlers, agent coordination
- **Preload Script** (CommonJS, security bridge): contextBridge ONLY, whitelisted IPC channels
- **Renderer Process** (sandboxed): NO Node.js/Electron APIs, use `window.igent` API only

**Security rules:**

- Preload MUST use CommonJS (`.cjs`) - see [preload/index.cjs](../src/preload/index.cjs)
- NEVER expose Node.js directly to renderer
- All IPC channels must be explicitly whitelisted in preload
- Validate ALL inputs in both planner and config layers

### ES Modules Throughout

- All main/renderer code uses ES modules (`import`/`export`)
- Only preload uses CommonJS (`require`/`module.exports`)
- Use `import.meta.url` for file paths, NOT `__dirname` directly
- Convert with: `fileURLToPath(import.meta.url)` then `path.dirname()`

See [main/index.js](../src/main/index.js) for pattern.

## Validation Layers (Must Follow)

1. **UI Validation** ([renderer/renderer.js](../src/renderer/renderer.js)): Non-empty checks, button states
2. **Type Routing**: AGENT_TYPES enum validation
3. **Planner Validation**: Use validators from [utils/validators.js](../src/main/utils/validators.js)
   - `validateIncludes()` for whitelist checks (servers, directories)
   - `validatePattern()` for branch names, paths
   - `validateString()`, `validateNonEmpty()` for all inputs
4. **Config Validation** ([config/loadConfig.js](../src/main/config/loadConfig.js)): Structure validation on load

**Never skip validation** - security depends on multi-layer checks.

## Configuration System

Servers defined in [config/servers.json](../src/main/config/servers.json):

```json
{
  "serverKey": {
    "sshHost": "hostname-from-ssh-config",
    "allowedDirectories": ["dir1", "dir2"]
  }
}
```

**Rules:**

- `sshHost` must match `~/.ssh/config` entry
- All directories MUST be whitelisted per server
- Validation runs on load and every plan creation
- Directory paths constructed as `/var/webs/{directory}` (see [types/server-update/planner.js](../src/main/agent/types/server-update/planner.js))

## Progress Tracking Pattern

Use [ProgressTracker](../src/main/utils/progressTracker.js) for long-running operations:

```javascript
const tracker = new ProgressTracker(
  'OperationName',
  totalSteps,
  progressCallback
);
tracker.start('Starting operation...');
tracker.stepStart(commandText);
// ... execute command ...
tracker.stepComplete(commandText, stdout, stderr);
tracker.complete();
```

Progress events automatically flow: Executor → IPC → Preload → Renderer UI

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

- **Agent types**: Each gets own directory under `src/main/agent/types/[type-name]/`
- **Utils**: Shared utilities in `src/main/utils/` (logger, validators, progressTracker)
- **Config**: All config files in `src/main/config/` with validation in loadConfig.js
- **Renderer**: Single-page app structure in `src/renderer/` with view switching

## Common Patterns to Follow

**IPC Communication:**

- Handlers registered in [main/index.js](../src/main/index.js) `registerIPCHandlers()`
- All handlers wrap in try-catch, use logError on failure
- Progress uses `event.sender.send()` for streaming updates

**Logging:**
Import from [utils/logger.js](../src/main/utils/logger.js):

- `logDebug()` for routing/flow
- `logInfo()` for progress steps
- `logSuccess()` for completions
- `logError()` for failures (includes stack trace)

**Renderer State Management:**
Global `state` object pattern (see [renderer/renderer.js](../src/renderer/renderer.js)):

- Stores servers, currentPlan, isExecuting, currentView
- Update state THEN trigger UI changes
- View switching through data attributes: `data-view="view-name"`

## Key Files Reference

- [ARCHITECTURE.js](../ARCHITECTURE.js): Visual architecture diagrams and data flows
- [README.md](../README.md): Feature overview and project structure
- [main/index.js](../src/main/index.js): Entry point, IPC handlers, security setup
- [agent/planner.js](../src/main/agent/planner.js): Type routing dispatcher
- [agent/executor.js](../src/main/agent/executor.js): Execution routing dispatcher
- [config/servers.json](../src/main/config/servers.json): Server whitelist configuration
- [preload/index.cjs](../src/preload/index.cjs): Security bridge (CommonJS)

## What NOT to Do

- ❌ Don't add Node.js/Electron APIs to renderer - use IPC through preload
- ❌ Don't skip validation layers - security requires all three
- ❌ Don't use CommonJS in main/renderer (only preload)
- ❌ Don't hardcode server paths - use config system
- ❌ Don't execute commands without progress tracking
- ❌ Don't bypass directory whitelist validation
