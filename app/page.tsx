'use client';

import { useChat } from '@ai-sdk/react';
import { UIMessage } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

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

function VAvatar() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0" style={{ background: '#C94BBE' }}>
      <span className="text-white text-xs font-bold">V</span>
    </div>
  );
}

export default function Page() {
  const { messages, sendMessage, status } = useChat();
  const router = useRouter();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [emailSent, setEmailSent] = useState(false);
  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    for (const m of messages) {
      for (const p of m.parts) {
        if (p.type === 'tool-sendSummaryEmail' && p.state === 'output-available') {
          setEmailSent(true);
          sessionStorage.setItem('venuehopperSummary', JSON.stringify(p.input));
          setTimeout(() => router.push('/confirmation'), 3000);
          return;
        }
      }
    }
  }, [messages, router]);

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
    <div className="min-h-screen flex flex-col items-center py-12 px-4" style={{ background: '#F0EDF6' }}>
      <div className="w-full max-w-lg mb-2 text-center">
        <Logo />
        <h1 className="text-4xl text-neutral-900 mb-2" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
          Plan your event.
        </h1>
        <p className="text-neutral-500 text-sm leading-relaxed">
          Tell our assistant what you have in mind. We review every inquiry and&nbsp;will be in touch with options.
        </p>
      </div>

      <div className="w-full max-w-lg flex flex-col bg-white rounded-2xl shadow-md overflow-hidden mt-6">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[480px]">
          {/* Static welcome message */}
          <div className="flex justify-start">
            <VAvatar />
            <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed" style={{ background: '#F0EDF6', color: '#1a1a1a' }}>
              Hello! Tell me a bit about your event.
            </div>
          </div>

          {messages.map((m: UIMessage, i: number) => {
            const text = getTextContent(m);
            if (!text) return null;
            const isUser = m.role === 'user';
            return (
              <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
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

        <div className="p-4" style={{ borderTop: '1px solid #ede9f4' }}>
          <form onSubmit={handleSubmit} className="flex gap-3 items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || emailSent}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#F0EDF6', border: 'none' }}
              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #C94BBE')}
              onBlur={(e) => (e.target.style.boxShadow = 'none')}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || emailSent}
              className="text-white rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              style={{ background: '#C94BBE' }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.background = '#a83a9e')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.background = '#C94BBE')}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      <p className="mt-5 text-xs text-neutral-400 text-center">
        No spam ever. We&apos;ll be in touch within 48 hours.
      </p>
    </div>
  );
}
