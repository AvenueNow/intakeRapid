import Link from 'next/link';

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

export default function OptionsPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-16 px-4" style={{ background: '#F0EDF6' }}>
      <Logo />

      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl shadow-md px-8 py-12 flex flex-col items-center gap-6">
          {/* Clock illustration */}
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

          <a
            href="mailto:events@venuehopper.com"
            className="text-sm font-medium transition"
            style={{ color: '#C94BBE' }}
          >
            events@venuehopper.com
          </a>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href="/confirmation" className="text-sm text-neutral-500 hover:text-neutral-800 transition underline underline-offset-2">
            ← Back to my summary
          </Link>
          <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-600 transition underline underline-offset-2">
            Submit another inquiry
          </Link>
        </div>
      </div>
    </div>
  );
}
