const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * AdSession Model - Enhanced with Security Features
 * 
 * SECURITY FEATURES:
 * 1. Atomic status transitions (findOneAndUpdate)
 * 2. Server-enforced minimum watch time
 * 3. HMAC signature to prevent tampering
 * 4. Single-use sessions (cannot complete twice)
 */

const adSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  provider: {
    type: String,
    enum: ['adsgram', 'monetag', 'adextra', 'adexora'],
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  reward: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  // SECURITY: Minimum time (seconds) that must pass before completion
  minWatchTimeSeconds: {
    type: Number,
    default: 10 // Default 10 seconds minimum watch time
  },
  // SECURITY: HMAC signature of session data
  signature: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  // SECURITY: Track completion IP for forensics
  completedFromIp: {
    type: String,
    default: null
  }
});

// Compound indexes for security queries
adSessionSchema.index({ user: 1, provider: 1, createdAt: -1 });
adSessionSchema.index({ user: 1, status: 1, createdAt: -1 });
adSessionSchema.index({ user: 1, status: 1, completedAt: -1 });

// TTL index to auto-expire old pending sessions (1 hour)
adSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

/**
 * Generate a cryptographically secure session ID
 */
adSessionSchema.statics.generateSessionId = function() {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate HMAC signature for session verification
 */
adSessionSchema.statics.generateSignature = function(sessionId, userId, provider, reward, createdAt) {
  const secret = process.env.AD_SESSION_SECRET || process.env.JWT_SECRET;
  const payload = JSON.stringify({
    sessionId,
    userId: userId.toString(),
    provider,
    reward,
    createdAt: createdAt.toISOString()
  });
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

/**
 * Verify HMAC signature
 */
adSessionSchema.methods.verifySignature = function() {
  const expectedSignature = this.constructor.generateSignature(
    this.sessionId,
    this.user,
    this.provider,
    this.reward,
    this.createdAt
  );
  try {
    return crypto.timingSafeEqual(
      Buffer.from(this.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (e) {
    return false;
  }
};

/**
 * Check if session can be completed (time check)
 */
adSessionSchema.methods.canBeCompleted = function() {
  const now = Date.now();
  const createdTime = this.createdAt.getTime();
  const sessionAge = now - createdTime;
  const minTimePassed = sessionAge >= (this.minWatchTimeSeconds * 1000);
  const maxAge = 5 * 60 * 1000; // 5 minutes max
  const notExpired = sessionAge < maxAge;
  const isPending = this.status === 'pending';
  
  return {
    canComplete: minTimePassed && notExpired && isPending,
    minTimePassed,
    notExpired,
    isPending,
    remainingMinTime: Math.max(0, (this.minWatchTimeSeconds * 1000) - sessionAge) / 1000,
    sessionAge: sessionAge / 1000
  };
};

/**
 * ATOMIC session completion using findOneAndUpdate
 * 
 * This is the CRITICAL security function.
 * Ensures only ONE request can complete a session, even if simultaneous.
 * 
 * @param {string} sessionId - The session to complete
 * @param {ObjectId} userId - The user attempting to complete
 * @param {string} completedFromIp - IP address of completer
 * @returns {object} { success, session, error, remainingSeconds }
 */
adSessionSchema.statics.completeSession = async function(sessionId, userId, completedFromIp = null) {
  const now = new Date();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  const minCreatedAt = new Date(now.getTime() - maxAge);
  
  // First, atomically claim the session (change status from pending to completed)
  const session = await this.findOneAndUpdate(
    {
      sessionId,
      user: userId,
      status: 'pending',
      createdAt: { $gte: minCreatedAt }
    },
    {
      $set: {
        status: 'completed',
        completedAt: now,
        completedFromIp
      }
    },
    {
      new: false // Return original document to check minWatchTime
    }
  );
  
  if (!session) {
    return {
      success: false,
      session: null,
      error: 'SESSION_INVALID_OR_COMPLETED'
    };
  }
  
  // Verify signature to detect tampering
  if (!session.verifySignature()) {
    console.error(`[SECURITY] Ad session signature verification failed: ${sessionId}`);
    return {
      success: false,
      session: null,
      error: 'SESSION_SIGNATURE_INVALID'
    };
  }
  
  // Check minimum watch time (server-enforced)
  const completeCheck = session.canBeCompleted();
  if (!completeCheck.minTimePassed) {
    // Session was completed too quickly - this is a script attack indicator
    // We've already marked it as completed (intentionally) to prevent retry
    console.warn(`[SECURITY] Ad session completed too quickly: ${sessionId}, age: ${completeCheck.sessionAge}s, required: ${session.minWatchTimeSeconds}s`);
    return {
      success: false,
      session: null,
      error: 'SESSION_MIN_TIME_NOT_PASSED',
      remainingSeconds: completeCheck.remainingMinTime
    };
  }
  
  return {
    success: true,
    session,
    error: null
  };
};

/**
 * Create a new secure ad session
 */
adSessionSchema.statics.createSession = async function(userId, provider, reward, minWatchTimeSeconds = 10, ipAddress = null, userAgent = '') {
  const sessionId = this.generateSessionId();
  const createdAt = new Date();
  
  const signature = this.generateSignature(sessionId, userId, provider, reward, createdAt);
  
  // Invalidate any existing pending sessions for this user/provider
  // Prevents session accumulation attacks
  await this.updateMany(
    {
      user: userId,
      provider,
      status: 'pending'
    },
    {
      $set: { status: 'cancelled' }
    }
  );
  
  const session = await this.create({
    user: userId,
    provider,
    sessionId,
    reward,
    minWatchTimeSeconds,
    signature,
    ipAddress,
    userAgent,
    createdAt
  });
  
  return session;
};

module.exports = mongoose.model('AdSession', adSessionSchema);
