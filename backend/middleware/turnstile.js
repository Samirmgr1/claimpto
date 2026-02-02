/**
 * Cloudflare Turnstile Server-Side Validation Middleware
 * 
 * This middleware validates Turnstile tokens on protected routes to prevent
 * automated bot scripts and unauthorized API requests.
 * 
 * Usage:
 *   const { verifyTurnstile } = require('../middleware/turnstile');
 *   router.post('/protected-route', authenticateUser, verifyTurnstile, handler);
 */

const Settings = require('../models/Settings');

// Cache for Turnstile settings to avoid repeated DB queries
const TURNSTILE_CACHE = {
  data: null,
  lastFetch: 0,
  ttl: 30 * 1000 // 30 seconds
};

/**
 * Get Turnstile settings with caching
 */
async function getTurnstileSettings() {
  const now = Date.now();
  
  if (TURNSTILE_CACHE.data && (now - TURNSTILE_CACHE.lastFetch) < TURNSTILE_CACHE.ttl) {
    return TURNSTILE_CACHE.data;
  }
  
  const settings = await Settings.find({
    key: { $in: ['turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key'] }
  }).lean();
  
  const settingsObj = {};
  settings.forEach(s => { settingsObj[s.key] = s.value; });
  
  const result = {
    enabled: settingsObj.turnstile_enabled === true,
    siteKey: settingsObj.turnstile_site_key || '',
    secretKey: settingsObj.turnstile_secret_key || ''
  };
  
  TURNSTILE_CACHE.data = result;
  TURNSTILE_CACHE.lastFetch = now;
  
  return result;
}

/**
 * Invalidate the Turnstile settings cache
 * Call this when admin updates Turnstile settings
 */
function invalidateTurnstileCache() {
  TURNSTILE_CACHE.data = null;
  TURNSTILE_CACHE.lastFetch = 0;
}

/**
 * Validate a Turnstile token with Cloudflare's Siteverify API
 * 
 * @param {string} token - The Turnstile token from the client
 * @param {string} secretKey - The Turnstile secret key
 * @param {string} remoteip - Optional: The user's IP address
 * @returns {Promise<{success: boolean, error?: string, data?: object}>}
 */
async function validateTurnstileToken(token, secretKey, remoteip = null) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Invalid token format' };
  }
  
  if (token.length > 2048) {
    return { success: false, error: 'Token too long' };
  }
  
  if (!secretKey) {
    return { success: false, error: 'Turnstile secret key not configured' };
  }
  
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString(),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const result = await response.json();
    
    if (result.success) {
      return { 
        success: true, 
        data: {
          challengeTs: result.challenge_ts,
          hostname: result.hostname,
          action: result.action,
          cdata: result.cdata
        }
      };
    } else {
      // Map error codes to user-friendly messages
      const errorMessages = {
        'missing-input-secret': 'Server configuration error',
        'invalid-input-secret': 'Server configuration error',
        'missing-input-response': 'Verification token missing',
        'invalid-input-response': 'Invalid verification token',
        'bad-request': 'Invalid request',
        'timeout-or-duplicate': 'Verification expired or already used',
        'internal-error': 'Verification service temporarily unavailable'
      };
      
      const errorCode = result['error-codes']?.[0] || 'unknown-error';
      const errorMessage = errorMessages[errorCode] || 'Verification failed';
      
      console.warn('[Turnstile] Validation failed:', result['error-codes']);
      
      return { 
        success: false, 
        error: errorMessage,
        errorCodes: result['error-codes']
      };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[Turnstile] Validation timeout');
      return { success: false, error: 'Verification timeout' };
    }
    
    console.error('[Turnstile] Validation error:', error);
    return { success: false, error: 'Verification service unavailable' };
  }
}

/**
 * Express middleware to verify Turnstile token
 * 
 * Expects the token in req.body.turnstileToken
 * 
 * If Turnstile is disabled in settings, the middleware passes through.
 * If the user is authenticated via Telegram Mini App, bypass Turnstile (it doesn't work in Telegram WebView).
 * If enabled but token is missing/invalid, returns 403.
 */
async function verifyTurnstile(req, res, next) {
  try {
    const turnstileSettings = await getTurnstileSettings();
    
    // If Turnstile is disabled, skip validation
    if (!turnstileSettings.enabled) {
      return next();
    }
    
    // TELEGRAM MINI APP BYPASS:
    // Turnstile (Cloudflare's CAPTCHA) doesn't work properly in Telegram's WebView environment.
    // If the user is authenticated and has a telegramId, they've already been validated
    // through Telegram's authentication system, so we can safely bypass Turnstile.
    if (req.user && req.user.telegramId) {
      // User is authenticated via Telegram Mini App - bypass Turnstile
      return next();
    }
    
    // Check if secret key is configured - BLOCK if not configured but enabled
    if (!turnstileSettings.secretKey) {
      console.error('[Turnstile] SECURITY: Enabled but secret key not configured - blocking request');
      return res.status(503).json({
        message: 'Security verification not properly configured. Please contact support.',
        error: 'TURNSTILE_NOT_CONFIGURED',
        turnstileRequired: true
      });
    }
    
    const token = req.body.turnstileToken;
    
    if (!token) {
      return res.status(403).json({
        message: 'Security verification required',
        error: 'TURNSTILE_REQUIRED',
        turnstileRequired: true
      });
    }
    
    // Get client IP
    const remoteip = req.headers['cf-connecting-ip'] || 
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.ip;
    
    const validation = await validateTurnstileToken(token, turnstileSettings.secretKey, remoteip);
    
    if (!validation.success) {
      return res.status(403).json({
        message: validation.error || 'Security verification failed',
        error: 'TURNSTILE_FAILED',
        turnstileRequired: true
      });
    }
    
    // Attach validation data to request for potential logging/auditing
    req.turnstile = validation.data;
    
    next();
  } catch (error) {
    console.error('[Turnstile] Middleware error:', error);
    
    // SECURITY: When Turnstile is enabled, do NOT allow requests through on errors
    // This prevents bypassing verification by causing server errors
    try {
      const turnstileSettings = await getTurnstileSettings();
      if (turnstileSettings.enabled && turnstileSettings.secretKey) {
        return res.status(503).json({
          message: 'Security verification service unavailable. Please try again.',
          error: 'TURNSTILE_SERVICE_ERROR',
          turnstileRequired: true
        });
      }
    } catch (settingsError) {
      // If we can't even check settings, block the request for safety
      return res.status(503).json({
        message: 'Security verification service unavailable. Please try again.',
        error: 'TURNSTILE_SERVICE_ERROR',
        turnstileRequired: true
      });
    }
    
    next();
  }
}

/**
 * Optional middleware - verifies Turnstile only if token is provided
 * Useful for routes that want to accept but not require verification
 */
async function verifyTurnstileOptional(req, res, next) {
  try {
    const token = req.body.turnstileToken;
    
    if (!token) {
      return next();
    }
    
    const turnstileSettings = await getTurnstileSettings();
    
    if (!turnstileSettings.enabled || !turnstileSettings.secretKey) {
      return next();
    }
    
    const remoteip = req.headers['cf-connecting-ip'] || 
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.ip;
    
    const validation = await validateTurnstileToken(token, turnstileSettings.secretKey, remoteip);
    
    if (validation.success) {
      req.turnstile = validation.data;
    }
    
    next();
  } catch (error) {
    console.error('[Turnstile] Optional middleware error:', error);
    next();
  }
}

module.exports = {
  verifyTurnstile,
  verifyTurnstileOptional,
  validateTurnstileToken,
  getTurnstileSettings,
  invalidateTurnstileCache
};
