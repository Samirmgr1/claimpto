/**
 * License Enforcement Service - Frontend
 * 
 * SECURITY: This service provides license validation for the admin frontend.
 * It gates access to the admin dashboard and handles license status display.
 * 
 * NOTE: Frontend validation is advisory only. Server-side enforcement is authoritative.
 * However, the frontend MUST check license status before rendering admin UI.
 */

import axios from 'axios';

// License state
let licenseState = {
  checked: false,
  valid: false,
  offline: false,
  graceExpiry: null,
  message: null,
  error: null,
  lastCheck: null
};

// Cache configuration
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Check if cached license state is still valid
 */
function isCacheValid() {
  if (!licenseState.checked || !licenseState.lastCheck) {
    return false;
  }
  
  const cacheAge = Date.now() - licenseState.lastCheck;
  return cacheAge < CACHE_TTL_MS;
}

/**
 * Validate license with the server
 * 
 * This performs a fresh validation and should be called:
 * 1. On admin dashboard mount
 * 2. On admin login success
 * 3. Periodically during admin session
 * 
 * @param {boolean} forceRefresh - Force server validation even if cache is valid
 * @returns {Promise<{valid: boolean, offline?: boolean, message?: string, error?: string}>}
 */
export async function validateLicense(forceRefresh = false) {
  // Use cache if valid and not forcing refresh
  if (!forceRefresh && isCacheValid() && licenseState.valid) {
    return {
      valid: licenseState.valid,
      offline: licenseState.offline,
      message: licenseState.message,
      cached: true
    };
  }
  
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      return {
        valid: false,
        error: 'NOT_AUTHENTICATED',
        message: 'Admin authentication required'
      };
    }
    
    const response = await axios.post('/license/validate', {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 15000
    });
    
    const result = response.data;
    
    // Update state
    licenseState = {
      checked: true,
      valid: result.valid === true,
      offline: result.offline || false,
      graceExpiry: result.graceExpiry || null,
      message: result.message || null,
      error: result.error || null,
      lastCheck: Date.now()
    };
    
    return {
      valid: licenseState.valid,
      offline: licenseState.offline,
      graceRemaining: result.graceRemaining,
      message: licenseState.message,
      error: licenseState.error
    };
    
  } catch (error) {
    console.error('[LICENSE] Validation failed:', error.message);
    
    // Handle specific error responses
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};
      
      // License explicitly invalid
      if (status === 403) {
        licenseState = {
          checked: true,
          valid: false,
          offline: false,
          graceExpiry: null,
          message: data.message || 'License validation failed',
          error: data.error || 'LICENSE_INVALID',
          lastCheck: Date.now()
        };
        
        return {
          valid: false,
          error: data.error || 'LICENSE_INVALID',
          message: data.message || 'License validation failed'
        };
      }
      
      // Rate limited
      if (status === 429) {
        return {
          valid: false,
          error: 'RATE_LIMITED',
          message: 'Too many attempts. Please wait.'
        };
      }
      
      // Unauthorized
      if (status === 401) {
        return {
          valid: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication expired'
        };
      }
    }
    
    // Network error - use cached state if available
    if (!error.response && licenseState.checked && licenseState.valid) {
      console.log('[LICENSE] Using cached state due to network error');
      return {
        valid: licenseState.valid,
        offline: true,
        message: 'Operating in offline mode (cached)',
        cached: true
      };
    }
    
    // Default failure
    return {
      valid: false,
      error: 'VALIDATION_ERROR',
      message: error.message || 'Unable to validate license'
    };
  }
}

/**
 * Get license status (quick check, no validation)
 * 
 * @returns {Promise<{valid: boolean, offline?: boolean, message?: string}>}
 */
export async function getLicenseStatus() {
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      return { valid: false, message: 'Not authenticated' };
    }
    
    const response = await axios.get('/license/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 10000
    });
    
    return response.data;
    
  } catch (error) {
    console.error('[LICENSE] Status check failed:', error.message);
    
    // Return cached state if available
    if (licenseState.checked) {
      return {
        valid: licenseState.valid,
        offline: licenseState.offline,
        message: licenseState.message
      };
    }
    
    return {
      valid: false,
      error: 'STATUS_ERROR',
      message: 'Unable to check license status'
    };
  }
}

/**
 * Check if license is currently valid (synchronous, from cache)
 * 
 * @returns {boolean}
 */
export function isLicenseValid() {
  return licenseState.checked && licenseState.valid;
}

/**
 * Get current license state
 * 
 * @returns {object}
 */
export function getLicenseState() {
  return { ...licenseState };
}

/**
 * Clear license cache (call on logout)
 */
export function clearLicenseCache() {
  licenseState = {
    checked: false,
    valid: false,
    offline: false,
    graceExpiry: null,
    message: null,
    error: null,
    lastCheck: null
  };
}

/**
 * License Error Component
 * 
 * Display component for license failures
 */
export const LicenseError = {
  INVALID: {
    icon: '🚫',
    title: 'License Invalid',
    message: 'Your license is invalid or has been revoked. Please contact support.'
  },
  EXPIRED: {
    icon: '⏰',
    title: 'License Expired',
    message: 'Your license has expired. Please renew to continue using the admin panel.'
  },
  DOMAIN_MISMATCH: {
    icon: '🌐',
    title: 'Domain Mismatch',
    message: 'This license is not valid for this domain.'
  },
  OFFLINE_EXPIRED: {
    icon: '📡',
    title: 'Offline Mode Expired',
    message: 'The offline grace period has expired. Internet connection required.'
  },
  VALIDATION_ERROR: {
    icon: '⚠️',
    title: 'Validation Error',
    message: 'Unable to validate your license. Please try again.'
  }
};

const licenseService = {
  validateLicense,
  getLicenseStatus,
  isLicenseValid,
  getLicenseState,
  clearLicenseCache,
  LicenseError
};

export default licenseService;
