import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const LOG_DIR = path.join(__dirname, '../../../logs');
let currentLogFile = null;
let logFileInitialized = false;

function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function getFullTimestamp() {
  return new Date().toISOString();
}

async function initializeLogFile() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const dateStr = getDateString();
    currentLogFile = path.join(LOG_DIR, `igent-${dateStr}.log`);
    logFileInitialized = true;
  } catch (error) {
    console.error('Failed to initialize log file:', error);
    logFileInitialized = false;
  }
}

async function writeToFile(level, module, message, data = null) {
  if (!logFileInitialized) {
    await initializeLogFile();
  }

  if (!currentLogFile) return;

  try {
    const timestamp = getFullTimestamp();
    let logEntry = `[${timestamp}] [${level}] [${module}] ${message}`;

    if (data !== undefined && data !== null) {
      if (data instanceof Error) {
        logEntry += `\n  Error: ${data.message}`;
        if (data.stack) {
          logEntry += `\n  Stack: ${data.stack}`;
        }
      } else if (typeof data === 'object') {
        logEntry += `\n  Data: ${JSON.stringify(data, null, 2)}`;
      } else {
        logEntry += `\n  Data: ${data}`;
      }
    }

    logEntry += '\n';

    const dateStr = getDateString();
    const expectedLogFile = path.join(LOG_DIR, `igent-${dateStr}.log`);
    if (currentLogFile !== expectedLogFile) {
      currentLogFile = expectedLogFile;
    }

    await fs.appendFile(currentLogFile, logEntry, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

function formatModule(module) {
  return `${COLORS.dim}[${COLORS.cyan}${module}${COLORS.dim}]${COLORS.reset}`;
}

function formatData(data) {
  if (typeof data === 'object' && data !== null) {
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

export function logInfo(module, message, data) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const label = `${COLORS.blue}INFO${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(`${timestamp} ${label} ${moduleStr} ${message}`);
  if (data !== undefined) {
    console.log(`${COLORS.dim}${formatData(data)}${COLORS.reset}`);
  }

  writeToFile('INFO', module, message, data).catch(() => {});
}

export function logSuccess(module, message, data) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const label = `${COLORS.green}${COLORS.bright}SUCCESS${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${label} ${moduleStr} ${COLORS.green}${message}${COLORS.reset}`
  );
  if (data !== undefined) {
    console.log(`${COLORS.dim}${formatData(data)}${COLORS.reset}`);
  }

  writeToFile('SUCCESS', module, message, data).catch(() => {});
}

export function logWarn(module, message, data) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const label = `${COLORS.yellow}${COLORS.bright}WARN${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${label} ${moduleStr} ${COLORS.yellow}${message}${COLORS.reset}`
  );
  if (data !== undefined) {
    console.log(`${COLORS.dim}${formatData(data)}${COLORS.reset}`);
  }

  writeToFile('WARN', module, message, data).catch(() => {});
}

export function logError(module, message, error) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const label = `${COLORS.red}${COLORS.bright}ERROR${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.error(
    `${timestamp} ${label} ${moduleStr} ${COLORS.red}${message}${COLORS.reset}`
  );
  if (error !== undefined) {
    if (error instanceof Error) {
      console.error(`${COLORS.red}${error.message}${COLORS.reset}`);
      if (error.stack) {
        console.error(`${COLORS.dim}${error.stack}${COLORS.reset}`);
      }
    } else {
      console.error(`${COLORS.dim}${formatData(error)}${COLORS.reset}`);
    }
  }

  writeToFile('ERROR', module, message, error).catch(() => {});
}

export function logDebug(module, message, data) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const label = `${COLORS.gray}DEBUG${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${label} ${moduleStr} ${COLORS.dim}${message}${COLORS.reset}`
  );
  if (data !== undefined) {
    console.log(`${COLORS.dim}${formatData(data)}${COLORS.reset}`);
  }

  writeToFile('DEBUG', module, message, data).catch(() => {});
}

export function logStart(module, operation, params) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const label = `${COLORS.blue}${COLORS.bright}START${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${label} ${moduleStr} ${COLORS.bright}${operation}${COLORS.reset}`
  );
  if (params && Object.keys(params).length > 0) {
    console.log(`${COLORS.dim}${formatData(params)}${COLORS.reset}`);
  }

  writeToFile('START', module, operation, params).catch(() => {});
}
