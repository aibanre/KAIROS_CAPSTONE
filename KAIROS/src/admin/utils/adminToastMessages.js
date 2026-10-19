const TECHNICAL_ERROR_PATTERN = /\b(?:ER_[A-Z_]+|SQLSTATE|stack trace|mysql|database exception)\b|(?:\bSELECT\b.+\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b|\bDROP\s+TABLE\b|at\s+\S+\s+\()/i
const SECRET_ERROR_PATTERN = /\b(?:temporary[_ ]password|access[_ ]token|refresh[_ ]token|api[_ -]?key|secret value)\b/i
const AUTH_REDIRECT_MESSAGE = /admin session has expired/i

export function getSafeAdminActionError(error, fallback = 'Unable to complete this action.') {
    const message = typeof error === 'string' ? error : error?.message
    if (!message || AUTH_REDIRECT_MESSAGE.test(message)) return null
    if (TECHNICAL_ERROR_PATTERN.test(message) || SECRET_ERROR_PATTERN.test(message)) return fallback
    return message
}

export function notifyAdminActionError(toast, error, fallback) {
    const message = getSafeAdminActionError(error, fallback)
    if (message) toast.error(message)
}
