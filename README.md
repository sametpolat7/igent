# igent

**igent** is an Electron desktop application for automated remote server operations via SSH. It provides an extensible agent-based system for managing Git-based server updates, remote file editing, and Sidekiq queue operations with real-time progress tracking and error recovery.

## Tech Stack

- **Framework:** Electron 39.x
- **Runtime:** Node.js 16+ (ES Modules)
- **Frontend:** Vanilla JavaScript (ES6+)
- **Remote Execution:** SSH
- **Code Quality:** ESLint + Prettier
- **Build System:** electron-builder

## Architecture

### Three-Process Security Model

igent implements Electron's recommended security architecture with strict process isolation:

- **Main Process**: Full Node.js capabilities, handles IPC routing, agent coordination, SSH execution
- **Preload Script**: Security bridge using `contextBridge` with explicit API whitelisting
- **Renderer Process**: Sandboxed environment with zero Node.js access, communicates only via IPC

**Agent Types:**

- `server-update`: Git pull, branch switching, Rails migrations, asset compilation, service restart
- `file-editing`: Remote file editing with automatic backup and restore
- `queue-control`: Sidekiq process management (check/start/stop/restart)

Each type operates independently with dedicated planner/executor modules.

## Features

### Server Update Agent

- Automated Git operations (stash, checkout, pull, stash pop)
- Rails database migrations with automatic rollback on failure
- Optional asset rebuild (precompilation and cache clearing)
- Test servers service restart
- Intelligent conflict detection with automatic rollback
  - Handles merge conflicts, stash conflicts, unmerged indices
  - Automatic cleanup via `git merge --abort` or `git reset --hard`
  - Original HEAD restoration on failure

### File Editing Agent

- Template-based file transformations via configuration
- Automatic file backup before modifications
- Git-based restore functionality
- Service restart after edits
- Function definitions in `fileEditConfigs.json`

**Current Functions:**

- `hash-data-update`: Modify Rails payment controller methods for testing

### Queue Control Agent

- Real-time Sidekiq process status checking
- Start/stop/restart operations with PID tracking
- Process verification after state changes
- Safe signal handling (TSTP for pause, TERM for stop)

### Security Features

- Directory whitelisting per server
- Multi-layer input validation (UI → IPC → Business Logic)
- No credential storage (relies on SSH key authentication)
- Context isolation enforced at Electron level
- Command injection prevention via shell escaping

## Releases

