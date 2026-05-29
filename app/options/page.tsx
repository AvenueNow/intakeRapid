'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { type EventSchema, type MatchedPackage, createEmptySchema } from '@/lib/event-schema';
import { loadOrCreateSchema, saveSchema } from '@/lib/schema-session';

// ── Types ──────────────────────────────────────────────────────────────────────

type ConcludeData = {
  packageId: string;
  packageName: string;
  venueName: string;
  agentSummary: string;
};

type MsgPart = {
  type: string;
  text?: string;
  state?: string;
  output?: unknown;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPrice(cents: number | null, packageType: string): string {
  if (cents === null) return 'Price on request';
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(cents / 100);
  if (packageType === 'Starting at') return `From ${fmt}`;
  if (packageType === 'Minimum Spend' || packageType === 'Cash Bar') return `${fmt} min.`;
  return fmt;
}

function capacityLabel(min: number | null, max: number | null): string | null {
  if (max && min) return `${min}–${max} guests`;
  if (max)        return `Up to ${max} guests`;
  if (min)        return `${min}+ guests`;
  return null;
}

// ── Package card: discovery mode ───────────────────────────────────────────────

function DiscoveryCard({
  match,
  onInterested,
  onNext,
}: {
  match: MatchedPackage;
  onInterested: () => void;
  onNext: () => void;
}) {
  const cap = capacityLabel(match.capacityMin, match.capacityMax);
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col w-full max-w-sm">
      {match.coverPhoto ? (
        <div className="h-52 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={match.coverPhoto} alt={match.venueName} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-52 flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.07)' }}>
          <PinIcon />
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
          <span className="font-semibold text-neutral-700">
            {formatPrice(match.price, match.packageType)}
          </span>
          {cap && <span>{cap}</span>}
          <span>{match.durationHours}h</span>
          <span className="capitalize">{match.privacyLevel?.toLowerCase()}</span>
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

        <div className="mt-auto pt-4 flex gap-2">
          <button
            onClick={onNext}
            className="flex-1 text-sm font-medium py-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:border-neutral-400 transition"
          >
            Next →
          </button>
          <button
            onClick={onInterested}
            className="flex-1 text-sm font-medium py-2.5 rounded-xl text-white transition"
            style={{ background: '#C94BBE' }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = '#a83a9e')}
            onMouseOut={e  => ((e.currentTarget as HTMLElement).style.background = '#C94BBE')}
          >
            I&apos;m interested
          </button>
        </div>

        <a
          href={`mailto:events@venuehopper.com?subject=Interested in ${encodeURIComponent(match.venueName)} — ${encodeURIComponent(match.packageName)}`}
          className="text-center text-xs mt-1 transition"
          style={{ color: '#9ca3af' }}
          onMouseOver={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#C94BBE')}
          onMouseOut={e  => ((e.currentTarget as HTMLAnchorElement).style.color = '#9ca3af')}
        >
          Inquire directly →
        </a>
      </div>
    </div>
  );
}

// ── Package card: confirm mode ─────────────────────────────────────────────────

function ConfirmCard({
  match,
  conclude,
  onShowMore,
}: {
  match: MatchedPackage;
  conclude: ConcludeData;
  onShowMore: () => void;
}) {
  const cap = capacityLabel(match.capacityMin, match.capacityMax);
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col w-full max-w-sm">
      {match.coverPhoto ? (
        <div className="h-52 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={match.coverPhoto} alt={match.venueName} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-52 flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.07)' }}>
          <PinIcon />
        </div>
      )}

      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="text-xs font-semibold tracking-wide uppercase" style={{ color: '#C94BBE' }}>
          ✓ Your pick
        </div>

        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-neutral-900 text-base leading-tight">{match.venueName}</h2>
          <span className="text-xs rounded-full px-2 py-0.5 whitespace-nowrap shrink-0 mt-0.5"
            style={{ background: 'rgba(201,75,190,0.10)', color: '#C94BBE' }}>
            {match.neighborhood}
          </span>
        </div>

        <p className="text-xs text-neutral-400">{match.address}</p>
        <div className="h-px bg-neutral-100 my-1" />
        <p className="text-sm font-medium" style={{ color: '#C94BBE' }}>{match.packageName}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">
            {formatPrice(match.price, match.packageType)}
          </span>
          {cap && <span>{cap}</span>}
          <span>{match.durationHours}h</span>
        </div>

        {conclude.agentSummary && (
          <p className="text-xs text-neutral-500 italic leading-relaxed mt-1">
            &ldquo;{conclude.agentSummary}&rdquo;
          </p>
        )}

        <div className="mt-auto pt-4">
          <a
            href={`mailto:events@venuehopper.com?subject=Interested in ${encodeURIComponent(match.venueName)} — ${encodeURIComponent(match.packageName)}`}
            className="block text-center text-sm font-medium py-3 rounded-xl text-white transition"
            style={{ background: '#C94BBE' }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = '#a83a9e')}
            onMouseOut={e  => ((e.currentTarget as HTMLElement).style.background = '#C94BBE')}
          >
            Inquire about this venue →
          </a>
        </div>

        <button
          onClick={onShowMore}
          className="text-center text-xs mt-2 transition"
          style={{ color: '#9ca3af' }}
          onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = '#C94BBE')}
          onMouseOut={e  => ((e.currentTarget as HTMLElement).style.color = '#9ca3af')}
        >
          Show me more options
        </button>
      </div>
    </div>
  );
}

