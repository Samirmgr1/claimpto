/**
 * ActionToken Model
 * 
 * Server-issued, single-use, action-bound tokens for secure reward flows.
 * 
 * SECURITY ARCHITECTURE:
 * - Tokens are issued by the server, not the client
 * - Each token is bound to a specific user, action, and context
 * - Tokens can only be consumed ONCE (atomic consumption)
 * - Tokens expire after a short TTL
 * - Minimum time enforcement prevents instant replay
 * - HMAC signature prevents token forgery
 * 
 * ATTACK VECTORS MITIGATED:
 * - Replay attacks: Token is deleted on consumption
 * - Token harvesting: Short TTL + action binding
 * - Script automation: Server-enforced minimum time
 * - Token forgery: HMAC signature verification
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const ACTION_TYPES = {
  FAUCET_CLAIM: 'faucet_claim',
  AD_WATCH: 'ad_watch',
  AD_COMPLETE: 'ad_complete',
  TASK_SUBMIT: 'task_submit',
  WITHDRAWAL: 'withdrawal',
  PEERED_AD_SESSION: 'peered_ad_session'
};

const ActionTokenSchema = new mongoose.Schema({
  // Unique token identifier (cryptographically random)
  tokenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User this token is bound to (CANNOT be used by another user)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Action type this token authorizes
  actionType: {
    type: String,
    required: true,
    enum: Object.values(ACTION_TYPES),
    index: true
  },
  
  // Action-specific context (e.g., provider ID, task ID, amount)
  // This binds the token to a specific action instance
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // HMAC signature of (tokenId + userId + actionType + context + issuedAt)
  // Prevents token tampering even if attacker has DB read access
  signature: {
    type: String,
    required: true
  },
  
  // When the token was issued (for minimum time enforcement)
  issuedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // When the token expires (absolute deadline)
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  // Minimum time (in seconds) that must pass before token can be consumed
  // This is server-enforced, not client-side
  minTimeSeconds: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Whether the token has been consumed
  // This is a soft-delete flag for audit purposes
  consumed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // When the token was consumed (for audit trail)
  consumedAt: {
    type: Date,
    default: null
  },
  
  // IP address when token was issued (for forensics, not security)
  issuedFromIp: {
    type: String,
    default: null
  },
  
  // IP address when token was consumed (for forensics, not security)
  consumedFromIp: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
ActionTokenSchema.index({ userId: 1, actionType: 1, consumed: 1 });

// TTL index for automatic cleanup of expired tokens
// MongoDB will automatically delete documents where expiresAt < now
ActionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for finding unconsumed tokens for a user/action
ActionTokenSchema.index({ userId: 1, actionType: 1, consumed: 1, expiresAt: 1 });

/**
 * Generate a cryptographically secure token ID
 */