Pre-built binaries are available on the [GitHub Releases page](https://github.com/sametpolat7/igent/releases).

### Installation by Platform

**macOS:**

- Download `igent-{VERSION}-universal.dmg`
- Open the DMG file and drag igent to Applications
- Universal binary supports both Intel and Apple Silicon

**Windows:**

- Download `igent-Setup-{VERSION}.exe`
- Run the installer and follow the setup wizard
- Application will be added to Start Menu

**Linux:**

- **AppImage**: Download `igent-{VERSION}.AppImage`
  - Make executable: `chmod +x igent-{VERSION}.AppImage`
  - Run directly: `./igent-{VERSION}.AppImage`
- **Debian/Ubuntu**: Download `igent_{VERSION}_amd64.deb`
  - Install: `sudo dpkg -i igent_{VERSION}_amd64.deb`

## Installation (Development)

```bash
# Clone repository
git clone https://github.com/sametpolat7/igent.git
cd igent

# Install dependencies
npm install
```

## Configuration

### Server Configuration

Define servers in `src/main/config/servers.json`:

```json
{
  "stest": {
    "sshHost": "stest",
    "allowedDirectories": ["test-tc", "test-cy"]
  }
}
```

- **sshHost**: Must match an entry in `~/.ssh/config`
- **allowedDirectories**: Whitelist of directories under `/var/webs/`

### SSH Access Requirements

igent requires **passwordless SSH access** to target servers. Each server must be configured with:

#### 1. Public Key Authentication

Add your SSH public key to the server's authorized keys:

```bash
# On your local machine
cat ~/.ssh/id_ed25519.pub

# On the server (as iwallet user)
vim ~/.ssh/authorized_keys
# Paste: ssh-ed25519 AAAAC3NzaC1l...gVp9kvpb0yS6X3NTh5H name.surname@iwallet.com.tr

chmod 600 ~/.ssh/authorized_keys
```

#### 2. SSH Agent Forwarding (for Git operations)

Enable agent forwarding in `~/.ssh/config`:

```
Host stest
  HostName 192.168.1.100
  User iwallet
  ForwardAgent yes
```

Start SSH agent on your local machine:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

This allows Git operations on the server without password prompts.

#### 3. Passwordless sudo for systemctl

Add a scoped sudo rule on the server for test service restarts:

```bash
# On server, run: sudo visudo
# Add this line (replace 'youruser' with your server username):
youruser ALL=(root) NOPASSWD: /bin/systemctl restart *.service
```

This allows igent to restart test services without password prompts while maintaining security.

## Usage

### Development Mode

```bash
# Standard mode
npm start

# Debug mode with inspector
npm run dev
```

Application launches on port 3000. Access via the desktop window.

### Build for Production

```bash
# Current platform
npm run build

# Specific platforms
npm run build:mac    # macOS universal binary
npm run build:win    # Windows x64
npm run build:linux  # Linux x64 (AppImage + deb)
```

Outputs to `dist/` directory.

### Code Quality

```bash
# Lint check
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Project Structure

```
igent/
├── src/
│   ├── main/                          # Main Process (Node.js + Electron)
│   │   ├── index.js                   # Entry point, IPC handlers
│   │   ├── agents/
│   │   │   ├── planner.js             # Type routing dispatcher
│   │   │   ├── executor.js            # Execution routing dispatcher
│   │   │   ├── server-update/         # Git pull agent
│   │   │   │   ├── planner.js
│   │   │   │   └── executor.js
│   │   │   ├── file-editing/          # File transformation agent
│   │   │   │   ├── planner.js
│   │   │   │   └── executor.js
│   │   │   └── queue-control/         # Sidekiq management agent
│   │   │       ├── planner.js
│   │   │       └── executor.js
│   │   ├── config/
│   │   │   ├── loadConfig.js          # Config validation
│   │   │   ├── servers.json           # Server whitelist
│   │   │   └── fileEditConfigs.json   # File edit functions
│   │   └── utils/
│   │       ├── logger.js              # Structured logging
│   │       ├── progressTracker.js     # Progress tracking
│   │       ├── validator.js           # Input validation
│   │       ├── conflictHandler.js     # Git conflict handling
│   │       └── securityHandler.js     # Shell escaping
│   ├── preload/
│   │   └── index.cjs                  # IPC security bridge (CommonJS)
│   └── renderer/                      # Renderer Process (Sandboxed)
│       ├── index.html                 # Main UI
│       ├── index.js                   # State management, IPC calls
│       ├── styles.css                 # UI styling
│       └── agents/                    # Agent-specific UI modules
│           ├── server-update.js
│           ├── file-editing.js
│           └── queue-control.js
├── assets/                            # Application icons
├── logs/                              # Runtime logs
├── ARCHITECTURE.js                    # Visual architecture docs
├── package.json                       # Dependencies and scripts
├── eslint.config.mjs                  # ESLint configuration
└── LICENSE                            # MIT License
```

## Code Style & Conventions

### Module System

- **Main + Renderer**: ES Modules (`import`/`export`)
- **Preload**: CommonJS (`require`/`module.exports`) for security bridge

### IPC Communication

- All handlers registered in `registerIPCHandlers()` in `src/main/index.js`
- Wrap handlers in try-catch blocks
- Channel naming: `{agent-type}:{action}` (e.g., `server-update:plan`)
- Explicit whitelisting in preload `contextBridge`

### Validation Strategy

Multi-layer validation at every boundary:

1. **UI Layer**: Form validation, input sanitization
2. **IPC Layer**: Channel whitelisting, type checking
3. **Business Logic**: Domain validation (servers, directories, branches)
4. **Execution Layer**: Command validation, timeout enforcement

Use validator utilities from `utils/validator.js`:

```javascript
validateString(value, 'Field Name');
validateNonEmpty(value, 'Field Name');
validateIncludes(value, allowedValues, 'Field Name');
```

### Logging

Import from `utils/logger.js`:

```javascript
logInfo('moduleName', 'Message', { data });
logSuccess('moduleName', 'Success message');
logWarn('moduleName', 'Warning message');
logError('moduleName', 'Error message', error);
```

### Progress Tracking

All long-running operations use `ProgressTracker`:

```javascript
const tracker = new ProgressTracker('Operation', totalSteps, progressCallback);
tracker.start('Starting...');
tracker.stepStart('command');
// ... execute operation
tracker.stepComplete('command', stdout, stderr);
tracker.complete();
```

### Critical Rules

- **Never bypass directory whitelist** — All operations must validate against `allowedDirectories`
- **No credential storage** — Application relies exclusively on SSH key authentication
- **Shell injection prevention** — Use `escapeShellArg()` for all user-provided strings
- **IPC channel whitelisting** — Only whitelisted channels can communicate between processes
- **Context isolation** — Renderer process has zero Node.js/Electron API access

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'feat: add feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a pull request

**Before submitting:**

```bash
npm run lint
npm run format
```

## License

MIT License — See [LICENSE](LICENSE) for details.
