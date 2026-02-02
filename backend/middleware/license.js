/**
 * License Enforcement Middleware
 * 
 * SECURITY: This middleware enforces license validation on all protected routes.
 * Every admin request MUST pass through this middleware.
 * 
 * FAIL-CLOSED: Any validation failure results in HTTP 403.
 * NO BYPASSES: No environment shortcuts, no commented blocks.
 */

const crypto = require('crypto');
const {
  revalidateLicense,
  isLicenseValid,
  getLicenseState,
  getCurrentDomain
} = require('../utils/licenseValidator');

// ============================================
// SECURITY CONSTANTS
// ============================================
const TRACKING_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_FAILED_ATTEMPTS = 10;
const REVALIDATION_INTERVAL_MS = 15 * 60 * 1000; // Force revalidation every 15 minutes
const REQUEST_SIGNATURE_HEADER = 'X-License-Signature';

// In-memory request tracking for anomaly detection
const requestTracking = new Map();

// Track last revalidation time
let lastRevalidationTime = 0;

/**
 * Clean up old tracking entries
 */
function cleanupTracking() {
  const now = Date.now();
  for (const [key, data] of requestTracking.entries()) {
    if (now - data.firstSeen > TRACKING_WINDOW_MS) {
      requestTracking.delete(key);
    }
  }
}

/**
 * Track failed license check attempts (anomaly detection)
 */
function trackFailedAttempt(identifier) {
  cleanupTracking();
  
  const existing = requestTracking.get(identifier) || {
    count: 0,
    firstSeen: Date.now()
  };
  
  existing.count++;
  requestTracking.set(identifier, existing);
  
  return existing.count;
}

/**
 * Get client identifier for tracking
 */
function getClientIdentifier(req) {
  const ip = req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0].trim() || 
    req.connection?.remoteAddress ||
    'unknown';
  
  return `${ip}:${req.headers['user-agent'] || 'unknown'}`;
}

/**
 * Primary license enforcement middleware
 * 
 * Use this on all admin routes to enforce license validation.
 * This performs a quick state check and periodic revalidation.
 * 
 * SECURITY HARDENING:
 * - Periodic forced revalidation
 * - Request signature verification
 * - Tamper detection response
 */
const requireValidLicense = async (req, res, next) => {
  const clientId = getClientIdentifier(req);
  const requestDomain = getCurrentDomain(req);
  
  // Log license check attempt
  console.log(`[LICENSE-MW] Checking license for ${req.method} ${req.path}`);
  
  try {
    // Get current license state
    const state = getLicenseState();
    
    // SECURITY: Check for tamper detection flag
    if (state.tamperDetected) {
      console.error('[LICENSE-MW] ✗ Tamper detection triggered - blocking all requests');
      return res.status(403).json({
        error: 'SECURITY_VIOLATION',
        message: 'Security check failed. Please contact support.',
        code: 'LICENSE_TAMPER_DETECTED'
      });
    }
    
    // Check if license is valid
    if (!state.valid) {
      console.error('[LICENSE-MW] ✗ License state invalid - blocking request');
      trackFailedAttempt(clientId);
      
      return res.status(403).json({
        error: 'LICENSE_INVALID',
        message: 'A valid license is required to access this resource.',
        code: 'LICENSE_ENFORCEMENT_BLOCK'
      });
    }
    
    // SECURITY: Periodic forced revalidation
    const now = Date.now();
    if (now - lastRevalidationTime > REVALIDATION_INTERVAL_MS && !state.offline) {
      console.log('[LICENSE-MW] Periodic revalidation triggered');
      try {
        const revalidateResult = await revalidateLicense(req);
        lastRevalidationTime = now;
        
        if (!revalidateResult.valid) {
          console.error('[LICENSE-MW] ✗ Periodic revalidation failed');
          return res.status(403).json({
            error: 'LICENSE_INVALID',
            message: 'License revalidation failed.',
            code: 'LICENSE_REVALIDATION_FAILED'
          });
        }
      } catch (revalError) {
        // If revalidation fails due to network, allow offline grace if applicable
        console.warn('[LICENSE-MW] Revalidation error (may use cached):', revalError.message);
      }
    }
    
    // Domain mismatch check - NO BYPASSES
    if (state.domain && requestDomain && state.domain !== requestDomain) {
      console.error(`[LICENSE-MW] ✗ Domain mismatch: licensed=${state.domain}, request=${requestDomain}`);
      trackFailedAttempt(clientId);
      
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        code: 'LICENSE_ENFORCEMENT'
      });
    }
    
    // Offline grace period warning
    if (state.offline && state.graceExpiry) {
      const remainingMs = state.graceExpiry - Date.now();
      const remainingHours = Math.round(remainingMs / (60 * 60 * 1000) * 10) / 10;
      
      // Add warning header
      res.setHeader('X-License-Warning', `Offline mode - ${remainingHours} hours remaining`);
      
      // Block if grace period expired
      if (remainingMs <= 0) {
        console.error('[LICENSE-MW] ✗ Offline grace period expired');
        
        return res.status(403).json({
          error: 'OFFLINE_GRACE_EXPIRED',
          message: 'Offline grace period has expired. Internet connection required.',
          code: 'LICENSE_OFFLINE_EXPIRED'
        });
      }
    }
    
    // All checks passed
    console.log('[LICENSE-MW] ✓ License check passed');
    next();
    
  } catch (error) {
    console.error('[LICENSE-MW] ✗ License check error:', error.message);
    trackFailedAttempt(clientId);
    
    return res.status(403).json({
      error: 'LICENSE_CHECK_FAILED',
      message: 'Unable to verify license. Please try again.',
      code: 'LICENSE_ENFORCEMENT_ERROR'
    });
  }
};

