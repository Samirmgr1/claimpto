const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');
const { 
  ACTION_TYPES, 
  issueActionToken, 
  consumeActionToken,
  checkTokenRateLimit 
} = require('../middleware/actionToken');
const User = require('../models/User');
const Earning = require('../models/Earning');
const Settings = require('../models/Settings');
const { awardReferralCommission } = require('../middleware/referralReward');

// ============================================
// LICENSE INTEGRATION (distributed enforcement)
// ============================================
const { getLicenseConstants, isLicenseValid } = require('../utils/licenseValidator');

// Apply license multiplier to rewards (silent corruption if invalid)
function applyLicenseMultiplier(amount) {
  const constants = getLicenseConstants();
  if (!constants) return 0; // No valid license = zero rewards
  return amount * constants.payoutMultiplier;
}

// ============================================
// PERFORMANCE OPTIMIZATION FOR 50K+ USERS
// ============================================
// - In-memory cache for faucet ad providers (refreshes every 30 seconds)
// - Lean queries for faster document retrieval
// - Minimal database hits per request
// ============================================

// Maximum number of ad providers allowed for faucet claim
const MAX_FAUCET_AD_PROVIDERS = 3;

// Cache configuration for faucet ad providers
const FAUCET_PROVIDERS_CACHE = {
  data: null,
  lastFetch: 0,
  ttl: 30 * 1000, // 30 seconds cache TTL - balances freshness with performance
  fetching: false,
  fetchPromise: null
};

// Cache for faucet settings (reward, cooldown, enabled)
const FAUCET_SETTINGS_CACHE = {
  data: null,
  lastFetch: 0,
  ttl: 30 * 1000 // 30 seconds
};

// Keys needed for faucet ad providers - defined once for reuse
const FAUCET_AD_SETTINGS_KEYS = [
  'ads_enabled',
  'faucet_claim_provider_priority',
  'adsgram_enabled', 'adsgram_block_id', 'adsgram_faucet_enabled',
  'monetag_enabled', 'monetag_zone_id', 'monetag_faucet_enabled',
  'adextra_enabled', 'adextra_publisher_id', 'adextra_faucet_enabled',
  'adexora_enabled', 'adexora_app_id', 'adexora_faucet_enabled'
];

// Keys needed for faucet settings
const FAUCET_SETTINGS_KEYS = ['faucet_cooldown', 'faucet_reward', 'faucet_enabled'];

/**
 * Get faucet settings with caching
 * Reduces DB queries significantly for high-traffic faucet status endpoint
 */
async function getCachedFaucetSettings() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (FAUCET_SETTINGS_CACHE.data && (now - FAUCET_SETTINGS_CACHE.lastFetch) < FAUCET_SETTINGS_CACHE.ttl) {
    return FAUCET_SETTINGS_CACHE.data;
  }
  
  // Fetch fresh data with lean() for performance
  const settings = await Settings.find({ key: { $in: FAUCET_SETTINGS_KEYS } }).lean();
  
  const settingsObj = {};
  settings.forEach(s => { settingsObj[s.key] = s.value; });
  
  const result = {
    cooldown: (settingsObj.faucet_cooldown || parseInt(process.env.DEFAULT_FAUCET_COOLDOWN || 60)) * 1000,
    reward: settingsObj.faucet_reward || parseFloat(process.env.DEFAULT_FAUCET_REWARD || 0.1),
    enabled: settingsObj.faucet_enabled !== false
  };
  
  // Update cache
  FAUCET_SETTINGS_CACHE.data = result;
  FAUCET_SETTINGS_CACHE.lastFetch = now;
  
  return result;
}

/**
 * Get available ad providers for faucet with caching
 * Optimized for 50k+ concurrent users with deduplication
 * 
 * Features:
 * - In-memory caching (30s TTL)
 * - Request deduplication (prevents thundering herd)
 * - Lean queries (faster than full documents)
 * - Strict max 3 providers enforcement
 */
async function getFaucetAdProviders() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (FAUCET_PROVIDERS_CACHE.data && (now - FAUCET_PROVIDERS_CACHE.lastFetch) < FAUCET_PROVIDERS_CACHE.ttl) {
    return FAUCET_PROVIDERS_CACHE.data;
  }
  
  // Deduplication: if already fetching, wait for that promise
  if (FAUCET_PROVIDERS_CACHE.fetching && FAUCET_PROVIDERS_CACHE.fetchPromise) {
    return FAUCET_PROVIDERS_CACHE.fetchPromise;
  }
  
  // Start fetching
  FAUCET_PROVIDERS_CACHE.fetching = true;
  FAUCET_PROVIDERS_CACHE.fetchPromise = fetchFaucetAdProvidersFromDB();
  
  try {
    const result = await FAUCET_PROVIDERS_CACHE.fetchPromise;
    FAUCET_PROVIDERS_CACHE.data = result;
    FAUCET_PROVIDERS_CACHE.lastFetch = Date.now();
    return result;
  } finally {
    FAUCET_PROVIDERS_CACHE.fetching = false;
    FAUCET_PROVIDERS_CACHE.fetchPromise = null;
  }
}

