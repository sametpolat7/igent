import path from 'node:path';
import { logWarn, logError, logDebug } from './logger.js';

const operationTracker = new Map();
const MAX_CONCURRENT_OPERATIONS = 5;
const OPERATION_COOLDOWN_MS = 1000;

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

function checkRateLimit(operationType, identifier) {
  const key = `${operationType}:${identifier}`;
  const now = Date.now();
  const lastOperation = operationTracker.get(key);

  const activeOperations = Array.from(operationTracker.values()).filter(
    (op) => op.active
  ).length;

  if (activeOperations >= MAX_CONCURRENT_OPERATIONS) {
    throw new RateLimitError(
      `Maximum concurrent operations (${MAX_CONCURRENT_OPERATIONS}) reached`
    );
  }

  if (lastOperation && lastOperation.timestamp) {
    const timeSinceLastOp = now - lastOperation.timestamp;
    if (timeSinceLastOp < OPERATION_COOLDOWN_MS) {
      const waitTime = Math.ceil(
        (OPERATION_COOLDOWN_MS - timeSinceLastOp) / 1000
      );
      throw new RateLimitError(
        `Operation cooldown active. Please wait ${waitTime} second(s)`
      );
    }
  }

  operationTracker.set(key, { active: true, timestamp: now });
  logDebug('security', `Rate limit check passed for ${key}`);
}

function releaseRateLimit(operationType, identifier) {
  const key = `${operationType}:${identifier}`;
  const entry = operationTracker.get(key);
  if (entry) {
    entry.active = false;
    entry.timestamp = Date.now();
    operationTracker.set(key, entry);
  }
  logDebug('security', `Rate limit released for ${key}`);
}

const DANGEROUS_PATTERNS = [
  { pattern: /[;&|`$()<>"]/g, name: 'shell metacharacters' },
  { pattern: /\$\{/g, name: 'variable expansion' },
  { pattern: /\$\(/g, name: 'command substitution' },
  { pattern: /\.\./g, name: 'path traversal' },
  { pattern: /~\//g, name: 'home directory expansion' },
  { pattern: /\r|\n/g, name: 'newline characters' },
  // eslint-disable-next-line no-control-regex
  { pattern: /\x00/g, name: 'null bytes' },
];

const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9._/-]+$/;
const DIRECTORY_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const SSH_HOST_PATTERN = /^[a-zA-Z0-9._-]+$/;

const MAX_INPUT_LENGTH = 1000;
const MAX_BRANCH_LENGTH = 255;
const MAX_DIRECTORY_LENGTH = 255;
const MAX_SSH_HOST_LENGTH = 253;

function sanitizeBranchName(branchName) {
  if (!branchName || typeof branchName !== 'string') {
    throw new Error('Branch name must be a non-empty string');
  }

  const trimmed = branchName.trim();

  if (trimmed.length === 0) {
    throw new Error('Branch name cannot be empty');
  }
  if (trimmed.length > MAX_BRANCH_LENGTH) {
    throw new Error(
      `Branch name exceeds maximum length of ${MAX_BRANCH_LENGTH} characters`
    );
  }

  if (!BRANCH_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid branch name: "${trimmed}". Only alphanumeric characters, dots, hyphens, slashes, and underscores are allowed`
    );
  }

  if (trimmed.includes('..')) {
    throw new Error('Branch name cannot contain consecutive dots (..)');
  }
  if (trimmed.startsWith('/') || trimmed.endsWith('/')) {
    throw new Error('Branch name cannot start or end with a slash');
  }
  if (trimmed.startsWith('-')) {
    throw new Error('Branch name cannot start with a hyphen');
  }

  return trimmed;
}

export function sanitizeDirectoryName(directory) {
  if (!directory || typeof directory !== 'string') {
    throw new Error('Directory must be a non-empty string');
  }

  const trimmed = directory.trim();

  if (trimmed.length === 0) {
    throw new Error('Directory name cannot be empty');
  }
  if (trimmed.length > MAX_DIRECTORY_LENGTH) {
    throw new Error(
      `Directory name exceeds maximum length of ${MAX_DIRECTORY_LENGTH} characters`
    );
  }

  if (!DIRECTORY_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid directory name: "${trimmed}". Only alphanumeric characters, dots, hyphens, and underscores are allowed`
    );
  }

  if (trimmed.includes('..')) {
    throw new Error('Directory name cannot contain consecutive dots (..)');
  }
  if (trimmed === '.' || trimmed === '..') {
    throw new Error('Directory name cannot be "." or ".."');
  }
  if (trimmed.startsWith('-')) {
    throw new Error('Directory name cannot start with a hyphen');
  }

  return trimmed;
}

export function sanitizeSSHHost(sshHost) {
  if (!sshHost || typeof sshHost !== 'string') {
    throw new Error('SSH host must be a non-empty string');
  }

  const trimmed = sshHost.trim();

  if (trimmed.length === 0) {
    throw new Error('SSH host cannot be empty');
  }
  if (trimmed.length > MAX_SSH_HOST_LENGTH) {
    throw new Error(
      `SSH host exceeds maximum length of ${MAX_SSH_HOST_LENGTH} characters`
    );
  }

  if (!SSH_HOST_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid SSH host: "${trimmed}". Only alphanumeric characters, dots, hyphens, and underscores are allowed`
    );
  }

  if (trimmed.startsWith('-')) {
    throw new Error(
      'SSH host cannot start with a hyphen (flag injection risk)'
    );
  }
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    throw new Error('SSH host cannot start or end with a dot');
  }
  if (trimmed.includes('..')) {
    throw new Error('SSH host cannot contain consecutive dots');
  }

  return trimmed;
}

