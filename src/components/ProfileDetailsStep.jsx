import { useEffect, useRef, useState } from 'react';
import { getUserProfile } from '../api/auth';
import { getProfileFields, updateMyProfile } from '../api/profileFields';

/**
 * Checkout's profile step (Aviraj, 28 Nov 2026: on the website the profile is
 * required when buying). The rules come from the admin (Settings > Student
 * Profile Fields), the same ones the app's first sign-in uses.
 *
 * When a required detail is missing from the student's profile, the details
 * not filled in yet are asked here, once, before the billing address. When
 * nothing required is missing (almost everyone: the app asks at sign-up), or
 * the rules or profile cannot be loaded, the children (the billing form) show
 * straight away, as before.
 */

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** The profile value as the form holds it (a date as YYYY-MM-DD). */
function formValue(field, user) {
  const v = user?.[field.key];
  if (isEmpty(v)) return '';
  if (field.type === 'date') return String(v).slice(0, 10);
  return String(v);
}

function missingRequired(fields, user) {
  return fields.filter((f) => f.asked && f.rule === 'required' && isEmpty(user?.[f.key]));
}

/** Latest date of birth allowed: 18 years ago today. */
function maxBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

const PLACEHOLDERS = {
  name: 'Your full name',
  email: 'you@example.com',
  address: 'House, street, city, pincode',
  ug_college: 'Where you did your MBBS',
  pg_college: 'Where you did, or are doing, your PG',
  affiliated_organisation: 'Hospital or institution',
  current_designation: 'For example, Resident',
};

const AUTOCOMPLETE = { name: 'name', email: 'email', address: 'street-address', date_of_birth: 'bday', gender: 'sex' };

