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

const SYMBOLS = {
  info: '→',
  success: '✓',
  warn: '⚠',
  error: '✗',
  debug: '•',
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
  const symbol = `${COLORS.blue}${SYMBOLS.info}${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(`${timestamp} ${symbol} ${moduleStr} ${message}`);
  if (data !== undefined) {
    console.log(`${COLORS.dim}${formatData(data)}${COLORS.reset}`);
  }
}

export function logSuccess(module, message, data) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const symbol = `${COLORS.green}${SYMBOLS.success}${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${COLORS.green}${message}${COLORS.reset}`
  );
  if (data !== undefined) {
    console.log(`${COLORS.dim}${formatData(data)}${COLORS.reset}`);
  }
}

export function logWarn(module, message, data) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const symbol = `${COLORS.yellow}${SYMBOLS.warn}${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${COLORS.yellow}${message}${COLORS.reset}`
  );
  if (data !== undefined) {
    console.log(`${COLORS.dim}${formatData(data)}${COLORS.reset}`);
  }
}

export function logError(module, message, error) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const symbol = `${COLORS.red}${SYMBOLS.error}${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.error(
    `${timestamp} ${symbol} ${moduleStr} ${COLORS.red}${message}${COLORS.reset}`
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

export function logDebug(module, message) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const symbol = `${COLORS.gray}${SYMBOLS.debug}${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${COLORS.dim}${message}${COLORS.reset}`
  );
}

export function logStart(module, operation, params) {
  const timestamp = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`;
  const symbol = `${COLORS.blue}▶${COLORS.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${COLORS.bright}${operation}${COLORS.reset}`
  );
  if (params && Object.keys(params).length > 0) {
    console.log(`${COLORS.dim}${formatData(params)}${COLORS.reset}`);
  }
}
