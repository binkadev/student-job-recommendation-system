// In-memory ownership of asynchronous work in this tab. No JWT/revocation changes.
let version = 0;
export const AUTH_TOKEN_STORAGE_KEY = "job-system:auth-token";
export const sessionVersion = () => version;
export function advanceSession() { return ++version; }
