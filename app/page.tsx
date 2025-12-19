'use client';

import { useChat, Message } from 'ai/react';
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import FileUpload from '@/components/FileUpload';
import KBManager from '@/components/KBManager';

const CPS = 70; // characters per second (balanced speed for readability)

// Color palette for suggestions and presets - organized by color family
const COLOR_PALETTE = [
  // Green family
  '10ea5d',
  '85eb34',
  '62f608',
  '33c73a',
  // Cyan family
  '01fff4',
  // Yellow family
  'fffa0c',
  'ffff08',
  // Pink/Magenta family
  'f712e8',
  'f60062',
  'f142ee',
  // Purple family
  '9333ea',
  // Blue family
  '2323ff',
  '3c14cf',
  '3634da',
  '3154e6',
  '2b74f0',
  '2593fc',
  // Orange family
  'f75900',
  'f76c32',
  // Red family
  'db0000',
  // Light family
  'e5f2ff'
];

// Get random color with diversity - ensures each color is used at least once before repeating
const getRandomColorWithDiversity = (usedColors: string[] = []) => {
  // Count how many times each color has been used
  const colorCounts = COLOR_PALETTE.map(color => ({
    color,
    count: usedColors.filter(used => used === color).length
  }));
  
  // Find the minimum count
  const minCount = Math.min(...colorCounts.map(c => c.count));
  
  // Get colors that have been used the least
  const leastUsedColors = colorCounts
    .filter(c => c.count === minCount)
    .map(c => c.color);
  
  // Randomly select from least used colors
  return leastUsedColors[Math.floor(Math.random() * leastUsedColors.length)];
};

// Convert hex to RGB
const hexToRgb = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16)
  };
};

