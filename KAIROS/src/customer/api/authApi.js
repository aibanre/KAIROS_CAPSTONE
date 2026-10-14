import { request } from "./client";

export function getSession(portal = "customer") {
  return request(`/api/auth/me?portal=${encodeURIComponent(portal)}`, { handle401: false });
}

export function login(credentials) {
  return request("/api/auth/login", {
    method: "POST",
    body: { ...credentials, portal: "customer" },
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

export function verifyRegistration(email, code) {
  return request("/api/auth/register/verify", { method: "POST", body: { email, code }, credentials: "include", handle401: false });
}

export function resendRegistrationCode(email) {
  return request("/api/auth/register/resend-code", { method: "POST", body: { email }, credentials: "include", handle401: false });
}

export function verifyLogin(challenge, code) {
  return request("/api/auth/login/verify", { method: "POST", body: { challenge, code }, credentials: "include", handle401: false });
}

export function resendLoginCode(challenge) {
  return request("/api/auth/login/resend-code", { method: "POST", body: { challenge }, credentials: "include", handle401: false });
}

export function forgotPassword(email) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
    handle401: false,
  });
}

export function resetPassword(details) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: details,
    handle401: false,
  });
}

export function googleSignIn(credential) {
  return request("/api/auth/google", {
    method: "POST",
    body: { credential },
    handle401: false,
  });
}

export function completeGoogleSignIn(details) {
  return request("/api/auth/google/complete", {
    method: "POST",
    body: details,
    handle401: false,
  });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST", handle401: false });
}
