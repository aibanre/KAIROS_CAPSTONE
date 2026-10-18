import { API_URL } from "../../config/api.js";

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function createError(status, message, fieldErrors = {}, existingHolds = []) {
  const error = new Error(message);
  error.status = status;
  error.message = message;
  error.fieldErrors = fieldErrors;
  error.existingHolds = existingHolds;
  return error;
}

export async function request(path, options = {}) {
  const { body, headers = {}, handle401 = true, ...requestOptions } = options;
  const isFormData = body instanceof FormData;
  const requestHeaders = { ...headers };

  if (!isFormData && body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    credentials: "include",
    headers: requestHeaders,
    body: isFormData || body === undefined ? body : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text();

  if (!response.ok) {
    const message = typeof data === "object" && data?.error
      ? data.error
      : `Request failed with status ${response.status}.`;
    const fieldErrors = typeof data === "object" && data?.fieldErrors ? data.fieldErrors : {};

    if (response.status === 401 && handle401 && onUnauthorized) {
      onUnauthorized();
    }

    const existingHolds = typeof data === "object" && Array.isArray(data?.existing_holds) ? data.existing_holds : [];
    throw createError(response.status, message, fieldErrors, existingHolds);
  }

  return data;
}

export function apiError(error, fallback = "Something went wrong. Please try again.") {
  return error?.message || fallback;
}
