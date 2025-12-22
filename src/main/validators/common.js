/**
 * Common Validators - Reusable validation functions
 *
 * Provides generic validation utilities used across the application
 * to ensure consistency and avoid code duplication.
 */

/**
 * Validate that a value is a non-empty string
 *
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If validation fails
 */
export function validateRequiredString(value, fieldName) {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required and must be a string`);
  }
}

/**
 * Validate that a value is a non-empty trimmed string
 *
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If validation fails
 */
export function validateNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

/**
 * Validate that a value is a non-empty array
 *
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If validation fails
 */
export function validateNonEmptyArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array`);
  }
}

/**
 * Validate that all items in an array are non-empty strings
 *
 * @param {any[]} array - Array to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If validation fails
 */
export function validateStringArray(array, fieldName) {
  validateNonEmptyArray(array, fieldName);

  for (const item of array) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error(`All items in ${fieldName} must be non-empty strings`);
    }
  }
}

/**
 * Validate string against a regex pattern
 *
 * @param {string} value - Value to validate
 * @param {RegExp} pattern - Regex pattern to match
 * @param {string} fieldName - Name of the field for error messages
 * @param {string} patternDescription - Description of the allowed pattern
 * @throws {Error} If validation fails
 */
export function validatePattern(value, pattern, fieldName, patternDescription) {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${fieldName}. ${patternDescription}`);
  }
}

/**
 * Validate that a value exists in an array of allowed values
 *
 * @param {any} value - Value to validate
 * @param {any[]} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If validation fails
 */
export function validateInArray(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${fieldName} "${value}" is not allowed. Allowed values: ${allowedValues.join(', ')}`
    );
  }
}

/**
 * Validate that an object has required properties
 *
 * @param {Object} obj - Object to validate
 * @param {string[]} requiredProps - Array of required property names
 * @param {string} objectName - Name of the object for error messages
 * @throws {Error} If validation fails
 */
export function validateRequiredProperties(obj, requiredProps, objectName) {
  for (const prop of requiredProps) {
    if (!(prop in obj) || obj[prop] === undefined || obj[prop] === null) {
      throw new Error(`${objectName} must have "${prop}" property`);
    }
  }
}

/**
 * Validate that a value is an object
 *
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If validation fails
 */
export function validateObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
}
