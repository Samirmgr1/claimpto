import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Dashboard from './components/user/Dashboard';
import Earnings from './components/user/Earnings';
import Tasks from './components/user/Tasks';
import Ads from './components/user/Ads';
import Referrals from './components/user/Referrals';
import Withdrawals from './components/user/Withdrawals';
import Profile from './components/user/Profile';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import UserDetails from './components/admin/UserDetails';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AuthProvider, useAuth, useSettings } from './context/AuthContext';
import { AdminThemeProvider } from './context/AdminThemeContext';
import './App.css';

// ============================================
// PLATFORM DETECTION UTILITIES
// ============================================
function detectTelegramPlatform() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return { platform: 'unknown', detected: false };
  
  const platform = tg.platform?.toLowerCase() || '';
  
  // Detect platform type
  if (platform === 'web' || platform === 'weba' || platform.includes('web')) {
    return { platform: 'web', detected: true, raw: platform };
  }
  if (platform === 'tdesktop' || platform === 'desktop' || platform.includes('desktop')) {
    return { platform: 'desktop', detected: true, raw: platform };
  }
  if (platform === 'android' || platform === 'ios' || platform === 'mobile' || 
      platform.includes('android') || platform.includes('ios')) {
    return { platform: 'mobile', detected: true, raw: platform };
  }
  
  // Fallback detection based on user agent
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) {
    return { platform: 'mobile', detected: true, raw: platform || 'ua-mobile' };
  }
  
  // Default to web if inside Telegram but platform unknown
  if (tg.initData) {
    return { platform: 'web', detected: true, raw: platform || 'default-web' };
  }
  
  return { platform: 'unknown', detected: false, raw: platform };
}

