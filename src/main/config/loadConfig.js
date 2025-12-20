/**
 * Configuration Loader - Server Configuration Management
 *
 * Responsibilities:
 * - Load and parse server configuration from JSON file
 * - Validate configuration structure
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, 'servers.json');

/**
 * Load and validate servers configuration
 *
 * @returns {Object} Servers configuration object
 * @throws {Error} If configuration file is missing, invalid, or malformed
 */
export function loadServersConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      throw new Error(`Configuration file not found at: ${CONFIG_FILE_PATH}`);
    }

    const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    const config = JSON.parse(fileContent);

    validateConfigStructure(config);

    console.log('[Config] Loaded servers:', Object.keys(config).join(', '));

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate configuration structure and required fields
 *
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If configuration is invalid
 */
function validateConfigStructure(config) {
  // Validate top-level structure
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  const serverKeys = Object.keys(config);

  // Validate at least one server is defined
  if (serverKeys.length === 0) {
    throw new Error('Configuration must contain at least one server');
  }

  // Validate each server configuration
  for (const serverKey of serverKeys) {
    const serverConfig = config[serverKey];

    // Validate server configuration is an object
    if (!serverConfig || typeof serverConfig !== 'object') {
      throw new Error(`Server "${serverKey}" configuration must be an object`);
    }

    // Validate SSH host
    if (typeof serverConfig.sshHost !== 'string') {
      throw new Error(`Server "${serverKey}" must have "sshHost" string`);
    }

    if (serverConfig.sshHost.length === 0) {
      throw new Error(`Server "${serverKey}" must have at least one SSH host`);
    }

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

    // Validate array items are strings
    for (const host of serverConfig.sshHost) {
      if (typeof host !== 'string' || host.trim().length === 0) {
        throw new Error(
          `Server "${serverKey}" has invalid SSH host (must be non-empty string)`
        );
      }
    }

    for (const dir of serverConfig.allowedDirectories) {
      if (typeof dir !== 'string' || dir.trim().length === 0) {
        throw new Error(
          `Server "${serverKey}" has invalid directory (must be non-empty string)`
        );
      }
    }
  }
}
