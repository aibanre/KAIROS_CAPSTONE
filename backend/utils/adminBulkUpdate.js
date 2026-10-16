function validateBulkUpdateRequest(body, allowedFields) {
  const ids = body?.ids;
  const fields = body?.fields;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100
    || !ids.every((id) => Number.isSafeInteger(id) && id > 0)
    || new Set(ids).size !== ids.length) {
    return { error: 'ids must contain 1 to 100 unique positive integers.' };
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return { error: 'fields must be an object containing at least one field.' };
  }

  const keys = Object.keys(fields);
  if (!keys.length) return { error: 'fields must contain at least one field.' };
  if (keys.some((key) => !allowedFields.has(key))) {
    return { error: 'One or more fields are not allowed.' };
  }
  return { ids, fields };
}

function valuesEqual(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left === right;
  }
  return String(left) === String(right);
}

module.exports = { validateBulkUpdateRequest, valuesEqual };
