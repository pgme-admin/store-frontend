import axios from 'axios';
import { rememberSignedOut, terminationReason } from './sessionEnd';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Sign out locally and go to the sign-in page, which says why. */
function endSession(reason) {
  rememberSignedOut(reason);
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('session_id');
  window.location.href = '/login';
}

/**
 * Only a refusal from the server ends the session. Offline, a timeout or a
 * server failure (5xx, 429) leaves the student signed in; the next request
 * tries again.
 */
function refreshWasRefused(error) {
  const status = error?.response?.status;
  if (!status) return !error?.isAxiosError; // our own errors (no refresh token) are final
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

// Response interceptor: handle 401 with token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // This browser's session was ended (admin, another device, the device
    // limit). Refreshing cannot bring it back.
    const ended = terminationReason(error);
    if (ended && originalRequest?.headers?.Authorization) {
      endSession(ended);
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = data.data.access_token;
        const newRefreshToken = data.data.refresh_token;

        localStorage.setItem('access_token', newAccessToken);
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (refreshWasRefused(refreshError)) {
          endSession(terminationReason(refreshError) || 'expired');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
