# Release Notes - v1.0.1

**Release Date:** January 16, 2026

## Summary

Patch release addressing cross-platform build and runtime issues discovered after the initial 1.0.0 release. This update focuses on Linux compatibility fixes and documents Windows SmartScreen behavior.

---

## 🐛 Bug Fixes

### Linux AppImage Sandbox Fix

- **Issue:** On modern Linux distributions (Ubuntu 22.04+, Fedora 38+), the AppImage crashed immediately with a SIGTRAP signal
- **Cause:** Electron's bundled `chrome-sandbox` binary requires SUID root permissions (owner root, mode 4755), which cannot be satisfied inside an AppImage
- **Fix:** Disabled Electron sandbox at runtime for Linux platform via `app.commandLine.appendSwitch('no-sandbox')` in main process
- **Impact:** AppImage now launches correctly on all Linux distributions without manual flags

---

## 📋 Known Issues & Workarounds

### Windows SmartScreen Warning

Windows displays an "Unknown Publisher" warning when running the installer or portable executable.

**Why this happens:**

- The executable is not signed with a code-signing certificate
- SmartScreen cannot verify publisher identity or establish reputation

**Workaround:**

1. Click "More info" on the SmartScreen dialog
2. Click "Run anyway"

**Permanent solution:** Obtain and configure a code-signing certificate (EV or OV) for Windows builds. This will be addressed in a future release.

### Linux FUSE v2 Dependency

Ubuntu 24.04 and newer distributions do not include FUSE v2 by default, which is required for AppImage.

**Install FUSE v2:**

```bash
sudo apt install libfuse2t64
```

For other distributions:

```bash
# Fedora
sudo dnf install fuse-libs

# Arch Linux
sudo pacman -S fuse2
```

### macOS Gatekeeper Warning

macOS may display "app is from an unidentified developer" on first launch.

**Workaround:**

1. Right-click the app and select "Open"
2. Click "Open" in the confirmation dialog
3. Alternatively: System Preferences → Security & Privacy → "Open Anyway"

---

## 📦 Installation

### macOS

- Download `igent-1.0.1-universal.dmg` or `igent-1.0.1-universal-mac.zip`
- Drag to Applications folder

### Windows

- **Installer:** Download and run `igent-Setup-1.0.1.exe`
- **Portable:** Download `igent-1.0.1.exe` (no installation required)

### Linux

- **AppImage:** Download `igent-1.0.1.AppImage`, make executable (`chmod +x`), and run
- **Debian/Ubuntu:** Download and install `igent_1.0.1_amd64.deb`

---

## 🔗 Links

- [Full Changelog](../CHANGELOG.md)
- [Documentation](../README.md)
- [Report Issues](https://github.com/sametpolat7/igent/issues)