// Calculate relative luminance (WCAG formula)
const getLuminance = (r: number, g: number, b: number) => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Calculate contrast ratio between two colors
const getContrastRatio = (lum1: number, lum2: number) => {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Get optimal background color based on text color and theme background
const getCardBackground = (textColor: string, isDark: boolean) => {
  const textRgb = hexToRgb(textColor);
  const textLum = getLuminance(textRgb.r, textRgb.g, textRgb.b);
  
  // Theme background colors
  const themeBg = isDark ? '#0d1117' : '#c5c7ca';
  const themeBgRgb = hexToRgb(themeBg);
  const themeBgLum = getLuminance(themeBgRgb.r, themeBgRgb.g, themeBgRgb.b);
  
  // We want high contrast with text, but also blend with theme
  // Try different background luminance values and pick the best
  const candidates = [
    { lum: 0.95, color: '#f5f5f5' },  // Very light
    { lum: 0.85, color: '#d9d9d9' },  // Light
    { lum: 0.70, color: '#b3b3b3' },  // Medium-light
    { lum: 0.50, color: '#808080' },  // Medium
    { lum: 0.30, color: '#4d4d4d' },  // Medium-dark
    { lum: 0.15, color: '#262626' },  // Dark
    { lum: 0.05, color: '#0d0d0d' },  // Very dark
  ];
  
  // Find the candidate with best contrast to text (minimum 4.5:1 for WCAG AA)
  let bestCandidate = candidates[0];
  let bestContrast = 0;
  
  for (const candidate of candidates) {
    const contrast = getContrastRatio(textLum, candidate.lum);
    // Prefer candidates that also work well with theme background
    const themeContrast = getContrastRatio(candidate.lum, themeBgLum);
    const score = contrast + (themeContrast * 0.3); // Weight text contrast more heavily
    
    if (score > bestContrast) {
      bestContrast = score;
      bestCandidate = candidate;
    }
  }
  
  return bestCandidate.color;
};

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
  const [refreshKB, setRefreshKB] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; text: string; color: string; floatDuration: number; xOffset: number; yOffset: number; delay: number }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Generate stable colors and animations for preset buttons (only once on mount)
  const presetColors = useRef<string[]>([]);
  const presetAnimations = useRef<Array<{ duration: number; xOffset: number; yOffset: number }>>([]);
  
  if (presetColors.current.length === 0) {
    // Generate colors with diversity - each color family used once before repeating
    const colors: string[] = [];
    for (let i = 0; i < 8; i++) {
      colors.push(getRandomColorWithDiversity(colors));
    }
    presetColors.current = colors;
    
    presetAnimations.current = Array(8).fill(0).map(() => ({
      duration: 3 + Math.random() * 4, // 3-7 seconds
      xOffset: (Math.random() - 0.5) * 8, // -4px to +4px
      yOffset: (Math.random() - 0.5) * 8, // -4px to +4px
    }));
  }
  
  // Random corner lottie (only once on mount)
  // Automatically detects lottie files numbered 1.lottie, 2.lottie, etc. in /public/corners/
  // To add more: just add numbered files (3.lottie, 4.lottie, etc.) and update NEXT_PUBLIC_CORNER_LOTTIE_COUNT in .env.local
  const CORNER_LOTTIE_COUNT = parseInt(process.env.NEXT_PUBLIC_CORNER_LOTTIE_COUNT || '2', 10);
  
  const cornerLottie = useRef<string | null>(null);
  
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
            // Generate colors with diversity - each color family used once before repeating
            const colors: string[] = [];
            const newSuggestions = data.suggestions.map((text: string, i: number) => {
              const color = getRandomColorWithDiversity(colors);
              colors.push(color);
              return {
                id: `suggestion-${lastMessage.id}-${i}`,
                text: text,
                color: color,
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

  const handleFileUpload = async (file: File) => {
    if (!sessionId) {
      console.error('No session ID available');
      return;
    }
    
    setUploading(true);
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
    <div className="flex h-screen relative" style={{ backgroundColor: isDark ? '#0d1117' : '#c5c7ca' }}>
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
        className={`absolute left-0 top-0 h-full border-r border-gray-700 overflow-y-auto transition-all duration-300 ease-in-out z-40 ${kbExpanded ? 'w-[calc(100%-96px)]' : 'w-0'} max-w-80`} 
        style={{ backgroundColor: '#11141a', pointerEvents: kbExpanded ? 'auto' : 'none' }}
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

          <KBManager key={refreshKB} />
        </div>
      </div>

      {/* K-Base Toggle Button - Purple Gradient Bump */}
      <button
        onClick={() => setKbExpanded(!kbExpanded)}
        className="absolute top-1/2 -translate-y-1/2 z-50"
        style={{
          left: kbExpanded ? 'min(calc(100vw - 96px), 320px)' : '8px',
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
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 relative">
          <div className="max-w-4xl mx-auto space-y-3 relative z-20">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <h2 className={`text-4xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 tracking-widest`}>Hi! I'm OnlyFin.</h2>
<p className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-10 min-h-[3rem] text-left max-w-2xl mx-auto tracking-widest`}>{typedText}<span style={{ animation: 'cursor-blink 0.8s infinite' }}>|</span></p>
                
                <div className="flex flex-col gap-6 items-center max-w-4xl mx-auto">
                  {/* Row 1: 3 cards */}
                  <div className="flex gap-6 justify-center">
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How should I budget my monthly expenses?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[0], isDark),
                        color: `#${presetColors.current[0]}`,
                        borderColor: `#${presetColors.current[0]}40`,
                        animation: `float-0 ${presetAnimations.current[0].duration}s ease-in-out infinite`,
                      }}
                    >
                      How to budget expenses?
                    </button>
                    <style jsx>{`
                      @keyframes float-0 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[0].xOffset}px, ${presetAnimations.current[0].yOffset}px); }
                      }
                    `}</style>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "What are the best investment options for beginners?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[1], isDark),
                        color: `#${presetColors.current[1]}`,
                        borderColor: `#${presetColors.current[1]}40`,
                        animation: `float-1 ${presetAnimations.current[1].duration}s ease-in-out infinite`,
                      }}
                    >
                      Best investments for beginners?
                    </button>
                    <style jsx>{`
                      @keyframes float-1 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[1].xOffset}px, ${presetAnimations.current[1].yOffset}px); }
                      }
                    `}</style>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How can I improve my credit score?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[2], isDark),
                        color: `#${presetColors.current[2]}`,
                        borderColor: `#${presetColors.current[2]}40`,
                        animation: `float-2 ${presetAnimations.current[2].duration}s ease-in-out infinite`,
                      }}
                    >
                      Improve credit score?
                    </button>
                    <style jsx>{`
                      @keyframes float-2 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[2].xOffset}px, ${presetAnimations.current[2].yOffset}px); }
                      }
                    `}</style>
                  </div>
                  
                  {/* Row 2: 2 cards */}
                  <div className="flex gap-6 justify-center">
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "What's the difference between stocks and bonds?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[3], isDark),
                        color: `#${presetColors.current[3]}`,
                        borderColor: `#${presetColors.current[3]}40`,
                        animation: `float-3 ${presetAnimations.current[3].duration}s ease-in-out infinite`,
                      }}
                    >
                      Stocks vs bonds?
                    </button>
                    <style jsx>{`
                      @keyframes float-3 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[3].xOffset}px, ${presetAnimations.current[3].yOffset}px); }
                      }
                    `}</style>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How much should I save for retirement?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[4], isDark),
                        color: `#${presetColors.current[4]}`,
                        borderColor: `#${presetColors.current[4]}40`,
                        animation: `float-4 ${presetAnimations.current[4].duration}s ease-in-out infinite`,
                      }}
                    >
                      Retirement savings?
                    </button>
                    <style jsx>{`
                      @keyframes float-4 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[4].xOffset}px, ${presetAnimations.current[4].yOffset}px); }
                      }
                    `}</style>
                  </div>
                  
                  {/* Row 3: 3 cards */}
                  <div className="flex gap-6 justify-center">
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "What are tax deductions I should know about?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[5], isDark),
                        color: `#${presetColors.current[5]}`,
                        borderColor: `#${presetColors.current[5]}40`,
                        animation: `float-5 ${presetAnimations.current[5].duration}s ease-in-out infinite`,
                      }}
                    >
                      Tax deductions?
                    </button>
                    <style jsx>{`
                      @keyframes float-5 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[5].xOffset}px, ${presetAnimations.current[5].yOffset}px); }
                      }
                    `}</style>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "Should I pay off debt or invest?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[6], isDark),
                        color: `#${presetColors.current[6]}`,
                        borderColor: `#${presetColors.current[6]}40`,
                        animation: `float-6 ${presetAnimations.current[6].duration}s ease-in-out infinite`,
                      }}
                    >
                      Pay debt or invest?
                    </button>
                    <style jsx>{`
                      @keyframes float-6 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[6].xOffset}px, ${presetAnimations.current[6].yOffset}px); }
                      }
                    `}</style>
                    <button
                      onClick={() => {
                        handleInputChange({ target: { value: "How do I start building an emergency fund?" } } as any);
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className="px-2.5 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium antialiased"
                      style={{
                        backgroundColor: getCardBackground(presetColors.current[7], isDark),
                        color: `#${presetColors.current[7]}`,
                        borderColor: `#${presetColors.current[7]}40`,
                        animation: `float-7 ${presetAnimations.current[7].duration}s ease-in-out infinite`,
                      }}
                    >
                      Emergency fund tips?
                    </button>
                    <style jsx>{`
                      @keyframes float-7 {
                        0%, 100% { transform: translate(0, 0); }
                        50% { transform: translate(${presetAnimations.current[7].xOffset}px, ${presetAnimations.current[7].yOffset}px); }
                      }
                    `}</style>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${message.role === 'user' ? 'animate-slide-brake' : ''}`}>
                    <div 
                      className={`${message.role === 'user' ? 'rounded-l-2xl px-4 py-1 shadow-sm' : 'px-4 py-2'}`} 
                      style={message.role === 'user' ? { 
                        background: isDark ? 'linear-gradient(to right, #5f268c, transparent)' : 'linear-gradient(to right, #5f268c, transparent)',
                        backgroundImage: isDark 
                          ? 'linear-gradient(to right, #5f268c 0%, rgba(13, 17, 23, 0) 100%)'
                          : 'linear-gradient(to right, #5f268c 0%, rgba(197, 199, 202, 0) 100%)'
                      } : {}}
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
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                  )}
                                  <span className="font-medium">
                                    {tool.toolName === 'searchKnowledgeBase' && 'Searching knowledge base...'}
                                    {tool.toolName === 'searchWeb' && 'Searching the web...'}
                                    {tool.toolName === 'getUserLocation' && 'Getting your location...'}
                                  </span>
                                  {tool.state === 'result' && tool.result?.results?.length > 0 && (
                                    <span className="opacity-70">
                                      Found {tool.result.results.length} {tool.toolName === 'searchWeb' ? 'web result(s)' : 'document(s)'}
                                    </span>
                                  )}
                                  {tool.state === 'result' && tool.toolName === 'getUserLocation' && tool.result?.location && (
                                    <span className="opacity-70">
                                      {tool.result.location.city}, {tool.result.location.country}
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
                                      <p className={`mb-2 text-xs leading-loose tracking-widest opacity-70 ${isDark ? 'text-white' : 'text-gray-800'}`}>
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
                                                  <span key={i}>
                                                    [Source: <a href={url} target="_blank" rel="noopener noreferrer" className={`underline hover:opacity-80 transition-opacity cursor-pointer ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{domain}</a>]
                                                  </span>
                                                );
                                              } catch {
                                                // If URL parsing fails, show as-is
                                                return (
                                                  <span key={i}>{part}</span>
                                                );
                                              }
                                            }
                                            // Not a URL citation (e.g., file citation)
                                            return (
                                              <span key={i}>{part}</span>
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
                    {message.role === 'assistant' && getAssistantText(message, index).trim() && (
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
              <div className="flex justify-start mt-4">
                <div className="max-w-[85%]">
                  <div className="flex flex-wrap gap-6 ml-4">
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
                          className="px-3 py-1.5 text-xs tracking-wide border rounded-xl transition-all duration-200 backdrop-blur-sm hover:scale-105 active:scale-95"
                          style={{
                            backgroundColor: getCardBackground(suggestion.color, isDark),
                            color: `#${suggestion.color}`,
                            borderColor: `#${suggestion.color}40`,
                            animation: `fadeInFloat-${index} 0.5s ease-out ${suggestion.delay}s both, float-suggestion-${index} ${suggestion.floatDuration}s ease-in-out infinite ${suggestion.delay}s`,
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
                          @keyframes float-suggestion-${index} {
                            0%, 100% { transform: translate(0, 0); }
                            50% { transform: translate(${suggestion.xOffset}px, ${suggestion.yOffset}px); }
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
            setSuggestions([]); // Clear suggestions when user sends a message
            handleSubmit(e);
            requestAnimationFrame(() => {
              inputRef.current?.focus();
            });
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

      {/* Random Corner Animation - Right Bottom */}
      <div className="fixed bottom-0 right-0 z-50 pointer-events-none">
        <DotLottieReact
          src={`/corners/${cornerLottie.current}`}
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