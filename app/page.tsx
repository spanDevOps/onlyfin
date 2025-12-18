'use client';

import { useChat, Message } from 'ai/react';
import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import FileUpload from '@/components/FileUpload';
import KBManager from '@/components/KBManager';

const CPS = 45; // characters per second (50% faster than 30)

export default function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kbExpanded, setKbExpanded] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarFileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [refreshKB, setRefreshKB] = useState(0);
  const [typedText, setTypedText] = useState('');
  
  // Typing effect for welcome message with smart delays
  useEffect(() => {
    const fullText = "I'm your specialized financial assistant. Ask me anything about finance - you can also upload documents for me to refer while responding to you. Try me!";
    let currentIndex = 0;
    let timeoutId: NodeJS.Timeout;
    
    const typeNextChar = () => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        
        const currentChar = fullText[currentIndex - 1];
        let delay = 50; // Default typing speed
        
        // Long delay after sentence end
        if (currentChar === '!' || currentChar === '?') {
          delay = 1500; // 1.5 second pause after full sentence
        }
        // Short delay after mid-sentence period
        else if (currentChar === '.') {
          delay = 500; // 0.5 second pause after period
        }
        
        currentIndex++;
        timeoutId = setTimeout(typeNextChar, delay);
      } else {
        // Long delay before restarting
        timeoutId = setTimeout(() => {
          currentIndex = 0;
          typeNextChar();
        }, 2000); // 2 second pause before loop restart
      }
    };
    
    typeNextChar();
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Auto-open/close sidebar on page load with welcome toast
  useEffect(() => {
    // Wait 1 second, then open
    const openTimer = setTimeout(() => {
      setKbExpanded(true);
      
      // Show welcome toast
      setToast({ message: 'Upload your documents to K-Base for me to refer to, while responding!', type: 'success' });
      
      // Toast stays for 5 seconds
      const toastTimer = setTimeout(() => {
        setToast(null);
      }, 5000);
      
      // Sidebar stays open for 3.5 seconds, then close
      const closeTimer = setTimeout(() => {
        setKbExpanded(false);
      }, 3500);
      
      return () => {
        clearTimeout(toastTimer);
        clearTimeout(closeTimer);
      };
    }, 1000);
    
    return () => clearTimeout(openTimer);
  }, []); // Run only once on mount
  
  // Typing animation state
  const finalTextById = useRef<Record<string, string>>({});
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [renderedById, setRenderedById] = useState<Record<string, string>>({});
  const animationStartedFor = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>(0);
  const animationStartTimeRef = useRef<number>(0);

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

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat();

  // Initialize renderedById immediately when new assistant message appears
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;
    
    const messageId = lastMessage.id;
    const content = lastMessage.content ?? "";
    
    // Start animation if we have enough characters buffered
    const MIN_CHARS_TO_START = 10;
    if (content.length >= MIN_CHARS_TO_START && !animationStartedFor.current.has(messageId)) {
      // Initialize to empty string and start animation
      setRenderedById(prev => ({ ...prev, [messageId]: "" }));
      finalTextById.current[messageId] = content;
      setAnimatingId(messageId);
      animationStartedFor.current.add(messageId);
      animationStartTimeRef.current = performance.now();
    } else if (animationStartedFor.current.has(messageId)) {
      // Update the target text as more content streams in
      finalTextById.current[messageId] = content;
    }
  }, [messages]);

  // Critical: useLayoutEffect to avoid any paint with full content
  useLayoutEffect(() => {
    if (!animatingId) return;

    const msPerChar = 1000 / CPS;
    const t0 = animationStartTimeRef.current || performance.now();

    const tick = (t: number) => {
      // Get the current target text (which may be updated during streaming)
      const full = finalTextById.current[animatingId] ?? "";
      const elapsed = t - t0;
      const count = Math.min(full.length, Math.floor(elapsed / msPerChar));
      
      setRenderedById(prev => {
        // Only update if the count has changed
        const currentText = prev[animatingId] ?? "";
        const newText = full.slice(0, count);
        if (currentText === newText) return prev;
        return { ...prev, [animatingId]: newText };
      });

      // Keep animating if we haven't caught up to the current target
      if (count < full.length) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        // Check if we're still loading - if so, keep the animation alive
        if (isLoading) {
          animationFrameRef.current = requestAnimationFrame(tick);
        } else {
          setAnimatingId(null);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      console.log('Uploading file:', file.name, file.size, file.type);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      console.log('Upload response status:', response.status);
      const data = await response.json();
      console.log('Upload response data:', data);
      
      if (response.ok) {
        setToast({ message: `${file.name} uploaded successfully!`, type: 'success' });
        setRefreshKB(prev => prev + 1); // Trigger KB refresh
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: `Upload failed: ${data.error || 'Unknown error'}`, type: 'error' });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setToast({ message: `Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

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

  // Render rule: Use renderedById if available, otherwise show full content for old messages
  const getAssistantText = (message: Message, index: number) => {
    // If we have typed text (even if empty string), use it
    if (renderedById.hasOwnProperty(message.id)) {
      return renderedById[message.id];
    }
    
    // Check if this is currently being animated
    if (animationStartedFor.current.has(message.id)) {
      return ""; // Return empty until animation state is set
    }
    
    // For older messages that completed before this session, show full content
    return message.content ?? "";
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
    <div className="flex h-screen relative" style={{ backgroundColor: isDark ? '#1a1d24' : '#c5c7ca' }}>
      {/* K-Base Sidebar with Drag & Drop - Overlay */}
      <div 
        className={`absolute left-0 top-0 h-full border-r border-gray-700 overflow-y-auto transition-all duration-300 ease-in-out z-40 ${kbExpanded ? 'w-[calc(100%-96px)]' : 'w-0'} max-w-80`} 
        style={{ backgroundColor: '#11141a' }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {dragActive && kbExpanded && (
          <div className="absolute inset-0 bg-purple-500/20 border-2 border-dashed border-purple-500 z-50 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-purple-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-white font-medium">Drop file to upload</p>
            </div>
          </div>
        )}

        <div className={`space-y-2 p-4 ${kbExpanded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">K-Base</h2>
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Upload Button */}
          <input
            ref={sidebarFileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(file);
              }
              e.target.value = '';
            }}
          />
          <img 
            src="/upload.png" 
            alt="Upload" 
            onClick={() => sidebarFileInputRef.current?.click()}
            className={`w-8 h-8 mx-auto mb-4 cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 ${uploading ? 'animate-spin opacity-50' : ''}`}
            title="Upload to K-Base"
          />

          <KBManager key={refreshKB} />
        </div>
      </div>

      {/* K-Base Toggle Button - Purple Gradient Bump */}
      <button
        onClick={() => setKbExpanded(!kbExpanded)}
        className="absolute top-1/2 -translate-y-1/2 z-50"
        style={{
          left: kbExpanded ? 'min(calc(100vw - 96px), 320px)' : '0px',
          width: '44px',
          height: '500px',
          transition: 'left 300ms ease-in-out'
        }}
        title={kbExpanded ? 'Collapse K-Base' : 'Expand K-Base'}
      >
        {/* SVG Rounded Bump with Purple Gradient */}
        <svg 
          width="44" 
          height="500" 
          viewBox="0 0 44 500" 
          className="absolute inset-0"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#11141a', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#5f268c', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path
            d="M 0,0 
               L 0,180 
               C 0,200 6,215 16,230
               C 22,240 26,245 26,250
               C 26,255 22,260 16,270
               C 6,285 0,300 0,320
               L 0,500 
               Z"
            fill="url(#purpleGradient)"
          />
        </svg>
      </button>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">

        {/* Header - Half Size */}
        <div className="border-gray-600/30 backdrop-blur-sm shadow-sm border-b px-6 py-1.5" style={{ backgroundColor: '#11141a' }}>
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <a href="/" className="cursor-pointer">
                <DotLottieReact
                  src="/onlyf-icon.lottie"
                  loop
                  autoplay
                  style={{ width: 28, height: 28 }}
                />
              </a>
            </div>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg transition-all duration-200 bg-gray-600/50 hover:bg-gray-700/50"
            >
              {isDark ? (
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
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
                <h2 className={`text-4xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 tracking-widest`}>Hi! I'm OnlyFin.</h2>
<p className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-10 min-h-[3rem] text-left max-w-2xl mx-auto tracking-widest`}>{typedText}<span style={{ animation: 'cursor-blink 0.8s infinite' }}>|</span></p>
                
                <div className="flex flex-col gap-4 items-center max-w-4xl mx-auto">
                  {/* Row 1: 3 cards */}
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How should I budget my monthly expenses?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      How to budget expenses?
                    </button>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "What are the best investment options for beginners?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      Best investments for beginners?
                    </button>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How can I improve my credit score?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      Improve credit score?
                    </button>
                  </div>
                  
                  {/* Row 2: 2 cards */}
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "What's the difference between stocks and bonds?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      Stocks vs bonds?
                    </button>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How much should I save for retirement?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      Retirement savings?
                    </button>
                  </div>
                  
                  {/* Row 3: 3 cards */}
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "What are tax deductions I should know about?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      Tax deductions?
                    </button>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "Should I pay off debt or invest?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      Pay debt or invest?
                    </button>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How do I start building an emergency fund?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`px-2.5 py-1.5 text-xs tracking-widest ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50' : 'bg-white/80 border-gray-400/60 text-gray-800 font-medium hover:bg-gray-100/80'} border rounded-xl transition-all duration-200 backdrop-blur-sm`}
                    >
                      Emergency fund tips?
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%]`}>
                    <div className={`${message.role === 'user' ? 'text-white rounded-2xl px-4 py-1 shadow-sm' : 'px-4 py-2'}`} style={message.role === 'user' ? { background: 'linear-gradient(to right, #5f268c, #11141a)' } : {}}>
                      {message.role === 'assistant' ? (
                        <>
                          {/* Show tool calls if present */}
                          {message.toolInvocations && message.toolInvocations.length > 0 && (
                            <div className="mb-2 space-y-1">
                              {message.toolInvocations.map((tool: any, toolIndex: number) => (
                                <div key={toolIndex} className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] ${isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  <span className="font-medium">
                                    {tool.toolName === 'searchKnowledgeBase' && 'Searching knowledge base...'}
                                  </span>
                                  {tool.state === 'result' && tool.result?.results?.length > 0 && (
                                    <span className="opacity-70">
                                      Found {tool.result.results.length} document(s)
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]} 
                              components={{
                                p: ({ node, ...props }) => {
                                  const content = props.children;
                                  // Check if content contains [Source: ...] pattern
                                  if (typeof content === 'string' && content.includes('[Source:')) {
                                    const parts = content.split(/(\[Source:[^\]]+\])/g);
                                    return (
                                      <p className={`mb-2 text-xs leading-loose tracking-widest ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`}>
                                        {parts.map((part, i) => 
                                          part.startsWith('[Source:') ? 
                                            <span key={i} className="font-mono text-[9px] font-extralight opacity-60 tracking-normal">{part}</span> : 
                                            part
                                        )}
                                      </p>
                                    );
                                  }
                                  return <p className={`mb-2 text-xs leading-loose tracking-widest ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />;
                                },
                                strong: ({ node, ...props }) => <strong className={isDark ? 'text-white font-medium' : 'text-gray-900 font-bold'} {...props} />,
                                code: ({ node, ...props }: any) => props.inline ? <code className="font-mono text-[9px] font-extralight opacity-60 tracking-normal" {...props} /> : <code {...props} />,
                                ul: ({ node, ...props }) => <ul className={`mb-2 text-xs leading-loose tracking-widest ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />,
                                ol: ({ node, ...props }) => <ol className={`mb-2 text-xs leading-loose tracking-widest ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />,
                                li: ({ node, ...props }) => <li className={`text-xs leading-loose tracking-widest ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />,
                              }}
                            >
                              {getAssistantText(message, index)}
                            </ReactMarkdown>
                          </div>
                        </>
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
                      <svg className="w-5 h-5 text-purple-400 animate-fast-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-800'} font-light`}>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-purple-400 animate-fast-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-800'} font-light`}>Typing...</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-gray-600/30 backdrop-blur-sm border-t px-6 py-2 relative" style={{ backgroundColor: '#11141a' }}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e);
            requestAnimationFrame(() => {
              inputRef.current?.focus();
            });
          }} className="max-w-2xl mx-auto">
            <div className="flex gap-2 items-center">
              {/* Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                  e.target.value = '';
                }}
              />
              <img 
                src="/upload.png" 
                alt="Upload" 
                onClick={() => fileInputRef.current?.click()}
                className={`w-8 h-8 cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 ${uploading ? 'animate-spin opacity-50' : ''}`}
                title="Upload to K-Base"
              />
              
              <input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me anything about finance..."
                className={`flex-1 px-3.5 py-2 text-xs border ${isDark ? 'bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400' : 'bg-white/80 border-gray-400/60 text-gray-900 font-medium placeholder-gray-600'} rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200`}
                disabled={isLoading || isAnimating}
              />
              {(isLoading || isAnimating) ? (
                <button
                  type="button"
                  onClick={() => {
                    stop();
                    if (animatingId) {
                      setAnimatingId(null);
                    }
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className="transition-all duration-200 hover:scale-110 active:scale-95"
                  title="Stop generating"
                >
                  <img src="/stop.png" alt="Stop" className="w-6 h-6 -rotate-90" />
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

      {/* Revenue Animation - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
        <DotLottieReact
          src="/revenue.lottie"
          loop
          autoplay
          style={{ width: 180, height: 180 }}
        />
      </div>

      {/* Toast Notification - Positioned in header area with fade effect */}
      {toast && (
        <div className={`fixed top-0 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 rounded-b-lg shadow-lg animate-toast ${
          toast.type === 'success' 
            ? 'bg-purple-600 text-white' 
            : 'bg-red-500 text-white'
        }`} style={{ maxHeight: '40px' }}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-xs font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}