'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EventSummary {
  eventType?: string;
  availability?: string;
  location?: string;
  budget?: string;
  duration?: string;
  agenda?: string;
  dietaryRestrictions?: string;
  clientName?: string;
  clientContact?: string;
}

const LABELS: [keyof EventSummary, string][] = [
  ['eventType', 'Event Type'],
  ['availability', 'Date(s)'],
  ['location', 'Location'],
  ['budget', 'Budget'],
  ['duration', 'Duration'],
  ['agenda', 'Agenda'],
  ['dietaryRestrictions', 'Dietary Restrictions'],
  ['clientName', 'Name'],
  ['clientContact', 'Contact'],
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

export default function ConfirmationPage() {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('venuehopperSummary');
    if (raw) {
      try { setSummary(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, summary }),
      });
      if (!res.ok) throw new Error();
      setUnlocked(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4" style={{ background: '#F0EDF6' }}>
      <Logo />

      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-neutral-900 mb-2" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
            {unlocked ? 'You\'re all set!' : 'Your summary is ready.'}
          </h1>
          <p className="text-neutral-500 text-sm">
            {unlocked
              ? 'We\'ve received your details and will be in touch with venue options soon.'
              : 'Enter your contact info to unlock your event summary.'}
          </p>
        </div>

        <div className={`grid gap-6 ${unlocked ? '' : 'md:grid-cols-2'}`}>

          {/* Event summary card */}
          <div className="relative bg-white rounded-2xl shadow-md overflow-hidden">
            {/* Blurred overlay when locked */}
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

            <div className="px-6 py-4" style={{ borderBottom: '1px solid #ede9f4' }}>
              <h2 className="text-sm font-semibold text-neutral-700">Your event summary</h2>
            </div>

            {summary ? (
              <dl>
                {LABELS.map(([key, label]) => {
                  const value = summary[key];
                  if (!value) return null;
                  return (
                    <div key={key} className="px-6 py-4 flex gap-4" style={{ borderBottom: '1px solid #ede9f4' }}>
                      <dt className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide pt-0.5" style={{ color: '#C94BBE' }}>
                        {label}
                      </dt>
                      <dd className="text-sm text-neutral-800 leading-relaxed">{value}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-neutral-400">
                No summary available.
              </div>
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">
                    Full Name <span style={{ color: '#C94BBE' }}>*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition"
                    style={{ background: '#F0EDF6', border: 'none' }}
                    onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                    onBlur={(e) => (e.target.style.boxShadow = 'none')}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">
                    Email Address <span style={{ color: '#C94BBE' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition"
                    style={{ background: '#F0EDF6', border: 'none' }}
                    onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                    onBlur={(e) => (e.target.style.boxShadow = 'none')}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">
                    Phone Number <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(212) 555-1234"
                    className="rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition"
                    style={{ background: '#F0EDF6', border: 'none' }}
                    onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                    onBlur={(e) => (e.target.style.boxShadow = 'none')}
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !email.trim()}
                  className="w-full text-white rounded-xl px-5 py-3 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: '#C94BBE' }}
                  onMouseEnter={(e) => { if (!submitting) (e.currentTarget.style.background = '#a83a9e'); }}
                  onMouseLeave={(e) => { if (!submitting) (e.currentTarget.style.background = '#C94BBE'); }}
                >
                  {submitting ? 'Submitting…' : <>Unlock My Summary →</>}
                </button>

                <p className="text-xs text-neutral-400 text-center">No spam ever. We&apos;ll be in touch within 48 hours.</p>
              </form>
            </div>
          )}
        </div>

        {unlocked && (
          <div className="text-center mt-6">
            <Link
              href="/"
              className="text-xs text-neutral-400 hover:text-neutral-600 transition underline underline-offset-2"
            >
              Submit another inquiry
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
