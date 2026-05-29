'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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

const ERROR_MESSAGES: Record<string, string> = {
  expired: 'That sign-in link has expired. Request a new one below.',
  invalid: 'That sign-in link is invalid. Request a new one below.',
  missing: 'Something went wrong. Please try again.',
};

function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [email, setEmail]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (errorParam && ERROR_MESSAGES[errorParam]) {
      setError(ERROR_MESSAGES[errorParam]);
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-16 px-4" style={{ background: '#F0EDF6' }}>
      <Logo />

      <div className="bg-white rounded-2xl shadow-md overflow-hidden w-full max-w-sm">
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #ede9f4' }}>
          <h1 className="text-lg font-semibold text-neutral-900">
            {sent ? 'Check your inbox' : 'Sign in to your shortlist'}
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {sent
              ? `We sent a sign-in link to ${email}`
              : 'Enter the email you used when submitting your inquiry.'}
          </p>
        </div>

        {sent ? (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.10)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C94BBE" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Click the link in your email to sign in. It expires in 1 hour.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-xs underline underline-offset-2"
              style={{ color: '#C94BBE' }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            {error && (
              <div className="rounded-xl px-4 py-3 text-xs text-red-700" style={{ background: '#fef2f2' }}>
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-700">
                Email address <span style={{ color: '#C94BBE' }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition"
                style={{ background: '#F0EDF6', border: 'none' }}
                onFocus={e => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                onBlur={e  => (e.target.style.boxShadow = 'none')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full text-white rounded-xl px-5 py-3 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#C94BBE' }}
              onMouseEnter={e => { if (!submitting) (e.currentTarget.style.background = '#a83a9e'); }}
              onMouseLeave={e => { if (!submitting) (e.currentTarget.style.background = '#C94BBE'); }}
            >
              {submitting ? 'Sending…' : 'Send sign-in link →'}
            </button>

            <p className="text-xs text-neutral-400 text-center">
              No account yet?{' '}
              <Link href="/" className="underline underline-offset-2" style={{ color: '#C94BBE' }}>
                Start a new inquiry
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
