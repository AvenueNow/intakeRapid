'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface EventSummary {
  eventType?: string;
  availability?: string;
  location?: string;
  budget?: string;
  guestCount?: string;
  duration?: string;
  agenda?: string;
  dietaryRestrictions?: string;
  clientName?: string;
  clientContact?: string;
}

interface ContactInfo { name: string; email: string; phone: string }

const LABELS: [keyof EventSummary, string, boolean][] = [
  ['eventType',          'Event Type',          false],
  ['availability',       'Date(s)',             false],
  ['location',           'Location',            false],
  ['budget',             'Budget',              false],
  ['guestCount',         'Guest Count',         false],
  ['duration',           'Duration',            false],
  ['agenda',             'Agenda',              true ],
  ['dietaryRestrictions','Dietary Restrictions',false],
  ['clientName',         'Name',                false],
  ['clientContact',      'Contact',             false],
];

function Logo() {
  return (
    <div className="flex flex-col items-center gap-2 mb-8">
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.12)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#C94BBE"/>
        </svg>
      </div>
      <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: '#C94BBE' }}>
        VenueHopper
      </span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );
}

const fieldStyle = {
  background: '#F0EDF6',
  border: 'none',
  outline: 'none',
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '14px',
  color: '#1a1a1a',
  width: '100%',
  fontFamily: 'inherit',
  lineHeight: '1.5',
};