// ============================================
// ADBLOCKER DETECTION UTILITY
// ============================================
async function detectAdBlocker() {
  // Multiple detection methods for reliability
  const checks = [];
  
  // Method 1: Create a bait element with multiple ad-related identifiers
  const baitCheck = new Promise((resolve) => {
    const bait = document.createElement('div');
    bait.id = 'ad-container';
    bait.className = 'ad ads adsbox doubleclick ad-placement pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links ad-text adSense adBlock adBanner';
    bait.innerHTML = '&nbsp;';
    bait.style.cssText = 'width: 300px !important; height: 250px !important; position: absolute !important; left: -10000px !important; top: -1000px !important; background: #fff !important;';
    document.body.appendChild(bait);
    
    // Wait a bit for adblocker to process
    setTimeout(() => {
      let isBlocked = false;
      try {
        const computedStyle = window.getComputedStyle(bait);
        isBlocked = bait.offsetHeight === 0 || 
                    bait.offsetWidth === 0 || 
                    bait.offsetParent === null ||
                    bait.clientHeight === 0 ||
                    computedStyle.display === 'none' ||
                    computedStyle.visibility === 'hidden' ||
                    computedStyle.opacity === '0' ||
                    bait.innerHTML === '';
      } catch (e) {
        isBlocked = true;
      }
      if (bait.parentNode) {
        document.body.removeChild(bait);
      }
      resolve(isBlocked);
    }, 150);
  });
  checks.push(baitCheck);
  
  // Method 2: Create an actual ad-like iframe
  const iframeCheck = new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.id = 'ad-iframe';
    iframe.className = 'adsbox ad-frame';
    iframe.style.cssText = 'width: 300px; height: 250px; position: absolute; left: -10000px; top: -1000px; border: 0;';
    iframe.src = 'about:blank';
    document.body.appendChild(iframe);
    
    setTimeout(() => {
      let isBlocked = false;
      try {
        const computedStyle = window.getComputedStyle(iframe);
        isBlocked = iframe.offsetHeight === 0 || 
                    iframe.offsetWidth === 0 ||
                    iframe.offsetParent === null ||
                    computedStyle.display === 'none' ||
                    computedStyle.visibility === 'hidden';
      } catch (e) {
        isBlocked = true;
      }
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
      resolve(isBlocked);
    }, 150);
  });
  checks.push(iframeCheck);
  
  // Method 3: Try to fetch known ad-related URLs (multiple endpoints)
  const fetchCheck = new Promise((resolve) => {
    const testUrls = [
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://www.googletagservices.com/tag/js/gpt.js',
      'https://static.doubleclick.net/instream/ad_status.js'
    ];
    
    const fetchPromises = testUrls.map(url => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      return fetch(url, { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal 
      })
        .then(() => {
          clearTimeout(timeoutId);
          return false; // Successfully fetched = no adblocker
        })
        .catch(() => {
          clearTimeout(timeoutId);
          return true; // Failed to fetch = likely blocked
        });
    });
    
    // If any fetch fails, consider it blocked
    Promise.all(fetchPromises).then(results => {
      // If majority are blocked, adblocker is active
      const blockedCount = results.filter(r => r).length;
      resolve(blockedCount >= 2);
    });
  });
  checks.push(fetchCheck);
  
  // Method 4: Script injection test
  const scriptCheck = new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = 'ads-check-script';
    script.type = 'text/javascript';
    script.src = 'data:text/javascript,window.__adCheckPassed=true';
    script.className = 'adsbygoogle';
    
    script.onload = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(false);
    };
    script.onerror = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(true);
    };
    
    document.head.appendChild(script);
    
    // Timeout fallback
    setTimeout(() => {
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(false);
    }, 500);
  });
  checks.push(scriptCheck);
  
  // Method 5: Check for specific adblocker signatures
  const signatureCheck = new Promise((resolve) => {
    let detected = false;
    
    // Check for adblocker-specific elements or modifications
    const signatures = [
      // Check if specific ad-blocking CSS rules exist
      () => {
        const testEl = document.createElement('div');
        testEl.className = 'banner_ad';
        testEl.style.cssText = 'display: block !important; height: 10px !important; width: 10px !important;';
        document.body.appendChild(testEl);
        const hidden = window.getComputedStyle(testEl).display === 'none' || testEl.offsetHeight === 0;
        document.body.removeChild(testEl);
        return hidden;
      },
      // Check for ABP/uBlock origin style blocking
      () => {
        const testEl = document.createElement('ins');
        testEl.className = 'adsbygoogle';
        testEl.style.cssText = 'display: block; height: 100px; width: 100px;';
        document.body.appendChild(testEl);
        const hidden = testEl.offsetHeight === 0 || window.getComputedStyle(testEl).display === 'none';
        document.body.removeChild(testEl);
        return hidden;
      }
    ];
    
    for (const check of signatures) {
      try {
        if (check()) {
          detected = true;
          break;
        }
      } catch (e) {
        detected = true;
      }
    }
    
    resolve(detected);
  });
  checks.push(signatureCheck);
  
  // Run all checks
  const results = await Promise.all(checks);
  
  // Return true if at least 2 methods detect blocking (reduces false positives)
  const detectionCount = results.filter(r => r === true).length;
  return detectionCount >= 2;
}

// Set axios base URL
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
axios.defaults.timeout = 30000; // 30 second timeout
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Retry configuration for failed requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Start with 1 second

