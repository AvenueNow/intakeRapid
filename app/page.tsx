'use client';

import { useChat } from '@ai-sdk/react';
import { UIMessage } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

type VenueResult = {
  venueName: string;
  address: string;
  neighborhood: string;
  venueType: string;
  spaceName: string;
  capacityMax: number | null;
  packageName: string;
  priceCents: number;
  durationHours: number;
  coverPhotoUrl: string | null;
  matchSummary: string;
};

// Mock venues used in dev mode (?dev=venues) for visual/e2e testing
const MOCK_VENUES: VenueResult[] = [
  {
    venueName: 'The Ginger Man',
    address: '11 E 36th St, New York, NY',
    neighborhood: 'Midtown',
    venueType: 'Bar & Lounge',
    spaceName: 'Private Room',
    capacityMax: 80,
    packageName: 'Happy Hour Package',
    priceCents: 150000,
    durationHours: 3,
    coverPhotoUrl: null,
    matchSummary: 'Great for a networking crowd · seats your 50 guests comfortably',
  },
  {
    venueName: "Slattery's Midtown Pub",
    address: '8 E 36th St, New York, NY',
    neighborhood: 'Midtown East',
    venueType: 'Pub',
    spaceName: 'Full Buyout',
    capacityMax: 120,
    packageName: 'Cash Bar Package',
    priceCents: 120000,
    durationHours: 4,
    coverPhotoUrl: null,
    matchSummary: 'Polished corporate setting · well within your budget',
  },
  {
    venueName: 'Turnmill Bar',
    address: '120 E 27th St, New York, NY',
    neighborhood: 'Kips Bay',
    venueType: 'Bar',
    spaceName: 'The Turnmill',
    capacityMax: 80,
    packageName: 'Cash Bar at The Turnmill',
    priceCents: 0,
    durationHours: 4,
    coverPhotoUrl: null,
    matchSummary: 'A versatile Bar space · up to 80 guests',
  },
];

function Logo() {
  return (
    <div className="flex flex-col items-center gap-1.5 mb-3 md:mb-6">
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

function VAvatar() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0" style={{ background: '#C94BBE' }}>
      <span className="text-white text-xs font-bold">V</span>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#C94BBE" opacity="0.35"/>
    </svg>
  );
}

// Compact inline card — shown in chat on mobile only (md:hidden)
function InlineVenueCard({ venue }: { venue: VenueResult }) {
  const dollars = venue.priceCents
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(venue.priceCents / 100)
    : null;

  return (
    <div className="flex-shrink-0 w-44 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
      {venue.coverPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={venue.coverPhotoUrl} alt={venue.venueName} className="h-24 w-full object-cover" />
      ) : (
        <div className="h-24 flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.07)' }}>
          <PinIcon />
        </div>
      )}
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <div className="flex items-start gap-1 justify-between">
          <p className="text-xs font-semibold text-neutral-900 leading-tight line-clamp-2">{venue.venueName}</p>
          <span className="text-[9px] rounded-full px-1.5 py-0.5 shrink-0 leading-tight mt-0.5"
            style={{ background: 'rgba(201,75,190,0.10)', color: '#C94BBE' }}>
            {venue.neighborhood}
          </span>
        </div>
        <p className="text-[10px] text-neutral-500 leading-tight line-clamp-1">{venue.packageName}</p>
        <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-auto">
          {dollars && <span className="font-semibold text-neutral-700">{dollars}</span>}
          {venue.capacityMax && <span>≤{venue.capacityMax}</span>}
          <span>{venue.durationHours}h</span>
        </div>
        <a
          href={`mailto:events@venuehopper.com?subject=Interested in ${encodeURIComponent(venue.venueName)} — ${encodeURIComponent(venue.packageName)}`}
          className="mt-1 block text-center text-[10px] font-medium py-1.5 rounded-lg text-white transition"
          style={{ background: '#C94BBE' }}
          onMouseOver={e => (e.currentTarget.style.background = '#a83a9e')}
          onMouseOut={e  => (e.currentTarget.style.background = '#C94BBE')}
        >
          Inquire →
        </a>
      </div>
    </div>
  );
}