// ── Skeleton / empty states ────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden w-full max-w-sm animate-pulse">
      <div className="h-52 bg-neutral-100" />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-4 bg-neutral-100 rounded w-2/3" />
        <div className="h-3 bg-neutral-100 rounded w-1/3" />
        <div className="h-px bg-neutral-100 my-1" />
        <div className="h-4 bg-neutral-100 rounded w-3/4" />
        <div className="h-3 bg-neutral-100 rounded w-1/2" />
        <div className="mt-4 flex gap-2">
          <div className="flex-1 h-10 bg-neutral-100 rounded-xl" />
          <div className="flex-1 h-10 bg-neutral-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-xs">
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.08)' }}>
        <PinIcon />
      </div>
      <p className="text-sm text-neutral-400 leading-relaxed">
        V is finding your first option — just a moment.
      </p>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PinIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
        fill="#C94BBE" opacity="0.4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const INIT_TRIGGER = '__vh_init__';

export default function OptionsPage() {
  const [schema, setSchema] = useState<EventSchema>(() => {
    if (typeof window === 'undefined') return createEmptySchema();
    return loadOrCreateSchema();
  });
  const [currentPackage, setCurrentPackage] = useState<MatchedPackage | null>(null);
  const [concludeData, setConcludeData]     = useState<ConcludeData | null>(null);
  const [inputValue, setInputValue]         = useState('');
  const [inputFocused, setInputFocused]     = useState(false);
  const initFired    = useRef(false);
  const messagesEnd  = useRef<HTMLDivElement>(null);
  const schemaRef = useRef(schema);
  // Keep ref in sync so the transport body function always sends the latest schema
  useEffect(() => { schemaRef.current = schema; }, [schema]);

  // Transport created once; body is a function so it reads the latest schemaRef on each request
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/options-chat',
    body: () => ({ schema: schemaRef.current }),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { sendMessage: rawSend, messages, status } = useChat({ transport });

  const sendMessage = (text: string) => rawSend({ text });

  // Auto-trigger on mount to get the first package
  useEffect(() => {
    if (initFired.current) return;
    initFired.current = true;
    rawSend({ text: INIT_TRIGGER });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch tool outputs
  useEffect(() => {
    for (const msg of messages) {
      if (!Array.isArray(msg.parts)) continue;
      for (const part of msg.parts as MsgPart[]) {
        if (part.state !== 'output-available') continue;

        if (part.type === 'tool-requestNextPackage') {
          const out = part.output as { package: MatchedPackage | null };
          if (out.package) setCurrentPackage(out.package);
        }

        if (part.type === 'tool-updateSchema') {
          const updated = part.output as EventSchema;
          setSchema(updated);
          saveSchema(updated);
        }

        if (part.type === 'tool-concludeSearch') {
          setConcludeData(part.output as ConcludeData);
        }
      }
    }
  }, [messages]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isStreaming = status === 'streaming';

  const handleSend = (text: string) => {
    const t = text.trim();
    if (!t || isStreaming) return;
    setInputValue('');
    sendMessage(t);
  };

  const handleInterested = () => {
    if (!currentPackage) return;
    handleSend(`Tell me more about the ${currentPackage.packageName} at ${currentPackage.venueName}`);
  };

  const handleNext = () => {
    handleSend('Not for me — show me something different');
  };

  const handleShowMore = () => {
    setConcludeData(null);
    handleSend('Actually, can you show me a few more options?');
  };

  // Filter messages for display: hide the init trigger and tool-only turns
  const displayMessages = messages.filter(msg => {
    const text = Array.isArray(msg.parts)
      ? (msg.parts as MsgPart[]).filter(p => p.type === 'text').map(p => p.text ?? '').join('').trim()
      : '';
    if (msg.role === 'user')      return text && text !== INIT_TRIGGER;
    if (msg.role === 'assistant') return !!text;
    return false;
  });

  const showSkeleton = isStreaming && !currentPackage;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0EDF6' }}>

      {/* ── Left: Chat panel ──────────────────────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[400px] shrink-0 bg-white shadow-xl relative z-10 h-screen">

        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: '#C94BBE' }}>
              V
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">V · VenueHopper</div>
              <div className="text-xs text-neutral-400">Finding your venue</div>
            </div>
          </div>
          <Link href="/confirmation"
            className="text-xs text-neutral-400 hover:text-neutral-600 transition">
            ← Summary
          </Link>
        </div>

        {/* Mobile: compact card strip */}
        {(currentPackage || showSkeleton) && (
          <div className="lg:hidden px-4 pt-4">
            {showSkeleton ? (
              <MobileCardStrip loading />
            ) : concludeData ? (
              <MobileCardStrip
                match={currentPackage!}
                confirmHref={`mailto:events@venuehopper.com?subject=Interested in ${encodeURIComponent(currentPackage!.venueName)} — ${encodeURIComponent(currentPackage!.packageName)}`}
              />
            ) : (
              <MobileCardStrip
                match={currentPackage!}
                onInterested={handleInterested}
                onNext={handleNext}
              />
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {displayMessages.map((msg, i) => {
            const text = Array.isArray(msg.parts)
              ? (msg.parts as MsgPart[]).filter(p => p.type === 'text').map(p => p.text ?? '').join('').trim()
              : '';
            const isUser = msg.role === 'user';
            return (
              <div key={i} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: '#C94BBE' }}>
                    V
                  </div>
                )}
                <div
                  className="max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={isUser
                    ? { background: '#C94BBE', color: '#fff' }
                    : { background: '#F0EDF6', color: '#111827' }}
                >
                  {text}
                </div>
              </div>
            );
          })}

          {isStreaming && displayMessages.length === 0 && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: '#C94BBE' }}>V</div>
              <div className="px-3.5 py-2.5 rounded-2xl text-sm"
                style={{ background: '#F0EDF6', color: '#9ca3af' }}>
                <span className="animate-pulse">···</span>
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-neutral-100">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{
                background: '#F0EDF6',
                boxShadow: inputFocused ? '0 0 0 2px #C94BBE' : 'none',
                color: '#111827',
                transition: 'box-shadow 0.15s',
              }}
              placeholder="Add details or ask a question…"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(inputValue);
                }
              }}
              disabled={isStreaming}
            />
            <button
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || isStreaming}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition disabled:opacity-40"
              style={{ background: '#C94BBE', color: '#fff' }}
            >
              {isStreaming
                ? <span className="text-xs leading-none">···</span>
                : <SendIcon />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 text-center">
          <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-600 transition">
            Submit another inquiry
          </Link>
        </div>
      </div>

      {/* ── Right: Package panel (desktop only) ───────────────────────────── */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 gap-6">
        {showSkeleton ? (
          <CardSkeleton />
        ) : !currentPackage ? (
          <EmptyState />
        ) : concludeData ? (
          <ConfirmCard
            match={currentPackage}
            conclude={concludeData}
            onShowMore={handleShowMore}
          />
        ) : (
          <DiscoveryCard
            match={currentPackage}
            onInterested={handleInterested}
            onNext={handleNext}
          />
        )}

        {/* Package count indicator */}
        {schema.packagesShown.length > 1 && (
          <p className="text-xs text-neutral-400">
            {schema.packagesShown.length} venues reviewed
          </p>
        )}
      </div>
    </div>
  );
}

