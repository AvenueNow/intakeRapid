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
    <div className="flex flex-col items-center gap-2 mb-6">
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

export default function ConfirmationPage() {
  const [summary, setSummary] = useState<EventSummary | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('venuehopperSummary');
    if (raw) {
      try {
        setSummary(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4" style={{ background: '#F0EDF6' }}>
      <div className="w-full max-w-lg text-center">
        <Logo />

        <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#C94BBE' }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="text-4xl text-neutral-900 mb-2" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
          You&apos;re all set!
        </h1>
        <p className="text-neutral-500 text-sm leading-relaxed mb-8">
          We&apos;ve received your details and will be in touch with venue options soon.
        </p>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #ede9f4' }}>
          <h2 className="text-sm font-semibold text-neutral-700 tracking-tight">Your event summary</h2>
        </div>

        {summary ? (
          <dl className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: '#ede9f4' } as React.CSSProperties}>
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
          <div className="px-6 py-8 text-center text-sm text-neutral-400">
            No summary available.
          </div>
        )}
      </div>

      <Link
        href="/"
        className="mt-6 text-xs text-neutral-400 hover:text-neutral-600 transition underline underline-offset-2"
      >
        Submit another inquiry
      </Link>

      <p className="mt-3 text-xs text-neutral-400">
        No spam ever. We&apos;ll be in touch within 48 hours.
      </p>
    </div>
  );
}