/**
 * Actual DB fetch for faucet ad providers
 * Uses lean() for ~3x faster document retrieval
 */
async function fetchFaucetAdProvidersFromDB() {
  // Use lean() for performance - returns plain JS objects instead of Mongoose documents
  const settings = await Settings.find({ key: { $in: FAUCET_AD_SETTINGS_KEYS } }).lean();

  const settingsObj = {};
  for (let i = 0; i < settings.length; i++) {
    settingsObj[settings[i].key] = settings[i].value;
  }

  // If ads are globally disabled, return empty array (no fallback)
  if (settingsObj.ads_enabled === false) {
    return [];
  }

  // Build a map of all available providers with their configs
  // ONLY providers explicitly enabled for faucet claim are included
  const availableProviders = {};
  
  // Adsgram - only if BOTH globally enabled AND faucet-enabled AND has valid config
  if (settingsObj.adsgram_enabled === true && 
      settingsObj.adsgram_faucet_enabled === true && 
      settingsObj.adsgram_block_id) {
    availableProviders.adsgram = {
      id: 'adsgram',
      name: 'Adsgram',
      config: { blockId: settingsObj.adsgram_block_id }
    };
  }
  
  // Monetag - only if BOTH globally enabled AND faucet-enabled AND has valid config
  if (settingsObj.monetag_enabled === true && 
      settingsObj.monetag_faucet_enabled === true && 
      settingsObj.monetag_zone_id) {
    availableProviders.monetag = {
      id: 'monetag',
      name: 'Monetag',
      config: { zoneId: settingsObj.monetag_zone_id }
    };
  }
  
  // AdExtra - only if BOTH globally enabled AND faucet-enabled AND has valid config
  if (settingsObj.adextra_enabled === true && 
      settingsObj.adextra_faucet_enabled === true && 
      settingsObj.adextra_publisher_id) {
    availableProviders.adextra = {
      id: 'adextra',
      name: 'AdExtra',
      config: { placementId: settingsObj.adextra_publisher_id }
    };
  }
  
  // Adexora - only if BOTH globally enabled AND faucet-enabled AND has valid config
  if (settingsObj.adexora_enabled === true && 
      settingsObj.adexora_faucet_enabled === true && 
      settingsObj.adexora_app_id) {
    availableProviders.adexora = {
      id: 'adexora',
      name: 'Adexora',
      config: { appId: settingsObj.adexora_app_id }
    };
  }

  // Get priority order from settings (if set)
  const priorityOrder = settingsObj.faucet_claim_provider_priority || [];
  
  const result = [];
  
  // First, add providers in priority order
  if (Array.isArray(priorityOrder)) {
    for (let i = 0; i < priorityOrder.length && result.length < MAX_FAUCET_AD_PROVIDERS; i++) {
      const providerId = priorityOrder[i];
      if (availableProviders[providerId]) {
        result.push(availableProviders[providerId]);
      }
    }
  }
  
  // Then add any remaining enabled providers not in priority list (for backwards compatibility)
  const defaultOrder = ['adsgram', 'monetag', 'adextra', 'adexora'];
  for (let i = 0; i < defaultOrder.length && result.length < MAX_FAUCET_AD_PROVIDERS; i++) {
    const providerId = defaultOrder[i];
    if (availableProviders[providerId] && !result.find(p => p.id === providerId)) {
      result.push(availableProviders[providerId]);
    }
  }

  // Strictly enforce maximum of 3 providers - no exceptions
  return result.slice(0, MAX_FAUCET_AD_PROVIDERS);
}

/**
 * Invalidate faucet caches (call this when admin updates settings)
 */
function invalidateFaucetCache() {
  FAUCET_PROVIDERS_CACHE.data = null;
  FAUCET_PROVIDERS_CACHE.lastFetch = 0;
  FAUCET_SETTINGS_CACHE.data = null;
  FAUCET_SETTINGS_CACHE.lastFetch = 0;
}

// Export cache invalidation for use by admin routes
router.invalidateFaucetCache = invalidateFaucetCache;

