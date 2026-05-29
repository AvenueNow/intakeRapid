'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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

interface EventInquiry {
  id: string;
  slug: string;
  name: string;
  email: string;
  event_name: string;
  summary: Record<string, string>;
  created_at: string;
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

// ── Icons ──────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
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

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
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

function SavedCard({ match, isOwner, onRemove }: { match: VenueMatch; isOwner: boolean; onRemove: () => void }) {
  const cap = capacityLabel(match.capacityMin, match.capacityMax);

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col">
      {match.coverPhoto ? (
        <div className="h-44 overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={match.coverPhoto} alt={match.venueName} className="w-full h-full object-cover" />
          {isOwner && (
            <button
              onClick={onRemove}
              title="Remove from shortlist"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition text-neutral-500 hover:text-red-500"
              style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
            >
              <XIcon />
            </button>
          )}
        </div>
      ) : (
        <div className="h-44 flex items-center justify-center relative" style={{ background: 'rgba(201,75,190,0.07)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#C94BBE" opacity="0.4"/>
          </svg>
          {isOwner && (
            <button
              onClick={onRemove}
              title="Remove from shortlist"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition text-neutral-500 hover:text-red-500"
              style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
            >
              <XIcon />
            </button>
          )}
        </div>
      )}

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

// ── Page ───────────────────────────────────────────────────────────────────

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();

  const [inquiry, setInquiry]   = useState<EventInquiry | null>(null);
  const [packages, setPackages] = useState<VenueMatch[]>([]);
  const [isOwner, setIsOwner]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [copied, setCopied]     = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft]     = useState('');
  const [savingName, setSavingName]   = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/event/${slug}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return; }
        if (!r.ok) { setLoading(false); return; }
        const data = await r.json();
        setInquiry(data.inquiry);
        setPackages(data.packages ?? []);
        setIsOwner(data.isOwner ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: do nothing */ }
  };

  const startRename = () => {
    setNameDraft(inquiry?.event_name ?? '');
    setEditingName(true);
  };

  const saveRename = async () => {
    if (!nameDraft.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/event/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: nameDraft.trim() }),
      });
      if (res.ok) {
        setInquiry(prev => prev ? { ...prev, event_name: nameDraft.trim() } : prev);
        setEditingName(false);
      }
    } finally {
      setSavingName(false);
    }
  };

  const removePackage = async (packageId: string) => {
    setPackages(prev => prev.filter(p => p.packageId !== packageId));
    await fetch('/api/intake/save', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: '#F0EDF6' }}>
        <Logo />
        <div className="w-full max-w-2xl">
          <div className="h-8 bg-white/60 rounded-xl w-64 mb-2 animate-pulse" />
          <div className="h-4 bg-white/40 rounded-xl w-40 mb-8 animate-pulse" />
          <div className="grid gap-5 sm:grid-cols-2">
            <SkeletonCard /><SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !inquiry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-16 px-4" style={{ background: '#F0EDF6' }}>
        <Logo />
        <div className="bg-white rounded-2xl shadow-md px-8 py-12 text-center max-w-sm w-full">
          <p className="text-neutral-600 text-sm mb-4">This event shortlist couldn&apos;t be found.</p>
          <Link href="/" className="text-sm font-medium" style={{ color: '#C94BBE' }}>
            Start a new inquiry →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-16 px-4" style={{ background: '#F0EDF6' }}>
      <Logo />

      <div className="w-full max-w-2xl">
        {/* Header: event name + share */}
        <div className="flex items-start gap-3 mb-1">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveRename();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="text-2xl text-neutral-900 bg-white rounded-xl px-3 py-1 flex-1 outline-none min-w-0"
                  style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', boxShadow: '0 0 0 2px #C94BBE' }}
                />
                <button
                  onClick={saveRename}
                  disabled={savingName || !nameDraft.trim()}
                  className="flex items-center gap-1 text-sm font-medium text-white px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-40"
                  style={{ background: '#C94BBE' }}
                >
                  {savingName ? '…' : <><CheckIcon /> Save</>}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="text-sm text-neutral-400 hover:text-neutral-600 shrink-0"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h1
                  className="text-3xl text-neutral-900 truncate"
                  style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}
                >
                  {inquiry.event_name}
                </h1>
                {isOwner && (
                  <button
                    onClick={startRename}
                    className="shrink-0 text-neutral-400 hover:text-neutral-600 transition p-1 rounded"
                    title="Rename event"
                  >
                    <PencilIcon />
                  </button>
                )}
              </div>
            )}
          </div>

          {!editingName && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition shrink-0"
              style={{
                background: copied ? '#f0fdf4' : '#fff',
                color: copied ? '#16a34a' : '#374151',
                boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
              }}
            >
              {copied ? <CheckIcon /> : <ShareIcon />}
              {copied ? 'Copied!' : 'Share link'}
            </button>
          )}
        </div>

        {/* Subline */}
        <p className="text-sm text-neutral-500 mb-8">
          {packages.length} venue{packages.length !== 1 ? 's' : ''} saved
          {isOwner && (
            <>
              {' · '}
              <Link href="/options" className="underline underline-offset-2" style={{ color: '#C94BBE' }}>
                Browse more →
              </Link>
            </>
          )}
        </p>

        {/* Cards */}
        {packages.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {packages.map(m => (
              <SavedCard
                key={m.packageId}
                match={m}
                isOwner={isOwner}
                onRemove={() => removePackage(m.packageId)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md px-8 py-12 text-center">
            <p className="text-neutral-400 text-sm mb-4">No venues saved yet.</p>
            {isOwner && (
              <Link href="/options" className="text-sm font-medium" style={{ color: '#C94BBE' }}>
                Browse venue options →
              </Link>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 flex flex-col items-center gap-3">
          {isOwner && (
            <Link href="/options" className="text-sm text-neutral-500 hover:text-neutral-800 transition underline underline-offset-2">
              ← Browse more venues
            </Link>
          )}
          <Link href="/confirmation" className="text-sm text-neutral-400 hover:text-neutral-600 transition underline underline-offset-2">
            ← Back to my summary
          </Link>
          <Link href="/login" className="text-xs text-neutral-400 hover:text-neutral-600 transition underline underline-offset-2">
            Sign in on a different device
          </Link>
        </div>
      </div>
    </div>
  );
}
