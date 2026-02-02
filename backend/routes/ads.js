const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateUser } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');
const User = require('../models/User');
const Earning = require('../models/Earning');
const AdSession = require('../models/AdSession');
const PeeredAdSession = require('../models/PeeredAdSession');
const Settings = require('../models/Settings');
const { awardReferralCommission } = require('../middleware/referralReward');

// ============================================
// PERFORMANCE OPTIMIZATION FOR 50K+ USERS
// ============================================
// - In-memory cache for ad settings (refreshes every 30 seconds)
// - Lean queries for faster document retrieval
// - Request deduplication to prevent thundering herd
// ============================================

// Cache for ad settings
const AD_SETTINGS_CACHE = {
  data: null,
  lastFetch: 0,
  ttl: 30 * 1000, // 30 seconds
  fetching: false,
  fetchPromise: null
};

// Keys for ad settings - defined once
const AD_SETTINGS_KEYS = [
  'ads_enabled',
  'adsgram_enabled', 'adsgram_block_id', 'adsgram_reward',
  'monetag_enabled', 'monetag_zone_id', 'monetag_reward',
  'adextra_enabled', 'adextra_publisher_id', 'adextra_reward',
  'adexora_enabled', 'adexora_app_id', 'adexora_reward',
  'daily_ad_limit', 'ad_cooldown',
  // Multiple peer groups support
  'ads_peering_enabled', 'ads_peering_groups'
];

// Helper to get ad settings with caching
async function getAdSettings() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (AD_SETTINGS_CACHE.data && (now - AD_SETTINGS_CACHE.lastFetch) < AD_SETTINGS_CACHE.ttl) {
    return AD_SETTINGS_CACHE.data;
  }
  
  // Deduplication: if already fetching, wait for that promise
  if (AD_SETTINGS_CACHE.fetching && AD_SETTINGS_CACHE.fetchPromise) {
    return AD_SETTINGS_CACHE.fetchPromise;
  }
  
  // Start fetching
  AD_SETTINGS_CACHE.fetching = true;
  AD_SETTINGS_CACHE.fetchPromise = fetchAdSettingsFromDB();
  
  try {
    const result = await AD_SETTINGS_CACHE.fetchPromise;
    AD_SETTINGS_CACHE.data = result;
    AD_SETTINGS_CACHE.lastFetch = Date.now();
    return result;
  } finally {
    AD_SETTINGS_CACHE.fetching = false;
    AD_SETTINGS_CACHE.fetchPromise = null;
  }
}

// Actual DB fetch for ad settings
async function fetchAdSettingsFromDB() {
  // Use lean() for performance
  const settings = await Settings.find({ key: { $in: AD_SETTINGS_KEYS } }).lean();

  const settingsObj = {};
  for (let i = 0; i < settings.length; i++) {
    settingsObj[settings[i].key] = settings[i].value;
  }

  return {
    adsEnabled: settingsObj.ads_enabled !== false,
    adsgram: {
      enabled: settingsObj.adsgram_enabled === true,
      blockId: settingsObj.adsgram_block_id || '',
      reward: parseFloat(settingsObj.adsgram_reward || 0.1)
    },
    monetag: {
      enabled: settingsObj.monetag_enabled === true,
      zoneId: settingsObj.monetag_zone_id || '',
      reward: parseFloat(settingsObj.monetag_reward || 0.1)
    },
    adextra: {
      enabled: settingsObj.adextra_enabled === true,
      publisherId: settingsObj.adextra_publisher_id || '',
      reward: parseFloat(settingsObj.adextra_reward || 0.1)
    },
    adexora: {
      enabled: settingsObj.adexora_enabled === true,
      appId: settingsObj.adexora_app_id || '',
      reward: parseFloat(settingsObj.adexora_reward || 0.1)
    },
    dailyLimit: parseInt(settingsObj.daily_ad_limit || 50),
    cooldown: parseInt(settingsObj.ad_cooldown || 30), // seconds
    // Multiple peer groups configuration
    peeringEnabled: settingsObj.ads_peering_enabled === true,
    peeringGroups: settingsObj.ads_peering_groups || [] // Array of arrays: [[providerA, providerB], [providerC, providerD]]
  };
}