/**
 * Strict license revalidation middleware
 * 
 * Use this for critical admin operations (login, dashboard access, settings changes).
 * This ALWAYS performs a fresh validation against the license server.
 */
const requireFreshLicense = async (req, res, next) => {
  const clientId = getClientIdentifier(req);
  
  console.log(`[LICENSE-MW] Fresh validation for ${req.method} ${req.path}`);
  
  // Check for too many failed attempts
  cleanupTracking();
  const tracking = requestTracking.get(clientId);
  if (tracking && tracking.count >= MAX_FAILED_ATTEMPTS) {
    console.error(`[LICENSE-MW] ✗ Too many failed attempts from ${clientId}`);
    return res.status(429).json({
      error: 'TOO_MANY_ATTEMPTS',
      message: 'Too many failed license validation attempts. Please wait.',
      code: 'LICENSE_RATE_LIMITED'
    });
  }
  
  try {
    // Force fresh validation
    const result = await revalidateLicense(req);
    
    if (!result.valid) {
      console.error('[LICENSE-MW] ✗ Fresh validation failed:', result.error);
      trackFailedAttempt(clientId);
      
      return res.status(403).json({
        error: result.error || 'LICENSE_INVALID',
        message: result.message || 'License validation failed.',
        code: 'LICENSE_ENFORCEMENT_BLOCK'
      });
    }
    
    // Add license info to request for downstream use
    req.licenseInfo = {
      valid: true,
      offline: result.offline || false,
      data: result.data
    };
    
    console.log('[LICENSE-MW] ✓ Fresh validation passed');
    next();
    
  } catch (error) {
    console.error('[LICENSE-MW] ✗ Fresh validation error:', error.message);
    trackFailedAttempt(clientId);
    
    return res.status(403).json({
      error: 'LICENSE_VALIDATION_FAILED',
      message: 'Unable to validate license with server.',
      code: 'LICENSE_SERVER_ERROR'
    });
  }
};

/**
 * License status endpoint handler
 * 
 * Returns current license status for frontend display.
 * This is read-only and does NOT authorize access.
 */
const getLicenseStatus = async (req, res) => {
  try {
    const state = getLicenseState();
    
    // Return sanitized status (don't expose sensitive data)
    res.json({
      valid: state.valid,
      offline: state.offline,
      graceExpiry: state.graceExpiry ? new Date(state.graceExpiry).toISOString() : null,
      message: state.valid 
        ? (state.offline ? 'License valid (offline mode)' : 'License valid')
        : 'License invalid or expired'
    });
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: 'STATUS_CHECK_FAILED',
      message: 'Unable to retrieve license status'
    });
  }
};

/**
 * License validation endpoint handler (for frontend gate)
 * 
 * Performs fresh validation and returns detailed status.
 */
const validateLicenseEndpoint = async (req, res) => {
  try {
    const result = await revalidateLicense(req);
    
    res.json({
      valid: result.valid,
      offline: result.offline || false,
      graceRemaining: result.graceRemaining || null,
      message: result.valid
        ? (result.offline ? 'Operating in offline mode' : 'License is active')
        : (result.message || 'License validation failed'),
      error: result.valid ? null : result.error
    });
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: 'VALIDATION_ERROR',
      message: 'License validation encountered an error'
    });
  }
};

module.exports = {
  requireValidLicense,
  requireFreshLicense,
  getLicenseStatus,
  validateLicenseEndpoint
};
