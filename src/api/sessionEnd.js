// Why the session ended, as the backend says it (`details.reason` with
// SESSION_TERMINATED), in words for the sign-in page.

const NOTICE_KEY = 'pgme_signed_out_reason';

const MESSAGES = {
  signed_out_by_admin: 'PGME support signed this browser out of your account. Sign in again to continue.',
  device_limit: 'You signed in on another device, and your account can be used on a limited number of devices at a time, so this browser was signed out.',
  signed_out_elsewhere: 'This browser was signed out from another of your devices. Sign in again to continue.',
  expired: 'Your session has expired. Please sign in again.',
};
const DEFAULT_MESSAGE = 'You have been signed out. Please sign in again.';

export function signedOutMessage(reason) {
  return MESSAGES[reason] || DEFAULT_MESSAGE;
}

/** The reason of a SESSION_TERMINATED answer, or null for any other answer. */
export function terminationReason(error) {
  const body = error?.response?.data;
  if (error?.response?.status !== 401 || body?.error_code !== 'SESSION_TERMINATED') return null;
  return body?.details?.reason || 'session_ended';
}

/** Keep the reason for the sign-in page (one page load). */
export function rememberSignedOut(reason) {
  try { sessionStorage.setItem(NOTICE_KEY, reason || 'session_ended'); } catch { /* storage off */ }
}

/** The message to show on the sign-in page, if the last session was ended. */
export function peekSignedOutNotice() {
  try {
    const reason = sessionStorage.getItem(NOTICE_KEY);
    return reason ? signedOutMessage(reason) : null;
  } catch {
    return null;
  }
}

/** Forget it once shown (in an effect: render may run twice in development). */
export function clearSignedOutNotice() {
  try { sessionStorage.removeItem(NOTICE_KEY); } catch { /* storage off */ }
}
