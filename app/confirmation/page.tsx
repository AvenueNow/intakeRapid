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
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl mb-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase mb-2">
          VenueHopper
        </p>
        <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-neutral-900 tracking-tight">
          You&apos;re all set!
        </h1>
        <p className="mt-2 text-neutral-500 text-sm">
          We&apos;ve received your details and will be in touch with venue options soon.
        </p>
      </div>

      <div className="w-full max-w-2xl bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">Your event summary</h2>
        </div>

        {summary ? (
          <dl className="divide-y divide-neutral-100">
            {LABELS.map(([key, label]) => {
              const value = summary[key];
              if (!value) return null;
              return (
                <div key={key} className="px-6 py-4 flex gap-4">
                  <dt className="w-40 flex-shrink-0 text-xs font-semibold text-neutral-400 uppercase tracking-wide pt-0.5">
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
    </div>
  );
}
