import { request } from "./client";

export function getSession() {
  return request("/api/auth/me", { handle401: false });
}

export function login(credentials) {
  return request("/api/auth/login", {
    method: "POST",
    body: credentials,
    handle401: false,
  });
}

export function register(details) {
  return request("/api/auth/register", {
    method: "POST",
    body: details,
    handle401: false,
  });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST", handle401: false });
}
