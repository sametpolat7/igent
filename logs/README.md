# Logs Directory

This directory contains application log files generated during runtime.

## Structure

- Log files are automatically created daily with the naming convention: `igent-YYYY-MM-DD.log`
- Each entry includes: timestamp, log level, module name, message, and optional data
- Logs are written to both console (with colors) and files (plain text)

## Log Levels

- **START**: Operation initialization with parameters
- **INFO**: General informational messages about application flow
- **SUCCESS**: Successful completion of operations
- **WARN**: Warning messages for non-critical issues
- **ERROR**: Error messages with stack traces
- **DEBUG**: Detailed debugging information

## File Rotation

Log files automatically rotate daily. Each day gets its own log file to keep file sizes manageable and make it easy to find logs from specific dates.

## Git Control

**Important**: This directory and all `.log` files are excluded from git control via `.gitignore`. Each developer maintains their own logs locally. Never commit log files to the repository.

## Maintenance

Old log files can be safely deleted manually. There is no automatic cleanup, so you may want to periodically remove logs older than a few weeks to save disk space.

## Example Log Entry

```
[2026-01-13T10:30:45.123Z] [INFO] [Server Update Executor] Starting server update operation
  Data: {
    "server": "test-server",
    "directory": "backend",
    "branch": "main"
  }
```
