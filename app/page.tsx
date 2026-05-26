'use client';

import { useChat } from '@ai-sdk/react';
import { UIMessage } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

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
          router.push('/confirmation');
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
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl mb-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase mb-2">
          VenueHopper
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900 tracking-tight">
          Let&apos;s plan your event
        </h1>
        <p className="mt-2 text-neutral-500 text-sm">
          Tell our assistant about what you have in mind.
        </p>
      </div>

      <div className="w-full max-w-2xl flex flex-col bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[520px]">
          {/* Static welcome message */}
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-neutral-100 text-neutral-800">
              Hello! Tell me a bit about your event.
            </div>

          </div>

          {messages.map((m: UIMessage, i: number) => {
            const text = getTextContent(m);
            if (!text) return null;
            const isUser = m.role === 'user';
            return (
              <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                    <span className="text-white text-xs font-bold">V</span>
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed prose prose-sm max-w-none ${
                    isUser
                      ? 'bg-neutral-900 text-white rounded-br-sm prose-invert'
                      : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
                  }`}
                >
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center mr-3 flex-shrink-0">
                <span className="text-white text-xs font-bold">V</span>
              </div>
              <div className="bg-neutral-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-neutral-100 p-4">
          <form onSubmit={handleSubmit} className="flex gap-3 items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || emailSent}
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || emailSent}
              className="bg-neutral-900 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-neutral-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-xs text-neutral-400">
        Powered by VenueHopper &mdash; Your answers are sent directly to our team.
      </p>
    </div>
  );
}