export default function ProfileDetailsStep({ children }) {
  // checking | needed | ready
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const [fields, setFields] = useState([]); // the ones shown on this step
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    let current = true;
    (async () => {
      const [rulesRes, profileRes] = await Promise.allSettled([getProfileFields(), getUserProfile()]);
      if (!current) return;
      const rules = rulesRes.status === 'fulfilled' ? rulesRes.value : null;
      // GET /users/profile answers { user }
      const profile = profileRes.status === 'fulfilled' ? profileRes.value?.user || null : null;
      // Without rules or a profile, never block a purchase: checkout as before.
      if (!rules || !profile) {
        setStatus('ready');
        return;
      }
      const missing = missingRequired(rules.fields, profile);
      if (!missing.length) {
        setStatus('ready');
        return;
      }
      // Every detail asked that is still empty: the required ones must be
      // filled, the optional ones may be left.
      const shown = rules.fields.filter((f) => f.asked && isEmpty(profile[f.key]));
      setUser(profile);
      setFields(shown);
      setValues(Object.fromEntries(shown.map((f) => [f.key, formValue(f, profile)])));
      setStatus('needed');
    })();
    return () => {
      current = false;
    };
  }, []);

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
    });
  };

  const check = () => {
    const next = {};
    for (const f of fields) {
      const v = (values[f.key] || '').trim();
      if (!v) {
        if (f.rule === 'required') next[f.key] = `${f.label} is required`;
        continue;
      }
      if (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) next[f.key] = 'Enter a valid email address';
      if (f.type === 'date' && v > maxBirthDate()) next[f.key] = 'You must be at least 18 years old';
      if (f.key === 'name' && v.length < 2) next[f.key] = 'Enter your full name';
      if (f.max_length && v.length > f.max_length) next[f.key] = `Use at most ${f.max_length} characters`;
    }
    return next;
  };

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const found = check();
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirstError();
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const body = {};
      for (const f of fields) {
        const v = (values[f.key] || '').trim();
        if (v) body[f.key] = v;
      }
      const saved = await updateMyProfile(body);
      const merged = { ...user, ...(saved || body) };
      // Re-read the rules: an admin may have changed them meanwhile.
      let rules = null;
      try {
        rules = await getProfileFields();
      } catch {
        rules = null;
      }
      const still = rules ? missingRequired(rules.fields, merged) : [];
      if (still.length) {
        setUser(merged);
        setFields(rules.fields.filter((f) => f.asked && isEmpty(merged[f.key])));
        setErrors(Object.fromEntries(still.map((f) => [f.key, `${f.label} is required`])));
        focusFirstError();
        return;
      }
      setJustSaved(true);
      setStatus('ready');
    } catch (err) {
      const body = err?.response?.data;
      const list = Array.isArray(body?.details?.fields) ? body.details.fields : [];
      const shownKeys = new Set(fields.map((f) => f.key));
      const inline = Object.fromEntries(list.filter((f) => shownKeys.has(f.field)).map((f) => [f.field, f.message || body?.message]));
      if (Object.keys(inline).length) {
        setErrors(inline);
        focusFirstError();
      }
      if (!Object.keys(inline).length || list.length > Object.keys(inline).length) {
        setFormError(
          !err?.response
            ? "You're offline or we couldn't reach the server. Please try again."
            : body?.message || 'Your details could not be saved. Please try again.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (status === 'ready') {
    return (
      <>
        {justSaved && (
          <p className="mb-4 sm:mb-5 flex items-center gap-1.5 text-xs sm:text-sm font-medium text-success" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Your details are saved
          </p>
        )}
        {children}
      </>
    );
  }

  if (status === 'checking') {
    const row = (w) => (
      <div>
        <div className={`skeleton h-3.5 ${w} mb-2`} />
        <div className="skeleton h-11 sm:h-12 w-full rounded-lg" />
      </div>
    );
    return (
      <div className="space-y-4 sm:space-y-5" role="status" aria-live="polite">
        <span className="sr-only">Loading checkout...</span>
        <div className="skeleton h-5 sm:h-6 w-36 mb-1 sm:mb-2" />
        <div className="space-y-3 sm:space-y-4">
          {row('w-28')}
          {row('w-28')}
          {row('w-20')}
        </div>
        <div className="skeleton h-12 sm:h-14 w-full rounded-xl mt-3 sm:mt-4" />
      </div>
    );
  }

  const inputClass = (key) =>
    `w-full min-h-11 px-3.5 sm:px-4 py-2.5 sm:py-3 border rounded-lg text-sm sm:text-base bg-surface text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 transition-[border-color,box-shadow] ${
      errors[key] ? 'border-error focus:ring-error/20 focus:border-error' : 'border-border focus:ring-primary/20 focus:border-primary'
    }`;
  const labelClass = 'block text-xs sm:text-sm font-semibold text-text mb-1.5 sm:mb-2';
  const requiredCount = fields.filter((f) => f.rule === 'required').length;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5" aria-labelledby="profile-step-title">
      <div>
        <h3 id="profile-step-title" className="text-base sm:text-lg font-bold text-text">Your details</h3>
        <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
          We need {requiredCount === 1 ? 'one more detail' : 'a few more details'} before you buy. You only fill {requiredCount === 1 ? 'it' : 'these'} in once.
        </p>
        {user?.phone_number && (
          <p className="text-xs text-text-tertiary mt-1.5">
            Signed in with +91 {user.phone_number}. Your phone number cannot be changed.
          </p>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {fields.map((f) => {
          const id = `profile-${f.key}`;
          const err = errors[f.key];
          const describedBy = [err ? `${id}-error` : null, f.key === 'email' ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
          const common = {
            id,
            name: f.key,
            value: values[f.key] || '',
            onChange: (e) => handleChange(f.key, e.target.value),
            required: f.rule === 'required',
            'aria-invalid': err ? 'true' : undefined,
            'aria-describedby': describedBy,
            autoComplete: AUTOCOMPLETE[f.key] || 'off',
            disabled: saving,
            className: inputClass(f.key),
          };
          let control;
          if (f.type === 'choice') {
            control = (
              <select {...common}>
                <option value="">Select</option>
                {(f.options || []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            );
          } else if (f.type === 'address') {
            control = <textarea {...common} rows={2} maxLength={f.max_length || 500} placeholder={PLACEHOLDERS[f.key]} />;
          } else if (f.type === 'date') {
            control = <input {...common} type="date" max={maxBirthDate()} min="1940-01-01" />;
          } else {
            control = (
              <input
                {...common}
                type={f.type === 'email' ? 'email' : 'text'}
                inputMode={f.type === 'email' ? 'email' : undefined}
                maxLength={f.max_length || 200}
                placeholder={PLACEHOLDERS[f.key]}
              />
            );
          }
          return (
            <div key={f.key}>
              <label className={labelClass} htmlFor={id}>
                {f.label}
                {f.rule === 'required' ? (
                  <span className="text-error" aria-hidden="true"> *</span>
                ) : (
                  <span className="font-normal text-text-tertiary"> (optional)</span>
                )}
              </label>
              {control}
              {f.key === 'email' && !err && (
                <p id={`${id}-hint`} className="text-[11px] sm:text-xs text-text-tertiary mt-1.5">
                  Used for your invoices. It cannot be changed later.
                </p>
              )}
              {err && (
                <p id={`${id}-error`} className="text-[11px] sm:text-xs text-error mt-1.5" role="alert">
                  {err}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {formError && (
        <div className="bg-error/6 text-error text-xs sm:text-sm px-4 py-3 rounded-lg border border-error/10" role="alert">
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="btn-primary w-full !py-3.5 sm:!py-4 disabled:opacity-50 disabled:cursor-not-allowed mt-3 sm:mt-4 text-sm sm:text-base font-semibold"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving...
          </span>
        ) : (
          'Save and continue'
        )}
      </button>
    </form>
  );
}
