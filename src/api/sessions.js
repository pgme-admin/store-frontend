import client from './client';

export async function getSessions(subjectId) {
  const params = { limit: 50, upcoming_only: 'true' };
  if (subjectId) params.subject_id = subjectId;
  const { data } = await client.get('/live-sessions', { params });
  return data.data;
}

export async function getSessionById(sessionId) {
  const { data } = await client.get(`/live-sessions/${sessionId}`);
  return data.data;
}

export async function createSessionPaymentSession(sessionId, billingAddress, couponCode) {
  const { data } = await client.post(`/live-sessions/${sessionId}/create-order`, {
    billing_address: billingAddress,
    coupon_code: couponCode || undefined,
  });
  return data.data;
}

export async function verifySessionPayment(sessionId, paymentSessionId, paymentId, signature, termsAccepted) {
  const { data } = await client.post(`/live-sessions/${sessionId}/verify-payment`, {
    payment_session_id: paymentSessionId,
    payment_id: paymentId,
    signature,
    terms_accepted: termsAccepted,
  });
  return data.data;
}

export async function getSessionEnrollmentStatus(sessionId) {
  const { data } = await client.get(`/live-sessions/${sessionId}/enrollment-status`);
  return data.data;
}

export async function enrollInSession(sessionId) {
  const { data } = await client.post(`/live-sessions/${sessionId}/enroll`);
  return data.data;
}

export async function getSessionAccessStatus(sessionId) {
  const { data } = await client.get(`/live-sessions/${sessionId}/access-status`);
  return data.data;
}

// ── Who can join (package subscriptions) ──────────────────────────────────
// The backend adds access_mode ('everyone' | 'subscribers_free' |
// 'subscribers_only'), access_packages [{ id, name }] and, for a signed-in
// student, included_for_you / included_via_package. Missing fields mean
// 'everyone', so these helpers also work against an older backend.

/** "A", "A or B", "A, B or C". */
export function packageNames(packages, word = 'or') {
  const names = (packages || []).map((p) => p?.name).filter(Boolean);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} ${word} ${names[names.length - 1]}`;
}

/** The access state of a session for the signed-in student (or a visitor). */
export function sessionAccess(session) {
  const mode = ['subscribers_free', 'subscribers_only'].includes(session?.access_mode) ? session.access_mode : 'everyone';
  const packages = Array.isArray(session?.access_packages) ? session.access_packages : [];
  return {
    mode,
    packages,
    included: mode !== 'everyone' && session?.included_for_you === true,
    viaName: session?.included_via_package?.name || packages[0]?.name || 'package',
    names: packageNames(packages),
    firstPackageId: packages[0]?.id || null,
  };
}

const ACCESS_ERRORS = {
  SUBSCRIPTION_REQUIRED: 'This live session is only for package subscribers.',
  ALREADY_INCLUDED: 'This live session is included with your subscription, so there is nothing to pay. Register for free instead.',
  PAYMENT_REQUIRED: 'This session needs a payment first.',
};

/** A clear sentence for an error from the session endpoints. */
export function sessionErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const body = err?.response?.data;
  if (body?.message) return body.message; // the backend already writes a sentence
  return ACCESS_ERRORS[body?.error_code] || fallback;
}

// ── Weekly live sessions (round 6) ────────────────────────────────────────
// For a session that repeats every week the backend sends the CURRENT class
// as scheduled_start_time / scheduled_end_time (running now, in its overtime,
// else the next), status 'live' only during a class, plus repeat,
// schedule_label ("Every Wednesday, 7:00 PM to 9:00 PM"), overtime_label
// ("May run until 10:00 PM"), class_number, classes_total, can_join_now and
// join_closes_at. Missing fields mean a one-off session.

const IST = { timeZone: 'Asia/Kolkata' };

/** "Wed, 2 Dec" (with the year when it is not this year), India time. */
export function istDay(value) {
  if (!value) return '';
  const d = new Date(value);
  const sameYear = new Intl.DateTimeFormat('en-IN', { ...IST, year: 'numeric' }).format(d) === new Intl.DateTimeFormat('en-IN', { ...IST, year: 'numeric' }).format(new Date());
  return d.toLocaleDateString('en-IN', { ...IST, weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "7:00 pm", India time. */
export function istTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit', hour12: true });
}

/** The weekly state of a session for display, or null for a one-off session. */
export function weeklyInfo(session) {
  if (!session?.repeat?.weekly) return null;
  const status = session.status;
  const over = status === 'completed';
  const cancelled = status === 'cancelled';
  const live = status === 'live';
  // In the overtime buffer: the class time is over, joining is still open
  const overtime = !live && session.can_join_now === true && session.scheduled_end_time && new Date(session.scheduled_end_time) <= new Date();
  const total = session.classes_total || 0;
  return {
    label: session.schedule_label || 'Every week',
    overtimeLabel: session.overtime_label || null,
    classText: session.class_number && total ? `Class ${session.class_number} of ${total}` : '',
    totalText: total ? `${total} ${total === 1 ? 'class' : 'classes'}` : '',
    live,
    overtime,
    over,
    cancelled,
    start: session.scheduled_start_time,
    end: session.scheduled_end_time,
    nextText: over ? 'Series completed' : cancelled ? 'Cancelled' : live ? 'Live now' : overtime ? 'Class may be running over time' : `Next class ${istDay(session.scheduled_start_time)}, ${istTime(session.scheduled_start_time)}`,
  };
}

/** Still worth listing: a weekly series until its last class, a one-off until it ends. */
export function sessionStillOn(session, now = new Date()) {
  if (session?.repeat?.weekly) return !['completed', 'cancelled'].includes(session.status);
  const end = session?.scheduled_end_time || session?.scheduled_end;
  return !end || new Date(end) > now;
}

/** A class length in plain words: "45 min", "2 hours", "1 hr 30 min", "58 days". */
export function durationText(minutes) {
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m) || m <= 0) return '';
  if (m < 60) return `${m} min`;
  if (m >= 24 * 60) {
    const d = Math.round(m / (24 * 60));
    return `${d} day${d === 1 ? '' : 's'}`;
  }
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!rest) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h} hr ${rest} min`;
}
