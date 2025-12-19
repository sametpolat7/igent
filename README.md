# igent

A secure Electron-based automation application for iWallet deployment management. Features a clean architecture with separated main, preload, and renderer processes following Electron security best practices.

## Features

- 🔒 **Secure Architecture**: Three-process model with IPC communication
- 🚀 **Deployment Automation**: Plan and execute deployment commands
- 🖥️ **Cross-Platform**: Built with Electron for macOS, Windows, and Linux
- ⚡ **Modern Stack**: ES Modules, ESLint, Prettier

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

## Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd igent

# Install dependencies
npm install
```

## Development

```bash
# Run the application
npm start
```

## Project Structure

```
igent/
├── src/
│   ├── main/              # Main process (Node.js backend)
│   │   ├── index.js       # Application entry point
│   │   └── agent/
│   │       ├── planner.js # Deployment command planning
│   │       └── executor.js # Shell command execution
│   ├── preload/           # Preload scripts (security bridge)
│   │   └── index.cjs      # Context bridge for IPC
│   └── renderer/          # Renderer process (UI frontend)
│       ├── index.html     # Application UI
│       └── renderer.js    # Client-side logic
├── package.json
├── eslint.config.mjs
└── README.md
```

## Architecture

### Electron's 3-Process Security Model

**Main Process** ([src/main/index.js](src/main/index.js))

- Runs in Node.js with full system access
- Creates application windows
- Handles IPC requests from renderer
- Executes privileged operations (shell commands)

**Preload Script** ([src/preload/index.cjs](src/preload/index.cjs))

- Secure bridge between main and renderer
- Uses `contextBridge` to expose safe APIs
- Prevents direct Node.js access from renderer
- **Security layer**: Only approved operations allowed

**Renderer Process** ([src/renderer/](src/renderer/))

- Runs in Chromium browser (sandboxed)
- Handles UI and user interactions
- Can only access browser APIs + preload-exposed methods
- Cannot directly run shell commands or access file system

### Execution Flow

```
User Action (renderer.js)
    ↓
window.igent API call (exposed by preload)
    ↓
IPC Message (secure channel)
    ↓
Main Process Handler (main/index.js)
    ↓
Agent Logic (planner/executor)
    ↓
Shell Execution / Response
    ↓
IPC Response back to Renderer
    ↓
UI Update
```

## Technologies

- **Electron** - Desktop application framework
- **Node.js** - Backend runtime
- **ES Modules** - Modern JavaScript modules
- **ESLint & Prettier** - Code quality tools

## License

MIT License - Open to contributions by developers. See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! This project follows the MIT license, allowing free use, modification, and distribution.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
