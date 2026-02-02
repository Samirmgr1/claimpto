/**
 * Action Token Middleware
 * 
 * This middleware provides secure, atomic action authorization.
 * 
 * SECURITY FLOW:
 * 1. Client calls /start endpoint → Server issues action token
 * 2. Client performs action (e.g., watches ad)
 * 3. Client calls /complete endpoint with token → Server atomically consumes token
 * 4. Server grants reward ONLY if token consumption succeeds
 * 
 * WHY THIS BLOCKS TERMUX/PYTHON SCRIPTS:
 * 
 * 1. Token Issuance Requirement:
 *    - Scripts cannot skip the /start step
 *    - Each action requires a fresh, server-issued token
 *    - Tokens are bound to the authenticated user
 * 
 * 2. Minimum Time Enforcement:
 *    - Server records issuedAt timestamp
 *    - Completion is rejected if minTime hasn't passed
 *    - Scripts cannot fake the passage of time
 * 
 * 3. Single-Use Tokens:
 *    - Each token can only be consumed ONCE
 *    - Atomic findOneAndUpdate prevents race conditions
 *    - Replaying the same token always fails
 * 
 * 4. Context Binding:
 *    - Tokens are bound to specific action contexts (e.g., ad provider)
 *    - Cannot reuse a token issued for one action on another
 * 
 * 5. Short TTL:
 *    - Tokens expire quickly (e.g., 5 minutes)
 *    - Harvested tokens become useless
 * 
 * 6. Signature Verification:
 *    - Even if attacker has DB read access, they cannot forge tokens
 *    - HMAC prevents tampering with token fields
 */

const ActionToken = require('../models/ActionToken');
const { ACTION_TYPES } = require('../models/ActionToken');

// Default configuration for different action types
const ACTION_CONFIG = {
  [ACTION_TYPES.FAUCET_CLAIM]: {
    minTimeSeconds: 3,      // User must wait at least 3 seconds
    ttlSeconds: 300,        // Token valid for 5 minutes
    requireContext: false
  },
  [ACTION_TYPES.AD_WATCH]: {
    minTimeSeconds: 5,      // Ad must be "watched" for at least 5 seconds
    ttlSeconds: 120,        // Token valid for 2 minutes
    requireContext: ['provider'] // Must specify which ad provider
  },
  [ACTION_TYPES.AD_COMPLETE]: {
    minTimeSeconds: 10,     // Full ad view takes at least 10 seconds
    ttlSeconds: 180,        // Token valid for 3 minutes
    requireContext: ['sessionId']
  },
  [ACTION_TYPES.TASK_SUBMIT]: {
    minTimeSeconds: 5,      // Task completion takes at least 5 seconds
    ttlSeconds: 600,        // Token valid for 10 minutes
    requireContext: ['taskId']
  },
  [ACTION_TYPES.WITHDRAWAL]: {
    minTimeSeconds: 2,      // Withdrawal confirmation
    ttlSeconds: 300,        // Token valid for 5 minutes
    requireContext: ['amount', 'methodId']
  },
  [ACTION_TYPES.PEERED_AD_SESSION]: {
    minTimeSeconds: 15,     // Peered ads take longer
    ttlSeconds: 300,        // Token valid for 5 minutes
    requireContext: ['providers']
  }
};

/**
 * Get client IP from request
 */
function getClientIp(req) {
  return req.headers['cf-connecting-ip'] || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.ip || 
         'unknown';
}

/**
 * Issue an action token
 * 
 * Usage:
 *   const token = await issueActionToken(req.user._id, ACTION_TYPES.FAUCET_CLAIM, {}, req);
 * 
 * @param {ObjectId} userId - The authenticated user
 * @param {string} actionType - Type of action from ACTION_TYPES
 * @param {object} context - Action-specific context
 * @param {Request} req - Express request for IP logging
 * @param {object} overrides - Override default config
 * @returns {object} { tokenId, expiresAt, minTimeSeconds }
 */
async function issueActionToken(userId, actionType, context = {}, req = null, overrides = {}) {
  const config = ACTION_CONFIG[actionType];
  if (!config) {
    throw new Error(`Unknown action type: ${actionType}`);
  }
  
  // Validate required context fields
  if (config.requireContext) {
    for (const field of config.requireContext) {
      if (context[field] === undefined) {
        throw new Error(`Missing required context field: ${field}`);
      }
    }
  }
  
  const minTimeSeconds = overrides.minTimeSeconds ?? config.minTimeSeconds;
  const ttlSeconds = overrides.ttlSeconds ?? config.ttlSeconds;
  const clientIp = req ? getClientIp(req) : null;
  
  const token = await ActionToken.issueToken(
    userId,
    actionType,
    context,
    minTimeSeconds,
    ttlSeconds,
    clientIp
  );
  
  return {
    tokenId: token.tokenId,
    expiresAt: token.expiresAt,
    minTimeSeconds: token.minTimeSeconds,
    issuedAt: token.issuedAt
  };
}