// Invalidate ad settings cache
function invalidateAdCache() {
  AD_SETTINGS_CACHE.data = null;
  AD_SETTINGS_CACHE.lastFetch = 0;
}

// Export for use by admin routes
router.invalidateAdCache = invalidateAdCache;

// Get available ad providers
router.get('/providers', authenticateUser, async (req, res) => {
  try {
    const adSettings = await getAdSettings();
    
    if (!adSettings.adsEnabled) {
      return res.json({
        enabled: false,
        providers: []
      });
    }

    const providers = [];
    
    if (adSettings.adsgram.enabled && adSettings.adsgram.blockId) {
      providers.push({
        id: 'adsgram',
        name: 'Adsgram',
        reward: adSettings.adsgram.reward,
        blockId: adSettings.adsgram.blockId
      });
    }
    
    if (adSettings.monetag.enabled && adSettings.monetag.zoneId) {
      providers.push({
        id: 'monetag',
        name: 'Monetag',
        reward: adSettings.monetag.reward,
        zoneId: adSettings.monetag.zoneId
      });
    }
    
    if (adSettings.adextra.enabled && adSettings.adextra.publisherId) {
      providers.push({
        id: 'adextra',
        name: 'AdExtra',
        reward: adSettings.adextra.reward,
        publisherId: adSettings.adextra.publisherId
      });
    }
    
    if (adSettings.adexora.enabled && adSettings.adexora.appId) {
      providers.push({
        id: 'adexora',
        name: 'Adexora',
        reward: adSettings.adexora.reward,
        appId: adSettings.adexora.appId
      });
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAdsCount = await AdSession.countDocuments({
      user: req.user._id,
      status: 'completed',
      completedAt: { $gte: today }
    });

    // Get last ad time for cooldown
    const lastAd = await AdSession.findOne({
      user: req.user._id,
      status: 'completed'
    }).sort({ completedAt: -1 });

    let cooldownRemaining = 0;
    if (lastAd && lastAd.completedAt) {
      const timeSinceLastAd = Date.now() - new Date(lastAd.completedAt).getTime();
      cooldownRemaining = Math.max(0, (adSettings.cooldown * 1000) - timeSinceLastAd);
    }

    // Multiple peer groups support - find which group each provider belongs to
    const peeringGroups = adSettings.peeringGroups || [];
    const isPeeringActive = adSettings.peeringEnabled && peeringGroups.length > 0;
    
    // Build a map of provider -> group index and calculate group rewards
    const providerToGroup = {}; // providerId -> groupIndex
    const groupRewards = []; // groupIndex -> total reward (sum of individual rewards)
    
    if (isPeeringActive) {
      peeringGroups.forEach((group, groupIndex) => {
        if (Array.isArray(group) && group.length >= 2) {
          let groupReward = 0;
          group.forEach(providerId => {
            providerToGroup[providerId] = groupIndex;
            const provider = providers.find(p => p.id === providerId);
            if (provider) groupReward += provider.reward;
          });
          groupRewards[groupIndex] = Math.round(groupReward * 100) / 100;
        }
      });
    }
    
    // Add peering info to each provider
    const providersWithPeering = providers.map(p => {
      const groupIndex = providerToGroup[p.id];
      const isInGroup = groupIndex !== undefined;
      const group = isInGroup ? peeringGroups[groupIndex] : [];
      
      return {
        ...p,
        isPeered: isPeeringActive && isInGroup,
        peerGroupIndex: isInGroup ? groupIndex : null,
        peeredWith: isInGroup ? group.filter(id => id !== p.id) : [],
        combinedReward: isInGroup ? groupRewards[groupIndex] : p.reward
      };
    });

    res.json({
      enabled: true,
      providers: providersWithPeering,
      peeringEnabled: isPeeringActive,
      peeringGroups: isPeeringActive ? peeringGroups : [],
      dailyLimit: adSettings.dailyLimit,
      adsWatchedToday: todayAdsCount,
      remainingToday: Math.max(0, adSettings.dailyLimit - todayAdsCount),
      cooldown: adSettings.cooldown,
      cooldownRemaining: Math.ceil(cooldownRemaining / 1000)
    });
  } catch (error) {
    console.error('Get ad providers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start ad session (protected by Turnstile)
router.post('/start', authenticateUser, verifyTurnstile, async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider || !['adsgram', 'monetag', 'adextra', 'adexora'].includes(provider)) {
      return res.status(400).json({ message: 'Invalid provider' });
    }

    const user = await User.findById(req.user._id);
    
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }

    const adSettings = await getAdSettings();
    
    if (!adSettings.adsEnabled) {
      return res.status(403).json({ message: 'Ads are currently disabled' });
    }

    const providerSettings = adSettings[provider];
    if (!providerSettings || !providerSettings.enabled) {
      return res.status(403).json({ message: 'This ad provider is disabled' });
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAdsCount = await AdSession.countDocuments({
      user: req.user._id,
      status: 'completed',
      completedAt: { $gte: today }
    });

    if (todayAdsCount >= adSettings.dailyLimit) {
      return res.status(429).json({ 
        message: 'Daily ad limit reached',
        limit: adSettings.dailyLimit 
      });
    }

    // Check cooldown
    const lastAd = await AdSession.findOne({
      user: req.user._id,
      status: 'completed'
    }).sort({ completedAt: -1 });

    if (lastAd && lastAd.completedAt) {
      const timeSinceLastAd = Date.now() - new Date(lastAd.completedAt).getTime();
      const cooldownMs = adSettings.cooldown * 1000;
      
      if (timeSinceLastAd < cooldownMs) {
        return res.status(429).json({
          message: 'Cooldown active',
          remainingSeconds: Math.ceil((cooldownMs - timeSinceLastAd) / 1000)
        });
      }
    }

    // Generate secure session with signature and minimum watch time
    const minWatchTimeSeconds = 10; // Ads must be "watched" for at least 10 seconds
    
    const adSession = await AdSession.createSession(
      user._id,
      provider,
      providerSettings.reward,
      minWatchTimeSeconds,
      req.ip,
      req.get('user-agent') || ''
    );

    res.json({
      sessionId: adSession.sessionId,
      provider,
      reward: providerSettings.reward,
      minWatchTimeSeconds,
      config: {
        blockId: providerSettings.blockId,
        zoneId: providerSettings.zoneId,
        placementId: providerSettings.publisherId, // AdExtra placement ID
        appId: providerSettings.appId // Adexora app ID
      }
    });
  } catch (error) {
    console.error('Start ad session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Complete ad session - SECURE with atomic consumption
router.post('/complete', authenticateUser, verifyTurnstile, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // ATOMIC session completion - prevents race conditions and replay attacks
    const result = await AdSession.completeSession(
      sessionId,
      req.user._id,
      req.ip
    );

    if (!result.success) {
      const statusCode = result.error === 'SESSION_MIN_TIME_NOT_PASSED' ? 429 : 403;
      const messages = {
        'SESSION_INVALID_OR_COMPLETED': 'Invalid or already completed session',
        'SESSION_SIGNATURE_INVALID': 'Security verification failed',
        'SESSION_MIN_TIME_NOT_PASSED': `Please wait ${Math.ceil(result.remainingSeconds)} more seconds`
      };
      
      return res.status(statusCode).json({
        message: messages[result.error] || 'Session completion failed',
        error: result.error,
        remainingSeconds: result.remainingSeconds
      });
    }

    const adSession = result.session;
    const user = await User.findById(req.user._id);
    
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }

    // Credit reward (session was already marked as completed atomically)
    user.balance += adSession.reward;
    user.totalEarnings += adSession.reward;
    await user.save();

    // Create earning record
    const earning = new Earning({
      user: user._id,
      type: 'ad',
      amount: adSession.reward,
      description: `${adSession.provider.charAt(0).toUpperCase() + adSession.provider.slice(1)} ad reward`
    });
    await earning.save();

    // Award referral commission
    await awardReferralCommission(user._id, adSession.reward, 'ad');

    res.json({
      message: 'Reward credited successfully',
      reward: adSession.reward,
      balance: user.balance
    });
  } catch (error) {
    console.error('Complete ad session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cancel ad session (when ad fails to display)
router.post('/cancel', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const adSession = await AdSession.findOne({
      sessionId,
      user: req.user._id,
      status: 'pending'
    });

    if (!adSession) {
      // Session might already be completed, expired, or doesn't exist
      return res.json({ message: 'Session cancelled or not found' });
    }

    // Mark session as cancelled
    adSession.status = 'cancelled';
    await adSession.save();

    console.log(`Ad session ${sessionId} cancelled for user ${req.user._id}`);

    res.json({
      message: 'Ad session cancelled. No reward given.',
      sessionId
    });
  } catch (error) {
    console.error('Cancel ad session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// PEERED ADS SYSTEM
// ============================================
// Peered ads require users to watch all ads in a group before receiving the combined reward.
// This increases engagement and allows admins to bundle multiple ad providers together.
// 
// SECURITY: Uses MongoDB-backed sessions with atomic operations for:
// - Preventing race conditions
// - Enforcing minimum watch times per ad
// - Ensuring each provider can only be completed once
// - Automatic session expiration via TTL
// ============================================

// Minimum time per ad in peered session (seconds)
const PEERED_AD_MIN_TIME = 5;

// Start a peered ad session (for watching all peered ads in sequence)
router.post('/peered/start', authenticateUser, async (req, res) => {
  try {
    const { triggeredBy } = req.body; // The provider ID that was clicked
    
    if (!triggeredBy) {
      return res.status(400).json({ message: 'triggeredBy provider ID is required' });
    }

    const user = await User.findById(req.user._id);
    
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }

    const adSettings = await getAdSettings();
    
    if (!adSettings.adsEnabled) {
      return res.status(403).json({ message: 'Ads are currently disabled' });
    }
    
    if (!adSettings.peeringEnabled) {
      return res.status(403).json({ message: 'Ad peering is not enabled' });
    }
    
    // Find which group this provider belongs to
    const peeringGroups = adSettings.peeringGroups || [];
    let targetGroup = null;
    let groupIndex = -1;
    
    for (let i = 0; i < peeringGroups.length; i++) {
      const group = peeringGroups[i];
      if (Array.isArray(group) && group.includes(triggeredBy)) {
        targetGroup = group;
        groupIndex = i;
        break;
      }
    }
    
    if (!targetGroup || targetGroup.length < 2) {
      return res.status(400).json({ message: 'This provider is not in a valid peer group' });
    }

    // Verify all peered providers are enabled and get their configs
    const providersConfig = [];
    for (const providerId of targetGroup) {
      const providerSettings = adSettings[providerId];
      if (!providerSettings || !providerSettings.enabled) {
        return res.status(403).json({ 
          message: `Provider ${providerId} in peering is disabled` 
        });
      }
      providersConfig.push({
        id: providerId,
        reward: providerSettings.reward,
        config: {
          blockId: providerSettings.blockId,
          zoneId: providerSettings.zoneId,
          placementId: providerSettings.publisherId,
          appId: providerSettings.appId
        }
      });
    }

    // Check daily limit (peered sessions count as multiple ads)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAdsCount = await AdSession.countDocuments({
      user: req.user._id,
      status: 'completed',
      completedAt: { $gte: today }
    });

    const adsInPeering = targetGroup.length;
    if (todayAdsCount + adsInPeering > adSettings.dailyLimit) {
      return res.status(429).json({ 
        message: 'Not enough daily ad allowance for peered ads',
        limit: adSettings.dailyLimit,
        remaining: Math.max(0, adSettings.dailyLimit - todayAdsCount),
        required: adsInPeering
      });
    }

    // Check cooldown
    const lastAd = await AdSession.findOne({
      user: req.user._id,
      status: 'completed'
    }).sort({ completedAt: -1 });

    if (lastAd && lastAd.completedAt) {
      const timeSinceLastAd = Date.now() - new Date(lastAd.completedAt).getTime();
      const cooldownMs = adSettings.cooldown * 1000;
      
      if (timeSinceLastAd < cooldownMs) {
        return res.status(429).json({
          message: 'Cooldown active',
          remainingSeconds: Math.ceil((cooldownMs - timeSinceLastAd) / 1000)
        });
      }
    }

    // Generate peered session ID
    const peeredSessionId = crypto.randomBytes(32).toString('hex');
    
    // Calculate combined reward (sum of individual rewards, no multiplier)
    const combinedReward = Math.round(providersConfig.reduce((sum, p) => sum + p.reward, 0) * 100) / 100;
    
    // Create MongoDB-backed peered session with security features
    const peeredSession = await PeeredAdSession.createSession(
      req.user._id,
      groupIndex,
      targetGroup,
      providersConfig,
      combinedReward,
      PEERED_AD_MIN_TIME,
      req.ip,
      req.get('user-agent') || ''
    );

    res.json({
      peeredSessionId: peeredSession.sessionId,
      providers: providersConfig.map(p => ({
        id: p.id,
        config: p.config
      })),
      combinedReward,
      totalAds: targetGroup.length,
      minTimePerAd: PEERED_AD_MIN_TIME
    });
  } catch (error) {
    console.error('Start peered ad session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Complete a single ad within a peered session - SECURE with atomic operations
router.post('/peered/complete-ad', authenticateUser, async (req, res) => {
  try {
    const { peeredSessionId, providerId } = req.body;
    
    if (!peeredSessionId || !providerId) {
      return res.status(400).json({ message: 'Peered session ID and provider ID are required' });
    }

    // ATOMIC provider completion - prevents race conditions
    const result = await PeeredAdSession.completeProvider(
      peeredSessionId,
      req.user._id,
      providerId
    );
    
    if (!result.success) {
      const statusCodes = {
        'SESSION_NOT_FOUND': 404,
        'SESSION_ALREADY_COMPLETED': 400,
        'PROVIDER_ALREADY_COMPLETED': 400,
        'PROVIDER_NOT_IN_GROUP': 400,
        'SESSION_EXPIRED': 400,
        'MIN_TIME_NOT_PASSED': 429
      };
      
      const messages = {
        'SESSION_NOT_FOUND': 'Peered session not found or expired',
        'SESSION_ALREADY_COMPLETED': 'This peered session was already completed',
        'PROVIDER_ALREADY_COMPLETED': 'This ad was already completed in this session',
        'PROVIDER_NOT_IN_GROUP': 'Provider not part of this peered group',
        'SESSION_EXPIRED': 'Peered session has expired',
        'MIN_TIME_NOT_PASSED': `Please wait before completing the next ad`
      };
      
      return res.status(statusCodes[result.error] || 400).json({
        message: messages[result.error] || 'Session completion failed',
        error: result.error,
        remainingSeconds: result.remainingSeconds
      });
    }
    
    const session = result.session;
    
    // Check if all providers are completed
    if (result.allCompleted) {
      // Verify session signature before granting reward
      if (!session.verifySignature()) {
        console.error('[SECURITY] Peered session signature verification failed:', {
          sessionId: peeredSessionId,
          userId: req.user._id
        });
        return res.status(403).json({ message: 'Security verification failed' });
      }
      
      // All ads watched - credit the combined reward
      const user = await User.findById(req.user._id);
      
      if (user.status !== 'active') {
        return res.status(403).json({ message: 'Account is suspended or banned' });
      }
      
      // Create individual ad sessions for tracking
      const adSessionPromises = session.providers.map(pId => {
        const pConfig = session.providersConfig.find(p => p.id === pId);
        const adSession = new AdSession({
          user: user._id,
          provider: pId,
          sessionId: `${peeredSessionId}_${pId}`,
          reward: pConfig?.reward || 0,
          status: 'completed',
          completedAt: new Date(),
          ipAddress: session.ipAddress,
          userAgent: session.userAgent || ''
        });
        return adSession.save();
      });
      await Promise.all(adSessionPromises);
      
      // Credit combined reward using atomic update
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { 
          $inc: { 
            balance: session.combinedReward, 
            totalEarnings: session.combinedReward 
          }
        },
        { new: true }
      );
      
      // Create earning record
      const earning = new Earning({
        user: user._id,
        type: 'ad',
        amount: session.combinedReward,
        description: `Peered ads reward (${session.providers.length} ads)`
      });
      await earning.save();
      
      // Award referral commission
      await awardReferralCommission(user._id, session.combinedReward, 'ad');
      
      // Mark session as completed
      await PeeredAdSession.markCompleted(peeredSessionId, req.user._id);
      
      return res.json({
        message: 'All peered ads completed! Combined reward credited.',
        completed: true,
        reward: session.combinedReward,
        balance: updatedUser.balance,
        completedAds: result.completedCount,
        totalAds: result.totalCount
      });
    }
    
    // Not all completed yet
    const remainingProviders = session.providers.filter(
      p => !session.completedProviders.some(cp => cp.providerId === p)
    );
    
    res.json({
      message: `Ad completed. ${remainingProviders.length} more to go.`,
      completed: false,
      completedAds: result.completedCount,
      totalAds: result.totalCount,
      remainingProviders,
      minTimePerAd: session.minTimePerAd
    });
  } catch (error) {
    console.error('Complete peered ad error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cancel a peered session
router.post('/peered/cancel', authenticateUser, async (req, res) => {
  try {
    const { peeredSessionId } = req.body;
    
    if (!peeredSessionId) {
      return res.status(400).json({ message: 'Peered session ID is required' });
    }

    // Cancel the session in MongoDB
    const result = await PeeredAdSession.findOneAndUpdate(
      { 
        sessionId: peeredSessionId, 
        user: req.user._id,
        status: 'pending'
      },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    
    if (!result) {
      return res.json({ message: 'Session cancelled or not found' });
    }
    
    console.log(`Peered session ${peeredSessionId} cancelled for user ${req.user._id}`);

    res.json({
      message: 'Peered session cancelled. No reward given.',
      peeredSessionId
    });
  } catch (error) {
    console.error('Cancel peered session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get peered session status
router.get('/peered/status/:sessionId', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await PeeredAdSession.findOne({
      sessionId,
      user: req.user._id
    });
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found or expired' });
    }
    
    const sessionAge = Date.now() - session.createdAt.getTime();
    const sessionTtlMs = 10 * 60 * 1000; // 10 minutes
    const timeRemaining = Math.max(0, sessionTtlMs - sessionAge);
    
    const completedProviderIds = session.completedProviders.map(cp => cp.providerId);
    
    res.json({
      peeredSessionId: sessionId,
      status: session.status,
      completedProviders: completedProviderIds,
      remainingProviders: session.providers.filter(
        p => !completedProviderIds.includes(p)
      ),
      totalAds: session.providers.length,
      completedAds: session.completedProviders.length,
      combinedReward: session.combinedReward,
      minTimePerAd: session.minTimePerAd,
      timeRemainingMs: session.status === 'pending' ? timeRemaining : 0,
      timeRemainingSeconds: session.status === 'pending' ? Math.ceil(timeRemaining / 1000) : 0
    });
  } catch (error) {
    console.error('Get peered session status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get ad history
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const sessions = await AdSession.find({
      user: req.user._id,
      status: 'completed'
    })
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AdSession.countDocuments({
      user: req.user._id,
      status: 'completed'
    });

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStats = await AdSession.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          completedAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalEarnings: { $sum: '$reward' }
        }
      }
    ]);

    res.json({
      sessions,
      todayStats: {
        count: todayStats[0]?.count || 0,
        earnings: todayStats[0]?.totalEarnings || 0
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get ad history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
