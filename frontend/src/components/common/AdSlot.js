import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import axios from 'axios';
import { parseAndInject, cleanupInjectedElements } from '../../utils/domInjector';
import cacheService from '../../services/cacheService';

/**
 * AdSlot Component
 * 
 * Renders HTML/JS ad codes from admin-configured ad placements.
 * Supports all major ad networks: AdSense, BitMedia, Coinzilla,
 * CryptoCoinAds, A-ADS, CoinTraffic, Adsterra, PropellerAds, Monetag, etc.
 * 
 * Usage:
 *   <AdSlot slotId="dashboard_top" />
 *   <AdSlot slotId="tasks_between_list" style={{ margin: '10px 0' }} />
 * 
 * Props:
 *   slotId    - Required. The slot identifier (e.g., 'dashboard_top')
 *   style     - Optional. Additional inline styles for the container
 *   className - Optional. Additional CSS class names
 */

// Module-level cache for ad placements data
let _adPlacementsData = null;
let _adPlacementsFetchTime = 0;
const AD_PLACEMENTS_CACHE_TTL = 30000; // 30 seconds

// Fetch ad placements with deduplication and caching
async function fetchAdPlacements(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && _adPlacementsData && (now - _adPlacementsFetchTime) < AD_PLACEMENTS_CACHE_TTL) {
    return _adPlacementsData;
  }

  try {
    const data = await cacheService.deduplicatedFetch(
      'ad-placements/public',
      async () => {
        const response = await axios.get('/ad-placements/public');
        return response.data;
      }
    );
    _adPlacementsData = data;
    _adPlacementsFetchTime = Date.now();
    return data;
  } catch (error) {
    console.error('[AdSlot] Failed to fetch ad placements:', error);
    return _adPlacementsData || { placements: {} };
  }
}

// Clear module cache (call when admin updates placements)
export function invalidateAdPlacementsCache() {
  _adPlacementsData = null;
  _adPlacementsFetchTime = 0;
  cacheService.invalidate('ad-placements/public');
}

const AdSlot = memo(function AdSlot({ slotId, style, className }) {
  const containerRef = useRef(null);
  const injectedRef = useRef([]);
  const [adCodes, setAdCodes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Fetch and resolve ad codes for this slot
  const loadAds = useCallback(async () => {
    try {
      const data = await fetchAdPlacements();
      const slotAds = data?.placements?.[slotId] || [];
      setAdCodes(slotAds);
      setLoaded(true);
    } catch (e) {
      setLoaded(true);
    }
  }, [slotId]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Inject ad code into the container when adCodes change
  useEffect(() => {
    const container = containerRef.current;
    if (!container || adCodes.length === 0) return;

    // Clean up previous injections
    cleanupInjectedElements(injectedRef.current);
    injectedRef.current = [];
    container.innerHTML = '';

    // Inject all ad codes for this slot
    adCodes.forEach((ad) => {
      if (!ad.adCode) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'ad-slot-item';
      wrapper.setAttribute('data-ad-network', ad.adNetwork || 'custom');
      wrapper.setAttribute('data-ad-id', ad._id || '');
      container.appendChild(wrapper);

      const injected = parseAndInject(ad.adCode, wrapper, 'data-ad-injected');
      injectedRef.current.push(wrapper, ...injected);
    });

    // Cleanup on unmount
    return () => {
      cleanupInjectedElements(injectedRef.current);
      injectedRef.current = [];
    };
  }, [adCodes]);

  // Don't render anything if no ads for this slot
  if (loaded && adCodes.length === 0) {
    return null;
  }

  // Don't render placeholder during loading to avoid layout shift
  if (!loaded) {
    return null;
  }

  return (
    <div
      className={`ad-slot-container ${className || ''}`}
      data-ad-slot={slotId}
      style={{
        width: '100%',
        textAlign: 'center',
        overflow: 'hidden',
        ...style
      }}
    >
      <div ref={containerRef} className="ad-slot-content" />
    </div>
  );
});

/**
 * GlobalStickyAd Component
 * 
 * Renders a sticky bottom ad banner that persists across pages.
 * Only shown if there's an active ad for the 'global_sticky_bottom' slot.
 */
export const GlobalStickyAd = memo(function GlobalStickyAd() {
  const containerRef = useRef(null);
  const injectedRef = useRef([]);
  const [adCodes, setAdCodes] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const loadAds = async () => {
      try {
        const data = await fetchAdPlacements();
        const slotAds = data?.placements?.['global_sticky_bottom'] || [];
        setAdCodes(slotAds);
        setVisible(slotAds.length > 0);
      } catch (e) {
        // Silently fail
      }
    };
    loadAds();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || adCodes.length === 0) return;

    cleanupInjectedElements(injectedRef.current);
    injectedRef.current = [];
    container.innerHTML = '';

    adCodes.forEach((ad) => {
      if (!ad.adCode) return;
      const injected = parseAndInject(ad.adCode, container, 'data-ad-injected');
      injectedRef.current.push(...injected);
    });

    return () => {
      cleanupInjectedElements(injectedRef.current);
      injectedRef.current = [];
    };
  }, [adCodes]);

  if (!visible) return null;

  return (
    <div className="ad-sticky-bottom" style={{
      position: 'fixed',
      bottom: '70px', /* Above BottomNav */
      left: 0,
      right: 0,
      zIndex: 999,
      textAlign: 'center',
      background: 'var(--bg-card, #fff)',
      borderTop: '1px solid var(--border-color, #eee)',
      padding: '4px 0',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
    }}>
      <div ref={containerRef} />
    </div>
  );
});

/**
 * GlobalPopupAd Component
 * 
 * Shows a popup/interstitial ad that appears once per session.
 */
export const GlobalPopupAd = memo(function GlobalPopupAd() {
  const containerRef = useRef(null);
  const injectedRef = useRef([]);
  const [adCodes, setAdCodes] = useState([]);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const loadAds = async () => {
      try {
        // Only show once per session
        if (sessionStorage.getItem('ad_popup_shown')) return;

        const data = await fetchAdPlacements();
        const slotAds = data?.placements?.['global_popup'] || [];
        if (slotAds.length > 0) {
          setAdCodes(slotAds);
          // Show popup after a short delay
          setTimeout(() => {
            setShowPopup(true);
            sessionStorage.setItem('ad_popup_shown', 'true');
          }, 3000);
        }
      } catch (e) {
        // Silently fail
      }
    };
    loadAds();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || adCodes.length === 0 || !showPopup) return;

    cleanupInjectedElements(injectedRef.current);
    injectedRef.current = [];
    container.innerHTML = '';

    // Only show first ad in popup
    const ad = adCodes[0];
    if (ad?.adCode) {
      const injected = parseAndInject(ad.adCode, container, 'data-ad-injected');
      injectedRef.current.push(...injected);
    }

    return () => {
      cleanupInjectedElements(injectedRef.current);
      injectedRef.current = [];
    };
  }, [adCodes, showPopup]);

  if (!showPopup || adCodes.length === 0) return null;

  return (
    <div className="ad-popup-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="ad-popup-content" style={{
        background: 'var(--bg-card, #fff)',
        borderRadius: '16px',
        padding: '20px',
        maxWidth: '400px',
        width: '100%',
        position: 'relative',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <button
          onClick={() => setShowPopup(false)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '12px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: 'var(--text-secondary, #666)',
            zIndex: 1,
            lineHeight: 1
          }}
          aria-label="Close"
        >
          ×
        </button>
        <div ref={containerRef} style={{ marginTop: '10px' }} />
      </div>
    </div>
  );
});

export default AdSlot;