// Larger card for the side panel on desktop
function SidePanelVenueCard({ venue }: { venue: VenueResult }) {
  const dollars = venue.priceCents
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(venue.priceCents / 100)
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {venue.coverPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={venue.coverPhotoUrl} alt={venue.venueName} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 flex items-center justify-center" style={{ background: 'rgba(201,75,190,0.07)' }}>
          <PinIcon />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 leading-tight">{venue.venueName}</p>
            <p className="text-sm text-neutral-400 mt-0.5 truncate">{venue.packageName}</p>
          </div>
          <span className="text-xs rounded-full px-2 py-1 shrink-0 font-medium"
            style={{ background: 'rgba(201,75,190,0.10)', color: '#C94BBE' }}>
            {venue.neighborhood}
          </span>
        </div>

        {venue.matchSummary && (
          <p className="text-xs leading-relaxed" style={{ color: '#C94BBE' }}>
            {venue.matchSummary}
          </p>
        )}

        <div className="flex items-center gap-3 text-sm text-neutral-500 flex-wrap">
          {dollars && <span className="font-semibold text-neutral-900">{dollars}</span>}
          {venue.capacityMax && <span>≤{venue.capacityMax} guests</span>}
          <span>{venue.durationHours}h</span>
        </div>

        <a
          href={`mailto:events@venuehopper.com?subject=Interested in ${encodeURIComponent(venue.venueName)} — ${encodeURIComponent(venue.packageName)}`}
          className="mt-1 block text-center text-sm font-semibold py-2.5 rounded-xl text-white transition"
          style={{ background: '#C94BBE' }}
          onMouseOver={e => (e.currentTarget.style.background = '#a83a9e')}
          onMouseOut={e  => (e.currentTarget.style.background = '#C94BBE')}
        >
          Inquire →
        </a>
      </div>
    </div>
  );
}

function getVenueResults(m: UIMessage): VenueResult[] {
  for (const p of m.parts) {
    if (p.type === 'tool-searchVenues' && p.state === 'output-available') {
      return (p.output as VenueResult[]) ?? [];
    }
  }
  return [];
}

