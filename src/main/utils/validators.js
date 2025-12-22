/**
 * Validation Utilities
 *
 * Generic, single-purpose validation functions.
 * Each function validates one thing and throws an error if validation fails.
 */

/**
 * Validate that a value is a string
 *
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If value is not a string
 */
export function validateString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
}

/**
 * Validate that a string is not empty
 *
 * @param {string} value - String to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If string is empty or only whitespace
 */
export function validateNonEmpty(value, fieldName) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

/**
 * Validate that a value is an array
 *
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If value is not an array
 */
export function validateArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
}

/**
 * Validate that an array has at least one item
 *
 * @param {any[]} value - Array to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If array is empty
 */
export function validateArrayNotEmpty(value, fieldName) {
  if (value.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

/**
 * Validate that a value matches a pattern
 *
 * @param {string} value - Value to validate
 * @param {RegExp} pattern - Regular expression pattern
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If value doesn't match pattern
 */
export function validatePattern(value, pattern, fieldName) {
  if (!pattern.test(value)) {
    throw new Error(`${fieldName} has invalid format`);
  }
}

/**
 * Validate that a value exists in an array
 *
 * @param {any} value - Value to check
 * @param {any[]} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If value is not in allowed values
 */
export function validateIncludes(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${fieldName} "${value}" is not valid. Allowed: ${allowedValues.join(', ')}`
    );
  }
}

/**
 * Validate that a value is an object (not array, not null)
 *
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If value is not an object
 */
export function validateObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
}

/**
 * Validate that a property exists in an object
 *
 * @param {Object} obj - Object to check
 * @param {string} property - Property name
 * @param {string} objectName - Name of the object for error messages
 * @throws {Error} If property doesn't exist
 */
export function validateProperty(obj, property, objectName) {
  if (!(property in obj)) {
    throw new Error(`${objectName} must have "${property}" property`);
  }
}