ActionTokenSchema.statics.generateTokenId = function() {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate HMAC signature for token verification
 */
ActionTokenSchema.statics.generateSignature = function(tokenId, userId, actionType, context, issuedAt) {
  const secret = process.env.ACTION_TOKEN_SECRET || process.env.JWT_SECRET;
  const payload = JSON.stringify({
    tokenId,
    userId: userId.toString(),
    actionType,
    context,
    issuedAt: issuedAt.toISOString()
  });
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

/**
 * Verify HMAC signature
 */
ActionTokenSchema.methods.verifySignature = function() {
  const expectedSignature = this.constructor.generateSignature(
    this.tokenId,
    this.userId,
    this.actionType,
    this.context,
    this.issuedAt
  );
  return crypto.timingSafeEqual(
    Buffer.from(this.signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

/**
 * Check if token can be consumed (time check)
 */
ActionTokenSchema.methods.canBeConsumed = function() {
  const now = Date.now();
  const issuedTime = this.issuedAt.getTime();
  const minTimePassed = (now - issuedTime) >= (this.minTimeSeconds * 1000);
  const notExpired = now < this.expiresAt.getTime();
  const notConsumed = !this.consumed;
  
  return {
    canConsume: minTimePassed && notExpired && notConsumed,
    minTimePassed,
    notExpired,
    notConsumed,
    remainingMinTime: Math.max(0, (this.minTimeSeconds * 1000) - (now - issuedTime)) / 1000,
    remainingTTL: Math.max(0, this.expiresAt.getTime() - now) / 1000
  };
};

/**
 * ATOMIC token consumption using findOneAndUpdate
 * 
 * This is the CRITICAL security function.
 * It ensures that even if two requests arrive simultaneously,
 * only ONE will succeed in consuming the token.
 * 
 * @param {string} tokenId - The token to consume
 * @param {ObjectId} userId - The user attempting to consume
 * @param {string} actionType - The expected action type
 * @param {object} expectedContext - Optional context to verify (partial match)
 * @param {string} consumedFromIp - IP address of consumer
 * @returns {object} { success, token, error }
 */
ActionTokenSchema.statics.consumeToken = async function(tokenId, userId, actionType, expectedContext = null, consumedFromIp = null) {
  const now = new Date();
  
  // Build the query for atomic update
  const query = {
    tokenId,
    userId,
    actionType,
    consumed: false,
    expiresAt: { $gt: now }
  };
  
  // Add context matching if provided
  if (expectedContext) {
    for (const [key, value] of Object.entries(expectedContext)) {
      query[`context.${key}`] = value;
    }
  }
  
  // Atomic update: find the token and mark it as consumed in one operation
  // This prevents race conditions where two requests could consume the same token
  const token = await this.findOneAndUpdate(
    query,
    {
      $set: {
        consumed: true,
        consumedAt: now,
        consumedFromIp
      }
    },
    {
      new: false, // Return the original document (before update)
      // Note: We return the original to verify minTime AFTER the atomic claim
    }
  );
  
  if (!token) {
    // Token not found or already consumed
    return {
      success: false,
      token: null,
      error: 'TOKEN_INVALID_OR_CONSUMED'
    };
  }
  
  // Verify signature to detect tampering
  if (!token.verifySignature()) {
    // Token was tampered with - this is a serious security event
    console.error(`[SECURITY] Token signature verification failed: ${tokenId}`);
    return {
      success: false,
      token: null,
      error: 'TOKEN_SIGNATURE_INVALID'
    };
  }
  
  // Check minimum time (server-enforced)
  const consumeCheck = token.canBeConsumed();
  if (!consumeCheck.minTimePassed) {
    // Token was consumed too quickly - this is a script attack indicator
    // We've already marked it as consumed (intentionally) to prevent retry
    console.warn(`[SECURITY] Token consumed too quickly: ${tokenId}, remaining: ${consumeCheck.remainingMinTime}s`);
    return {
      success: false,
      token: null,
      error: 'TOKEN_MIN_TIME_NOT_PASSED',
      remainingSeconds: consumeCheck.remainingMinTime
    };
  }
  
  return {
    success: true,
    token,
    error: null
  };
};

/**
 * Issue a new action token
 * 
 * @param {ObjectId} userId - User to issue token for
 * @param {string} actionType - Type of action
 * @param {object} context - Action-specific context
 * @param {number} minTimeSeconds - Minimum seconds before consumption allowed
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {string} issuedFromIp - IP address of requester
 * @returns {object} The created token
 */
ActionTokenSchema.statics.issueToken = async function(userId, actionType, context = {}, minTimeSeconds = 0, ttlSeconds = 300, issuedFromIp = null) {
  const tokenId = this.generateTokenId();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + (ttlSeconds * 1000));
  
  const signature = this.generateSignature(tokenId, userId, actionType, context, issuedAt);
  
  // Check for existing unconsumed tokens for this user/action
  // This prevents token accumulation attacks
  const existingToken = await this.findOne({
    userId,
    actionType,
    consumed: false,
    expiresAt: { $gt: new Date() }
  });
  
  if (existingToken) {
    // Invalidate the old token
    await this.updateOne(
      { _id: existingToken._id },
      { $set: { consumed: true, consumedAt: new Date() } }
    );
  }
  
  const token = await this.create({
    tokenId,
    userId,
    actionType,
    context,
    signature,
    issuedAt,
    expiresAt,
    minTimeSeconds,
    issuedFromIp
  });
  
  return token;
};

/**
 * Cleanup expired tokens (called periodically)
 * Note: MongoDB TTL index handles this automatically, but this can be called for immediate cleanup
 */
ActionTokenSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

/**
 * Get token statistics for monitoring
 */
ActionTokenSchema.statics.getStats = async function() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const [active, consumed, expired, issuedLastHour] = await Promise.all([
    this.countDocuments({ consumed: false, expiresAt: { $gt: now } }),
    this.countDocuments({ consumed: true }),
    this.countDocuments({ expiresAt: { $lt: now }, consumed: false }),
    this.countDocuments({ issuedAt: { $gt: oneHourAgo } })
  ]);
  
  return { active, consumed, expired, issuedLastHour };
};

const ActionToken = mongoose.model('ActionToken', ActionTokenSchema);

module.exports = ActionToken;
module.exports.ACTION_TYPES = ACTION_TYPES;
