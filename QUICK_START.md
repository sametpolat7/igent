# Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Your Servers

Edit [src/main/config/servers.json](src/main/config/servers.json):

```json
{
  "your-server": {
    "sshHost": ["server1", "server2"],
    "allowedDirectories": ["app1", "app2", "app3"]
  }
}
```

### 3. Test SSH Access

```bash
# Make sure you can SSH without password
ssh server1
```

### 4. Run the Application

```bash
npm start
```

### 5. Deploy!

1. Select server from dropdown
2. Select directory
3. Enter branch name (e.g., `develop`)
4. Click "Plan Deployment"
5. Review commands
6. Click "Execute Deployment"

## 📋 Configuration Format

### servers.json Structure

```json
{
  "server-key": {
    "sshHost": ["ssh-host-1", "ssh-host-2"],
    "allowedDirectories": ["directory-1", "directory-2"]
  }
}
```

### Example

```json
{
  "production": {
    "sshHost": ["prod1.example.com", "prod2.example.com"],
    "allowedDirectories": ["myapp", "myapp-api", "admin-panel"]
  },
  "staging": {
    "sshHost": ["staging.example.com"],
    "allowedDirectories": ["test-app", "test-api"]
  }
}
```

## 🔒 SSH Setup

The application uses your system's SSH credentials. Set up SSH keys:

### 1. Generate SSH Key (if you don't have one)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### 2. Copy to Server

```bash
ssh-copy-id user@server
```

### 3. Test Connection

```bash
ssh user@server
```

### 4. Configure SSH Config (Optional)

Edit `~/.ssh/config`:

```
Host myserver
    HostName server.example.com
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```

Then use `myserver` in your servers.json sshHost.

## ⚙️ Deployment Process

### What Happens During Deployment

1. **Navigate to Directory**

   ```bash
   cd /var/webs/your-directory
   ```

2. **Fetch Latest Changes**

   ```bash
   git fetch origin
   ```

3. **Stash Local Changes**

   ```bash
   git stash
   ```

4. **Update Main Branch**

   ```bash
   git checkout main
   git pull origin main
   ```

5. **Switch to Target Branch**

   ```bash
   git checkout your-branch
   git pull origin your-branch
   ```

6. **Restore Stashed Changes**

   ```bash
   git stash pop
   ```

7. **Run Migrations**

   ```bash
   rails db:migrate
   ```

8. **Rebuild Assets**

   ```bash
   rails assets:clobber
   rails assets:precompile
   ```

9. **Restart Service**
   ```bash
   systemctl restart your-directory.service
   ```

## 🐛 Troubleshooting

### "Failed to load servers"

- Check [servers.json](src/main/config/servers.json) syntax
- Ensure file exists in `src/main/config/`

### "Directory not allowed"

- Add directory to `allowedDirectories` in servers.json
- Restart application

### "SSH Connection Failed"

- Test SSH manually: `ssh your-host`
- Check SSH key permissions: `chmod 600 ~/.ssh/id_ed25519`
- Verify SSH agent: `ssh-add -l`

### "Command Timeout"

- Default timeout is 5 minutes
- Edit [executor.js](src/main/agent/executor.js) `EXECUTION_TIMEOUT_MS`

### "Rails Command Not Found"

- Ensure Rails is in PATH on remote server
- Check that bash login shell loads rbenv/rvm
- Test manually: `ssh server "bash -l -c 'which rails'"`

## 📝 Common Tasks

### Add a New Server

1. Edit [servers.json](src/main/config/servers.json)
2. Add new server entry with sshHost and allowedDirectories
3. Restart application

### Add a New Directory

1. Edit [servers.json](src/main/config/servers.json)
2. Add directory to appropriate server's allowedDirectories
3. Restart application

### Change Deployment Commands

1. Edit [planner.js](src/main/agent/planner.js)
2. Modify `generateGitDeploymentCommands` function
3. Restart application

### Increase Timeout

1. Edit [executor.js](src/main/agent/executor.js)
2. Change `EXECUTION_TIMEOUT_MS` value
3. Restart application

## 🎓 Understanding the Code

### Key Files to Know

| File                                                           | Purpose                 |
| -------------------------------------------------------------- | ----------------------- |
| [src/main/index.js](src/main/index.js)                         | Application entry point |
| [src/main/agent/planner.js](src/main/agent/planner.js)         | Plan deployments        |
| [src/main/agent/executor.js](src/main/agent/executor.js)       | Execute commands        |
| [src/main/config/loadConfig.js](src/main/config/loadConfig.js) | Load configuration      |
| [src/preload/index.cjs](src/preload/index.cjs)                 | Security bridge         |
| [src/renderer/renderer.js](src/renderer/renderer.js)           | UI logic                |

### Code Flow

```
UI (renderer.js)
    ↓ window.igent API
Preload (index.cjs)
    ↓ IPC channel
Main Process (index.js)
    ↓ Routing
Planner (planner.js) → Validates & Generates Commands
    ↓
Executor (executor.js) → Executes via SSH
    ↓
Result → Back to UI
```

## 🚀 Next Steps

1. ✅ Test deployment on staging server
2. ✅ Verify rollback procedure manually
3. ✅ Document your specific deployment workflow
4. ✅ Add more servers/directories as needed
5. ✅ Consider adding logging to file
6. ✅ Plan for future features (rollback UI, logs view, etc.)

## 📚 Additional Resources

- [README.md](README.md) - Full documentation
- [ARCHITECTURE.js](ARCHITECTURE.js) - Visual architecture guide

## 💡 Tips

- Always test on staging first
- Review commands before executing
- Keep servers.json under version control
- Document your deployment workflows
- Set up SSH keys for passwordless access
- Monitor logs during first few deployments

## 🆘 Need Help?

1. Check error message in the UI
2. Review console logs (View → Developer → DevTools)
3. Test SSH connection manually
4. Check server configuration
5. Review [Troubleshooting](#-troubleshooting) section

---

**Ready to deploy!** 🎉
