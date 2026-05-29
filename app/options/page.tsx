'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────

interface VenueMatch {
  packageId: string;
  packageName: string;
  packageType: string;
  privacyLevel: string;
  durationHours: number;
  price: number | null;
  originalPrice: number | null;
  specialties: string[] | null;
  venueId: string;
  venueName: string;
  neighborhood: string;
  address: string;
  venueType: string;
  capacityMin: number | null;
  capacityMax: number | null;
  coverPhoto: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number | null, packageType: string): string {
  if (cents === null) return 'Price on request';
  const dollars = cents / 100;
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(dollars);
  if (packageType === 'Starting at') return `From ${fmt}`;
  if (packageType === 'Minimum Spend' || packageType === 'Cash Bar') return `${fmt} min. spend`;
  return fmt;
}

function capacityLabel(min: number | null, max: number | null): string | null {
  if (max && min) return `${min}–${max} guests`;
  if (max)        return `Up to ${max} guests`;
  if (min)        return `${min}+ guests`;
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden animate-pulse">
      <div className="h-44 bg-neutral-100" />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-4 bg-neutral-100 rounded w-2/3" />
        <div className="h-3 bg-neutral-100 rounded w-1/3" />
        <div className="h-px bg-neutral-100 my-1" />
        <div className="h-4 bg-neutral-100 rounded w-3/4" />
        <div className="h-3 bg-neutral-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill={filled ? '#C94BBE' : 'none'}
      stroke={filled ? '#C94BBE' : '#9ca3af'}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function MatchCard({
  match,
  isSaved,
  canSave,
  toggling,
  onToggle,
}: {
  match: VenueMatch;
  isSaved: boolean;
  canSave: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  const cap = capacityLabel(match.capacityMin, match.capacityMax);

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col">
      {/* Photo */}
      {match.coverPhoto ? (
        <div className="h-44 overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={match.coverPhoto}
            alt={match.venueName}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onToggle}
            disabled={toggling}
            title={canSave ? (isSaved ? 'Remove from shortlist' : 'Save to shortlist') : 'Complete your inquiry first to save venues'}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', opacity: toggling ? 0.5 : 1 }}
          >
            <BookmarkIcon filled={isSaved} />
          </button>
        </div>
      ) : (
        <div className="h-44 flex items-center justify-center relative" style={{ background: 'rgba(201,75,190,0.07)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#C94BBE" opacity="0.4"/>
          </svg>
          <button
            onClick={onToggle}
            disabled={toggling}
            title={canSave ? (isSaved ? 'Remove from shortlist' : 'Save to shortlist') : 'Complete your inquiry first to save venues'}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', opacity: toggling ? 0.5 : 1 }}
          >
            <BookmarkIcon filled={isSaved} />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-neutral-900 text-base leading-tight">{match.venueName}</h2>
          <span className="text-xs rounded-full px-2 py-0.5 whitespace-nowrap shrink-0 mt-0.5"
            style={{ background: 'rgba(201,75,190,0.10)', color: '#C94BBE' }}>
            {match.neighborhood}
          </span>
        </div>

        <p className="text-xs text-neutral-400 leading-snug">{match.address}</p>

        <div className="h-px bg-neutral-100 my-1" />

        <p className="text-sm font-medium" style={{ color: '#C94BBE' }}>{match.packageName}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">{formatPrice(match.price, match.packageType)}</span>
          {cap && <span>{cap}</span>}
          <span>{match.durationHours}h</span>
          <span className="capitalize">{match.privacyLevel.toLowerCase()}</span>
        </div>

        {match.specialties && match.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {match.specialties.slice(0, 4).map(s => (
              <span key={s} className="text-xs rounded-full px-2.5 py-0.5"
                style={{ background: '#F0EDF6', color: '#6b7280' }}>
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          <a
            href={`mailto:events@venuehopper.com?subject=Interested in ${encodeURIComponent(match.venueName)} — ${encodeURIComponent(match.packageName)}`}
            className="block w-full text-center text-sm font-medium py-2 rounded-xl transition"
            style={{ background: '#C94BBE', color: '#fff' }}
            onMouseOver={e => (e.currentTarget.style.background = '#a83a9e')}
            onMouseOut={e  => (e.currentTarget.style.background = '#C94BBE')}
          >
            Inquire about this venue →
          </a>
        </div>
      </div>
    </div>
  );
}

function HoldingPage() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="bg-white rounded-2xl shadow-md px-8 py-12 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.10)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C94BBE" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <h1 className="text-3xl text-neutral-900 mb-3" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
            Give us 24 hours.
          </h1>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Our team is reviewing your inquiry and hand-picking venues that fit your event. We&apos;ll send your options directly to your inbox.
          </p>
        </div>
        <div className="w-full rounded-xl px-5 py-4 text-sm text-neutral-600 leading-relaxed" style={{ background: '#F0EDF6' }}>
          In the meantime, feel free to reply to your confirmation email if anything changes or you have questions.
        </div>
        <a href="mailto:events@venuehopper.com" className="text-sm font-medium" style={{ color: '#C94BBE' }}>
          events@venuehopper.com
        </a>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OptionsPage() {
  const [matches, setMatches]       = useState<VenueMatch[] | null>(null);
  const [loading, setLoading]       = useState(true);
  const [hasSummary, setHasSummary] = useState(false);
  const [inquirySlug, setInquirySlug] = useState<string | null>(null);
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set());
  const [toggling, setToggling]     = useState<Set<string>>(new Set());

  useEffect(() => {
    async function run() {
      const raw  = sessionStorage.getItem('venuehopperSummary');
      const slug = sessionStorage.getItem('venuehopperInquirySlug');
      if (slug) setInquirySlug(slug);

      if (!raw) { setLoading(false); return; }
      setHasSummary(true);

      // Fetch matches and existing saved packages in parallel
      const [matchRes, savedRes] = await Promise.allSettled([
        fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: JSON.parse(raw) }),
        }).then(r => r.json()),
        slug
          ? fetch(`/api/event/${slug}`).then(r => r.ok ? r.json() : null)
          : Promise.resolve(null),
      ]);

      if (matchRes.status === 'fulfilled') {
        setMatches(matchRes.value.matches ?? []);
      } else {
        setMatches([]);
      }

      if (savedRes.status === 'fulfilled' && savedRes.value?.packages) {
        setSavedIds(new Set((savedRes.value.packages as VenueMatch[]).map(p => p.packageId)));
      }

      setLoading(false);
    }
    run();
  }, []);

  const toggleSave = async (packageId: string) => {
    if (!inquirySlug) return;
    const wasSaved = savedIds.has(packageId);

    // Optimistic update
    setToggling(prev => new Set(prev).add(packageId));
    setSavedIds(prev => {
      const next = new Set(prev);
      wasSaved ? next.delete(packageId) : next.add(packageId);
      return next;
    });

    try {
      await fetch('/api/intake/save', {
        method: wasSaved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
    } catch {
      // Revert on error
      setSavedIds(prev => {
        const next = new Set(prev);
        wasSaved ? next.add(packageId) : next.delete(packageId);
        return next;
      });
    } finally {
      setToggling(prev => { const next = new Set(prev); next.delete(packageId); return next; });
    }
  };

  const showResults = !loading && hasSummary && matches && matches.length > 0;
  const showHolding = !loading && (!hasSummary || !matches || matches.length === 0);
  const savedCount  = savedIds.size;

  return (
    <div className="min-h-screen flex flex-col items-center py-16 px-4 pb-28" style={{ background: '#F0EDF6' }}>
      <Logo />

      {/* Loading skeletons */}
      {loading && (
        <div className="w-full max-w-2xl">
          <div className="h-8 bg-white/60 rounded-xl w-56 mx-auto mb-2 animate-pulse" />
          <div className="h-4 bg-white/40 rounded-xl w-40 mx-auto mb-8 animate-pulse" />
          <div className="grid gap-5 sm:grid-cols-2">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        </div>
      )}

      {/* Match results */}
      {showResults && (
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl text-neutral-900 mb-2" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
              Here are your options.
            </h1>
            <p className="text-sm text-neutral-500">
              {matches.length} venue{matches.length !== 1 ? 's' : ''} matched your event
              {inquirySlug ? ' — bookmark any you like.' : ' — complete your inquiry to save venues.'}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {matches.map(m => (
              <MatchCard
                key={m.packageId}
                match={m}
                isSaved={savedIds.has(m.packageId)}
                canSave={!!inquirySlug}
                toggling={toggling.has(m.packageId)}
                onToggle={() => toggleSave(m.packageId)}
              />
            ))}
          </div>

          <p className="text-center text-sm text-neutral-400 mt-8">
            Don&apos;t see the right fit?{' '}
            <a href="mailto:events@venuehopper.com" className="underline underline-offset-2" style={{ color: '#C94BBE' }}>
              Email us
            </a>{' '}
            and we&apos;ll dig deeper.
          </p>
        </div>
      )}

      {/* Fallback holding page */}
      {showHolding && <HoldingPage />}

      {/* Nav links */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/confirmation" className="text-sm text-neutral-500 hover:text-neutral-800 transition underline underline-offset-2">
          ← Back to my summary
        </Link>
        <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-600 transition underline underline-offset-2">
          Submit another inquiry
        </Link>
      </div>

      {/* Sticky saved bar */}
      {savedCount > 0 && inquirySlug && (
        <div
          className="fixed bottom-0 left-0 right-0 flex items-center justify-center px-4 py-4"
          style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderTop: '1px solid #ede9f4', boxShadow: '0 -2px 12px rgba(0,0,0,0.08)' }}
        >
          <div className="flex items-center gap-4 w-full max-w-sm">
            <span className="flex-1 text-sm font-medium text-neutral-700">
              {savedCount} venue{savedCount !== 1 ? 's' : ''} saved
            </span>
            <Link
              href={`/event/${inquirySlug}`}
              className="flex items-center gap-1.5 text-sm font-medium text-white px-5 py-2.5 rounded-xl transition"
              style={{ background: '#C94BBE' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#a83a9e')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#C94BBE')}
            >
              View shortlist →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
