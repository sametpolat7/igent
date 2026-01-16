# Changelog

All notable changes to igent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-16

### Fixed

- **Linux**: Added `--no-sandbox` executable argument via electron-builder to resolve SUID sandbox crash on AppImage and deb installations

### Notes

- **Windows**: SmartScreen warning persists for unsigned executables. Code signing with a trusted certificate is required for permanent resolution
- **Linux**: Ubuntu 24.04+ users must install FUSE v2 (`sudo apt install libfuse2t64`) before running the AppImage

## [1.0.0] - 2026-01-15

### Added

#### Core Features

- **Server Update Agent**: Automated Git-based server updates with intelligent conflict detection
  - Git operations (stash, checkout, pull, stash pop)
  - Rails database migrations with automatic rollback
  - Asset precompilation and cache clearing
  - Service restart automation
  - Automatic conflict detection and cleanup (merge, stash, unmerged index)
- **File Editing Agent**: Template-based remote file transformations
  - Configuration-driven file editing functions
  - Automatic backup and restore capabilities
  - Git-based change detection and restoration
  - Service restart after modifications
- **Queue Control Agent**: Sidekiq process management
  - Real-time process status monitoring with PID tracking
  - Start/stop/restart operations with verification
  - Worker statistics and process information display

#### Security

- Multi-layer input validation (UI, IPC, business logic, execution)
- Directory whitelisting per server configuration
- SSH key-based authentication (no credential storage)
- Shell injection prevention with argument escaping
- Context isolation with sandboxed renderer process
- Rate limiting (max 5 concurrent operations, 1s cooldown)
- XSS protection with secure DOM manipulation

#### Developer Experience

- Real-time step-by-step progress tracking with duration metrics
- Structured logging with file output and color-coded console
- Comprehensive error messages with context
- Multi-view navigation UI
- Cross-platform build support (macOS, Windows, Linux)

### Technical Details

- **Architecture**: Three-process Electron security model with strict process isolation
- **Communication**: IPC-based with explicit channel whitelisting via contextBridge
- **Module System**: ES Modules (main/renderer), CommonJS (preload security bridge)
- **Logging**: Timestamped dual output (console + daily log files)
- **Build Targets**:
  - macOS: Universal DMG/ZIP with hardened runtime
  - Windows: NSIS installer and portable executable
  - Linux: AppImage and Debian package

### Infrastructure

- ESLint + Prettier code quality enforcement
- Automated build pipeline with electron-builder
- MIT License

[1.0.1]: https://github.com/sametpolat7/igent/releases/tag/v1.0.1
[1.0.0]: https://github.com/sametpolat7/igent/releases/tag/v1.0.0
