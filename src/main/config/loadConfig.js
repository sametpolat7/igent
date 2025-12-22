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
import { validateServerConfig } from '../validators/index.js';

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

    validateServerConfig(config);

    console.log('[Config] Loaded servers:', Object.keys(config).join(', '));

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
    throw error;
  }
}