export default function Page() {
  const { messages, sendMessage, status } = useChat();
  const router = useRouter();

  const [input, setInput] = useState('');
  const [latestVenues, setLatestVenues] = useState<VenueResult[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [emailSent, setEmailSent] = useState(false);
  const isLoading = status === 'streaming' || status === 'submitted';
  const isError = status === 'error';
  const showPanel = latestVenues.length > 0;

  const messagesRef = useRef(messages);
  const emailSentRef = useRef(emailSent);
  const abandonSentRef = useRef(false);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { emailSentRef.current = emailSent; }, [emailSent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  // Dev mode: ?dev=venues loads mock data for visual/e2e testing
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dev') === 'venues') {
        setLatestVenues(MOCK_VENUES);
      }
    }
  }, []);

  // Track latest venue results for the side panel
  useEffect(() => {
    for (const m of [...messages].reverse()) {
      const results = getVenueResults(m);
      if (results.length > 0) {
        setLatestVenues(results);
        return;
      }
    }
    // Only clear if not in dev mock mode
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dev') !== 'venues') {
        setLatestVenues([]);
      }
    }
  }, [messages]);

  useEffect(() => {
    for (const m of messages) {
      for (const p of m.parts) {
        if (p.type === 'tool-sendSummaryEmail' && p.state === 'output-available') {
          setEmailSent(true);
          sessionStorage.setItem('venuehopperSummary', JSON.stringify(p.input));
          setTimeout(() => router.push('/confirmation'), 2000);
          return;
        }
      }
    }
  }, [messages, router]);

  useEffect(() => {
    const sendAbandon = () => {
      if (abandonSentRef.current || emailSentRef.current || messagesRef.current.length === 0) return;
      abandonSentRef.current = true;
      const payload = JSON.stringify({ messages: messagesRef.current });
      navigator.sendBeacon('/api/abandon', new Blob([payload], { type: 'application/json' }));
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') sendAbandon(); };
    window.addEventListener('beforeunload', sendAbandon);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', sendAbandon);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || emailSent) return;
    sendMessage({ text: input.trim() });
    setInput('');
  };

  const getTextContent = (m: UIMessage) =>
    m.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join('');

  return (
    <div className="h-[100dvh] flex flex-col items-center pt-4 pb-2 px-4 md:py-8 overflow-hidden" style={{ background: '#F0EDF6' }}>
      {/* Header — always centered */}
      <div className="w-full max-w-lg flex-shrink-0 mb-1 text-center">
        <Logo />
        <h1 className="text-3xl md:text-4xl text-neutral-900 mb-1 md:mb-2" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
          Plan your event.
        </h1>
        <p className="hidden md:block text-neutral-500 text-sm leading-relaxed">
          Tell our assistant what you have in mind. We review every inquiry and&nbsp;will be in touch with options.
        </p>
      </div>

      {/* Stage: outer centers via justify-center, inner constrains width */}
      <div className="flex-1 min-h-0 mt-3 md:mt-5 flex justify-center w-full">
        <div
          className="flex gap-4 w-full min-h-0"
          data-testid="stage"
          style={{
            maxWidth: showPanel ? '960px' : '512px',
            transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Chat panel: flex-1 min-w-0 so it fills remaining space without overflowing */}
          <div
            data-testid="chat-panel"
            className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-md overflow-hidden min-h-0"
          >
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-0">
              {/* Static welcome message */}
              <div className="flex justify-start">
                <VAvatar />
                <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed" style={{ background: '#F0EDF6', color: '#1a1a1a' }}>
                  Hello! Tell me a bit about your event.
                </div>
              </div>

              {messages.map((m: UIMessage, i: number) => {
                const text = getTextContent(m);
                const isUser = m.role === 'user';
                const venueResults = isUser ? [] : getVenueResults(m);

                if (!text && venueResults.length === 0) return null;

                return (
                  <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    {text && (
                      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && <VAvatar />}
                        <div
                          className="max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed prose prose-sm"
                          style={isUser
                            ? { background: '#C94BBE', color: '#fff', borderBottomRightRadius: '4px' }
                            : { background: '#F0EDF6', color: '#1a1a1a', borderBottomLeftRadius: '4px' }
                          }
                        >
                          <ReactMarkdown>{text}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Inline cards — mobile only; lg+ uses side panel */}
                    {venueResults.length > 0 && (
                      <div className="ml-10 mt-2 flex gap-2.5 overflow-x-auto pb-1 max-w-full lg:hidden">
                        {venueResults.map((v, j) => (
                          <InlineVenueCard key={j} venue={v} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <VAvatar />
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: '#F0EDF6' }}>
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: '#C94BBE' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: '#C94BBE' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: '#C94BBE' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="p-3 md:p-4 flex-shrink-0" style={{ borderTop: '1px solid #ede9f4' }}>
              {isError && (
                <p className="text-xs text-red-400 mb-2 px-1">Something went wrong. Please try again.</p>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2 md:gap-3 items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLoading ? 'Waiting for response…' : 'Type your message...'}
                  disabled={isLoading || emailSent}
                  className="flex-1 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#F0EDF6', border: 'none' }}
                  onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
                  onBlur={(e) => (e.target.style.boxShadow = 'none')}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || emailSent}
                  className="text-white rounded-xl px-5 py-3 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 min-h-[44px]"
                  style={{ background: '#C94BBE' }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.background = '#a83a9e')}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.background = '#C94BBE')}
                >
                  {isLoading ? '…' : 'Send'}
                </button>
              </form>
            </div>
          </div>

          {/* Side panel: lg only (1024px+) so it never causes overflow on smaller screens */}
          {showPanel && (
            <div
              data-testid="venue-panel"
              className="hidden lg:flex flex-col gap-3 flex-shrink-0 overflow-y-auto"
              style={{ width: '460px', animation: 'venueSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <div className="flex-shrink-0 px-1">
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#C94BBE' }}>
                  Venue options
                </p>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {latestVenues.length} {latestVenues.length === 1 ? 'space' : 'spaces'} matched your event
                </p>
              </div>
              {latestVenues.map((v, i) => (
                <SidePanelVenueCard key={i} venue={v} />
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="flex-shrink-0 mt-2 text-xs text-neutral-400 text-center hidden md:block">
        No spam ever. We&apos;ll be in touch within 24 hours.
      </p>
    </div>
  );
}
