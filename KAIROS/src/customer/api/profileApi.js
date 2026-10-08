import { getSession } from "./authApi";

export function getProfile() {
  return getSession();
}

export async function updateProfile(profile) {
  const data = await request("/api/customer/profile", { method: "PATCH", body: profile });
  return { user: data.customer };
}

export async function changePassword(currentPassword, newPassword) {
  return request("/api/customer/password", {
    method: "PATCH",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
