import { exec } from 'node:child_process';

export function executeCommands(commands) {
  if (!Array.isArray(commands)) {
    throw new Error('Commands must be an array');
  }

  // Chain commands with && to run in the same shell session
  const chainedCommand = commands.join(' && ');

  return new Promise((resolve, reject) => {
    exec(chainedCommand, (error, stdout, stderr) => {
      const result = {
        commands,
        chainedCommand,
        stdout,
        stderr,
        error: error ? error.message : null,
      };

      if (error) {
        return reject(result);
      }

      resolve(result);
    });
  });
}
