export function normalizeInclusions(value) {
	if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
	if (typeof value !== 'string') return []

	try {
		const parsed = JSON.parse(value)
		if (Array.isArray(parsed)) return normalizeInclusions(parsed)
	} catch {
		// Fall through to newline-separated legacy values.
	}

	return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
}
