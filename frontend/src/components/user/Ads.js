import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import SuccessPopup from '../common/SuccessPopup';
import Turnstile, { useTurnstile } from '../common/Turnstile';
import { useAuth, useSettings, useData } from '../../context/AuthContext';

// Premium SVG Icons
const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const PlayCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="10 8 16 12 10 16 10 8"/>
  </svg>
);

const MonitorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const CoinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v12"/>
    <path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/>
  </svg>
);

const VideoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <polygon points="10,8 10,12 14,10"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const LightbulbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="18" x2="15" y2="18"/>
    <line x1="10" y1="22" x2="14" y2="22"/>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
  </svg>
);

const MailboxIcon = () => (
  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 17H2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2Z"/>
    <path d="M6 17V7"/>
    <path d="M6 10h4"/>
  </svg>
);

function Ads() {
  const { updateUser } = useAuth();
  const { settings } = useSettings();
  const { adProviders: cachedAdsInfo, fetchAdProviders } = useData();
  const [providers, setProviders] = useState(cachedAdsInfo?.providers || []);
  const [peeringEnabled, setPeeringEnabled] = useState(cachedAdsInfo?.peeringEnabled || false);
  const [adsInfo, setAdsInfo] = useState(cachedAdsInfo);
  const [loading, setLoading] = useState(!cachedAdsInfo);
  const [watching, setWatching] = useState(null);
  const [cooldown, setCooldown] = useState(cachedAdsInfo?.cooldownRemaining || 0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successPopup, setSuccessPopup] = useState(null);
  // Peered session state
  const [peeredSession, setPeeredSession] = useState(null);
  const [peeredProgress, setPeeredProgress] = useState({ completed: 0, total: 0, remaining: [] });
  // Turnstile state
  const turnstile = useTurnstile(settings?.turnstile?.siteKey);
  const adExtraScriptLoaded = useRef(false);
  const adExtraPlacementId = useRef(null);
  const monetagScriptLoaded = useRef(false);
  const monetagZoneId = useRef(null);
  const adexoraScriptLoaded = useRef(false);
  const adexoraAppId = useRef(null);
  const adsgramScriptLoaded = useRef(false);
  const adsgramBlockId = useRef(null);
  const adsgramController = useRef(null);

  const currencyName = settings?.currencyName || 'Coins';

  const fetchAdsInfo = useCallback(async () => {
    setError(null);
    try {
      // fetchAdProviders now returns the full adsInfo object
      const data = await fetchAdProviders();
      if (data) {
        setAdsInfo(data);
        setProviders(data.providers || []);
        setPeeringEnabled(data.peeringEnabled || false);
        setCooldown(data.cooldownRemaining || 0);
      }
    } catch (error) {
      console.error('Ads info error:', error);
      setError(error.response?.data?.message || 'Failed to load ads information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchAdProviders]);

  useEffect(() => {
    // Use cached data immediately
    if (cachedAdsInfo) {
      setAdsInfo(cachedAdsInfo);
      setProviders(cachedAdsInfo.providers || []);
      setPeeringEnabled(cachedAdsInfo.peeringEnabled || false);
      setCooldown(cachedAdsInfo.cooldownRemaining || 0);
      setLoading(false);
    }
    fetchAdsInfo();
  }, [fetchAdsInfo, cachedAdsInfo]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const watchAd = async (provider) => {
    if (cooldown > 0 || watching) return;
    
    setWatching(provider.id);
    setError(null);
    setSuccess(null);

    let sessionId = null;

    try {
      // Start ad session - include Turnstile token if available (backend will bypass for Telegram users)
      const startResponse = await axios.post('/ads/start', { 
        provider: provider.id,
        turnstileToken: turnstile.token || undefined
      });
      sessionId = startResponse.data.sessionId;
      const config = startResponse.data.config;

      // Show the ad - this will only resolve if user actually watched the ad
      await showAd(provider.id, config);

      // Only complete session and give reward if ad was successfully watched
      const completeResponse = await axios.post('/ads/complete', { 
        sessionId,
        turnstileToken: turnstile.token || undefined
      });
      
      // Show success popup
      setSuccessPopup({
        type: 'ads',
        reward: completeResponse.data.reward,
        newBalance: completeResponse.data.newBalance
      });
      
      // Refresh user data
      const userResponse = await axios.get('/user/dashboard');
      updateUser(userResponse.data.user);
      
      // Refresh ads info
      fetchAdsInfo();
      
      // Reset Turnstile for next ad (if token was used)
      if (turnstile.token) {
        turnstile.reset();
      }
    } catch (error) {
      // Cancel the session if it was started but ad failed
      if (sessionId) {
        try {
          await axios.post('/ads/cancel', { sessionId });
        } catch (cancelError) {
          console.error('Failed to cancel ad session:', cancelError);
        }
      }
      
      // Show user-friendly error message
      const message = error.message || error.response?.data?.message || 'Failed to complete ad. No reward given.';
      setError(message);
      
      // Check if it's a Turnstile error
      if (error.response?.data?.turnstileRequired) {
        turnstile.reset();
      }
      
      if (error.response?.data?.remainingSeconds) {
        setCooldown(error.response.data.remainingSeconds);
      }
    } finally {
      setWatching(null);
    }
  };

  // Watch a peered provider - must complete all peered ads in sequence
  const watchPeeredAds = async (triggeredProvider) => {
    if (cooldown > 0 || watching || peeredSession) return;
    
    setWatching(`peered_${triggeredProvider.id}`);
    setError(null);
    setSuccess(null);

    let peeredSessionId = null;

    try {
      // Start peered session - include Turnstile token if available (backend will bypass for Telegram users)
      const startResponse = await axios.post('/ads/peered/start', { 
        triggeredBy: triggeredProvider.id,
        turnstileToken: turnstile.token || undefined
      });
      peeredSessionId = startResponse.data.peeredSessionId;
      const providersToWatch = startResponse.data.providers;
      
      // Set up peered session state
      setPeeredSession({
        id: peeredSessionId,
        combinedReward: startResponse.data.combinedReward,
        totalAds: providersToWatch.length
      });
      setPeeredProgress({
        completed: 0,
        total: providersToWatch.length,
        remaining: providersToWatch.map(p => p.id)
      });
      
      // Watch each ad in sequence
      for (let i = 0; i < providersToWatch.length; i++) {
        const provider = providersToWatch[i];
        
        setWatching(provider.id);
        
        try {
          // Show the individual ad
          await showAd(provider.id, provider.config);
          
          // Mark this ad as completed in the peered session
          const completeResponse = await axios.post('/ads/peered/complete-ad', {
            peeredSessionId,
            providerId: provider.id
          });
          
          // Update progress
          setPeeredProgress(prev => ({
            completed: completeResponse.data.completedAds,
            total: completeResponse.data.totalAds,
            remaining: completeResponse.data.remainingProviders || []
          }));
          
          // Check if all completed
          if (completeResponse.data.completed) {
            // All ads watched - show combined reward
            setSuccessPopup({
              type: 'peered',
              reward: completeResponse.data.reward,
              newBalance: completeResponse.data.balance,
              adsWatched: completeResponse.data.totalAds
            });
            
            // Refresh user data
            const userResponse = await axios.get('/user/dashboard');
            updateUser(userResponse.data.user);
            
            // Refresh ads info
            fetchAdsInfo();
            
            // Clear peered session
            setPeeredSession(null);
            setPeeredProgress({ completed: 0, total: 0, remaining: [] });
            break;
          }
        } catch (adError) {
          console.error(`Failed to complete ad ${provider.id}:`, adError);
          throw adError; // Re-throw to cancel entire peered session
        }
      }
    } catch (error) {
      // Cancel the peered session if any ad failed
      if (peeredSessionId) {
        try {
          await axios.post('/ads/peered/cancel', { peeredSessionId });
        } catch (cancelError) {
          console.error('Failed to cancel peered session:', cancelError);
        }
      }
      
      // Clear peered session state
      setPeeredSession(null);
      setPeeredProgress({ completed: 0, total: 0, remaining: [] });
      
      // Show user-friendly error message
      const message = error.message || error.response?.data?.message || 'Failed to complete peered ads. No reward given.';
      setError(message);
      
      if (error.response?.data?.remainingSeconds) {
        setCooldown(error.response.data.remainingSeconds);
      }
    } finally {
      setWatching(null);
    }
  };

  // Handle ad click - either single ad or peered ads
  const handleAdClick = (provider) => {
    if (cooldown > 0 || watching || adsInfo.remainingToday === 0) return;
    
    if (provider.isPeered && peeringEnabled) {
      // Check if user has enough remaining ads for the peered group (same peerGroupIndex)
      const peeredCount = providers.filter(p => p.peerGroupIndex === provider.peerGroupIndex).length;
      if (adsInfo.remainingToday < peeredCount) {
        setError(`Need ${peeredCount} ads remaining for peered ads (you have ${adsInfo.remainingToday})`);
        return;
      }
      watchPeeredAds(provider);
    } else {
      watchAd(provider);
    }
  };

  // Load Adsgram SDK dynamically - following official integration guide
  const loadAdsgramScript = useCallback((blockId) => {
    return new Promise((resolve, reject) => {
      // Check if already loaded with same block ID
      if (adsgramScriptLoaded.current && adsgramBlockId.current === blockId && adsgramController.current) {
        console.log('Adsgram SDK already loaded for block:', blockId);
        resolve(adsgramController.current);
        return;
      }

      // Check if script is already in DOM
      const existingScript = document.getElementById('adsgram-script');
      
      const initController = () => {
        if (window.Adsgram) {
          try {
            // Initialize AdController as per official guide
            const AdController = window.Adsgram.init({ blockId });
            adsgramScriptLoaded.current = true;
            adsgramBlockId.current = blockId;
            adsgramController.current = AdController;
            console.log('Adsgram SDK initialized for block:', blockId);
            resolve(AdController);
          } catch (err) {
            console.error('Failed to initialize Adsgram:', err);
            reject(new Error('Failed to initialize Adsgram SDK'));
          }
        } else {
          reject(new Error('Adsgram SDK not available after loading'));
        }
      };

      if (existingScript && window.Adsgram) {
        // Script already loaded, just reinitialize if block ID changed
        initController();
        return;
      }

      // Remove existing script if any
      if (existingScript) {
        existingScript.remove();
      }

      // Create and load script as per official guide
      const script = document.createElement('script');
      script.id = 'adsgram-script';
      script.src = 'https://sad.adsgram.ai/js/sad.min.js';
      script.async = true;
      
      script.onload = () => {
        console.log('Adsgram script loaded successfully');
        // Small delay to ensure SDK is fully initialized
        setTimeout(() => initController(), 100);
      };
      
      script.onerror = () => {
        console.error('Failed to load Adsgram script');
        adsgramScriptLoaded.current = false;
        adsgramBlockId.current = null;
        adsgramController.current = null;
        reject(new Error('Failed to load Adsgram SDK'));
      };
      
      document.head.appendChild(script);
    });
  }, []);

  // Load Monetag SDK dynamically - following official integration guide
  const loadMonetagScript = useCallback((zoneId) => {
    return new Promise((resolve, reject) => {
      // Check if already loaded with same zone ID
      if (monetagScriptLoaded.current && monetagZoneId.current === zoneId) {
        console.log('Monetag script already loaded for zone:', zoneId);
        resolve();
        return;
      }

      // Remove existing script if zone ID changed
      const existingScript = document.getElementById('monetag-script');
      if (existingScript) {
        existingScript.remove();
      }

      // Create and load script in head as per Monetag guide
      const script = document.createElement('script');
      script.id = 'monetag-script';
      script.src = '//libtl.com/sdk.js';
      script.setAttribute('data-zone', zoneId);
      script.setAttribute('data-sdk', `show_${zoneId}`);
      
      script.onload = () => {
        console.log('Monetag script loaded successfully for zone:', zoneId);
        monetagScriptLoaded.current = true;
        monetagZoneId.current = zoneId;
        resolve();
      };
      
      script.onerror = () => {
        console.error('Failed to load Monetag script for zone:', zoneId);
        monetagScriptLoaded.current = false;
        monetagZoneId.current = null;
        reject(new Error('Failed to load Monetag script'));
      };
      
      document.head.appendChild(script);
    });
  }, []);

  // Load Adexora SDK dynamically - following official documentation
  const loadAdexoraScript = useCallback((appId) => {
    return new Promise((resolve, reject) => {
      // Check if already loaded with same app ID
      if (adexoraScriptLoaded.current && adexoraAppId.current === appId) {
        console.log('Adexora script already loaded for app:', appId);
        resolve();
        return;
      }

      // Remove existing script if app ID changed
      const existingScript = document.getElementById('adexora-script');
      if (existingScript) {
        existingScript.remove();
      }

      // Create and load script in head as per Adexora docs
      const script = document.createElement('script');
      script.id = 'adexora-script';
      script.src = `https://adexora.com/cdn/ads.js?id=${appId}`;
      
      script.onload = () => {
        console.log('Adexora script loaded successfully for app:', appId);
        adexoraScriptLoaded.current = true;
        adexoraAppId.current = appId;
        resolve();
      };
      
      script.onerror = () => {
        console.error('Failed to load Adexora script for app:', appId);
        adexoraScriptLoaded.current = false;
        adexoraAppId.current = null;
        reject(new Error('Failed to load Adexora script'));
      };
      
      document.head.appendChild(script);
    });
  }, []);

  // Load AdExtra script dynamically - following official integration guide
  const loadAdExtraScript = useCallback((placementId) => {
    return new Promise((resolve, reject) => {
      // Check if already loaded with same placement ID
      if (adExtraScriptLoaded.current && adExtraPlacementId.current === placementId) {
        console.log('AdExtra script already loaded for placement:', placementId);
        resolve();
        return;
      }

      // Remove existing script if placement ID changed
      const existingScript = document.getElementById('adextra-script');
      if (existingScript) {
        existingScript.remove();
      }

      // Remove existing container if any
      const existingContainer = document.getElementById(placementId);
      if (existingContainer) {
        existingContainer.remove();
      }

      // Create container div in body as per guide (Step 2)
      const container = document.createElement('div');
      container.id = placementId;
      document.body.appendChild(container);

      // Create and load script in head as per guide (Step 1)
      const script = document.createElement('script');
      script.id = 'adextra-script';
      script.src = `https://partner.adextra.io/jt/${placementId}.js`;
      script.async = true;
      
      script.onload = () => {
        console.log('AdExtra script loaded successfully for placement:', placementId);
        adExtraScriptLoaded.current = true;
        adExtraPlacementId.current = placementId;
        resolve();
      };
      
      script.onerror = () => {
        console.error('Failed to load AdExtra script for placement:', placementId);
        adExtraScriptLoaded.current = false;
        adExtraPlacementId.current = null;
        reject(new Error('Failed to load AdExtra script'));
      };
      
      document.head.appendChild(script);
    });
  }, []);

  const showAd = async (providerId, config) => {
    return new Promise((resolve, reject) => {
      if (providerId === 'adsgram' && config.blockId) {
        // Adsgram Rewarded Ads - following official integration guide
        loadAdsgramScript(config.blockId)
          .then((AdController) => {
            console.log('Showing Adsgram Rewarded Ad...');
            
            // Show ad as per official guide
            // Promise resolves when user watches ad till the end
            // Promise rejects if user gets error during playing ad
            AdController.show()
              .then((result) => {
                // User watched ad till the end
                console.log('Adsgram ad completed successfully:', result);
                resolve();
              })
              .catch((result) => {
                // User got error during playing ad or closed early
                console.error('Adsgram ad error or closed:', result);
                const errorMsg = result?.description || 'Ad was not completed';
                reject(new Error(`${errorMsg}. No reward given.`));
              });
          })
          .catch((err) => {
            console.error('Failed to load Adsgram:', err);
            reject(new Error('Failed to load ad. Please refresh and try again.'));
          });
      } else if (providerId === 'monetag' && config.zoneId) {
        // Monetag Rewarded Interstitial - following official documentation
        loadMonetagScript(config.zoneId)
          .then(() => {
            // Wait for script to fully initialize
            const tryShowAd = (attempts = 0) => {
              // The function name is show_{zoneId} as per Monetag docs
              const showFunctionName = `show_${config.zoneId}`;
              
              if (typeof window[showFunctionName] === 'function') {
                console.log(`Calling ${showFunctionName} for Monetag Rewarded Interstitial...`);
                
                try {
                  // Using Rewarded Interstitial format as per documentation
                  // Pass ymid for tracking (using sessionId if available)
                  window[showFunctionName]()
                    .then(() => {
                      console.log('Monetag ad completed successfully - user watched the ad');
                      resolve(); // Only give reward on successful completion
                    })
                    .catch((err) => {
                      console.error('Monetag ad failed or was skipped:', err);
                      reject(new Error('Ad was not completed. No reward given.'));
                    });
                } catch (err) {
                  console.error('Monetag show error:', err);
                  reject(new Error('Failed to show ad. Please try again.'));
                }
              } else if (attempts < 10) {
                // Retry up to 10 times with 500ms delay
                console.log(`Waiting for ${showFunctionName} function... attempt ${attempts + 1}`);
                setTimeout(() => tryShowAd(attempts + 1), 500);
              } else {
                console.error(`${showFunctionName} function not available after 5 seconds`);
                reject(new Error('Ad provider failed to initialize. Please try again.'));
              }
            };
            
            // Start trying to show ad after a brief delay for initialization
            setTimeout(() => tryShowAd(0), 500);
          })
          .catch((err) => {
            console.error('Failed to load Monetag:', err);
            reject(new Error('Failed to load ad. Please check your connection and try again.'));
          });
      } else if (providerId === 'adextra' && config.placementId) {
        // AdExtra integration - Full-Screen Format (Step 3 from guide)
        loadAdExtraScript(config.placementId)
          .then(() => {
            // Wait for script to fully initialize
            const tryShowAd = (attempts = 0) => {
              if (typeof window.p_adextra === 'function') {
                console.log('Calling p_adextra with callbacks...');
                
                // Define callbacks as per AdExtra guide
                const onSuccess = () => {
                  console.log('AdExtra ad completed successfully - user watched the ad');
                  resolve(); // Only give reward on successful completion
                };
                
                const onError = () => {
                  console.error('AdExtra ad error - ad was not watched');
                  reject(new Error('Ad failed to display. No reward given.'));
                };
                
                try {
                  // Call p_adextra with success and error callbacks (Step 3 from guide)
                  window.p_adextra(onSuccess, onError);
                } catch (err) {
                  console.error('AdExtra show error:', err);
                  reject(new Error('Failed to show ad. Please try again.'));
                }
              } else if (attempts < 10) {
                // Retry up to 10 times with 500ms delay
                console.log(`Waiting for p_adextra function... attempt ${attempts + 1}`);
                setTimeout(() => tryShowAd(attempts + 1), 500);
              } else {
                console.error('p_adextra function not available after 5 seconds');
                reject(new Error('Ad provider failed to initialize. Please try again.'));
              }
            };
            
            // Start trying to show ad after a brief delay for initialization
            setTimeout(() => tryShowAd(0), 500);
          })
          .catch((err) => {
            console.error('Failed to load AdExtra:', err);
            reject(new Error('Failed to load ad. Please check your connection and try again.'));
          });
      } else if (providerId === 'adexora' && config.appId) {
        // Adexora Rewarded Interstitial - following official documentation
        loadAdexoraScript(config.appId)
          .then(() => {
            // Wait for script to fully initialize
            const tryShowAd = (attempts = 0) => {
              if (typeof window.showAdexora === 'function') {
                console.log('Calling showAdexora for Adexora Rewarded Interstitial...');
                
                try {
                  // Using showAdexora() as per documentation
                  window.showAdexora()
                    .then(() => {
                      console.log('Adexora ad completed successfully - user watched the ad');
                      resolve(); // Only give reward on successful completion
                    })
                    .catch((err) => {
                      console.error('Adexora ad failed or was skipped:', err);
                      reject(new Error('Ad was not completed. No reward given.'));
                    });
                } catch (err) {
                  console.error('Adexora show error:', err);
                  reject(new Error('Failed to show ad. Please try again.'));
                }
              } else if (attempts < 10) {
                // Retry up to 10 times with 500ms delay
                console.log(`Waiting for showAdexora function... attempt ${attempts + 1}`);
                setTimeout(() => tryShowAd(attempts + 1), 500);
              } else {
                console.error('showAdexora function not available after 5 seconds');
                reject(new Error('Ad provider failed to initialize. Please try again.'));
              }
            };
            
            // Start trying to show ad after a brief delay for initialization
            setTimeout(() => tryShowAd(0), 500);
          })
          .catch((err) => {
            console.error('Failed to load Adexora:', err);
            reject(new Error('Failed to load ad. Please check your connection and try again.'));
          });
      } else {
        reject(new Error('Ad provider not configured properly.'));
      }
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProviderIcon = (providerId) => {
    const icons = {
      adsgram: <MonitorIcon />,
      monetag: <CoinIcon />,
      adextra: <VideoIcon />,
      adexora: <PlayCircleIcon />
    };
    return icons[providerId] || <PlayCircleIcon />;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading ads...</p>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  if (!adsInfo?.enabled) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><MonitorIcon /></div>
              <h3 className="empty-state-title">Ads Currently Unavailable</h3>
              <p className="empty-state-description">
                Ad rewards are temporarily disabled. Please check back later.
              </p>
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
        {error && (
          <div className="error" style={{ marginBottom: '16px' }}>
            {error}
            <button 
              className="btn btn-sm"
              onClick={() => { setLoading(true); fetchAdsInfo(); }}
              style={{ marginLeft: '10px' }}
            >
              Retry
            </button>
          </div>
        )}
        {success && <div className="success">{success}</div>}

        {/* Daily Progress */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon"><ChartIcon /></span>
              Daily Progress
            </h2>
          </div>
          <div className="progress-container">
            <div className="progress-label">
              <span>Ads Watched Today</span>
              <span>{adsInfo.adsWatchedToday} / {adsInfo.dailyLimit}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(adsInfo.adsWatchedToday / adsInfo.dailyLimit) * 100}%` }}
              ></div>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '14px', marginTop: '8px' }}>
            You can watch {adsInfo.remainingToday} more ads today
          </p>
        </div>

        {/* Cooldown Timer */}
        {cooldown > 0 && (
          <div className="card card-gradient">
            <div className="timer">
              <div className="timer-value">{formatTime(cooldown)}</div>
              <div className="timer-label" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Next ad available in
              </div>
            </div>
          </div>
        )}

        {/* Ad Watching Overlay */}
        {watching && (
          <div className="modal-overlay">
            <div className="modal" style={{ textAlign: 'center', padding: '40px' }}>
              <div className="ad-watching-icon"><MonitorIcon /></div>
              <h3 style={{ marginBottom: '16px' }}>
                {peeredSession ? `Watching Ads (${peeredProgress.completed + 1}/${peeredProgress.total})` : 'Watching Ad...'}
              </h3>
              <p className="text-muted">Please wait while the ad plays</p>
              <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                Don't close this window
              </p>
            </div>
          </div>
        )}

        {/* Cloudflare Turnstile Security Verification - Only shows when interaction is needed */}
        {settings?.turnstile?.enabled && settings?.turnstile?.siteKey && (
          <>
            {/* Hidden container for automatic verification */}
            <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }}>
              <Turnstile {...turnstile.turnstileProps} />
            </div>
            
            {/* Only show visible card if there's an error or verification is needed */}
            {(turnstile.error || turnstile.needsInteraction) && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-header">
                  <h2 className="card-title">
                    <span className="card-icon">🛡️</span>
                    Security Verification Required
                  </h2>
                </div>
                <p className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>
                  Please complete the verification to continue.
                </p>
                <Turnstile 
                  siteKey={settings.turnstile.siteKey}
                  onVerify={turnstile.handleVerify}
                  onExpire={turnstile.handleExpire}
                  onError={turnstile.handleError}
                  appearance="always"
                />
              </div>
            )}
          </>
        )}

        {/* Available Ad Providers */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon"><PlayCircleIcon /></span>
              Watch Ads to Earn
            </h2>
          </div>

          {providers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><MailboxIcon /></div>
              <h3 className="empty-state-title">No Ads Available</h3>
              <p className="empty-state-description">
                There are no ad providers available at the moment.
              </p>
            </div>
          ) : (
            providers.map((provider) => {
              const isDisabled = cooldown > 0 || watching || adsInfo.remainingToday === 0;
              const isPeered = provider.isPeered && peeringEnabled;
              // Count providers in the same peer group
              const peeredCount = isPeered ? providers.filter(p => p.peerGroupIndex === provider.peerGroupIndex).length : 0;
              const notEnoughForPeered = isPeered && adsInfo.remainingToday < peeredCount;
              
              return (
                <div 
                  key={provider.id}
                  className={`ad-provider-card ${isDisabled || notEnoughForPeered ? 'disabled' : ''}`}
                  onClick={() => !(isDisabled || notEnoughForPeered) && handleAdClick(provider)}
                  style={{ position: 'relative' }}
                >
                  <div className="ad-provider-header">
                    <div className="ad-provider-name">
                      <span className="ad-provider-icon">{getProviderIcon(provider.id)}</span> 
                      {provider.name}
                    </div>
                    <div className="ad-provider-reward">
                      +{provider.reward} {currencyName}
                    </div>
                  </div>
                  
                  <p className="ad-provider-description">
                    {isPeered 
                      ? `Watch with ${peeredCount - 1} other ad${peeredCount > 2 ? 's' : ''} in sequence`
                      : 'Watch a short video ad to earn rewards instantly!'
                    }
                  </p>
                  
                  {isPeered && (
                    <span style={{ 
                      position: 'absolute',
                      bottom: '10px',
                      right: '12px',
                      fontSize: '9px',
                      padding: '3px 8px',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
                      color: 'var(--primary-color)',
                      borderRadius: '4px',
                      fontWeight: '600',
                      letterSpacing: '0.5px',
                      border: '1px solid rgba(99, 102, 241, 0.2)'
                    }}>
                      🔗 PEERED
                    </span>
                  )}
                  
                  {notEnoughForPeered && (
                    <p style={{ fontSize: '12px', color: '#ef4444', margin: '8px 0 0 0' }}>
                      Need {peeredCount} ads remaining (you have {adsInfo.remainingToday})
                    </p>
                  )}
                  
                  {watching === provider.id && (
                    <div style={{ marginTop: '12px' }}>
                      <div className="loading-spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }}></div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Tips */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon tips-icon"><LightbulbIcon /></span>
              Tips
            </h2>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '8px' }}>• Watch ads regularly to maximize your earnings</p>
            <p style={{ marginBottom: '8px' }}>• Each ad has a {adsInfo.cooldown} second cooldown</p>
            <p style={{ marginBottom: '8px' }}>• You can watch up to {adsInfo.dailyLimit} ads per day</p>
            {peeringEnabled && providers.some(p => p.isPeered) && (
              <p style={{ marginBottom: '8px' }}>• Ads marked "PEERED" must be watched together in sequence</p>
            )}
            <p>• Rewards are credited instantly after watching</p>
          </div>
        </div>
      </div>
      <BottomNav />
      
      {/* Success Popup for Ad Completion */}
      <SuccessPopup
        show={!!successPopup}
        onClose={() => setSuccessPopup(null)}
        type={successPopup?.type || 'ads'}
        reward={successPopup?.reward}
        currencyName={currencyName}
        newBalance={successPopup?.newBalance}
      />
    </>
  );
}

export default Ads;
