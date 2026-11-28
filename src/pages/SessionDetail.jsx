import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSessionById, getSessionEnrollmentStatus, enrollInSession, sessionAccess, sessionErrorMessage, weeklyInfo, istDay, istTime, durationText } from '../api/sessions';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import PriceDisplay from '../components/PriceDisplay';
import RecommendationRail from '../components/RecommendationRail';

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isSessionPurchased } = usePurchase();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const result = await getSessionById(id);
        const loaded = result.session || result;
        setSession(loaded);
        if (isAuthenticated && loaded?.enrollment_mode === 'enrollment_required') {
          // (also tells a subscriber on a restricted session that they are registered)
          try {
            const status = await getSessionEnrollmentStatus(id);
            setIsEnrolled(status?.is_enrolled === true);
          } catch {
            // ignore — user not enrolled
          }
        }
      } catch {
        setError('Failed to load session');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isAuthenticated]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return <div className="text-center py-12 text-error text-sm">{error || 'Session not found'}</div>;
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const purchased = isSessionPurchased(session.session_id || session._id);

  const isEnrollmentRequired = session?.enrollment_mode === 'enrollment_required';
  // Who can join (package subscriptions). Missing fields mean "everyone".
  const access = sessionAccess(session);
  const restricted = access.mode !== 'everyone' && !purchased;
  const forSubscribersOnly = restricted && !access.included && access.mode === 'subscribers_only';
  const freeForSubscribers = restricted && !access.included && access.mode === 'subscribers_free';
  const packageHref = access.firstPackageId ? `/packages/${access.firstPackageId}` : '/packages';
  const startTime = session.scheduled_start_time || session.scheduled_start;
  // A weekly series: the pattern and the class now or next (null for a one-off)
  const weekly = weeklyInfo(session);
  const isLive = session.status === 'live';
  const facultyName = session.faculty?.name || session.faculty_id?.name;
  const showCta = !session.is_free || isEnrollmentRequired || access.mode !== 'everyone';
  const signIn = () => navigate('/login', { state: { from: { pathname: `/sessions/${id}` } } });

  const handleBuy = () => {
    if (session.is_free || purchased || access.included || forSubscribersOnly) return;
    if (!isAuthenticated) {
      signIn();
      return;
    }
    navigate(`/checkout/sessions/${id}`);
  };

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/sessions/${id}` } } });
      return;
    }
    setIsEnrolling(true);
    setEnrollError('');
    try {
      await enrollInSession(id);
      setIsEnrolled(true);
    } catch (err) {
      setEnrollError(sessionErrorMessage(err, 'Failed to register. Please try again.'));
    } finally {
      setIsEnrolling(false);
    }
  };

  // The fixed bars sit outside the animated wrapper: while an entrance
  // animation runs on transform, it pins position: fixed children to the page,
  // so the bar showed at the end of the content and then jumped to the bottom.
  return (
    <>
    <div className="animate-fade-in-up">
      <div className="max-w-5xl 2xl:max-w-6xl mx-auto">
        {/* Header */}
        <div className="gradient-hero rounded-2xl sm:rounded-3xl p-8 sm:p-10 lg:p-12 text-white mb-6 sm:mb-8 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white opacity-[0.06]" />
          <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-white opacity-[0.06] -translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-white opacity-[0.06]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <span className="text-sm font-medium text-white/80">{weekly ? 'Weekly Live Session' : 'Live Session'}</span>
              {/* LIVE only while a class is actually running */}
              {isLive && (
                <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-error">
                  <span className="w-1.5 h-1.5 rounded-full bg-error" aria-hidden="true" />
                  Live now
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl font-bold font-display mb-1">{session.title}</h1>
            {facultyName && (
              <p className="text-white/70 text-sm">By {facultyName}</p>
            )}
            {access.mode !== 'everyone' && (
              <p className="mt-3 inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-white/15 px-3 py-1 text-xs font-semibold leading-snug text-white">
                <ShieldIcon size={13} className="shrink-0 mt-px" />
                <span className="min-w-0 break-words">
                  {access.included
                    ? `Included with your ${access.viaName} subscription`
                    : access.mode === 'subscribers_only'
                      ? `For ${access.names || 'package'} subscribers`
                      : `Free for ${access.names || 'package'} subscribers`}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Thumbnail Banner */}
        {session.thumbnail_url && (
          <div className="rounded-2xl overflow-hidden mb-6 sm:mb-8 aspect-video max-h-80 w-full bg-surface-dim">
            <img
              src={session.thumbnail_url}
              alt={session.title}
              width="1280"
              height="720"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 2xl:gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Schedule */}
              <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <h3 className="text-base font-semibold text-text">Schedule</h3>
                </div>
                {weekly ? (
                  <div className="space-y-2 text-sm text-text-secondary">
                    <p className="font-medium text-text break-words">{weekly.label} <span className="text-text-tertiary font-normal">(IST)</span></p>
                    {weekly.overtimeLabel && <p className="text-xs text-text-tertiary">{weekly.overtimeLabel}</p>}
                    <p className={weekly.live ? 'font-semibold text-error' : weekly.overtime ? 'font-medium text-text' : ''}>
                      {weekly.over || weekly.cancelled || weekly.live || weekly.overtime
                        ? weekly.nextText
                        : <>Next class: <span className="text-text font-medium">{istDay(weekly.start)}, {istTime(weekly.start)} to {istTime(weekly.end)}</span></>}
                    </p>
                    {weekly.overtime && <p className="text-xs">Joining is open in the PGME app until {istTime(session.join_closes_at)}.</p>}
                    {weekly.classText && <p className="tabular-nums">{weekly.classText}</p>}
                    {durationText(session.duration_minutes) && <p>Each class: {durationText(session.duration_minutes)}</p>}
                    <p className="text-xs text-text-tertiary">One registration covers every class.</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-text-secondary">
                    {startTime && (
                      <div>Starts: {formatDate(startTime)}</div>
                    )}
                    {durationText(session.duration_minutes) && (
                      <div>Duration: {durationText(session.duration_minutes)}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              {session.description && (
                <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                  <h3 className="text-base font-semibold text-text mb-3 pb-2 border-b border-border">About this Session</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{session.description}</p>
                </div>
              )}
            </div>

            {/* Topics */}
            {session.topics?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-base font-semibold text-text mb-4 pb-2 border-b border-border">Topics Covered</h3>
                <ul className="space-y-3">
                  {session.topics.map((topic, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-text-secondary">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar - Desktop sticky CTA */}
          {showCta && (
            <div className="hidden lg:block">
              <div className="sticky top-24 bg-white rounded-xl border border-border p-6 shadow-md">
                {access.included && !purchased ? (
                  <IncludedCard
                    viaName={access.viaName}
                    needsRegistration={isEnrollmentRequired}
                    isEnrolled={isEnrolled}
                    isEnrolling={isEnrolling}
                    onEnroll={handleEnroll}
                    enrollError={enrollError}
                  />
                ) : forSubscribersOnly ? (
                  <>
                    <h3 className="text-base font-semibold text-text mb-3 pb-2 border-b border-border">For {access.names || 'package'} subscribers</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">Only subscribers of {access.names || 'the package'} can register for and join this live session. Get the package to join it, along with everything else it includes.</p>
                    <Link to={packageHref} className="btn-primary w-full mt-5 py-3.5! inline-flex items-center justify-center">View package</Link>
                    {!isAuthenticated && (
                      <button type="button" onClick={signIn} className="w-full mt-2 min-h-10 text-sm font-medium text-primary hover:underline cursor-pointer">Already a subscriber? Sign in</button>
                    )}
                    {enrollError && <p className="text-xs text-error mt-2 text-center">{enrollError}</p>}
                  </>
                ) : session.is_free && isEnrollmentRequired ? (
                  isEnrolled ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-success">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <span className="text-sm font-semibold text-success">Registered</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">You're registered for this free session. Open the PGME app to join when it starts.</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-base font-semibold text-text mb-4 pb-2 border-b border-border">Register for this Session</h3>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-lg font-bold text-success">FREE</span>
                      </div>
                      <button
                        onClick={handleEnroll}
                        disabled={isEnrolling}
                        className="btn-primary w-full py-3.5! disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isEnrolling ? 'Registering...' : 'Register for Free'}
                      </button>
                      {enrollError && <p className="text-xs text-error mt-2 text-center">{enrollError}</p>}
                      <p className="text-xs text-text-tertiary mt-3 text-center">Free · No payment required</p>
                    </>
                  )
                ) : purchased ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-success">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-success">Purchased</span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">You already own this session. Open the PGME app to access it.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-semibold text-text mb-4 pb-2 border-b border-border">Purchase Session</h3>
                    <PriceDisplay price={session.price} size="lg" />
                    {freeForSubscribers && (
                      <p className="mt-3 flex items-start gap-1.5 text-xs text-text-secondary leading-relaxed">
                        <ShieldIcon size={13} className="text-success mt-0.5 shrink-0" />
                        <span>
                          Free for {access.names || 'package'} subscribers.{' '}
                          {/* 40px hit area without changing the sentence's line height */}
                          {isAuthenticated
                            ? <Link to={packageHref} className="inline-flex items-center min-h-10 -my-2.5 align-middle font-medium text-primary hover:underline">View package</Link>
                            : <button type="button" onClick={signIn} className="inline-flex items-center min-h-10 -my-2.5 align-middle font-medium text-primary hover:underline cursor-pointer">Sign in to register free</button>}
                        </span>
                      </p>
                    )}
                    <button onClick={handleBuy} className="btn-primary w-full mt-5 !py-3.5">
                      Buy Now
                    </button>
                    <p className="text-xs text-text-tertiary mt-3 text-center">Secure payment via Zoho</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <RecommendationRail
          context="product_detail"
          productType="session"
          productId={id}
          className="mt-5 sm:mt-6"
        />
      </div>
    </div>

      {/* Mobile sticky bottom CTA */}
      {showCta && (
        <>
          {access.included && !purchased ? (
            <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
              <div className="max-w-7xl mx-auto flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-success line-clamp-2">Included with your {access.viaName} subscription</p>
                  {(!isEnrollmentRequired || isEnrolled) && <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{isEnrolled ? 'Registered. ' : ''}Open the PGME app to join</p>}
                </div>
                {isEnrollmentRequired && !isEnrolled && (
                  <button onClick={handleEnroll} disabled={isEnrolling} className="btn-primary shrink-0 py-3! px-5 disabled:opacity-60 disabled:cursor-not-allowed">
                    {isEnrolling ? 'Registering...' : 'Register for Free'}
                  </button>
                )}
              </div>
              {enrollError && <p className="text-xs text-error mt-1.5 text-center">{enrollError}</p>}
            </div>
          ) : forSubscribersOnly ? (
            <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
              <div className="max-w-7xl mx-auto flex items-center gap-3">
                <p className="min-w-0 flex-1 text-xs font-semibold text-text leading-snug line-clamp-2">For {access.names || 'package'} subscribers</p>
                <Link to={packageHref} className="btn-primary shrink-0 py-3! px-5 inline-flex items-center justify-center">View package</Link>
              </div>
              {!isAuthenticated && (
                <button type="button" onClick={signIn} className="flex items-center justify-center min-h-10 mx-auto -mb-2 px-3 text-xs font-medium text-primary cursor-pointer">Already a subscriber? Sign in</button>
              )}
            </div>
          ) : session.is_free && isEnrollmentRequired ? (
            isEnrolled ? (
              <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
                <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-success">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm font-semibold text-success">Registered — Open the PGME app to join</span>
                </div>
              </div>
            ) : (
              <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                  <span className="text-base font-bold text-success shrink-0">FREE</span>
                  <button
                    onClick={handleEnroll}
                    disabled={isEnrolling}
                    className="btn-primary flex-1 py-3! disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isEnrolling ? 'Registering...' : 'Register for Free'}
                  </button>
                </div>
                {enrollError && <p className="text-xs text-error mt-1.5 text-center">{enrollError}</p>}
              </div>
            )
          ) : purchased ? (
            <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
              <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-success">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-semibold text-success">Purchased — Open the PGME app to access</span>
              </div>
            </div>
          ) : (
            <div data-bottom-bar className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border px-4 pt-4 pb-safe-4 lg:hidden z-40">
              <div className="max-w-7xl mx-auto flex items-center gap-4">
                <PriceDisplay price={session.price} size="lg" />
                <button onClick={handleBuy} className="btn-primary flex-1 py-3!">
                  Buy Now
                </button>
              </div>
              {freeForSubscribers && (
                <p className="max-w-7xl mx-auto mt-1.5 text-center text-xs text-text-secondary line-clamp-2">Free for {access.names || 'package'} subscribers</p>
              )}
            </div>
          )}
          <div className="h-20 sm:h-24 lg:hidden" />
        </>
      )}
    </>
  );
}

function ShieldIcon({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

/** A subscriber's seat: included with their package, register free if needed. */
function IncludedCard({ viaName, needsRegistration, isEnrolled, isEnrolling, onEnroll, enrollError }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
          <ShieldIcon size={16} className="text-success" />
        </div>
        <span className="text-sm font-semibold text-success">Included with your {viaName} subscription</span>
      </div>
      {needsRegistration && !isEnrolled ? (
        <>
          <p className="text-xs text-text-secondary leading-relaxed mb-4">No payment needed. Register to save your seat.</p>
          <button
            onClick={onEnroll}
            disabled={isEnrolling}
            className="btn-primary w-full py-3.5! disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isEnrolling ? 'Registering...' : 'Register for Free'}
          </button>
          {enrollError && <p className="text-xs text-error mt-2 text-center">{enrollError}</p>}
        </>
      ) : (
        <p className="text-xs text-text-secondary leading-relaxed">
          {isEnrolled ? "You're registered. " : ''}Open the PGME app to join when it starts.
        </p>
      )}
    </>
  );
}
