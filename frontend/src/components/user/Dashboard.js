import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, useData } from '../../context/AuthContext';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import SuccessPopup from '../common/SuccessPopup';
import Turnstile, { useTurnstile } from '../common/Turnstile';

// Premium SVG Icons
const WalletIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const TrendUpIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const WithdrawIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="15"/>
    <polyline points="5 8 12 1 19 8"/>
    <path d="M5 21h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2z"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const DropletIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
  </svg>
);

const GiftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12v10H4V12"/>
    <path d="M2 7h20v5H2z"/>
    <path d="M12 22V7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);

const TaskIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const AdsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <path d="M8 21h8"/>
    <path d="M12 17v4"/>
    <polygon points="10,8 10,12 14,10"/>
  </svg>
);

const BoltIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const ListIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const CoinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v12"/>
    <path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

function Dashboard() {
  const { user } = useAuth();
  const { fetchDashboard, fetchFaucetStatus: fetchCachedFaucetStatus, faucetStatus: cachedFaucetStatus, invalidateCache, settings } = useData();
  const turnstile = useTurnstile(settings?.turnstile?.siteKey);
  const [dashboardData, setDashboardData] = useState(null);
  const [faucetStatus, setFaucetStatus] = useState(cachedFaucetStatus);
  const [loading, setLoading] = useState(!user); // Don't show loading if we have cached user
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successPopup, setSuccessPopup] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  
  // Ad-related state for faucet claim
  const [adProgress, setAdProgress] = useState(null); // { current: 1, total: 3, status: 'watching' | 'completed' | 'error' }
  const adsgramScriptLoaded = useRef(false);
  const adsgramBlockId = useRef(null);
  const adsgramController = useRef(null);
  const monetagScriptLoaded = useRef(false);
  const monetagZoneId = useRef(null);
  const adExtraScriptLoaded = useRef(false);
  const adExtraPlacementId = useRef(null);
  const adexoraScriptLoaded = useRef(false);
  const adexoraAppId = useRef(null);

  // Get Telegram user photo URL
  const getTelegramPhotoUrl = () => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.photo_url) {
        return tg.initDataUnsafe.user.photo_url;
      }
    } catch (e) {
      console.log('Could not get Telegram photo');
    }
    return null;
  };

  const telegramPhotoUrl = getTelegramPhotoUrl();

  // Debug logger helper
  const logDebug = useCallback((message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
    console.log(logEntry);
    setDebugLogs(prev => [...prev.slice(-19), logEntry]); // Keep last 20 logs
  }, []);

  const fetchDashboardData = useCallback(async () => {
    logDebug('Fetching dashboard data (with cache)...');
    try {
      const data = await fetchDashboard();
      if (data) {
        logDebug('Dashboard data received', { hasUser: !!data?.user });
        setDashboardData(data);
        setError(null);
      }
    } catch (err) {
      const errorDetails = {
        message: err.message,
        status: err.response?.status,
        isNetworkError: !err.response
      };
      logDebug('Dashboard fetch error', errorDetails);
      setError(`Failed to load dashboard: ${err.response?.data?.message || err.message}`);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, logDebug]);

  const fetchFaucetStatusData = useCallback(async () => {
    logDebug('Fetching faucet status (with cache)...');
    try {
      const data = await fetchCachedFaucetStatus();
      if (data) {
        logDebug('Faucet status received', { canClaim: data?.canClaim });
        setFaucetStatus(data);
      }
    } catch (err) {
      logDebug('Faucet status error', { message: err.message, status: err.response?.status });
      console.error('Faucet status error:', err);
    }
  }, [fetchCachedFaucetStatus, logDebug]);

  useEffect(() => {
    // Use cached data if available, but still fetch fresh data in background
    if (cachedFaucetStatus) {
      setFaucetStatus(cachedFaucetStatus);
    }
    fetchDashboardData();
    fetchFaucetStatusData();
  }, [fetchDashboardData, fetchFaucetStatusData, cachedFaucetStatus]);

  // Countdown timer
  useEffect(() => {
    if (faucetStatus && !faucetStatus.canClaim && faucetStatus.remainingSeconds > 0) {
      const timer = setInterval(() => {
        setFaucetStatus(prev => {
          if (!prev || prev.remainingSeconds <= 1) {
            invalidateCache('faucet');
            fetchFaucetStatusData();
            return prev;
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [faucetStatus, fetchFaucetStatusData, invalidateCache]);

  // Ad loading functions for faucet claim
  const loadAdsgramScript = useCallback((blockId) => {
    return new Promise((resolve, reject) => {
      if (adsgramScriptLoaded.current && adsgramBlockId.current === blockId && adsgramController.current) {
        resolve(adsgramController.current);
        return;
      }
      const existingScript = document.getElementById('adsgram-script');
      const initController = () => {
        if (window.Adsgram) {
          try {
            const AdController = window.Adsgram.init({ blockId });
            adsgramScriptLoaded.current = true;
            adsgramBlockId.current = blockId;
            adsgramController.current = AdController;
            resolve(AdController);
          } catch (err) {
            reject(new Error('Failed to initialize Adsgram SDK'));
          }
        } else {
          reject(new Error('Adsgram SDK not available'));
        }
      };
      if (existingScript && window.Adsgram) {
        initController();
        return;
      }
      if (existingScript) existingScript.remove();
      const script = document.createElement('script');
      script.id = 'adsgram-script';
      script.src = 'https://sad.adsgram.ai/js/sad.min.js';
      script.async = true;
      script.onload = () => setTimeout(() => initController(), 100);
      script.onerror = () => reject(new Error('Failed to load Adsgram SDK'));
      document.head.appendChild(script);
    });
  }, []);

  const loadMonetagScript = useCallback((zoneId) => {
    return new Promise((resolve, reject) => {
      if (monetagScriptLoaded.current && monetagZoneId.current === zoneId) {
        resolve();
        return;
      }
      const existingScript = document.getElementById('monetag-script');
      if (existingScript) existingScript.remove();
      const script = document.createElement('script');
      script.id = 'monetag-script';
      script.src = '//libtl.com/sdk.js';
      script.setAttribute('data-zone', zoneId);
      script.setAttribute('data-sdk', `show_${zoneId}`);
      script.onload = () => {
        monetagScriptLoaded.current = true;
        monetagZoneId.current = zoneId;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Monetag script'));
      document.head.appendChild(script);
    });
  }, []);

  const loadAdExtraScript = useCallback((placementId) => {
    return new Promise((resolve, reject) => {
      if (adExtraScriptLoaded.current && adExtraPlacementId.current === placementId) {
        resolve();
        return;
      }
      const existingScript = document.getElementById('adextra-script');
      if (existingScript) existingScript.remove();
      const existingContainer = document.getElementById(placementId);
      if (existingContainer) existingContainer.remove();
      const container = document.createElement('div');
      container.id = placementId;
      document.body.appendChild(container);
      const script = document.createElement('script');
      script.id = 'adextra-script';
      script.src = `https://partner.adextra.io/jt/${placementId}.js`;
      script.async = true;
      script.onload = () => {
        adExtraScriptLoaded.current = true;
        adExtraPlacementId.current = placementId;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load AdExtra script'));
      document.head.appendChild(script);
    });
  }, []);

  const loadAdexoraScript = useCallback((appId) => {
    return new Promise((resolve, reject) => {
      if (adexoraScriptLoaded.current && adexoraAppId.current === appId) {
        resolve();
        return;
      }
      const existingScript = document.getElementById('adexora-script');
      if (existingScript) existingScript.remove();
      const script = document.createElement('script');
      script.id = 'adexora-script';
      script.src = `https://adexora.com/cdn/ads.js?id=${appId}`;
      script.onload = () => {
        adexoraScriptLoaded.current = true;
        adexoraAppId.current = appId;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Adexora script'));
      document.head.appendChild(script);
    });
  }, []);

  // Show a single ad and return a promise
  // STRICT: Only shows ads from providers that are explicitly configured by admin for faucet claim
  // No fallback or alternative providers - if config is missing, the ad fails
  const showSingleAd = useCallback(async (provider) => {
    const { id, config } = provider;
    
    // Validate that provider has required config - no fallback allowed
    if (!id || !config) {
      return Promise.reject(new Error('Invalid provider configuration'));
    }
    
    return new Promise((resolve, reject) => {
      if (id === 'adsgram') {
        if (!config.blockId) {
          return reject(new Error('Adsgram not properly configured'));
        }
        loadAdsgramScript(config.blockId)
          .then((AdController) => {
            AdController.show()
              .then(() => resolve())
              .catch((result) => reject(new Error(result?.description || 'Ad not completed')));
          })
          .catch((err) => reject(err));
      } else if (id === 'monetag') {
        if (!config.zoneId) {
          return reject(new Error('Monetag not properly configured'));
        }
        loadMonetagScript(config.zoneId)
          .then(() => {
            const tryShowAd = (attempts = 0) => {
              const showFn = `show_${config.zoneId}`;
              if (typeof window[showFn] === 'function') {
                window[showFn]()
                  .then(() => resolve())
                  .catch(() => reject(new Error('Ad not completed')));
              } else if (attempts < 10) {
                setTimeout(() => tryShowAd(attempts + 1), 500);
              } else {
                reject(new Error('Ad provider failed to initialize'));
              }
            };
            setTimeout(() => tryShowAd(0), 500);
          })
          .catch((err) => reject(err));
      } else if (id === 'adextra') {
        if (!config.placementId) {
          return reject(new Error('AdExtra not properly configured'));
        }
        loadAdExtraScript(config.placementId)
          .then(() => {
            const tryShowAd = (attempts = 0) => {
              if (typeof window.p_adextra === 'function') {
                window.p_adextra(() => resolve(), () => reject(new Error('Ad not completed')));
              } else if (attempts < 10) {
                setTimeout(() => tryShowAd(attempts + 1), 500);
              } else {
                reject(new Error('Ad provider failed to initialize'));
              }
            };
            setTimeout(() => tryShowAd(0), 500);
          })
          .catch((err) => reject(err));
      } else if (id === 'adexora') {
        if (!config.appId) {
          return reject(new Error('Adexora not properly configured'));
        }
        loadAdexoraScript(config.appId)
          .then(() => {
            const tryShowAd = (attempts = 0) => {
              if (typeof window.showAdexora === 'function') {
                window.showAdexora()
                  .then(() => resolve())
                  .catch(() => reject(new Error('Ad not completed')));
              } else if (attempts < 10) {
                setTimeout(() => tryShowAd(attempts + 1), 500);
              } else {
                reject(new Error('Ad provider failed to initialize'));
              }
            };
            setTimeout(() => tryShowAd(0), 500);
          })
          .catch((err) => reject(err));
      } else {
        // Unknown provider - strict enforcement, no fallback
        reject(new Error(`Unknown ad provider: ${id}`));
      }
    });
  }, [loadAdsgramScript, loadMonetagScript, loadAdExtraScript, loadAdexoraScript]);

  const claimFaucet = async () => {
    if (claiming) return;
    
    setClaiming(true);
    setError(null);
    setSuccess(null);

    let actionToken = null;

    try {
      // STEP 1: Start faucet session to get action token
      // This prevents direct API calls to /claim without going through proper flow
      logDebug('Starting faucet session...');
      const startResponse = await axios.post('/earnings/faucet/start');
      actionToken = startResponse.data.actionToken;
      const minTimeSeconds = startResponse.data.minTimeSeconds || 0;
      const adProviders = startResponse.data.adProviders || [];
      const totalAds = adProviders.length;
      
      logDebug('Faucet session started', { 
        tokenReceived: !!actionToken, 
        minTimeSeconds, 
        adCount: totalAds 
      });

      // STEP 2: Show ads if any (this takes time, satisfying minTimeSeconds)
      if (totalAds > 0) {
        setAdProgress({ current: 0, total: totalAds, status: 'watching' });
        
        for (let i = 0; i < totalAds; i++) {
          setAdProgress({ current: i + 1, total: totalAds, status: 'watching' });
          
          try {
            await showSingleAd(adProviders[i]);
          } catch (adError) {
            // Log the error but continue to next ad (graceful degradation)
            console.warn(`Ad ${i + 1} failed:`, adError.message);
            // Short delay before next ad attempt
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        setAdProgress({ current: totalAds, total: totalAds, status: 'completed' });
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (minTimeSeconds > 0) {
        // No ads but we still need to wait minimum time
        // The server will reject early claims anyway, but let's be nice to UX
        logDebug(`Waiting minimum time: ${minTimeSeconds}s`);
        await new Promise(resolve => setTimeout(resolve, minTimeSeconds * 1000));
      }

      // STEP 3: Claim the reward with action token
      // Include Turnstile token if available (backend will bypass for Telegram users)
      logDebug('Claiming faucet with action token...');
      const response = await axios.post('/earnings/faucet/claim', {
        actionToken,
        turnstileToken: turnstile.token || undefined
      });
      
      // Show success popup
      setSuccessPopup({
        type: 'faucet',
        reward: response.data.reward,
        newBalance: response.data.newBalance
      });
      invalidateCache('faucet');
      invalidateCache('dashboard');
      fetchDashboardData();
      fetchFaucetStatusData();
      
      // Reset Turnstile after successful claim (if token was used)
      if (turnstile.token) {
        turnstile.reset();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to claim reward';
      const errorCode = error.response?.data?.error;
      
      if (error.response?.status === 429) {
        const remainingSeconds = error.response.data.remainingSeconds;
        setError(`⏰ ${errorMessage || `Cooldown active. Wait ${remainingSeconds} seconds`}`);
      } else if (errorCode === 'TOKEN_MIN_TIME_NOT_PASSED') {
        setError(`⏳ Please wait a moment and try again`);
      } else if (errorCode === 'TOKEN_INVALID_OR_CONSUMED') {
        setError('Session expired. Please try again.');
        // Refresh faucet status to get latest state
        fetchFaucetStatusData();
      } else {
        setError(errorMessage);
      }
      
      logDebug('Faucet claim error', { 
        status: error.response?.status, 
        message: errorMessage,
        error: errorCode 
      });
      
      // Reset Turnstile on error (if token was used)
      if (turnstile.token) {
        turnstile.reset();
      }
    } finally {
      setClaiming(false);
      setAdProgress(null);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEarningIcon = (type) => {
    const icons = {
      faucet: <DropletIcon />,
      task: <TaskIcon />,
      referral: <UsersIcon />,
      ads: <AdsIcon />,
      bonus: <GiftIcon />
    };
    return icons[type] || <CoinIcon />;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  if (error && !dashboardData) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ marginBottom: '16px', color: 'var(--warning-color)' }}><AlertIcon /></div>
            <h3 style={{ marginBottom: '12px' }}>Failed to Load Dashboard</h3>
            <p className="text-muted" style={{ marginBottom: '20px' }}>{error}</p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchDashboardData();
              }}
            >
              <RefreshIcon /> Try Again
            </button>
          </div>
          
          {/* Debug Panel */}
          <div className="card" style={{ marginTop: '16px', textAlign: 'left' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>🔍 Debug Info</h4>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', background: '#1a1a2e', color: '#0f0', padding: '12px', borderRadius: '8px', maxHeight: '200px', overflow: 'auto' }}>
              <div style={{ marginBottom: '8px', color: '#ff0' }}>
                API URL: {axios.defaults.baseURL}
              </div>
              <div style={{ marginBottom: '8px', color: '#ff0' }}>
                Token: {localStorage.getItem('token') ? 'Present (' + localStorage.getItem('token').substring(0, 20) + '...)' : 'Missing'}
              </div>
              <div style={{ marginBottom: '8px', color: '#ff0' }}>
                User ID: {user?.telegramId || 'N/A'}
              </div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px', marginTop: '8px' }}>
                {debugLogs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container page-content">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {/* Ad Progress Overlay for Faucet Claim */}
        {adProgress && (
          <div className="modal-overlay">
            <div className="modal" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📺</div>
              <h3 style={{ marginBottom: '8px' }}>
                {adProgress.status === 'completed' ? 'Ads Completed!' : 'Watching Ads...'}
              </h3>
              <p className="text-muted" style={{ marginBottom: '16px' }}>
                {adProgress.status === 'completed' 
                  ? 'Claiming your reward...' 
                  : `Please watch the ad to claim your reward`}
              </p>
              
              {/* Progress indicator */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '8px', 
                marginBottom: '16px' 
              }}>
                {Array.from({ length: adProgress.total }).map((_, i) => (
                  <div 
                    key={i} 
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: i < adProgress.current 
                        ? 'var(--success-color, #28a745)' 
                        : 'var(--border-color, #333)',
                      transition: 'background 0.3s ease'
                    }}
                  />
                ))}
              </div>
              
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Ad {adProgress.current} of {adProgress.total}
              </p>
              
              {adProgress.status === 'watching' && (
                <div className="loading-spinner" style={{ margin: '16px auto 0' }}></div>
              )}
            </div>
          </div>
        )}

        {/* Welcome Card */}
        <div className="card card-gradient">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="welcome-avatar" style={telegramPhotoUrl ? { padding: 0, overflow: 'hidden' } : {}}>
              {telegramPhotoUrl ? (
                <img 
                  src={telegramPhotoUrl} 
                  alt="Profile" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }} 
                />
              ) : (
                user?.firstName?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div>
              <h2 style={{ color: '#fff', marginBottom: '4px' }}>
                Hello, {user?.firstName || 'User'}!
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                Welcome back to your earning dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon"><WalletIcon /></div>
            <div className="stat-value">{user?.balance?.toFixed(5) || '0.00000'}</div>
            <div className="stat-label">Balance</div>
            {settings?.currencyMode === 'points' && user?.balance > 0 && (
              <div className="stat-usd-equivalent">
                ≈ ${(user.balance / (settings?.pointsExchangeRate || 1000)).toFixed(5)}
              </div>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-icon"><TrendUpIcon /></div>
            <div className="stat-value">{user?.totalEarnings?.toFixed(5) || '0.00000'}</div>
            <div className="stat-label">Total Earned</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><WithdrawIcon /></div>
            <div className="stat-value">{user?.totalWithdrawals?.toFixed(5) || '0.00000'}</div>
            <div className="stat-label">Withdrawn</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><UsersIcon /></div>
            <div className="stat-value">{user?.referralCount || 0}</div>
            <div className="stat-label">Referrals</div>
          </div>
        </div>

        {/* Faucet Claim */}
        {faucetStatus && (
          <div className="card" style={{ 
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px'
          }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="card-icon" style={{ 
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
                  borderRadius: '10px',
                  padding: '8px',
                  color: 'var(--primary-color)'
                }}><DropletIcon /></span>
                Faucet Claim
              </h2>
            </div>
            
            {faucetStatus.noAdsAvailable ? (
              <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ 
                  fontSize: '48px', 
                  marginBottom: '12px', 
                  opacity: 0.6,
                  filter: 'grayscale(1)'
                }}>📺</div>
                <h4 style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '15px' }}>Faucet Temporarily Unavailable</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  No ad providers are currently configured. Please check back later.
                </p>
              </div>
            ) : faucetStatus.canClaim ? (
              <div style={{ 
                textAlign: 'center',
                padding: '20px 0 8px',
                background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%)',
                borderRadius: '12px',
                margin: '8px -4px 0'
              }}>
                <div className="faucet-ready-icon" style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.15) 100%)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(16, 185, 129, 0.2)',
                  color: '#10b981'
                }}><GiftIcon /></div>
                <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {faucetStatus.adProviders?.length > 0 
                    ? `Watch ${faucetStatus.adProviders.length} ad${faucetStatus.adProviders.length > 1 ? 's' : ''} to claim your reward!`
                    : 'Your reward is ready to claim!'}
                </p>
                
                {/* Turnstile Verification - Hidden, works in background */}
                {settings?.turnstile?.enabled && settings?.turnstile?.siteKey && (
                  <>
                    {/* Hidden container for automatic verification */}
                    <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }}>
                      <Turnstile {...turnstile.turnstileProps} />
                    </div>
                    
                    {/* Only show visible widget if there's an error or verification is needed */}
                    {(turnstile.error || turnstile.needsInteraction) && (
                      <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Please complete the verification
                        </p>
                        <Turnstile
                          siteKey={settings.turnstile.siteKey}
                          onVerify={turnstile.handleVerify}
                          onError={turnstile.handleError}
                          onExpire={turnstile.handleExpire}
                          appearance="always"
                        />
                      </div>
                    )}
                  </>
                )}
                
                <button 
                  className="btn btn-primary" 
                  onClick={claimFaucet}
                  disabled={claiming}
                  style={{ 
                    width: '100%', 
                    maxWidth: '280px',
                    padding: '14px 24px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600'
                  }}
                >
                  {claiming ? (
                    <>
                      <div className="loading-spinner" style={{ width: '18px', height: '18px', marginRight: '8px' }}></div>
                      {adProgress ? 'Watching Ads...' : 'Claiming...'}
                    </>
                  ) : (
                    <>
                      {faucetStatus.adProviders?.length > 0 ? '📺 ' : '🎁 '}
                      Claim {faucetStatus.reward} Coins
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="timer" style={{ 
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}>
                <div className="timer-value" style={{ 
                  color: '#ffffff',
                  fontSize: '48px',
                  fontWeight: '800',
                  textShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
                  marginBottom: '8px'
                }}>
                  {formatTime(faucetStatus.remainingSeconds)}
                </div>
                <div className="timer-label" style={{ 
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '13px',
                  fontWeight: '500',
                  letterSpacing: '0.5px'
                }}>Next claim available in</div>
                <div className="progress-bar" style={{ 
                  marginTop: '20px', 
                  maxWidth: '280px', 
                  margin: '20px auto 0',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px'
                }}>
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${Math.max(0, 100 - (faucetStatus.remainingSeconds / (faucetStatus.cooldown || 300) * 100))}%`,
                      background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                      boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon"><BoltIcon /></span>
              Earn More
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <Link to="/tasks" className="action-card" style={{ textDecoration: 'none' }}>
              <div className="action-icon"><TaskIcon /></div>
              <div className="action-label">Tasks</div>
              <div className="action-sublabel">Complete & Earn</div>
            </Link>
            <Link to="/ads" className="action-card" style={{ textDecoration: 'none' }}>
              <div className="action-icon"><AdsIcon /></div>
              <div className="action-label">Watch Ads</div>
              <div className="action-sublabel">Watch & Earn</div>
            </Link>
            <Link to="/referrals" className="action-card" style={{ textDecoration: 'none' }}>
              <div className="action-icon"><UsersIcon /></div>
              <div className="action-label">Referrals</div>
              <div className="action-sublabel">Invite & Earn</div>
            </Link>
            <Link to="/withdrawals" className="action-card" style={{ textDecoration: 'none' }}>
              <div className="action-icon"><WithdrawIcon /></div>
              <div className="action-label">Withdraw</div>
              <div className="action-sublabel">Cash Out</div>
            </Link>
          </div>
        </div>

        {/* Recent Earnings */}
        {dashboardData?.recentEarnings && dashboardData.recentEarnings.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon"><ListIcon /></span>
                Recent Earnings
              </h2>
              <Link to="/earnings" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }}>
                View All
              </Link>
            </div>
            <div className="earnings-list">
              {dashboardData.recentEarnings.slice(0, 5).map((earning) => (
                <div key={earning._id} className="earning-item">
                  <div className="earning-icon">
                    {getEarningIcon(earning.type)}
                  </div>
                  <div className="earning-details">
                    <div className="earning-description">
                      {earning.description || earning.type.charAt(0).toUpperCase() + earning.type.slice(1)}
                    </div>
                    <div className="earning-date">
                      {new Date(earning.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="earning-amount">
                    +{earning.amount.toFixed(5)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon"><ChartIcon /></span>
              Your Stats
            </h2>
          </div>
          <div className="stats-list">
            <div className="stats-list-item">
              <span>Referral Earnings</span>
              <span className="stats-list-value">{user?.referralEarnings?.toFixed(5) || '0.00000'} coins</span>
            </div>
            <div className="stats-list-item">
              <span>Total Referrals</span>
              <span className="stats-list-value">{user?.referralCount || 0} users</span>
            </div>
            <div className="stats-list-item">
              <span>Member Since</span>
              <span className="stats-list-value">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="stats-list-item">
              <span>Status</span>
              <span className={`badge badge-${user?.status === 'active' ? 'success' : 'warning'}`}>
                {user?.status || 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
      
      {/* Success Popup for Faucet Claims */}
      <SuccessPopup
        show={!!successPopup}
        onClose={() => setSuccessPopup(null)}
        type={successPopup?.type || 'faucet'}
        reward={successPopup?.reward}
        currencyName="Coins"
        newBalance={successPopup?.newBalance}
      />
    </>
  );
}

export default Dashboard;
