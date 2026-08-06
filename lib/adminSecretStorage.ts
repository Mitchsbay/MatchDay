// Deliberately NOT part of lib/workspace.ts's STORAGE_KEY / CLOUD_WORKSPACE_ID_KEY
// families. Those get read into createPersistedState and written to JSON
// backups and the Supabase cloud sync payload — this secret must never touch
// either of those paths. It lives in its own separate localStorage key,
// read/written only by these two functions, and only when the user has
// explicitly opted in via the "remember on this device" checkbox.
const ADMIN_SECRET_STORAGE_KEY = "tipping-gates-app-admin-secret";

export function loadRememberedAdminSecret(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY);
}

export function saveRememberedAdminSecret(secret: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, secret);
}

export function forgetRememberedAdminSecret(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
}
