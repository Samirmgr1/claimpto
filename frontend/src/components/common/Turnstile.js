/**
 * Cloudflare Turnstile React Component
 * 
 * A reusable component that renders the Turnstile widget and manages token state.
 * Uses explicit rendering for better control in React's SPA environment.
 * 
 * Usage:
 *   import Turnstile from '../common/Turnstile';
 *   
 *   function MyComponent() {
 *     const [turnstileToken, setTurnstileToken] = useState(null);
 *     
 *     return (
 *       <Turnstile
 *         siteKey="your-site-key"
 *         onVerify={(token) => setTurnstileToken(token)}
 *         onExpire={() => setTurnstileToken(null)}
 *       />
 *     );
 *   }
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

// Check if Turnstile script is already loaded
let turnstileScriptLoaded = false;
let turnstileScriptLoading = false;
const turnstileLoadCallbacks = [];

/**
 * Load the Turnstile script dynamically
 */
function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (turnstileScriptLoaded && window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    
    turnstileLoadCallbacks.push({ resolve, reject });
    
    if (turnstileScriptLoading) {
      return;
    }
    
    turnstileScriptLoading = true;
    
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      turnstileScriptLoaded = true;
      turnstileScriptLoading = false;
      // Wait for turnstile to be ready
      if (window.turnstile) {
        window.turnstile.ready(() => {
          turnstileLoadCallbacks.forEach(cb => cb.resolve(window.turnstile));
          turnstileLoadCallbacks.length = 0;
        });
      }
    };
    
    script.onerror = (error) => {
      turnstileScriptLoading = false;
      turnstileLoadCallbacks.forEach(cb => cb.reject(error));
      turnstileLoadCallbacks.length = 0;
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Turnstile Widget Component
 */
function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  onError,
  onLoad,
  theme = 'auto',
  size = 'normal',
  action,
  cData,
  retry = 'auto',
  retryInterval = 8000,
  refreshExpired = 'auto',
  appearance = 'always',
  execution = 'render',
  className = '',
  style = {},
  reserveSpace = true // Whether to reserve minimum height
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [, setIsReady] = useState(false); // isReady available for future use
  const [error, setError] = useState(null);
  
  // Reset function exposed via ref or can be called internally
  // eslint-disable-next-line no-unused-vars
  const reset = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (e) {
        console.warn('[Turnstile] Reset error:', e);
      }
    }
  }, []);
  
  // Get current token
  // eslint-disable-next-line no-unused-vars
  const getResponse = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      return window.turnstile.getResponse(widgetIdRef.current);
    }
    return null;
  }, []);
  
  // Remove the widget
  const remove = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      } catch (e) {
        console.warn('[Turnstile] Remove error:', e);
      }
    }
  }, []);
  
  // Initialize Turnstile
  useEffect(() => {
    if (!siteKey) {
      return;
    }
    
    let mounted = true;
    
    const initTurnstile = async () => {
      try {
        await loadTurnstileScript();
        
        if (!mounted || !containerRef.current) return;
        
        // Remove existing widget if any
        if (widgetIdRef.current) {
          remove();
        }
        
        // Render the widget
        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size,
          action,
          cData,
          retry,
          'retry-interval': retryInterval,
          'refresh-expired': refreshExpired,
          appearance,
          execution,
          callback: (token) => {
            if (onVerify) onVerify(token);
          },
          'expired-callback': () => {
            if (onExpire) onExpire();
          },
          'error-callback': (errorCode) => {
            console.warn('[Turnstile] Error:', errorCode);
            setError(errorCode);
            if (onError) onError(errorCode);
          }
        });
        
        widgetIdRef.current = widgetId;
        setIsReady(true);
        setError(null);
        
        if (onLoad) onLoad();
        
      } catch (err) {
        console.error('[Turnstile] Init error:', err);
        setError('LOAD_ERROR');
        if (onError) onError('LOAD_ERROR');
      }
    };
    
    initTurnstile();
    
    return () => {
      mounted = false;
      remove();
    };
  }, [siteKey, theme, size, action, cData, retry, retryInterval, refreshExpired, appearance, execution, onVerify, onExpire, onError, onLoad, remove]);
  
  // If no site key is provided, don't render anything
  if (!siteKey) {
    return null;
  }
  
  // Only reserve space if explicitly requested or using 'always' appearance
  const shouldReserveSpace = reserveSpace && appearance === 'always';
  
  return (
    <div 
      className={`turnstile-container ${className}`}
      style={{ 
        minHeight: shouldReserveSpace ? (size === 'compact' ? '120px' : '65px') : 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        ...style 
      }}
    >
      <div ref={containerRef} />
      {error && (
        <div className="turnstile-error" style={{ 
          color: 'var(--danger-color, #dc3545)', 
          fontSize: '12px',
          marginTop: '8px',
          textAlign: 'center'
        }}>
          Verification failed. Please try again.
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage Turnstile token state with automatic reset
 * Uses 'interaction-only' appearance by default for seamless UX
 */
export function useTurnstile(siteKey, options = {}) {
  const [token, setToken] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const resetRef = useRef(null);
  
  const handleVerify = useCallback((newToken) => {
    setToken(newToken);
    setIsVerified(true);
    setIsExpired(false);
    setError(null);
    setNeedsInteraction(false);
  }, []);
  
  const handleExpire = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setIsExpired(true);
  }, []);
  
  const handleError = useCallback((errorCode) => {
    setToken(null);
    setIsVerified(false);
    setError(errorCode);
    // If there's an error, user might need to interact
    setNeedsInteraction(true);
  }, []);
  
  const reset = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setIsExpired(false);
    setError(null);
    setNeedsInteraction(false);
    if (resetRef.current) {
      resetRef.current();
    }
  }, []);
  
  return {
    token,
    isVerified,
    isExpired,
    error,
    needsInteraction,
    handleVerify,
    handleExpire,
    handleError,
    reset,
    resetRef,
    // Props to spread to Turnstile component - uses interaction-only by default
    turnstileProps: {
      siteKey,
      onVerify: handleVerify,
      onExpire: handleExpire,
      onError: handleError,
      appearance: options.appearance || 'interaction-only', // Only show if interaction needed
      execution: options.execution || 'render',
      size: options.size || 'normal',
      theme: options.theme || 'auto'
    }
  };
}

/**
 * Wrapper component that handles the common pattern of
 * requiring verification before an action can be taken
 */
export function TurnstileProtected({
  siteKey,
  children,
  onTokenChange,
  required = true,
  className = '',
  style = {}
}) {
  const [, setToken] = useState(null); // token state managed via onTokenChange callback
  
  const handleVerify = useCallback((newToken) => {
    setToken(newToken);
    if (onTokenChange) onTokenChange(newToken);
  }, [onTokenChange]);
  
  const handleExpire = useCallback(() => {
    setToken(null);
    if (onTokenChange) onTokenChange(null);
  }, [onTokenChange]);
  
  // If no site key, just render children (Turnstile disabled)
  if (!siteKey) {
    return children;
  }
  
  return (
    <div className={`turnstile-protected ${className}`} style={style}>
      <Turnstile
        siteKey={siteKey}
        onVerify={handleVerify}
        onExpire={handleExpire}
      />
      {children}
    </div>
  );
}

export default Turnstile;
