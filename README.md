# igent

A secure, user-friendly Electron desktop application for automated deployment management. Built with a clean architecture designed for future extensibility.

## 🎯 Current Scope

**Primary Responsibility:** Successfully pull and update development branches on selected test server and directory combinations.

**Design Philosophy:** Simple, focused, and extensible. The architecture is intentionally designed to support future enhancements:

- Multiple operational actions
- AI-powered planning
- Agent-style workflows

## ✨ Features

- 🔒 **Secure Architecture**: Three-process model with IPC communication following Electron security best practices
- 🚀 **Git Deployment**: Automated git pull, database migration, and asset compilation
- ✅ **Validation**: Directory whitelisting and parameter validation
- 🎨 **Clean UI**: Modern, intuitive interface with real-time feedback
- 📝 **Detailed Logging**: Comprehensive error messages and execution logs
- 🔧 **Extensible Design**: Well-structured codebase ready for future enhancements

## 🛠️ Tech Stack

- **Electron** - Desktop application framework
- **Node.js** - Backend runtime (ES Modules)
- **Vanilla JavaScript** - Frontend (no framework overhead)
- **SSH** - Secure remote command execution
- **ESLint + Prettier** - Code quality and formatting

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- SSH access to configured servers

## 🚀 Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd igent

# Install dependencies
npm install
```

## 💻 Development

```bash
# Run the application
npm start
```

## 📁 Project Structure

```
igent/
├── src/
│   ├── main/                    # Main Process (Node.js Backend)
│   │   ├── index.js            # Application entry point & IPC handlers
│   │   ├── agent/              # Core deployment logic
│   │   │   ├── planner.js     # Deployment planning & validation
│   │   │   └── executor.js    # Remote SSH command execution
│   │   └── config/             # Configuration management
│   │       ├── loadConfig.js  # Config loader with validation
│   │       └── servers.json   # Server definitions
│   ├── preload/                # Security Bridge
│   │   └── index.cjs          # Context bridge for secure IPC
│   └── renderer/               # Renderer Process (UI Frontend)
│       ├── index.html         # Application UI structure
│       ├── styles.css         # Application styling
│       └── renderer.js        # Client-side logic & event handling
├── package.json
├── eslint.config.mjs
└── README.md
```

## 🏗️ Architecture

### Electron's 3-Process Security Model

#### **Main Process** ([src/main/index.js](src/main/index.js))

- Runs in Node.js with full system access
- Creates and manages application windows
- Registers IPC handlers globally
- Coordinates deployment planning and execution
- Handles application lifecycle

#### **Preload Script** ([src/preload/index.cjs](src/preload/index.cjs))

- Secure bridge between main and renderer processes
- Uses `contextBridge` to expose only approved APIs
- Prevents direct Node.js/Electron API access from renderer
- **Critical security layer**: Only whitelisted operations allowed

#### **Renderer Process** ([src/renderer/](src/renderer/))

- Runs in Chromium browser (sandboxed)
- Handles UI and user interactions
- Communicates via `window.igent` API
- Cannot directly execute system commands or access file system

### Data Flow

```
User Input (UI)
    ↓
Form Validation (renderer.js)
    ↓
window.igent API Call (preload)
    ↓
IPC Message (secure channel)
    ↓
Main Process Handler (index.js)
    ↓
Planning (planner.js)
  - Validate server/directory/branch
  - Generate command sequence
    ↓
Execution (executor.js)
  - Build SSH command
  - Execute remotely
  - Return results
    ↓
IPC Response to Renderer
    ↓
UI Update (success/error display)
```

## 🔒 Security Features

1. **Directory Whitelisting**: Only pre-approved directories can be deployed
2. **Server Configuration**: Centralized server definitions prevent unauthorized access
3. **Input Validation**: Branch names and parameters are validated to prevent injection
4. **Context Isolation**: Renderer process cannot access Node.js APIs
5. **SSH Authentication**: Uses system SSH credentials (no password storage)

## 🎨 UI Workflow

1. **Select Server** → Populates available directories
2. **Select Directory** → Choose application to deploy
3. **Enter Branch** → Specify git branch name
4. **Plan Deployment** → Review commands before execution
5. **Execute** → Run deployment with real-time feedback

## 🧩 Component Overview

### Agent System (Future-Ready)

The current implementation uses a simple agent pattern that's ready to evolve:

**Planner** ([planner.js](src/main/agent/planner.js))

- Validates deployment requests
- Generates command sequences
- Future: Support multiple deployment strategies (Docker, custom scripts)

**Executor** ([executor.js](src/main/agent/executor.js))

- Executes commands via SSH
- Provides detailed error handling
- Future: Support parallel execution, retry logic, streaming output

### Configuration System

**Server Configuration** ([servers.json](src/main/config/servers.json))

```json
{
  "server-key": {
    "sshHost": ["host1", "host2"],
    "allowedDirectories": ["app1", "app2", "app3"]
  }
}
```

**Future Enhancements:**

- Environment-specific configs (dev/staging/prod)
- Encrypted credentials
- Per-directory custom commands
- Deployment hooks (pre/post actions)

## 🚀 Future Extensibility

The codebase is structured to easily support:

### Multiple Operational Actions

- Rollback deployments
- Database backups
- Log viewing
- Service management
- Health checks

### AI-Powered Planning

- Automatic deployment strategy selection
- Risk assessment and validation
- Predictive error detection
- Smart rollback recommendations

### Agent-Style Workflows

- Multi-step deployment pipelines
- Conditional execution based on results
- Parallel deployment across servers
- Automated testing and verification

## 📝 Adding New Features

### Adding a New Deployment Action

1. **Create command generator** in `planner.js`:

```javascript
export function generateRollbackCommands({ directory, targetCommit }) {
  return [
    `cd /var/webs/${directory}`,
    `git checkout ${targetCommit}`,
    `rails db:migrate:down`,
    // ...
  ];
}
```

2. **Add IPC handler** in `main/index.js`:

```javascript
ipcMain.handle('agent:rollback', async (_event, payload) => {
  return await executeRollback(payload);
});
```

3. **Expose in preload** (`preload/index.cjs`):

```javascript
rollback: (payload) => ipcRenderer.invoke('agent:rollback', payload),
```

4. **Update UI** in `renderer.js` to call the new action

## 🐛 Troubleshooting

**SSH Connection Issues:**

- Ensure SSH keys are configured (`~/.ssh/config`)
- Test SSH access manually: `ssh server-name`
- Check SSH agent is running

**Permission Errors:**

- Verify user has sudo/systemctl permissions
- Check directory ownership and permissions

**Command Failures:**

- Review error output in the result panel
- Check Rails environment is properly configured
- Verify git remote access

## 📄 License

MIT License - Open to contributions by developers. See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
