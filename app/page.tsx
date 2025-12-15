'use client';

import { useChat, Message } from 'ai/react';
import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CPS = 45; // characters per second (50% faster than 30)

export default function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Typing animation state
  const finalTextById = useRef<Record<string, string>>({});
  const streamingTextById = useRef<Record<string, string>>({});
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [renderedById, setRenderedById] = useState<Record<string, string>>({});
  const animationStartedFor = useRef<Set<string>>(new Set());

  // Generate stars once and keep them stable
  const stars = useRef(
    [...Array(50)].map(() => ({
      size: Math.random() * 2 + 1,
      top: Math.random() * 25,
      left: Math.random() * 100,
      opacity: Math.random() * 0.4 + 0.3,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 5
    }))
  ).current;

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    onFinish: (message) => {
      // Capture the final text
      finalTextById.current[message.id] = message.content ?? "";
      streamingTextById.current[message.id] = message.content ?? "";
      
      // If animation hasn't started yet, start it now
      if (!animationStartedFor.current.has(message.id)) {
        setRenderedById(prev => ({ ...prev, [message.id]: "" }));
        setAnimatingId(message.id);
        animationStartedFor.current.add(message.id);
      }
    },
  });

  // Watch for streaming messages and start animation early
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;
    
    const content = lastMessage.content ?? "";
    const messageId = lastMessage.id;
    
    // Update streaming text
    streamingTextById.current[messageId] = content;
    
    // Start animation if we have 2 seconds worth of characters (60 chars at 30 CPS)
    // and animation hasn't started yet
    const MIN_CHARS_TO_START = 60;
    if (content.length >= MIN_CHARS_TO_START && !animationStartedFor.current.has(messageId)) {
      finalTextById.current[messageId] = content;
      setRenderedById(prev => ({ ...prev, [messageId]: "" }));
      setAnimatingId(messageId);
      animationStartedFor.current.add(messageId);
    } else if (animationStartedFor.current.has(messageId)) {
      // Update the target text as more content streams in
      finalTextById.current[messageId] = content;
    }
  }, [messages]);

  // Critical: useLayoutEffect to avoid any paint with full content
  useLayoutEffect(() => {
    if (!animatingId) return;

    const msPerChar = 1000 / CPS;
    const t0 = performance.now();

    let raf = 0;
    const tick = (t: number) => {
      // Get the current target text (which may be updated during streaming)
      const full = finalTextById.current[animatingId] ?? "";
      const count = Math.min(full.length, Math.floor((t - t0) / msPerChar));
      setRenderedById(prev => ({ ...prev, [animatingId]: full.slice(0, count) }));

      // Keep animating if we haven't caught up to the current target
      if (count < full.length) {
        raf = requestAnimationFrame(tick);
      } else {
        // Check if we're still loading - if so, keep the animation alive
        if (isLoading) {
          raf = requestAnimationFrame(tick);
        } else {
          setAnimatingId(null);
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animatingId, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, renderedById]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const isDark = theme === 'dark';

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Format tool names for display
  const formatToolName = (toolName: string) => {
    return toolName
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Render rule: for assistant messages, prefer renderedById when present
  const getAssistantText = (message: Message, index: number) => {
    const typed = renderedById[message.id];
    if (typed !== undefined) return typed; // animating or already typed
    
    // If this is the last message and animation hasn't started yet, return empty to prevent flash
    const isLastMessage = index === messages.length - 1;
    if (isLastMessage && !animationStartedFor.current.has(message.id)) {
      return ""; // Don't show anything until animation starts
    }
    
    return message.content ?? ""; // older assistant messages
  };

  // Check if currently animating
  const isAnimating = animatingId !== null;

  // Refocus input after animation completes
  useEffect(() => {
    if (!isLoading && !isAnimating) {
      // Use setTimeout to ensure focus happens after all state updates
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAnimating]);

  return (
    <div className="flex flex-col h-screen relative" style={{ backgroundColor: isDark ? '#000000' : '#9a9a9a' }}>
      {/* Background skyline */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${isDark ? '/skyline-night.png' : '/skyline-day.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          backgroundRepeat: 'no-repeat',
          opacity: isDark ? 0.15 : 0.15
        }}
      />

      {/* Dark blue tint overlay for dark theme (below scroll button z-index) - night sky effect starting below header */}
      {isDark && (
        <div 
          className="absolute pointer-events-none z-0"
          style={{
            top: '64px', // Start below header
            left: 0,
            right: 0,
            height: '50vh', // Cover top half of remaining screen
            background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.7) 0%, rgba(15, 23, 42, 0.4) 40%, rgba(15, 23, 42, 0) 100%)'
          }}
        />
      )}

      {/* Starry night effect for dark theme */}
      {isDark && (
        <>
          {/* Animated stars */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {stars.map((star, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: star.size + 'px',
                  height: star.size + 'px',
                  top: star.top + '%',
                  left: star.left + '%',
                  opacity: star.opacity,
                  animation: `twinkle ${star.duration}s ease-in-out infinite`,
                  animationDelay: star.delay + 's'
                }}
              />
            ))}
          </div>
          <style jsx>{`
            @keyframes twinkle {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.7; }
            }
          `}</style>
        </>
      )}
      {/* Header */}
      <div className="border-gray-600/30 backdrop-blur-sm shadow-sm border-b px-6 py-3" style={{ backgroundColor: '#11141a' }}>
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <a href="/" className="cursor-pointer">
              <img src="/rivo-icon.png" alt="Rivo" className="h-8 w-auto" />
            </a>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg transition-all duration-200 bg-gray-600/50 hover:bg-gray-700/50"
          >
            {isDark ? (
              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 relative">
        <div className="max-w-4xl mx-auto space-y-3 relative z-20">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <h2 className={`text-4xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Hi! I am Rivo.</h2>
              <p className={`text-lg ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-10`}>I'm here to help you make smart property decisions in the UAE.</p>
              <div className="flex flex-col gap-6 items-center max-w-3xl mx-auto">
                {/* Row 1 - 3 buttons */}
                <div className="flex gap-6 justify-center">
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "Should I buy or rent?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    Should I buy or rent?
                  </button>
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "What's my monthly payment for a 1M property?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    Monthly payment for 1M?
                  </button>
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "How much do I need upfront to buy?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    Upfront costs?
                  </button>
                </div>
                {/* Row 2 - 2 buttons */}
                <div className="flex gap-6 justify-center">
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "What property can I afford with my budget?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    What can I afford?
                  </button>
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "Should I rent or buy a property?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    Rent vs buy comparison
                  </button>
                </div>
                {/* Row 3 - 3 buttons */}
                <div className="flex gap-6 justify-center">
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "Break-even point for buying vs renting?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    Break-even analysis
                  </button>
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "What are the best areas to invest in UAE?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    Best areas to invest?
                  </button>
                  <button
                    onClick={() => {
                      handleInputChange({ target: { value: "How does mortgage work for expats in UAE?" } } as any);
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.requestSubmit();
                      }, 50);
                    }}
                    className={`px-2.5 py-1.5 text-xs ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                  >
                    Mortgage for expats?
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            // Skip rendering the last assistant message entirely while streaming
            // to prevent any flash of content
            if (message.role === 'assistant' && index === messages.length - 1 && isLoading) {
              return null;
            }
            
            return (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%]`}>
                  {/* Tool call indicators */}
                  {message.role === 'assistant' && message.toolInvocations && message.toolInvocations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {message.toolInvocations.map((tool: any, toolIndex: number) => (
                        <div
                          key={toolIndex}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] ${isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-indigo-100 text-indigo-700 border border-indigo-300'} backdrop-blur-sm`}
                        >
                          {tool.toolName === 'compare_rent_vs_buy' ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                          <span className="font-medium">{formatToolName(tool.toolName)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className={`${message.role === 'user' ? 'text-white rounded-2xl px-4 py-1 shadow-sm' : 'rounded-2xl px-4 py-2'}`} style={message.role === 'user' ? { background: 'linear-gradient(135deg, #2386cd 0%, #1a5f9e 100%)' } : { backgroundColor: isDark ? 'rgba(55, 65, 81, 0.7)' : 'rgba(229, 231, 235, 0.5)' }}>
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]} 
                          components={{
                            p: ({ node, ...props }) => <p className={`mb-2 text-xs leading-loose tracking-widest ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />,
                            strong: ({ node, ...props }) => <strong className={isDark ? 'text-white font-medium' : 'text-gray-900 font-bold'} {...props} />,
                            ul: ({ node, ...props }) => <ul className={`list-disc list-inside mb-2 text-xs tracking-widest leading-loose ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />,
                            ol: ({ node, ...props }) => <ol className={`list-decimal list-inside mb-2 text-xs tracking-widest leading-loose ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />,
                            table: ({ node, ...props }) => (
                              <div className="overflow-x-auto my-3">
                                <table className={`min-w-full divide-y ${isDark ? 'divide-gray-600/50' : 'divide-gray-200'} border ${isDark ? 'border-gray-600/50' : 'border-gray-300'} rounded-lg`} {...props} />
                              </div>
                            ),
                            th: ({ node, ...props }) => <th className={`px-3 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-widest`} {...props} />,
                            td: ({ node, ...props }) => <td className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'text-gray-200' : 'text-gray-900'}`} {...props} />,
                          }}
                        >
                          {getAssistantText(message, index)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-xs tracking-widest leading-loose">{message.content}</div>
                    )}
                  </div>
                  {message.role === 'assistant' && getAssistantText(message, index).trim() && (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => copyToClipboard(getAssistantText(message, index), message.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all duration-200 ${isDark ? 'text-white hover:text-white hover:bg-gray-700/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/30'}`}
                      >
                        {copiedId === message.id ? (
                          <>
                            <svg className="w-2.5 h-2.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading/Typing indicator */}
          {(isLoading || isAnimating) && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 py-3">
                {isLoading ? (
                  <>
                    <svg className={`w-5 h-5 ${isDark ? 'text-white' : 'text-indigo-700'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" className="animate-pulse" />
                    </svg>
                    <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-800'} font-medium`}>Thinking...</span>
                  </>
                ) : (
                  <>
                    <svg className={`w-5 h-5 ${isDark ? 'text-white' : 'text-indigo-700'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="animate-pulse" />
                    </svg>
                    <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-800'} font-medium`}>Typing...</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button - positioned above input */}
      <button
        onClick={scrollToBottom}
        className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 p-1.5 rounded-full shadow-lg transition-all duration-200 z-[100] ${isDark ? 'bg-gray-700/90 hover:bg-gray-600/90 text-gray-300' : 'bg-white/90 hover:bg-gray-50/90 text-gray-600'} group`}
        title="Scroll to bottom"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <span className={`absolute -top-7 left-1/2 transform -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-white'}`}>
          Scroll to bottom
        </span>
      </button>

      {/* Input */}
      <div className="border-gray-600/30 backdrop-blur-sm shadow-sm border-t px-6 py-4 relative" style={{ backgroundColor: '#11141a' }}>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(e);
          requestAnimationFrame(() => {
            inputRef.current?.focus();
          });
        }} className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me anything about UAE property..."
              className={`flex-1 px-3.5 py-2.5 text-xs border ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400' : 'bg-white/80 border-gray-400/60 text-gray-900 font-medium placeholder-gray-600'} rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200`}
              disabled={isLoading || isAnimating}
            />
            {(isLoading || isAnimating) ? (
              <button
                type="button"
                onClick={() => {
                  stop();
                  // Immediately stop typing animation at current position (cut mid-air)
                  if (animatingId) {
                    // Keep whatever is currently rendered, don't show the rest
                    setAnimatingId(null);
                  }
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className="transition-all duration-200 hover:scale-110 active:scale-95"
                title="Stop generating"
              >
                <img src="/stop.png" alt="Stop" className="w-10 h-10 rotate-90" />
              </button>
            ) : (
              <button
                type="submit"
                className="transition-all duration-200 hover:scale-110 active:scale-95 active:rotate-12"
              >
                <img src="/send.png" alt="Send" className="w-8 h-8" />
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
