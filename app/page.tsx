'use client';

import { useChat } from '@ai-sdk/react';
import { UIMessage } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

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

export default function Page() {
  const { messages, sendMessage, status } = useChat();
  const router = useRouter();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [emailSent, setEmailSent] = useState(false);
  const isLoading = status === 'streaming' || status === 'submitted';
  const isError = status === 'error';

  // Refs so event handlers always read current values without stale closures
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
    <div className="h-[100dvh] flex flex-col items-center pt-4 pb-2 px-4 md:py-12" style={{ background: '#F0EDF6' }}>
      <div className="w-full max-w-lg flex-shrink-0 mb-1 text-center">
        <Logo />
        <h1 className="text-3xl md:text-4xl text-neutral-900 mb-1 md:mb-2" style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}>
          Plan your event.
        </h1>
        <p className="hidden md:block text-neutral-500 text-sm leading-relaxed">
          Tell our assistant what you have in mind. We review every inquiry and&nbsp;will be in touch with options.
        </p>
      </div>

      <div className="w-full max-w-lg flex-1 flex flex-col bg-white rounded-2xl shadow-md overflow-hidden mt-3 md:mt-6 min-h-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
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

        <div className="p-3 md:p-4" style={{ borderTop: '1px solid #ede9f4' }}>
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

      <p className="flex-shrink-0 mt-2 text-xs text-neutral-400 text-center hidden md:block">
        No spam ever. We&apos;ll be in touch within 24 hours.
      </p>
    </div>
  );
}
