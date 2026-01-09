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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, 'servers.json');
const FILE_EDIT_FUNCTIONS_PATH = path.join(__dirname, 'fileEditFunctions.json');

export function loadServersConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      throw new Error(`Configuration file not found at: ${CONFIG_FILE_PATH}`);
    }

    const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    const config = JSON.parse(fileContent);

    validateObject(config, 'Configuration');

    const serverKeys = Object.keys(config);
    if (serverKeys.length === 0) {
      throw new Error('Configuration must contain at least one server');
    }

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

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
    throw error;
  }
}

export function loadFileEditFunctions() {
  try {
    if (!fs.existsSync(FILE_EDIT_FUNCTIONS_PATH)) {
      throw new Error(
        `File edit functions config not found at: ${FILE_EDIT_FUNCTIONS_PATH}`
      );
    }

    const fileContent = fs.readFileSync(FILE_EDIT_FUNCTIONS_PATH, 'utf-8');
    const config = JSON.parse(fileContent);

    validateObject(config, 'File edit functions configuration');

    const functionIds = Object.keys(config);
    if (functionIds.length === 0) {
      throw new Error('File edit functions must contain at least one function');
    }

    for (const functionId of functionIds) {
      const funcConfig = config[functionId];
      validateObject(funcConfig, `Function "${functionId}" configuration`);
      validateProperty(funcConfig, 'name', `Function "${functionId}"`);
      validateProperty(funcConfig, 'targetFile', `Function "${functionId}"`);
      validateString(funcConfig.name, `Function "${functionId}" name`);
      validateString(
        funcConfig.targetFile,
        `Function "${functionId}" targetFile`
      );
    }

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON in file edit functions config: ${error.message}`
      );
    }
    throw error;
  }
}