// ── Mobile card strip ──────────────────────────────────────────────────────────
// Compact horizontal card shown above the chat on mobile.

function MobileCardStrip({
  match,
  loading,
  onInterested,
  onNext,
  confirmHref,
}: {
  match?: MatchedPackage;
  loading?: boolean;
  onInterested?: () => void;
  onNext?: () => void;
  confirmHref?: string;
}) {
  if (loading || !match) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-3 flex gap-3 animate-pulse">
        <div className="w-14 h-14 rounded-xl bg-neutral-100 shrink-0" />
        <div className="flex-1 flex flex-col gap-2 justify-center">
          <div className="h-3 bg-neutral-100 rounded w-2/3" />
          <div className="h-3 bg-neutral-100 rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 flex gap-3 items-center">
      {match.coverPhoto ? (
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={match.coverPhoto} alt={match.venueName} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
          style={{ background: 'rgba(201,75,190,0.08)' }}>
          <PinIcon />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 truncate">{match.venueName}</p>
        <p className="text-xs text-neutral-400 truncate">{match.neighborhood} · {match.packageName}</p>
      </div>

      {confirmHref ? (
        <a
          href={confirmHref}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: '#C94BBE' }}
        >
          Inquire →
        </a>
      ) : (
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={onNext}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-600"
          >
            Next
          </button>
          <button
            onClick={onInterested}
            className="text-xs px-2.5 py-1.5 rounded-lg text-white"
            style={{ background: '#C94BBE' }}
          >
            Interested
          </button>
        </div>
      )}
    </div>
  );
}
