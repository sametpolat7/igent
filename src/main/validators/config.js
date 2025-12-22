/**
 * Configuration Validators - Validation logic for server configuration
 *
 * Provides validation functions for server configuration structure
 * to ensure proper setup and security.
 */

import { validateObject, validateNonEmptyString } from './common.js';

/**
 * Validate server configuration structure and required fields
 *
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If configuration is invalid
 */
export function validateServerConfig(config) {
  // Validate top-level structure
  validateObject(config, 'Configuration');

  const serverKeys = Object.keys(config);

  // Validate at least one server is defined
  if (serverKeys.length === 0) {
    throw new Error('Configuration must contain at least one server');
  }

  // Validate each server configuration
  for (const serverKey of serverKeys) {
    const serverConfig = config[serverKey];

    // Validate server configuration is an object
    validateObject(serverConfig, `Server "${serverKey}" configuration`);

    // Validate SSH host
    if (typeof serverConfig.sshHost !== 'string') {
      throw new Error(`Server "${serverKey}" must have "sshHost" string`);
    }

    validateNonEmptyString(
      serverConfig.sshHost,
      `Server "${serverKey}" sshHost`
    );

    // Validate allowed directories
    if (!Array.isArray(serverConfig.allowedDirectories)) {
      throw new Error(
        `Server "${serverKey}" must have "allowedDirectories" array`
      );
    }

    if (serverConfig.allowedDirectories.length === 0) {
      throw new Error(
        `Server "${serverKey}" must have at least one allowed directory`
      );
    }

    // Validate directory items are non-empty strings
    for (const directory of serverConfig.allowedDirectories) {
      if (typeof directory !== 'string' || directory.trim().length === 0) {
        throw new Error(
          `Server "${serverKey}" has invalid directory (must be non-empty string)`
        );
      }
    }
  }
}