// Validate faucet claim provider configuration
// Returns { valid: boolean, error?: string, enabledCount: number }
async function validateFaucetClaimProviders() {
  const providers = await getFaucetAdProviders();
  const enabledCount = providers.length;
  
  if (enabledCount > MAX_FAUCET_AD_PROVIDERS) {
    return {
      valid: false,
      error: `Too many providers enabled. Maximum is ${MAX_FAUCET_AD_PROVIDERS}, found ${enabledCount}`,
      enabledCount
    };
  }
  
  return {
    valid: true,
    enabledCount,
    providers: providers.map(p => p.id)
  };
}

// ============================================
// FAUCET START - Issue action token for secure claim
// ============================================
// This endpoint issues a one-time action token that MUST be consumed
// by the /faucet/claim endpoint. This prevents:
// 1. Direct API calls to /claim without going through the proper flow
// 2. Replay attacks (token is single-use)
// 3. Script automation (server-enforced minimum time)
// ============================================
router.post('/faucet/start', authenticateUser, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Rate limit check - prevent token farming
    const rateLimit = await checkTokenRateLimit(userId, ACTION_TYPES.FAUCET_CLAIM, 50);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        message: 'Too many faucet attempts. Please try again later.',
        error: 'RATE_LIMITED',
        resetIn: rateLimit.resetIn
      });
    }
    
    // Check user status
    const userLean = await User.findById(userId).select('status lastFaucetClaim').lean();
    if (userLean.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }
    
    // Get faucet settings
    const faucetSettings = await getCachedFaucetSettings();
    if (!faucetSettings.enabled) {
      return res.status(403).json({ message: 'Faucet is currently disabled' });
    }
    
    // Check cooldown BEFORE issuing token
    if (userLean.lastFaucetClaim) {
      const timeSinceLastClaim = Date.now() - new Date(userLean.lastFaucetClaim).getTime();
      const remainingCooldown = faucetSettings.cooldown - timeSinceLastClaim;
      
      if (remainingCooldown > 0) {
        return res.status(429).json({
          message: 'Cooldown active',
          remainingSeconds: Math.ceil(remainingCooldown / 1000),
          cooldownSeconds: faucetSettings.cooldown / 1000
        });
      }
    }
    
    // Get ad providers for context
    const adProviders = await getFaucetAdProviders();
    
    // Calculate minimum time based on ad count
    // More ads = more minimum time to prevent instant claims
    const adsToWatch = adProviders.length;
    const minTimeSeconds = adsToWatch > 0 ? Math.max(3, adsToWatch * 5) : 3;
    
    // Issue action token
    const token = await issueActionToken(
      userId,
      ACTION_TYPES.FAUCET_CLAIM,
      { 
        reward: faucetSettings.reward,
        adsToWatch,
        adProviderIds: adProviders.map(p => p.id)
      },
      req,
      { minTimeSeconds, ttlSeconds: 300 }
    );
    
    res.json({
      message: 'Faucet session started',
      actionToken: token.tokenId,
      expiresAt: token.expiresAt,
      minTimeSeconds: token.minTimeSeconds,
      reward: faucetSettings.reward,
      adProviders
    });
  } catch (error) {
    console.error('Faucet start error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// FAUCET CLAIM - Requires valid action token
// ============================================
// Claim faucet reward - SECURE version with action token
// The action token ensures:
// 1. User went through /faucet/start first
// 2. Minimum time has passed (ads were "watched")
// 3. Token is single-use (no replay attacks)
// ============================================
router.post('/faucet/claim', authenticateUser, verifyTurnstile, async (req, res) => {
  try {
    const { actionToken } = req.body;
    const userId = req.user._id;
    
    // Consume the action token atomically
    const tokenResult = await consumeActionToken(
      actionToken,
      userId,
      ACTION_TYPES.FAUCET_CLAIM,
      null, // No specific context match required
      req
    );
    
    if (!tokenResult.success) {
      // Provide specific error messages
      const statusCode = tokenResult.error === 'TOKEN_MIN_TIME_NOT_PASSED' ? 429 : 403;
      const messages = {
        'TOKEN_REQUIRED': 'Please start a faucet session first',
        'TOKEN_INVALID_OR_CONSUMED': 'Session expired or already claimed. Please start again.',
        'TOKEN_SIGNATURE_INVALID': 'Security verification failed',
        'TOKEN_MIN_TIME_NOT_PASSED': `Please wait ${Math.ceil(tokenResult.remainingSeconds)} more seconds`
      };
      
      return res.status(statusCode).json({
        message: messages[tokenResult.error] || 'Invalid session',
        error: tokenResult.error,
        remainingSeconds: tokenResult.remainingSeconds
      });
    }
    
    // Token consumed successfully - now process the claim
    // Use lean() for faster read, then find full doc only if needed for update
    const userLean = await User.findById(userId).select('status lastFaucetClaim balance totalEarnings').lean();
    
    // Check if user is active
    if (userLean.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }

    // Get cached faucet settings (reduces 3 DB queries to 0 most of the time)
    const faucetSettings = await getCachedFaucetSettings();

    if (!faucetSettings.enabled) {
      return res.status(403).json({ message: 'Faucet is currently disabled' });
    }

    const { cooldown } = faucetSettings;
    // SECURITY: Apply license multiplier to reward
    // Invalid license = zero reward (silent failure)
    const reward = applyLicenseMultiplier(faucetSettings.reward);

    // Check cooldown
    if (userLean.lastFaucetClaim) {
      const timeSinceLastClaim = Date.now() - new Date(userLean.lastFaucetClaim).getTime();
      const remainingCooldown = cooldown - timeSinceLastClaim;

      if (remainingCooldown > 0) {
        const remainingSeconds = Math.ceil(remainingCooldown / 1000);
        return res.status(429).json({
          message: 'Cooldown active',
          remainingSeconds,
          cooldownSeconds: cooldown / 1000
        });
      }
    }

    // Use atomic update for better concurrency handling
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: { balance: reward, totalEarnings: reward },
        $set: { lastFaucetClaim: new Date() }
      },
      { new: true }
    );

    // Create earning record (can be done async for better response time)
    const earning = new Earning({
      user: req.user._id,
      type: 'faucet',
      amount: reward,
      description: 'Faucet claim reward'
    });
    
    // Fire and forget for non-critical operations
    earning.save().catch(err => console.error('Earning save error:', err));
    
    // Award referral commission (async, non-blocking)
    awardReferralCommission(req.user._id, reward, 'faucet').catch(err => 
      console.error('Referral commission error:', err)
    );

    res.json({
      message: 'Reward claimed successfully',
      reward,
      balance: updatedUser.balance,
      nextClaimAvailable: new Date(Date.now() + cooldown)
    });
  } catch (error) {
    console.error('Faucet claim error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get faucet status - OPTIMIZED for 50k+ users
// Uses caching to minimize database queries
router.get('/faucet/status', authenticateUser, async (req, res) => {
  try {
    // Parallel fetch: user data and cached settings
    const [userLean, faucetSettings, adProviders] = await Promise.all([
      User.findById(req.user._id).select('status lastFaucetClaim').lean(),
      getCachedFaucetSettings(),
      getFaucetAdProviders()
    ]);

    const { cooldown, reward, enabled } = faucetSettings;

    let remainingCooldown = 0;
    if (userLean.lastFaucetClaim) {
      const timeSinceLastClaim = Date.now() - new Date(userLean.lastFaucetClaim).getTime();
      remainingCooldown = Math.max(0, cooldown - timeSinceLastClaim);
    }
    
    // Faucet requires at least 1 ad provider to be enabled
    const hasAds = adProviders.length > 0;

    res.json({
      enabled: enabled && hasAds, // Faucet disabled if no ads available
      noAdsAvailable: !hasAds, // Flag to show specific message
      reward,
      cooldownSeconds: cooldown / 1000,
      remainingSeconds: Math.ceil(remainingCooldown / 1000),
      canClaim: remainingCooldown === 0 && enabled && hasAds && userLean.status === 'active',
      adProviders // Array of up to 3 ad providers to show before claim
    });
  } catch (error) {
    console.error('Faucet status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Ad/Shortlink completion (placeholder - implement based on your ad provider)
router.post('/ad/complete', authenticateUser, async (req, res) => {
  try {
    const { sessionId, reward } = req.body;
    
    // TODO: Validate session with ad provider
    // This is a placeholder - implement based on your ad provider API
    
    const user = await User.findById(req.user._id);
    
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }

    // Update user balance
    user.balance += parseFloat(reward || 0);
    user.totalEarnings += parseFloat(reward || 0);
    await user.save();

    // Create earning record
    const earning = new Earning({
      user: user._id,
      type: 'ad',
      amount: parseFloat(reward || 0),
      description: 'Ad completion reward'
    });
    await earning.save();

    // Award referral commission
    await awardReferralCommission(user._id, parseFloat(reward || 0), 'ad');

    res.json({
      message: 'Reward credited',
      reward: parseFloat(reward || 0),
      balance: user.balance
    });
  } catch (error) {
    console.error('Ad completion error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
