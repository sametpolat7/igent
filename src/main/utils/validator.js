export function validateString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
}

export function validateNonEmpty(value, fieldName) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

export function validateArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
}

export function validateArrayNotEmpty(value, fieldName) {
  if (value.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

export function validatePattern(value, pattern, fieldName) {
  if (!pattern.test(value)) {
    throw new Error(`${fieldName} has invalid format`);
  }
}

export function validateIncludes(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${fieldName} "${value}" is not valid. Allowed: ${allowedValues.join(', ')}`
    );
  }
}

export function validateObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
}

export function validateProperty(obj, property, objectName) {
  if (!(property in obj)) {
    throw new Error(`${objectName} must have "${property}" property`);
  }
}
