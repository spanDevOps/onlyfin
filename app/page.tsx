'use client';

import { useChat, Message } from 'ai/react';
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import FileUpload from '@/components/FileUpload';
import KBManager from '@/components/KBManager';
import { getRandomPresetQuestions, type PresetQuestion } from '@/lib/preset-questions';

const CPS = 70; // characters per second (balanced speed for readability)

export default function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kbExpanded, setKbExpanded] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarFileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastExiting, setToastExiting] = useState(false);
  const [refreshKB, setRefreshKB] = useState(0);
  const [autoCollapseAfterRefresh, setAutoCollapseAfterRefresh] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; text: string; color: string; floatDuration: number; xOffset: number; yOffset: number; delay: number }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Preset questions - generated once on mount
  const [presetQuestions, setPresetQuestions] = useState<PresetQuestion[]>([]);
  
  // Random corner lottie (only once on mount)
  // Automatically detects lottie files numbered 1.lottie, 2.lottie, etc. in /public/corners/
  // To add more: just add numbered files (3.lottie, 4.lottie, etc.) and update NEXT_PUBLIC_CORNER_LOTTIE_COUNT in .env.local
  const CORNER_LOTTIE_COUNT = parseInt(process.env.NEXT_PUBLIC_CORNER_LOTTIE_COUNT || '2', 10);
  
  const cornerLottie = useRef<string | null>(null);
  const cornerPosition = useRef<number>(20 + Math.random() * 60); // Initialize immediately
  
  if (!cornerLottie.current) {
    const randomNumber = Math.floor(Math.random() * CORNER_LOTTIE_COUNT) + 1; // 1 to CORNER_LOTTIE_COUNT
    cornerLottie.current = `${randomNumber}.lottie`;
  }
  
  // Initialize session and theme from localStorage
  useEffect(() => {
    // Import session utilities dynamically (client-side only)
    import('@/lib/session').then(({ getOrCreateSessionId, getTheme }) => {
      const sid = getOrCreateSessionId();
      setSessionId(sid);
      
      const savedTheme = getTheme();
      setTheme(savedTheme);
    });
    
    // Generate preset questions once on mount
    setPresetQuestions(getRandomPresetQuestions(8));
  }, []);
  
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
      setToast({ message: 'Upload your documents to K-Base for my reference.', type: 'success' });
      
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

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    headers: sessionId ? {
      'x-session-id': sessionId,
    } : undefined,
  });

  // Check if currently animating
  const isAnimating = animatingId !== null;

  // Generate suggestions after assistant response completes
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const secondLastMessage = messages[messages.length - 2];
    
    // Only generate if last message is from assistant and we're not loading/animating
    if (lastMessage && lastMessage.role === 'assistant' && !isLoading && !isAnimating) {
      const assistantText = lastMessage.content || '';
      const userText = secondLastMessage?.content || '';
      
      // Skip for simple greetings
      const isGreeting = userText.toLowerCase().match(/^(hi|hello|hey|sup|yo)$/);
      if (isGreeting) {
        setSuggestions([]);
        return;
      }
      
      // Generate suggestions
      setLoadingSuggestions(true);
      fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastUserMessage: userText,
          lastAssistantMessage: assistantText,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.suggestions) {
            const newSuggestions = data.suggestions.map((text: string, i: number) => {
              return {
                id: `suggestion-${lastMessage.id}-${i}`,
                text: text,
                color: '9333ea', // Fixed neon violet color
                floatDuration: 6 + Math.random() * 6, // 6-12 seconds for very slow movement
                xOffset: (Math.random() - 0.5) * 8,
                yOffset: (Math.random() - 0.5) * 8,
                delay: i * 0.15 // Staggered appearance: 150ms between each
              };
            });
            setSuggestions(newSuggestions);
          }
        })
        .catch(err => {
          console.error('Failed to generate suggestions:', err);
        })
        .finally(() => {
          setLoadingSuggestions(false);
        });
    }
  }, [messages, isLoading, isAnimating]);

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

  const scrollToBottom = (smooth = true) => {
    if (smooth) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  };

  // Ultra smooth immediate scroll for messages
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, renderedById]);

  // Ultra smooth delayed scroll for suggestions
  useEffect(() => {
    if (suggestions.length > 0) {
      // Wait for suggestions to render and animations to start
      const timeoutId = setTimeout(() => {
        scrollToBottom(true);
      }, 300); // 300ms delay for smooth transition
      
      return () => clearTimeout(timeoutId);
    }
  }, [suggestions]);

  // Check if scroll button should be visible
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
      setShowScrollButton(isScrolledUp);
    };

    container.addEventListener('scroll', handleScroll);
    
    // Use setTimeout to avoid triggering during render
    const timeoutId = setTimeout(() => {
      handleScroll();
    }, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    // Save to localStorage
    import('@/lib/session').then(({ setTheme: saveTheme }) => {
      saveTheme(newTheme);
    });
  };

  const isDark = theme === 'dark';

  const handleKBLoadComplete = () => {
    if (autoCollapseAfterRefresh) {
      setTimeout(() => {
        setKbExpanded(false);
        setAutoCollapseAfterRefresh(false);
      }, 1000);
    }
  };

  const dismissToast = () => {
    setToastExiting(true);
    setTimeout(() => {
      setToast(null);
      setToastExiting(false);
    }, 300); // Match animation duration
  };

  const handleFileUpload = async (file: File) => {
    if (!sessionId) {
      console.error('No session ID available');
      return;
    }
    
    setUploading(true);
    setToast({ message: `Uploading ${file.name}...`, type: 'success' });
    setTimeout(dismissToast, 3000);
    
    const formData = new FormData();
    formData.append('file', file);
    try {
      console.log('Uploading file:', file.name, file.size, file.type);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-session-id': sessionId,
        },
        body: formData,
      });
      console.log('Upload response status:', response.status);
      const data = await response.json();
      console.log('Upload response data:', data);
      
      if (response.ok) {
        setToast({ message: `${file.name} uploaded successfully!`, type: 'success' });
        setRefreshKB(prev => prev + 1); // Trigger KB refresh
        setTimeout(dismissToast, 3000);
        
        // If sidebar is collapsed, open it and set flag to auto-collapse after refresh
        if (!kbExpanded) {
          setKbExpanded(true);
          setAutoCollapseAfterRefresh(true);
        }
      } else {
        setToast({ message: `Upload failed: ${data.error || 'Unknown error'}`, type: 'error' });
        setTimeout(dismissToast, 5000);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setToast({ message: `Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
      setTimeout(dismissToast, 5000);
    } finally {
      setUploading(false);
    }
  };

  const dragCounter = useRef(0);

  const handleDrag = (e: React.DragEvent) => {
    console.log('[DRAG EVENT]', e.type, 'at', e.currentTarget);
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter') {
      dragCounter.current++;
      console.log('[DRAG] dragenter - counter:', dragCounter.current);
      if (dragCounter.current === 1) {
        console.log('[DRAG] Setting dragActive to TRUE');
        setDragActive(true);
      }
    } else if (e.type === 'dragleave') {
      dragCounter.current--;
      console.log('[DRAG] dragleave - counter:', dragCounter.current);
      if (dragCounter.current === 0) {
        console.log('[DRAG] Setting dragActive to FALSE');
        setDragActive(false);
      }
    } else if (e.type === 'dragover') {
      // Just prevent default, don't change state
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    console.log('[DROP EVENT] Triggered at', e.currentTarget);
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0; // Reset counter
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    console.log('[DROP] File detected:', file ? `${file.name} (${file.size} bytes, ${file.type})` : 'NO FILE');
    if (file) {
      console.log('[DROP] Calling handleFileUpload with file:', file.name);
      handleFileUpload(file);
    } else {
      console.log('[DROP] No file found in dataTransfer');
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
    <div 
      className="flex h-screen relative" 
      style={{ backgroundColor: isDark ? '#0d1117' : '#c5c7ca' }}
      onDoubleClick={(e) => {
        // Only toggle if double-click is on the main area (not on sidebar, buttons, or input)
        const target = e.target as HTMLElement;
        const isMainArea = !target.closest('.sidebar-area') && 
                          !target.closest('button') && 
                          !target.closest('input') && 
                          !target.closest('textarea') && 
                          !target.closest('.message-area') &&
                          !target.closest('.tool-call');
        if (isMainArea) {
          setKbExpanded(!kbExpanded);
        }
      }}
    >
      {/* Violet Gradient Strip at Extreme Left Edge */}
      <div 
        className="absolute left-0 top-0 h-full w-2 z-30"
        style={{
          background: isDark 
            ? 'linear-gradient(to right, #8445bf, #0d1117)'
            : 'linear-gradient(to right, #8445bf, #c5c7ca)'
        }}
      />
      
      {/* K-Base Sidebar with Drag & Drop - Overlay */}
      <div 
        className={`sidebar-area absolute left-0 top-0 h-full border-r border-gray-700 overflow-y-auto transition-all duration-300 ease-in-out z-40 ${kbExpanded ? 'w-[calc(100%-96px)]' : 'w-0'} max-w-80`} 
        style={{ backgroundColor: '#11141a', pointerEvents: kbExpanded ? 'auto' : 'none' }}
        onDoubleClick={() => setKbExpanded(false)}
        onDragEnter={kbExpanded ? handleDrag : undefined}
        onDragLeave={kbExpanded ? handleDrag : undefined}
        onDragOver={kbExpanded ? handleDrag : undefined}
        onDrop={kbExpanded ? handleDrop : undefined}
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
              onClick={() => setRefreshKB(prev => prev + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors"
              title="Refresh K-Base"
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

          <KBManager key={refreshKB} onLoadComplete={handleKBLoadComplete} />
        </div>
      </div>

      {/* K-Base Toggle Button - Purple Gradient Bump */}
      <button
        onClick={() => setKbExpanded(!kbExpanded)}
        className="absolute top-1/2 -translate-y-1/2 z-50"
        style={{
          left: kbExpanded ? '320px' : '8px', // Position at max sidebar width (320px) when expanded
          width: '44px',
          height: '500px',
          transition: 'left 300ms ease-in-out',
          transform: 'translateY(-50%)'
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
            <linearGradient id="purpleGradientDark" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#0d1117', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#5f268c', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="purpleGradientLight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#c5c7ca', stopOpacity: 1 }} />
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
            fill={isDark ? "url(#purpleGradientDark)" : "url(#purpleGradientLight)"}
          />
        </svg>
      </button>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={() => scrollToBottom()}
              className="group relative p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
              style={{ backgroundColor: isDark ? '#5f268c' : '#9333ea' }}
              title="Scroll to bottom"
            >
              <svg 
                className="w-5 h-5 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Scroll to bottom
              </span>
            </button>
          </div>
        )}

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
            <div 
              onClick={toggleTheme}
              className="cursor-pointer flex items-center justify-center"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 28, height: 28 }}
            >
              <DotLottieReact
                key={`theme-${theme}`}
                src={isDark ? "/theme/dark.lottie" : "/theme/light.lottie"}
                loop
                autoplay
                style={{ width: 28, height: 28 }}
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 relative">
          <div className="max-w-4xl mx-auto space-y-3 relative z-20">
            {messages.length === 0 && (
              <div className="text-center py-24">
                <h2 className={`text-4xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 tracking-widest`}>Hi! I'm OnlyFin.</h2>
<p className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-10 min-h-[3rem] text-left max-w-2xl mx-auto tracking-widest`}>{typedText}<span style={{ animation: 'cursor-blink 0.8s infinite' }}>|</span></p>
                
                <div className="flex flex-col gap-6 items-center max-w-4xl mx-auto">
                  {/* Row 1: 3 cards */}
                  <div className="flex gap-6 justify-center">
                    {presetQuestions.slice(0, 3).map((question) => (
                      <button
                        key={question.id}
                        onClick={() => {
                          handleInputChange({ target: { value: question.text } } as any);
                          setTimeout(() => {
                            const form = document.querySelector('form');
                            if (form) form.requestSubmit();
                          }, 50);
                        }}
                        className="px-2 py-1 text-xs tracking-wide border-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-light antialiased"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#9333ea',
                          borderColor: '#9333ea',
                          boxShadow: '0 0 10px rgba(147, 51, 234, 0.5), inset 0 0 10px rgba(147, 51, 234, 0.1)',
                        }}
                      >
                        {question.shortText}
                      </button>
                    ))}
                  </div>
                  
                  {/* Row 2: 2 cards */}
                  <div className="flex gap-6 justify-center">
                    {presetQuestions.slice(3, 5).map((question) => (
                      <button
                        key={question.id}
                        onClick={() => {
                          handleInputChange({ target: { value: question.text } } as any);
                          setTimeout(() => {
                            const form = document.querySelector('form');
                            if (form) form.requestSubmit();
                          }, 50);
                        }}
                        className="px-2 py-1 text-xs tracking-wide border-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-light antialiased"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#9333ea',
                          borderColor: '#9333ea',
                          boxShadow: '0 0 10px rgba(147, 51, 234, 0.5), inset 0 0 10px rgba(147, 51, 234, 0.1)',
                        }}
                      >
                        {question.shortText}
                      </button>
                    ))}
                  </div>
                  
                  {/* Row 3: 3 cards */}
                  <div className="flex gap-6 justify-center">
                    {presetQuestions.slice(5, 8).map((question) => (
                      <button
                        key={question.id}
                        onClick={() => {
                          handleInputChange({ target: { value: question.text } } as any);
                          setTimeout(() => {
                            const form = document.querySelector('form');
                            if (form) form.requestSubmit();
                          }, 50);
                        }}
                        className="px-2 py-1 text-xs tracking-wide border-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-light antialiased"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#9333ea',
                          borderColor: '#9333ea',
                          boxShadow: '0 0 10px rgba(147, 51, 234, 0.5), inset 0 0 10px rgba(147, 51, 234, 0.1)',
                        }}
                      >
                        {question.shortText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              return (
                <div key={message.id} className={`message-area flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${message.role === 'user' ? 'animate-slide-brake' : ''}`}>
                    <div 
                      className={`${message.role === 'user' ? 'px-4 py-1' : 'px-4 py-2'}`}
                    >
                      {message.role === 'assistant' ? (
                        <>
                          {/* Show tool calls if present */}
                          {message.toolInvocations && message.toolInvocations.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {message.toolInvocations.map((tool: any, toolIndex: number) => (
                                <div key={toolIndex} className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] ${isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                                  {tool.toolName === 'searchKnowledgeBase' ? (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                  ) : tool.toolName === 'getUserLocation' ? (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  ) : tool.toolName === 'getCurrentDateTime' ? (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                  )}
                                  <span className="font-medium">
                                    {tool.toolName === 'searchKnowledgeBase' && 'K-Base Search'}
                                    {tool.toolName === 'searchWeb' && 'Web Search'}
                                    {tool.toolName === 'getUserLocation' && 'Location'}
                                    {tool.toolName === 'getCurrentDateTime' && 'Date & Time'}
                                  </span>
                                  {tool.state === 'result' && tool.toolName === 'getUserLocation' && tool.result?.location && (
                                    <span className="opacity-70">
                                      {tool.result.location.city}, {tool.result.location.country}
                                    </span>
                                  )}
                                  {tool.state === 'result' && tool.toolName === 'getCurrentDateTime' && tool.result?.datetime && (
                                    <span className="opacity-70">
                                      {tool.result.datetime.formatted}
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
                                        {parts.map((part, i) => {
                                          if (part.startsWith('[Source:')) {
                                            // Check if it's a URL citation
                                            const urlMatch = part.match(/\[Source:\s*(https?:\/\/[^\]]+)\]/);
                                            if (urlMatch) {
                                              const url = urlMatch[1];
                                              // Extract domain/title from URL
                                              try {
                                                const urlObj = new URL(url);
                                                const domain = urlObj.hostname.replace('www.', '');
                                                return (
                                                  <span key={i} className="opacity-70">
                                                    [Source: <a href={url} target="_blank" rel="noopener noreferrer" className={`underline hover:opacity-80 transition-opacity cursor-pointer ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{domain}</a>]
                                                  </span>
                                                );
                                              } catch {
                                                // If URL parsing fails, show as-is
                                                return (
                                                  <span key={i} className="opacity-70">{part}</span>
                                                );
                                              }
                                            }
                                            // Not a URL citation (e.g., file citation)
                                            return (
                                              <span key={i} className="opacity-70">{part}</span>
                                            );
                                          }
                                          return part;
                                        })}
                                      </p>
                                    );
                                  }
                                  return <p className={`mb-2 text-xs leading-loose tracking-widest ${isDark ? 'text-white' : 'text-gray-800 font-semibold'}`} {...props} />;
                                },
                                a: ({ node, ...props }) => {
                                  // Custom link handler for citations
                                  const href = props.href || '';
                                  if (href.startsWith('http')) {
                                    try {
                                      const urlObj = new URL(href);
                                      const domain = urlObj.hostname.replace('www.', '');
                                      return (
                                        <a 
                                          href={href} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className={`underline hover:opacity-80 transition-opacity cursor-pointer ${isDark ? 'text-blue-400' : 'text-blue-700'}`}
                                        >
                                          {domain}
                                        </a>
                                      );
                                    } catch {
                                      return <a {...props} target="_blank" rel="noopener noreferrer" className={`underline hover:opacity-80 transition-opacity cursor-pointer ${isDark ? 'text-blue-400' : 'text-blue-700'}`} />;
                                    }
                                  }
                                  return <a {...props} target="_blank" rel="noopener noreferrer" className={`underline hover:opacity-80 transition-opacity cursor-pointer ${isDark ? 'text-blue-400' : 'text-blue-700'}`} />;
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
                        <div 
                          className="whitespace-pre-wrap text-xs tracking-widest leading-loose font-semibold"
                          style={{
                            backgroundImage: isDark 
                              ? 'linear-gradient(to right, #ffffff 0%, #9333ea 100%)'
                              : 'linear-gradient(to right, #1f2937 0%, #9333ea 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            color: 'transparent'
                          }}
                        >
                          {message.content}
                        </div>
                      )}
                    </div>
                    {message.role === 'assistant' && getAssistantText(message, index).trim() && !isAnimating && (
                      <div className="flex items-center gap-2 mt-0.5 ml-4">
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

            {/* Suggestion Cards */}
            {!isLoading && !isAnimating && suggestions.length > 0 && messages.length > 0 && (
              <div className="flex justify-end mt-4 animate-slideDown">
                <div className="max-w-[85%]">
                  <div className="flex flex-wrap gap-6 mr-4">
                    {suggestions.map((suggestion, index) => (
                      <React.Fragment key={suggestion.id}>
                        <button
                          onClick={() => {
                            handleInputChange({ target: { value: suggestion.text } } as any);
                            setSuggestions([]); // Clear suggestions after click
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 50);
                          }}
                          className="px-2 py-1 text-xs tracking-wide border-2 rounded-xl transition-all duration-200 backdrop-blur-sm hover:scale-105 active:scale-95 font-light antialiased"
                          style={{
                            backgroundColor: 'transparent',
                            color: '#9333ea',
                            borderColor: '#9333ea',
                            boxShadow: '0 0 10px rgba(147, 51, 234, 0.5), inset 0 0 10px rgba(147, 51, 234, 0.1)',
                            animation: `fadeInFloat-${index} 0.5s ease-out ${suggestion.delay}s both`,
                          }}
                        >
                          {suggestion.text}
                        </button>
                        <style jsx>{`
                          @keyframes fadeInFloat-${index} {
                            from {
                              opacity: 0;
                            }
                            to {
                              opacity: 1;
                            }
                          }
                        `}</style>
                      </React.Fragment>
                    ))}
                  </div>
                  {loadingSuggestions && (
                    <div className="flex items-center gap-2 mt-2">
                      <svg className="w-3 h-3 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Generating suggestions...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Loading/Typing indicator */}
            {(isLoading || isAnimating) && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 py-3 ml-4">
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
        <div 
          className="border-gray-600/30 backdrop-blur-sm border-t px-6 py-2 relative" 
          style={{ backgroundColor: '#11141a' }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {/* Drag Overlay for Footer */}
          {dragActive && (
            <div className="absolute inset-0 bg-purple-500/20 border-2 border-dashed border-purple-500 z-50 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 text-purple-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-white font-medium text-sm">Drop file to upload</p>
              </div>
            </div>
          )}
          <form onSubmit={(e) => {
            e.preventDefault();
            const trimmedInput = input.trim();
            // Don't submit if input is empty or only whitespace
            if (!trimmedInput) {
              return;
            }
            // Update input to trimmed version before submitting
            handleInputChange({ target: { value: trimmedInput } } as any);
            setSuggestions([]); // Clear suggestions when user sends a message
            // Use setTimeout to ensure the trimmed value is set before submitting
            setTimeout(() => {
              handleSubmit(e);
              requestAnimationFrame(() => {
                inputRef.current?.focus();
              });
            }, 0);
          }} className="max-w-2xl mx-auto">
            <div className="flex gap-3 items-center">
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

      {/* Random Corner Animation - Right Edge (Random Vertical Position) */}
      <div 
        className="fixed right-0 z-50 pointer-events-none"
        style={{ top: `${cornerPosition.current}%` }}
      >
        <DotLottieReact
          src={`/corners/${cornerLottie.current}`}
          loop
          autoplay
          style={{ width: 138, height: 138 }}
        />
      </div>

      {/* Toast Notification - Positioned in header area with slide animations */}
      {toast && (
        <div className={`fixed top-0 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 rounded-b-lg shadow-lg ${
          toastExiting ? 'animate-toast-out' : 'animate-toast-in'
        } ${
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