import client from './client';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// One id per browser, kept across sign-outs (like the app's per-install id).
const DEVICE_ID_KEY = 'pgme_device_id';

function browserName() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
      : /Chrome\//.test(ua) ? 'Chrome'
        : /Firefox\//.test(ua) ? 'Firefox'
          : /Safari\//.test(ua) ? 'Safari'
            : 'Browser';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
      : /Mac OS X/.test(ua) ? 'macOS'
        : /Windows/.test(ua) ? 'Windows'
          : /Linux/.test(ua) ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * This browser as a web store device. The backend records the sign-in as a
 * web store session: it never shows on the app's "Multiple logins" screen,
 * counts toward the device limit only when an admin switches that on, and can
 * be signed out from the admin. Empty when storage is unavailable.
 */
export function webDeviceInfo() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `web-${randomId()}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return { device_id: id, device_name: browserName(), device_type: 'Web', client: 'web_store' };
  } catch {
    return {};
  }
}

export async function verifyWebToken(token) {
  // Use raw axios (no auth interceptor needed for public endpoint)
  const { data } = await axios.post(`${API_BASE_URL}/auth/verify-web-token`, { token, ...webDeviceInfo() });
  return data.data;
}

export async function verifyWidget(accessToken) {
  // register_if_new: false — prevent creating ghost user records from the web store
  const { data } = await axios.post(`${API_BASE_URL}/auth/verify-widget`, {
    access_token: accessToken,
    register_if_new: false,
    ...webDeviceInfo(),
  });
  return data.data;
}

/** Finish a sign-in refused at the device limit by signing out the chosen devices. */
export async function resolveDeviceLimit(resolveToken, signOutSessionIds) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/device-limit/resolve`, {
    resolve_token: resolveToken,
    sign_out_session_ids: signOutSessionIds,
  });
  return data.data;
}

/**
 * End this browser's session on the server. Only with a session id: a logout
 * without one signs the student out on every device.
 */
export function logoutSession(sessionId, accessToken) {
  if (!sessionId || !accessToken) return Promise.resolve();
  return axios.post(`${API_BASE_URL}/auth/logout`, { session_id: sessionId }, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 8000,
  }).catch(() => {});
}

export async function refreshToken(refresh_token) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refresh_token });
  return data.data;
}

export async function getUserProfile() {
  const { data } = await client.get('/users/profile');
  return data.data;
}