function sanitizeUserInput(input, context = 'user input') {
  if (!input || typeof input !== 'string') {
    throw new Error(`${context} must be a non-empty string`);
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new Error(`${context} cannot be empty`);
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    throw new Error(
      `${context} exceeds maximum length of ${MAX_INPUT_LENGTH} characters`
    );
  }

  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      logWarn('security', `Dangerous pattern detected in ${context}: ${name}`);
      throw new Error(`Invalid ${context}: contains forbidden ${name}`);
    }
  }

  return trimmed;
}

export function validateAndNormalizePath(basePath, userDirectory) {
  const sanitizedDir = sanitizeDirectoryName(userDirectory);
  const fullPath = path.join(basePath, sanitizedDir);
  const normalizedPath = path.normalize(fullPath);
  const resolvedPath = path.resolve(normalizedPath);

  if (!resolvedPath.startsWith(path.resolve(basePath))) {
    logError(
      'security',
      `Path traversal attempt detected: ${userDirectory} -> ${resolvedPath}`
    );
    throw new Error('Path traversal detected: directory escapes base path');
  }

  return resolvedPath;
}

export function escapeShellArg(arg) {
  if (!arg) return "''";
  if (typeof arg !== 'string') {
    throw new Error('Shell argument must be a string');
  }

  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export function buildSafeSSHCommand(sshHost, remoteCommand) {
  const sanitizedHost = sanitizeSSHHost(sshHost);

  const escapedCommand = escapeShellArg(remoteCommand);

  const sshCommand = `ssh ${sanitizedHost} ${escapedCommand}`;

  return sshCommand;
}

function escapeAWKString(str) {
  if (typeof str !== 'string') {
    throw new Error('AWK string must be a string');
  }

  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

export function buildSafeFileEditCommand(filePath, backupPath, userValue) {
  const sanitized = sanitizeUserInput(userValue, 'file edit value');

  const awkEscaped = escapeAWKString(sanitized);

  const awkScript = `awk '
    /def hash_data/ { inside=1; print; next }
    inside && /^[[:space:]]*end[[:space:]]*$/ { 
      print "    \\"${awkEscaped}\\""; 
      print; 
      inside=0; 
      next 
    }
    inside { print "    # " substr($0, 5); next }
    { print }
  ' ${escapeShellArg(backupPath)} > ${escapeShellArg(filePath)}`;

  logDebug('security', 'Safe file edit command built with nested escaping');
  return awkScript;
}

export function validateOperationParams({
  serverKey,
  directory,
  sshHost,
  branch,
  userInputs = {},
}) {
  const validated = {};

  if (serverKey) {
    validated.serverKey = sanitizeUserInput(serverKey, 'server key');
  }

  if (directory) {
    validated.directory = sanitizeDirectoryName(directory);
  }

  if (sshHost) {
    validated.sshHost = sanitizeSSHHost(sshHost);
  }

  if (branch) {
    validated.branch = sanitizeBranchName(branch);
  }

  if (userInputs && typeof userInputs === 'object') {
    validated.userInputs = {};
    for (const [key, value] of Object.entries(userInputs)) {
      if (typeof value === 'string') {
        validated.userInputs[key] = sanitizeUserInput(value, `input: ${key}`);
      } else {
        validated.userInputs[key] = value;
      }
    }
  }

  return validated;
}

export class SecurityContext {
  constructor(operationType, identifier) {
    this.operationType = operationType;
    this.identifier = identifier;
    this.started = false;
  }

  start() {
    checkRateLimit(this.operationType, this.identifier);
    this.started = true;
    logDebug(
      'security',
      `Security context started: ${this.operationType}:${this.identifier}`
    );
  }

  release() {
    if (this.started) {
      releaseRateLimit(this.operationType, this.identifier);
      this.started = false;
      logDebug(
        'security',
        `Security context released: ${this.operationType}:${this.identifier}`
      );
    }
  }

  async execute(fn) {
    try {
      this.start();
      return await fn();
    } finally {
      this.release();
    }
  }
}
