export function getImageUrl(images) {
	if (!images) return null
	if (Array.isArray(images)) return images[0] || null
	try {
		const parsed = JSON.parse(images)
		return Array.isArray(parsed) ? parsed[0] || null : parsed
	} catch {
		return images
	}
}
