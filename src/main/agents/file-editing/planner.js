import {
  loadServersConfig,
  loadFileEditFunctions,
} from '../../config/loadConfig.js';
import {
  validateString,
  validateNonEmpty,
  validateIncludes,
  validateNoNewlines,
} from '../../utils/validators.js';
import { logSuccess } from '../../utils/logger.js';

const BASE_DIRECTORY = '/var/webs';

export const FILE_EDIT_FUNCTIONS = {
  HASH_DATA_UPDATE: 'hash-data-update',
};

export function planFileEdit({ serverKey, directory, functionId, inputs }) {
  const serversConfig = loadServersConfig();
  const functionsConfig = loadFileEditFunctions();

  // Validate server
  validateString(serverKey, 'Server key');
  validateNonEmpty(serverKey, 'Server key');
  validateIncludes(serverKey, Object.keys(serversConfig), 'Server key');

  const serverConfig = serversConfig[serverKey];

  // Validate directory
  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateIncludes(directory, serverConfig.allowedDirectories, 'Directory');

  // Validate function
  validateString(functionId, 'Function');
  validateNonEmpty(functionId, 'Function');
  validateIncludes(functionId, Object.keys(functionsConfig), 'Function');

  const functionConfig = functionsConfig[functionId];

  // Validate required inputs
  validateFunctionInputs(functionConfig, inputs);

  // Generate commands
  const commands = generateFileEditCommands({
    functionId,
    functionConfig,
    directory,
    inputs,
  });

  const plan = {
    serverKey,
    directory,
    functionId,
    functionName: functionConfig.name,
    targetFile: functionConfig.targetFile,
    inputs,
    commands,
    sshHost: serverConfig.sshHost,
    createdAt: new Date().toISOString(),
  };

  logSuccess('fileEdit', 'Plan created', {
    server: serverKey,
    directory,
    function: functionId,
    targetFile: functionConfig.targetFile,
    commands: commands.length,
  });

  return plan;
}

function validateFunctionInputs(functionConfig, inputs) {
  if (!functionConfig.inputs) return;

  for (const inputDef of functionConfig.inputs) {
    const value = inputs?.[inputDef.key];

    if (inputDef.required) {
      validateString(value, inputDef.label);
      validateNonEmpty(value, inputDef.label);
      validateNoNewlines(value, inputDef.label);
    }
  }
}

function generateFileEditCommands({
  functionId,
  functionConfig,
  directory,
  inputs,
}) {
  const appPath = `${BASE_DIRECTORY}/${directory}`;
  const filePath = `${appPath}/${functionConfig.targetFile}`;

  switch (functionId) {
    case FILE_EDIT_FUNCTIONS.HASH_DATA_UPDATE:
      return generateHashDataUpdateCommands(
        filePath,
        directory,
        inputs.newValue
      );

    default:
      throw new Error(`Unknown file edit function: ${functionId}`);
  }
}

function generateHashDataUpdateCommands(filePath, directory, newValue) {
  const escapedValue = escapeForShell(newValue);
  const backupPath = `${filePath}.backup`;
  const serviceName = `${directory}.service`;

  // Command definitions
  const cdCommand = `cd $(dirname ${filePath})`;
  const backupCommand = `cp ${filePath} ${backupPath}`;
  const awkCommand = buildAwkTransformCommand(
    filePath,
    backupPath,
    escapedValue
  );
  const verifyCommand = `grep -A 10 "def hash_data" ${filePath}`;
  const restartCommand = `sudo systemctl restart ${serviceName}`;

  return [cdCommand, backupCommand, awkCommand, verifyCommand, restartCommand];
}

function buildAwkTransformCommand(filePath, backupPath, escapedValue) {
  // Use single quotes in -v option to prevent shell expansion
  // Single quotes prevent all variable expansion and special character interpretation
  const safeValue = escapedValue.replace(/'/g, "'\\''");
  return `awk -v newval='${safeValue}' '
    /def hash_data/ { inside=1; print; next }
    inside && /^[[:space:]]*end[[:space:]]*$/ { 
      print "    \\"" newval "\\""; 
      print; 
      inside=0; 
      next 
    }
    inside { print "    # " substr($0, 5); next }
    { print }
  ' ${backupPath} > ${filePath}`;
}

function escapeForShell(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "'")
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

export function getFileEditFunctions() {
  return loadFileEditFunctions();
}

export function planRestore({ serverKey, directory, targetFile }) {
  const serversConfig = loadServersConfig();

  validateString(serverKey, 'Server key');
  validateNonEmpty(serverKey, 'Server key');
  validateIncludes(serverKey, Object.keys(serversConfig), 'Server key');

  const serverConfig = serversConfig[serverKey];

  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateIncludes(directory, serverConfig.allowedDirectories, 'Directory');

  validateString(targetFile, 'Target file');
  validateNonEmpty(targetFile, 'Target file');

  const commands = generateRestoreCommands(directory, targetFile);

  const plan = {
    serverKey,
    directory,
    targetFile,
    commands,
    sshHost: serverConfig.sshHost,
    createdAt: new Date().toISOString(),
  };

  logSuccess('fileEdit', 'Restore plan created', {
    server: serverKey,
    directory,
    targetFile,
    commands: commands.length,
  });

  return plan;
}

function generateRestoreCommands(directory, targetFile) {
  const appPath = `${BASE_DIRECTORY}/${directory}`;
  const serviceName = `${directory}.service`;

  const cdCommand = `cd ${appPath}`;
  const restoreCommand = `git restore -- "${targetFile}"`;
  const restartCommand = `sudo systemctl restart ${serviceName}`;

  return [cdCommand, restoreCommand, restartCommand];
}
