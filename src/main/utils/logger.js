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

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
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
}