export default function ConfirmationPage() {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [contact, setContact] = useState<ContactInfo>({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [contactError, setContactError] = useState('');

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<EventSummary>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('venuehopperSummary');
    if (raw) {
      try { setSummary(JSON.parse(raw)); } catch { /* ignore */ }
    }
    if (sessionStorage.getItem('venuehopperUnlocked') === '1') {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (unlocked) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      g.accounts.id.initialize({
        client_id: clientId,
        callback: (res: { credential: string }) => {
          const [, payloadB64] = res.credential.split('.');
          const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
          const profile = JSON.parse(json) as { name?: string; email?: string };
          setContact((c) => ({
            ...c,
            name: profile.name ?? c.name,
            email: profile.email ?? c.email,
          }));
        },
      });
      if (googleBtnRef.current) {
        g.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: googleBtnRef.current.offsetWidth || 320,
          logo_alignment: 'center',
        });
      }
    };

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, [unlocked]);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.name.trim() || !contact.email.trim()) return;
    setSubmitting(true);
    setContactError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, summary }),
      });
      if (!res.ok) throw new Error();
      sessionStorage.setItem('venuehopperUnlocked', '1');
      setUnlocked(true);
    } catch {
      setContactError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    const contactName = contact.name.trim();
    const contactInfo = [contact.email, contact.phone].filter(Boolean).join(' · ');
    setDraft({
      ...summary,
      clientName: summary?.clientName || contactName || undefined,
      clientContact: summary?.clientContact || contactInfo || undefined,
    });
    setSaveError('');
    setSavedAt(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setSaveError('');
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/update-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: draft, contact }),
      });
      if (!res.ok) throw new Error();
      setSummary({ ...draft });
      sessionStorage.setItem('venuehopperSummary', JSON.stringify(draft));
      setEditMode(false);
      setSavedAt(new Date());
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSavedAt(null), 4000);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (key: keyof EventSummary, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const activeSummary = editMode ? draft : summary;

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4" style={{ background: '#F0EDF6' }}>
      <Logo />

      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-neutral-900 mb-2" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
            {unlocked ? "You're all set!" : 'Your summary is ready.'}
          </h1>
          <p className="text-neutral-500 text-sm">
            {unlocked
              ? "We've received your details and will be in touch with venue options soon."
              : 'Enter your contact info to unlock your event summary.'}
          </p>
        </div>

        <div className={`grid gap-6 ${unlocked ? '' : 'md:grid-cols-2'}`}>

          {/* Event summary card */}
          <div className="relative bg-white rounded-2xl shadow-md overflow-hidden">
            {/* Lock overlay */}
            {!unlocked && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl"
                style={{ backdropFilter: 'blur(6px)', background: 'rgba(240,237,246,0.55)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: '#C94BBE' }}>
                  <LockIcon />
                </div>
                <p className="text-sm font-medium text-neutral-600 text-center px-6">
                  Submit your contact info to unlock
                </p>
              </div>
            )}

            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #ede9f4' }}>
              <h2 className="text-sm font-semibold text-neutral-700">Your event summary</h2>
              {unlocked && !editMode && (
                <div className="flex items-center gap-3">
                  {savedAt && (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#C94BBE' }}>
                      <CheckIcon /> Saved
                    </span>
                  )}
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition px-3 py-1.5 rounded-lg hover:bg-neutral-50"
                  >
                    <PencilIcon /> Edit
                  </button>
                </div>
              )}
              {editMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEdit}
                    className="text-xs font-medium text-neutral-400 hover:text-neutral-600 transition px-3 py-1.5 rounded-lg hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-xs font-medium text-white rounded-lg px-3 py-1.5 transition disabled:opacity-50"
                    style={{ background: '#C94BBE' }}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>

            {activeSummary ? (
              <dl>
                {LABELS.map(([key, label, isTextarea]) => {
                  const value = activeSummary[key];
                  if (!editMode && !value) return null;
                  return (
                    <div key={key} className="px-6 py-3 flex gap-4 items-start" style={{ borderBottom: '1px solid #ede9f4' }}>
                      <dt className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide pt-2" style={{ color: '#C94BBE' }}>
                        {label}
                      </dt>
                      <dd className="flex-1 text-sm text-neutral-800 leading-relaxed py-1">
                        {editMode ? (
                          isTextarea ? (
                            <textarea
                              value={value ?? ''}
                              onChange={(e) => updateDraft(key, e.target.value)}
                              rows={3}
                              style={{ ...fieldStyle, resize: 'vertical' }}
                              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                              onBlur={(e) => (e.target.style.boxShadow = 'none')}
                            />
                          ) : (
                            <input
                              value={value ?? ''}
                              onChange={(e) => updateDraft(key, e.target.value)}
                              style={fieldStyle}
                              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                              onBlur={(e) => (e.target.style.boxShadow = 'none')}
                            />
                          )
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-neutral-400">
                No summary available.
              </div>
            )}

            {editMode && saveError && (
              <p className="px-6 py-3 text-xs text-red-500">{saveError}</p>
            )}
          </div>

          {/* Contact form — hidden after unlock */}
          {!unlocked && (
            <div className="bg-white rounded-2xl shadow-md overflow-hidden self-start">
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #ede9f4' }}>
                <h2 className="text-sm font-semibold text-neutral-700">Your contact info</h2>
                <p className="text-xs text-neutral-400 mt-0.5">So we know how to reach you with options.</p>
              </div>

              <form onSubmit={handleContact} className="px-6 py-5 flex flex-col gap-4">
                {/* Google sign-in — only renders if NEXT_PUBLIC_GOOGLE_CLIENT_ID is set */}
                {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                  <>
                    <div ref={googleBtnRef} className="w-full flex justify-center" />
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ background: '#ede9f4' }} />
                      <span className="text-xs text-neutral-400">or fill in manually</span>
                      <div className="flex-1 h-px" style={{ background: '#ede9f4' }} />
                    </div>
                  </>
                )}
                {([
                  ['name',  'Full Name',      'text', 'Your full name',    true],
                  ['email', 'Email Address',  'email','your@email.com',    true],
                  ['phone', 'Phone Number',   'tel',  '(212) 555-1234',    false],
                ] as [keyof ContactInfo, string, string, string, boolean][]).map(([field, label, type, placeholder, required]) => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-700">
                      {label}{' '}
                      {required
                        ? <span style={{ color: '#C94BBE' }}>*</span>
                        : <span className="font-normal text-neutral-400">(optional)</span>}
                    </label>
                    <input
                      type={type}
                      value={contact[field]}
                      onChange={(e) => setContact((c) => ({ ...c, [field]: e.target.value }))}
                      placeholder={placeholder}
                      required={required}
                      className="rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition"
                      style={{ background: '#F0EDF6', border: 'none' }}
                      onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                      onBlur={(e) => (e.target.style.boxShadow = 'none')}
                    />
                  </div>
                ))}

                {contactError && <p className="text-xs text-red-500">{contactError}</p>}

                <button
                  type="submit"
                  disabled={submitting || !contact.name.trim() || !contact.email.trim()}
                  className="w-full text-white rounded-xl px-5 py-3 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#C94BBE' }}
                  onMouseEnter={(e) => { if (!submitting) (e.currentTarget.style.background = '#a83a9e'); }}
                  onMouseLeave={(e) => { if (!submitting) (e.currentTarget.style.background = '#C94BBE'); }}
                >
                  {submitting ? 'Submitting…' : 'Unlock My Summary →'}
                </button>

                <p className="text-xs text-neutral-400 text-center">No spam ever. We&apos;ll be in touch within 24 hours.</p>
              </form>
            </div>
          )}
        </div>

        {unlocked && (
          <div className="flex flex-col items-center gap-4 mt-6">
            <Link
              href="/options"
              className="inline-block text-white rounded-xl px-8 py-3 text-sm font-medium transition"
              style={{ background: '#C94BBE' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#a83a9e')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#C94BBE')}
            >
              See venue options →
            </Link>
            <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-600 transition underline underline-offset-2">
              Submit another inquiry
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