/**
 * Consume an action token (atomic operation)
 * 
 * Usage:
 *   const result = await consumeActionToken(tokenId, req.user._id, ACTION_TYPES.FAUCET_CLAIM, {}, req);
 *   if (!result.success) {
 *     return res.status(403).json({ error: result.error });
 *   }
 * 
 * @param {string} tokenId - The token to consume
 * @param {ObjectId} userId - The authenticated user
 * @param {string} actionType - Expected action type
 * @param {object} expectedContext - Expected context (partial match)
 * @param {Request} req - Express request for IP logging
 * @returns {object} { success, token, error, remainingSeconds }
 */
async function consumeActionToken(tokenId, userId, actionType, expectedContext = null, req = null) {
  if (!tokenId) {
    return {
      success: false,
      token: null,
      error: 'TOKEN_REQUIRED'
    };
  }
  
  const clientIp = req ? getClientIp(req) : null;
  
  return await ActionToken.consumeToken(
    tokenId,
    userId,
    actionType,
    expectedContext,
    clientIp
  );
}

/**
 * Express middleware factory for action token consumption
 * 
 * Usage:
 *   router.post('/complete', 
 *     authenticateUser, 
 *     requireActionToken(ACTION_TYPES.FAUCET_CLAIM), 
 *     faucetClaimHandler
 *   );
 * 
 * The middleware expects:
 *   - req.body.actionToken (the token ID)
 *   - req.user (from authenticateUser middleware)
 * 
 * On success, attaches req.actionToken with the consumed token data
 */
function requireActionToken(actionType, contextExtractor = null) {
  return async (req, res, next) => {
    try {
      const tokenId = req.body.actionToken;
      const userId = req.user?._id;
      
      if (!userId) {
        return res.status(401).json({
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
      }
      
      if (!tokenId) {
        return res.status(403).json({
          message: 'Action token required',
          error: 'TOKEN_REQUIRED'
        });
      }
      
      // Extract expected context from request if extractor provided
      let expectedContext = null;
      if (contextExtractor) {
        expectedContext = typeof contextExtractor === 'function' 
          ? contextExtractor(req) 
          : contextExtractor;
      }
      
      const result = await consumeActionToken(
        tokenId,
        userId,
        actionType,
        expectedContext,
        req
      );
      
      if (!result.success) {
        const statusCode = result.error === 'TOKEN_MIN_TIME_NOT_PASSED' ? 429 : 403;
        return res.status(statusCode).json({
          message: getErrorMessage(result.error),
          error: result.error,
          remainingSeconds: result.remainingSeconds
        });
      }
      
      // Attach token data to request for handler use
      req.actionToken = result.token;
      next();
    } catch (error) {
      console.error('[ActionToken] Middleware error:', error);
      return res.status(500).json({
        message: 'Action authorization failed',
        error: 'TOKEN_SYSTEM_ERROR'
      });
    }
  };
}

/**
 * Get human-readable error message
 */
function getErrorMessage(errorCode) {
  const messages = {
    'TOKEN_REQUIRED': 'Action token is required',
    'TOKEN_INVALID_OR_CONSUMED': 'Invalid or already used token',
    'TOKEN_SIGNATURE_INVALID': 'Token verification failed',
    'TOKEN_MIN_TIME_NOT_PASSED': 'Action completed too quickly',
    'TOKEN_EXPIRED': 'Token has expired',
    'AUTH_REQUIRED': 'Authentication required',
    'TOKEN_SYSTEM_ERROR': 'Token system temporarily unavailable'
  };
  return messages[errorCode] || 'Token authorization failed';
}

/**
 * Middleware to invalidate any existing tokens for an action
 * Useful when you want to ensure only one active token exists
 */
function invalidateExistingTokens(actionType) {
  return async (req, res, next) => {
    try {
      if (req.user?._id) {
        await ActionToken.updateMany(
          {
            userId: req.user._id,
            actionType,
            consumed: false
          },
          {
            $set: { consumed: true, consumedAt: new Date() }
          }
        );
      }
      next();
    } catch (error) {
      console.error('[ActionToken] Invalidation error:', error);
      next(); // Continue even if invalidation fails
    }
  };
}

/**
 * Rate limiting helper based on token issuance
 * Returns the count of tokens issued in the last X minutes
 */
async function getTokenIssuanceCount(userId, actionType, windowMinutes = 60) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  return await ActionToken.countDocuments({
    userId,
    actionType,
    issuedAt: { $gte: windowStart }
  });
}

/**
 * Check if user is being rate limited based on token usage
 */
async function checkTokenRateLimit(userId, actionType, maxPerHour = 100) {
  const count = await getTokenIssuanceCount(userId, actionType, 60);
  return {
    allowed: count < maxPerHour,
    current: count,
    limit: maxPerHour,
    resetIn: 60 // minutes
  };
}

module.exports = {
  ACTION_TYPES,
  ACTION_CONFIG,
  issueActionToken,
  consumeActionToken,
  requireActionToken,
  invalidateExistingTokens,
  getTokenIssuanceCount,
  checkTokenRateLimit,
  getClientIp
};
