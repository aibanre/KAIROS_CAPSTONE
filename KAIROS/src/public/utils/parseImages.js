import { API_URL } from "../../config/api.js";

export function parseImages(images) {
	if (!images) return []
	if (Array.isArray(images)) return images.flatMap(parseImages)
	if (typeof images !== "string") return []
	const value = images.trim()
	if (!value) return []
	try {
		const parsed = JSON.parse(value)
		return Array.isArray(parsed) ? parsed.flatMap(parseImages) : parseImages(parsed)
	} catch {
		return [value]
	}
}

export function resolveImageUrl(image) {
	if (typeof image !== "string" || !image.trim()) return null
	const value = image.trim()
	if (/^(data:|blob:|https?:\/\/|\/\/)/i.test(value)) return value
	return `${API_URL}/${value.replace(/^\/+/, "")}`
}

export function getImageUrls(images) {
	return parseImages(images).map(resolveImageUrl).filter(Boolean)
}

export function getImageUrl(images) {
	return getImageUrls(images)[0] || null
}
