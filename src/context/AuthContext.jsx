import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyWebToken, verifyWidget, resolveDeviceLimit, logoutSession } from '../api/auth';
import { openOTPWidget } from '../utils/msg91';

const AuthContext = createContext(null);

/**
 * A sign-in error in words a student can act on. A refusal at the device limit
 * keeps the backend's device list and one-time ticket on `err.deviceLimit`.
 */
function toLoginError(err) {
  const body = err?.response?.data;
  const out = new Error(body?.message || err?.message || 'Login failed. Please try again.');
  if (err?.response?.status === 409 && body?.error_code === 'DEVICE_LIMIT_REACHED' && body?.details?.resolve_token) {
    out.deviceLimit = {
      maxDevices: body.details.max_devices || 0,
      devices: Array.isArray(body.details.devices) ? body.details.devices : [],
      resolveToken: body.details.resolve_token,
    };
  } else if (err?.response?.status === 401 && body?.error_code === 'DEVICE_LIMIT_TICKET_EXPIRED') {
    out.ticketExpired = true;
  } else if (!err?.response && err?.isAxiosError) {
    out.message = "You're offline or we couldn't reach the server. Please try again.";
  }
  return out;
}

// The app-to-web sign-in link is single use on the server. React StrictMode
// runs the mount effect twice (and a provider can remount), so each link is
// sent once and every run shares that one answer. Sending it twice made the
// second request fail as a used link and drop the student on /login.
const webTokenClaims = new Map();
function claimWebToken(token) {
  if (!webTokenClaims.has(token)) webTokenClaims.set(token, verifyWebToken(token));
  return webTokenClaims.get(token);
}

function storeSignIn(result) {
  localStorage.setItem('access_token', result.access_token);
  localStorage.setItem('refresh_token', result.refresh_token);
  localStorage.setItem('user', JSON.stringify(result.user));
  if (result.session_id) localStorage.setItem('session_id', result.session_id);
  else localStorage.removeItem('session_id');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // If a magic link token is present, clear any previous session immediately
    // (before first render) so PurchaseContext never fires stale API calls
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('session_id');
      return null;
    }
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!user && !!localStorage.getItem('access_token');

  // Handle magic link token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      setLoading(false);
      return undefined;
    }
    // Only the run that is still mounted acts on the answer (StrictMode's
    // first run is cleaned up before the second one starts).
    let current = true;
    handleWebToken(token, () => current);
    return () => { current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWebToken = async (token, isCurrent) => {
    try {
      const result = await claimWebToken(token);
      if (!isCurrent()) return;

      storeSignIn(result);
      setUser(result.user);

      // Strip token from URL and navigate to the current path
      const params = new URLSearchParams(location.search);
      params.delete('token');
      const cleanPath = location.pathname + (params.toString() ? `?${params.toString()}` : '');
      navigate(cleanPath, { replace: true });
    } catch (err) {
      if (!isCurrent()) return;
      console.error('Web token verification failed:', err);
      // Preserve the intended destination so Login can redirect back after manual login
      navigate('/login', { replace: true, state: { from: location } });
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  // Opens MSG91 OTP popup, verifies with backend, stores tokens
  const loginWithOTP = useCallback(async (phoneNumber) => {
    // Pre-fill phone with country code if provided
    const identifier = phoneNumber ? `91${phoneNumber}` : undefined;

    // MSG91 popup handles OTP send + verify, returns access token
    const msg91AccessToken = await openOTPWidget(identifier);

    // Exchange MSG91 access token for our JWT tokens (this browser as a web store device)
    let result;
    try {
      result = await verifyWidget(msg91AccessToken);
    } catch (err) {
      throw toLoginError(err);
    }

    // If this is a new user, no account was created on the backend — they must register via the app
    if (result.registered === false || result.user?.is_new_user) {
      return { isNewUser: true };
    }

    storeSignIn(result);
    setUser(result.user);

    return { isNewUser: false };
  }, []);

  // At the device limit: sign out the chosen devices and finish this sign-in
  // with the refusal's ticket (no new OTP).
  const continueAfterDeviceLimit = useCallback(async (resolveToken, signOutSessionIds) => {
    let result;
    try {
      result = await resolveDeviceLimit(resolveToken, signOutSessionIds);
    } catch (err) {
      throw toLoginError(err);
    }
    storeSignIn(result);
    setUser(result.user);
    return { isNewUser: false };
  }, []);

  const logout = useCallback(() => {
    // End this browser's session on the server too, so it stops counting as
    // a signed-in device. Never without a session id (that would sign out
    // every device).
    void logoutSession(localStorage.getItem('session_id'), localStorage.getItem('access_token'));
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('session_id');
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const value = {
    user,
    isAuthenticated,
    loading,
    loginWithOTP,
    continueAfterDeviceLimit,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
