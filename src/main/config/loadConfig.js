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
import {
  validateObject,
  validateString,
  validateNonEmpty,
  validateArray,
  validateArrayNotEmpty,
  validateProperty,
} from '../utils/validators.js';
import { logSuccess } from '../utils/logger.js';

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

    // Validate configuration structure
    validateObject(config, 'Configuration');

    const serverKeys = Object.keys(config);
    if (serverKeys.length === 0) {
      throw new Error('Configuration must contain at least one server');
    }

    // Validate each server
    for (const serverKey of serverKeys) {
      const serverConfig = config[serverKey];
      validateObject(serverConfig, `Server "${serverKey}" configuration`);
      validateProperty(serverConfig, 'sshHost', `Server "${serverKey}"`);
      validateString(serverConfig.sshHost, `Server "${serverKey}" sshHost`);
      validateNonEmpty(serverConfig.sshHost, `Server "${serverKey}" sshHost`);
      validateProperty(
        serverConfig,
        'allowedDirectories',
        `Server "${serverKey}"`
      );
      validateArray(
        serverConfig.allowedDirectories,
        `Server "${serverKey}" allowedDirectories`
      );
      validateArrayNotEmpty(
        serverConfig.allowedDirectories,
        `Server "${serverKey}" allowedDirectories`
      );
      for (const dir of serverConfig.allowedDirectories) {
        validateString(dir, `Server "${serverKey}" directory`);
        validateNonEmpty(dir, `Server "${serverKey}" directory`);
      }
    }

    logSuccess('Config', 'Loaded servers', {
      servers: Object.keys(config),
    });

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
    throw error;
  }
}