// Helper function to delay with exponential backoff
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Add token to requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Initialize retry count
    config.retryCount = config.retryCount || 0;
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Handle response errors with automatic retry
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // Log errors for debugging
    console.error('API Error:', {
      url: config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      isNetworkError: !error.response,
      retryCount: config?.retryCount || 0
    });

    // Retry logic for network errors and 503 Service Unavailable
    const shouldRetry = (
      config && 
      config.retryCount < MAX_RETRIES &&
      (
        !error.response || // Network error
        error.response.status === 503 || // Service unavailable
        error.response.status === 502 || // Bad gateway
        error.response.status === 504 || // Gateway timeout
        error.response.status === 429    // Too many requests
      )
    );

    if (shouldRetry) {
      config.retryCount += 1;
      const backoffDelay = RETRY_DELAY * Math.pow(2, config.retryCount - 1);
      console.log(`Retrying request (${config.retryCount}/${MAX_RETRIES}) after ${backoffDelay}ms...`);
      await delay(backoffDelay);
      return axios(config);
    }

    // Handle network errors (after retries exhausted)
    if (!error.response) {
      error.message = 'Unable to connect to server. Please check your connection and try again.';
      return Promise.reject(error);
    }

    // Handle 503 Service Unavailable (after retries exhausted)
    if (error.response?.status === 503) {
      error.message = 'Service temporarily unavailable. Please try again in a moment.';
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized - but avoid redirect loops
    if (error.response?.status === 401) {
      const isAuthEndpoint = config?.url?.includes('/auth/');
      const isAdminRoute = window.location.pathname.startsWith('/admin');
      const isAdminEndpoint = config?.url?.includes('/admin/');
      
      if (!isAuthEndpoint) {
        // Handle admin vs user routes separately
        if (isAdminRoute || isAdminEndpoint) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('admin');
          // Redirect to admin login
          if (window.location.pathname !== '/admin/login') {
            window.location.href = '/admin/login';
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Only redirect if not already on root
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to get Telegram user data
function getTelegramUserData() {
  const tg = window.Telegram?.WebApp;
  
  if (!tg) {
    console.log('Telegram WebApp not available');
    return null;
  }

  console.log('Telegram WebApp object:', tg);
  console.log('Platform:', tg.platform);
  console.log('Version:', tg.version);
  console.log('initData:', tg.initData);
  console.log('initDataUnsafe:', JSON.stringify(tg.initDataUnsafe, null, 2));

  // Method 1: Direct user object from initDataUnsafe
  if (tg.initDataUnsafe?.user?.id) {
    console.log('Got user from initDataUnsafe.user');
    return {
      user: tg.initDataUnsafe.user,
      startParam: tg.initDataUnsafe.start_param,
      initData: tg.initData
    };
  }

  // Method 2: Parse from initData URL params
  if (tg.initData) {
    try {
      const params = new URLSearchParams(tg.initData);
      const userStr = params.get('user');
      if (userStr) {
        const userData = JSON.parse(decodeURIComponent(userStr));
        console.log('Got user from parsing initData:', userData);
        return {
          user: userData,
          startParam: params.get('start_param'),
          initData: tg.initData
        };
      }
    } catch (e) {
      console.error('Error parsing initData:', e);
    }
  }

  // Method 3: Check if running in iframe (Mini App mode)
  if (window.parent !== window) {
    console.log('Running in iframe, likely Mini App');
  }

  return null;
}

function App() {
  const [telegramReady, setTelegramReady] = useState(false);

  useEffect(() => {
    // Initialize Telegram Web App
    const tg = window.Telegram?.WebApp;
    if (tg) {
      // Set theme colors
      document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams?.bg_color || '#ffffff');
      document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams?.text_color || '#000000');
      
      // Tell Telegram we're ready
      tg.ready();
      tg.expand();
      
      // Small delay to ensure everything is loaded
      setTimeout(() => {
        setTelegramReady(true);
      }, 100);
    } else {
      // Not in Telegram
      setTelegramReady(true);
    }
  }, []);

  if (!telegramReady) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner large"></div>
          <h2>Initializing...</h2>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="/*" element={<UserApp />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function UserApp() {
  const { user, loading, login } = useAuth();
  const { settings } = useSettings();
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  
  // Access control states
  const [accessBlocked, setAccessBlocked] = useState(null);
  const [platformInfo, setPlatformInfo] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [hasAdblocker, setHasAdblocker] = useState(false);

  // Check platform and adblocker access
  const checkAccessControl = useCallback(async (currentSettings) => {
    const accessControl = currentSettings?.accessControl;
    if (!accessControl) {
      return;
    }

    // Detect platform
    const platform = detectTelegramPlatform();
    setPlatformInfo(platform);

    // Check platform restrictions
    if (platform.detected) {
      if (platform.platform === 'web' && !accessControl.telegramWebEnabled) {
        setAccessBlocked({
          type: 'platform',
          platform: 'Telegram Web',
          icon: '🌐',
          message: 'Access from Telegram Web is currently disabled.',
          subMessage: 'Please use Telegram Mobile or Desktop app to access this application.'
        });
        return;
      }
      if (platform.platform === 'desktop' && !accessControl.telegramDesktopEnabled) {
        setAccessBlocked({
          type: 'platform',
          platform: 'Telegram Desktop',
          icon: '💻',
          message: 'Access from Telegram Desktop is currently disabled.',
          subMessage: 'Please use Telegram Mobile or Web version to access this application.'
        });
        return;
      }
      if (platform.platform === 'mobile' && !accessControl.telegramMobileEnabled) {
        setAccessBlocked({
          type: 'platform',
          platform: 'Telegram Mobile',
          icon: '📱',
          message: 'Access from Telegram Mobile is currently disabled.',
          subMessage: 'Please use Telegram Desktop or Web version to access this application.'
        });
        return;
      }
    }

    // Check adblocker if enforcement is enabled
    if (accessControl.adblockerEnforcementEnabled) {
      try {
        const adblockDetected = await detectAdBlocker();
        setHasAdblocker(adblockDetected);
        
        if (adblockDetected) {
          setAccessBlocked({
            type: 'adblocker',
            icon: '🛡️',
            message: 'Ad Blocker Detected',
            subMessage: 'Please disable your ad blocker to access this application. Our service relies on advertisements to remain free.'
          });
          return;
        }
      } catch (e) {
        console.error('Adblocker detection error:', e);
      }
    }

    // All checks passed
    setAccessBlocked(null);
  }, []);

  // Re-check access when settings change
  useEffect(() => {
    if (settings) {
      checkAccessControl(settings);
    }
  }, [settings, checkAccessControl]);

  const initTelegramAuth = useCallback(async () => {
    try {
      const tg = window.Telegram?.WebApp;
      const telegramData = getTelegramUserData();
      
      setDebugInfo(`Platform: ${tg?.platform || 'none'}, Has initData: ${!!tg?.initData}`);
      
      if (telegramData && telegramData.user?.id) {
        // We have valid Telegram user data - authenticate
        console.log('Authenticating user:', telegramData.user);
        
        const response = await axios.post('/auth/telegram', {
          id: telegramData.user.id,
          username: telegramData.user.username || '',
          first_name: telegramData.user.first_name || '',
          last_name: telegramData.user.last_name || '',
          referralCode: telegramData.startParam,
          initData: telegramData.initData
        });
        
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        login(response.data.user);
        
      } else if (tg && tg.initData) {
        // Inside Telegram but couldn't parse user - try once more after delay
        console.log('Has initData but no user, retrying...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const retryData = getTelegramUserData();
        if (retryData && retryData.user?.id) {
          const response = await axios.post('/auth/telegram', {
            id: retryData.user.id,
            username: retryData.user.username || '',
            first_name: retryData.user.first_name || '',
            last_name: retryData.user.last_name || '',
            referralCode: retryData.startParam,
            initData: retryData.initData
          });
          
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          login(response.data.user);
        } else {
          setError('Could not retrieve user data from Telegram. Please restart the app.');
        }
      } else {
        // Not in Telegram - check for existing session
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
          try {
            const response = await axios.get('/auth/verify');
            login(response.data.user);
          } catch (err) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.response?.data?.message || 'Authentication failed. Please try again.');
    } finally {
      setInitializing(false);
    }
  }, [login]);

  useEffect(() => {
    initTelegramAuth();
  }, [initTelegramAuth]);

  // Update document title with app name from settings
  useEffect(() => {
    if (settings?.appName) {
      document.title = settings.appName;
    }
  }, [settings?.appName]);

  if (initializing || loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner large"></div>
          <h2>Loading...</h2>
          <p>Please wait while we set things up</p>
        </div>
      </div>
    );
  }

  // Access Control Block Screen - Platform or Adblocker restriction
  if (accessBlocked) {
    return (
      <div className="access-blocked-screen">
        <div className="access-blocked-card">
          <div className="access-blocked-icon">{accessBlocked.icon}</div>
          <h2>{accessBlocked.type === 'platform' ? 'Platform Restricted' : accessBlocked.message}</h2>
          <p className="access-blocked-message">
            {accessBlocked.type === 'platform' ? accessBlocked.message : accessBlocked.subMessage}
          </p>
          {accessBlocked.type === 'platform' && (
            <p className="access-blocked-sub">{accessBlocked.subMessage}</p>
          )}
          {accessBlocked.type === 'adblocker' && (
            <div className="access-blocked-instructions">
              <h4>How to disable your ad blocker:</h4>
              <ol>
                <li>Click on your ad blocker extension icon</li>
                <li>Select "Pause" or "Disable" for this site</li>
                <li>Refresh this page</li>
              </ol>
              <button 
                className="btn btn-primary"
                onClick={() => window.location.reload()}
                style={{ marginTop: '20px' }}
              >
                🔄 I've Disabled Ad Blocker - Refresh
              </button>
            </div>
          )}
          {platformInfo && (
            <div className="access-blocked-debug">
              <small>Platform: {platformInfo.raw || platformInfo.platform}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check if user is suspended or banned
  if (user && user.status && user.status !== 'active') {
    // Build support Telegram link
    const supportId = settings?.supportTelegramId || '';
    const supportLink = supportId.startsWith('@') 
      ? `https://t.me/${supportId.slice(1)}` 
      : supportId.startsWith('https://') || supportId.startsWith('http://') 
        ? supportId 
        : supportId 
          ? `https://t.me/${supportId}` 
          : null;
    
    return (
      <div className="blocked-screen">
        <div className="blocked-card">
          <div className="blocked-icon">
            {user.status === 'banned' ? '🚫' : '⚠️'}
          </div>
          <h2>Account {user.status === 'banned' ? 'Banned' : 'Suspended'}</h2>
          <p className="blocked-message">
            {user.status === 'banned' 
              ? 'Your account has been permanently banned due to policy violations.'
              : 'Your account has been temporarily suspended.'}
          </p>
          <p className="blocked-sub">
            If you believe this is a mistake, please contact our support team.
          </p>
          {supportLink && (
            <a 
              href={supportLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ marginTop: '20px', display: 'inline-block', textDecoration: 'none' }}
            >
              💬 Contact Support
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    const tg = window.Telegram?.WebApp;
    return (
      <div className="welcome-screen">
        <div className="welcome-card">
          <div className="welcome-icon">⚡</div>
          <h2>Welcome!</h2>
          {error ? (
            <>
              <p className="error-text">{error}</p>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setError(null);
                  setInitializing(true);
                  initTelegramAuth();
                }}
                style={{ marginTop: '15px' }}
              >
                Try Again
              </button>
              {/* Enhanced Debug Panel */}
              <div style={{ marginTop: '20px', padding: '12px', background: '#1a1a2e', borderRadius: '8px', textAlign: 'left', fontSize: '11px', fontFamily: 'monospace', color: '#0f0', maxHeight: '150px', overflow: 'auto' }}>
                <div style={{ color: '#ff0', marginBottom: '4px' }}>API: {axios.defaults.baseURL}</div>
                <div style={{ color: '#ff0', marginBottom: '4px' }}>Platform: {tg?.platform || 'none'}</div>
                <div style={{ color: '#ff0', marginBottom: '4px' }}>Has initData: {!!tg?.initData}</div>
                <div style={{ color: '#ff0', marginBottom: '4px' }}>Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</div>
                <div style={{ wordBreak: 'break-all' }}>{debugInfo}</div>
              </div>
            </>
          ) : tg?.initData ? (
            <p>Authenticating with Telegram...</p>
          ) : (
            <>
              <p>Please open this app from Telegram to continue.</p>
              <a 
                href="https://t.me/miniFaucet_bot" 
                className="btn btn-primary"
                style={{ marginTop: '20px', display: 'inline-block', textDecoration: 'none' }}
              >
                Open in Telegram
              </a>
            </>
          )}
          {debugInfo && !error && (
            <div className="welcome-debug">
              <small>{debugInfo}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="/earnings" element={<ErrorBoundary><Earnings /></ErrorBoundary>} />
        <Route path="/tasks" element={<ErrorBoundary><Tasks /></ErrorBoundary>} />
        <Route path="/ads" element={<ErrorBoundary><Ads /></ErrorBoundary>} />
        <Route path="/referrals" element={<ErrorBoundary><Referrals /></ErrorBoundary>} />
        <Route path="/withdrawals" element={<ErrorBoundary><Withdrawals /></ErrorBoundary>} />
        <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
      </Routes>
    </div>
  );
}

function AdminApp() {
  const { admin } = useAuth();

  return (
    <AdminThemeProvider>
      <Routes>
        <Route path="/login" element={admin ? <Navigate to="/admin" replace /> : <AdminLogin />} />
        <Route path="/users/:id" element={admin ? <UserDetails /> : <Navigate to="/admin/login" replace />} />
        <Route path="/*" element={admin ? <AdminDashboard /> : <Navigate to="/admin/login" replace />} />
      </Routes>
    </AdminThemeProvider>
  );
}

export default App;
