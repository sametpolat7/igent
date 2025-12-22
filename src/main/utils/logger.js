/**
 * Logger Utility
 *
 * Centralized logging system with visual formatting and context.
 * Provides consistent, readable output across the application.
 */

// ANSI color codes for terminal output
const colors = {
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

// Log level symbols
const symbols = {
  info: '→',
  success: '✓',
  warn: '⚠',
  error: '✗',
  debug: '•',
};

/**
 * Format timestamp for logs
 */
function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format module name with color
 */
function formatModule(module) {
  return `${colors.dim}[${colors.cyan}${module}${colors.dim}]${colors.reset}`;
}

/**
 * Format object for pretty printing
 */
function formatData(data) {
  if (typeof data === 'object' && data !== null) {
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

/**
 * Log info message
 *
 * @param {string} module - Module name (e.g., 'Planner', 'Executor')
 * @param {string} message - Log message
 * @param {any} [data] - Optional data to log
 */
export function logInfo(module, message, data) {
  const timestamp = `${colors.gray}${getTimestamp()}${colors.reset}`;
  const symbol = `${colors.blue}${symbols.info}${colors.reset}`;
  const moduleStr = formatModule(module);

  console.log(`${timestamp} ${symbol} ${moduleStr} ${message}`);
  if (data !== undefined) {
    console.log(`${colors.dim}${formatData(data)}${colors.reset}`);
  }
}

/**
 * Log success message
 *
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {any} [data] - Optional data to log
 */
export function logSuccess(module, message, data) {
  const timestamp = `${colors.gray}${getTimestamp()}${colors.reset}`;
  const symbol = `${colors.green}${symbols.success}${colors.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${colors.green}${message}${colors.reset}`
  );
  if (data !== undefined) {
    console.log(`${colors.dim}${formatData(data)}${colors.reset}`);
  }
}

/**
 * Log warning message
 *
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {any} [data] - Optional data to log
 */
export function logWarn(module, message, data) {
  const timestamp = `${colors.gray}${getTimestamp()}${colors.reset}`;
  const symbol = `${colors.yellow}${symbols.warn}${colors.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${colors.yellow}${message}${colors.reset}`
  );
  if (data !== undefined) {
    console.log(`${colors.dim}${formatData(data)}${colors.reset}`);
  }
}

/**
 * Log error message
 *
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {any} [error] - Optional error object or data
 */
export function logError(module, message, error) {
  const timestamp = `${colors.gray}${getTimestamp()}${colors.reset}`;
  const symbol = `${colors.red}${symbols.error}${colors.reset}`;
  const moduleStr = formatModule(module);

  console.error(
    `${timestamp} ${symbol} ${moduleStr} ${colors.red}${message}${colors.reset}`
  );
  if (error !== undefined) {
    if (error instanceof Error) {
      console.error(`${colors.red}${error.message}${colors.reset}`);
      if (error.stack) {
        console.error(`${colors.dim}${error.stack}${colors.reset}`);
      }
    } else {
      console.error(`${colors.dim}${formatData(error)}${colors.reset}`);
    }
  }
}

/**
 * Log debug message (minimal output)
 *
 * @param {string} module - Module name
 * @param {string} message - Log message
 */
export function logDebug(module, message) {
  const timestamp = `${colors.gray}${getTimestamp()}${colors.reset}`;
  const symbol = `${colors.gray}${symbols.debug}${colors.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${colors.dim}${message}${colors.reset}`
  );
}

/**
 * Log operation start
 *
 * @param {string} module - Module name
 * @param {string} operation - Operation name
 * @param {Object} params - Operation parameters
 */
export function logStart(module, operation, params) {
  const timestamp = `${colors.gray}${getTimestamp()}${colors.reset}`;
  const symbol = `${colors.blue}▶${colors.reset}`;
  const moduleStr = formatModule(module);

  console.log(
    `${timestamp} ${symbol} ${moduleStr} ${colors.bright}${operation}${colors.reset}`
  );
  if (params && Object.keys(params).length > 0) {
    console.log(`${colors.dim}${formatData(params)}${colors.reset}`);
  }
}
