/**
 * Session Management for User Isolation
 * Generates and manages unique session IDs stored in localStorage
 */

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = localStorage.getItem('onlyfin_session_id');
  
  if (!sessionId) {
    // Generate unique ID: timestamp + random string
    sessionId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('onlyfin_session_id', sessionId);
    console.log('[SESSION] Created new session ID:', sessionId);
  } else {
    console.log('[SESSION] Using existing session ID:', sessionId);
  }
  
  return sessionId;
}

export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('onlyfin_session_id');
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('onlyfin_session_id');
  console.log('[SESSION] Session cleared');
}

// Theme management
export function getTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const theme = localStorage.getItem('onlyfin_theme');
  return (theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
}

export function setTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('onlyfin_theme', theme);
  console.log('[SESSION] Theme set to:', theme);
}
