/**
 * PeeredAdSession Model
 * 
 * Tracks multi-ad peered sessions with security features.
 * 
 * SECURITY ARCHITECTURE:
 * - Sessions are server-issued and bound to specific users
 * - Each ad completion is tracked atomically
 * - Minimum watch time is enforced per-ad
 * - HMAC signature prevents session tampering
 * - TTL ensures automatic cleanup
 * 
 * FLOW:
 * 1. User clicks a peered ad group
 * 2. Server creates PeeredAdSession with all providers
 * 3. User watches each ad in sequence
 * 4. Server records each completion with atomic update
 * 5. When all ads completed, combined reward is granted
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const PeeredAdSessionSchema = new mongoose.Schema({
  // Unique session identifier (cryptographically random)
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User this session belongs to
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Peer group index (for reference)
  groupIndex: {
    type: Number,
    required: true
  },
  
  // List of all providers in this peered group
  providers: [{
    type: String,
    required: true
  }],
  
  // Provider configurations (for displaying ads)
  providersConfig: [{
    id: String,
    reward: Number,
    config: mongoose.Schema.Types.Mixed
  }],
  
  // List of completed providers
  completedProviders: [{
    providerId: String,
    completedAt: Date
  }],
  
  // Combined reward for completing all ads
  combinedReward: {
    type: Number,
    required: true
  },
  
  // HMAC signature for verification
  signature: {
    type: String,
    required: true
  },
  
  // Minimum time per ad (seconds)
  minTimePerAd: {
    type: Number,
    required: true,
    default: 5
  },
  
  // Session status
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // When session was created
  createdAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // When session was completed (all ads watched)
  completedAt: {
    type: Date
  },
  
  // IP for forensics
  ipAddress: {
    type: String
  },
  
  // User agent for forensics
  userAgent: {
    type: String
  }
}, { timestamps: true });

// TTL index - auto-delete expired sessions after 15 minutes
PeeredAdSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

// Compound index for efficient queries
PeeredAdSessionSchema.index({ user: 1, status: 1 });

/**
 * Generate HMAC signature for session verification
 */
PeeredAdSessionSchema.methods.generateSignature = function() {
  const secret = process.env.PEERED_SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-me';
  
  const data = JSON.stringify({
    sessionId: this.sessionId,
    userId: this.user.toString(),
    groupIndex: this.groupIndex,
    providers: this.providers,
    combinedReward: this.combinedReward,
    createdAt: this.createdAt.toISOString()
  });
  
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify session signature
 */
PeeredAdSessionSchema.methods.verifySignature = function() {
  const expectedSignature = this.generateSignature();
  
  // Constant-time comparison to prevent timing attacks
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
 * Check if a provider can be marked as completed
 */
PeeredAdSessionSchema.methods.canCompleteProvider = function(providerId) {
  // Check if session is still pending
  if (this.status !== 'pending') {
    return { allowed: false, error: 'SESSION_NOT_PENDING' };
  }
  
  // Check if session has expired (10 minutes)
  const sessionAge = Date.now() - this.createdAt.getTime();
  if (sessionAge > 10 * 60 * 1000) {
    return { allowed: false, error: 'SESSION_EXPIRED' };
  }
  
  // Check if provider is in this group
  if (!this.providers.includes(providerId)) {
    return { allowed: false, error: 'PROVIDER_NOT_IN_GROUP' };
  }
  
  // Check if provider already completed
  const alreadyCompleted = this.completedProviders.some(
    cp => cp.providerId === providerId
  );
  if (alreadyCompleted) {
    return { allowed: false, error: 'PROVIDER_ALREADY_COMPLETED' };
  }
  
  // Check minimum time since session start for first provider
  // Or minimum time since last completion for subsequent providers
  if (this.completedProviders.length === 0) {
    const timeElapsed = Math.floor(sessionAge / 1000);
    if (timeElapsed < this.minTimePerAd) {
      return { 
        allowed: false, 
        error: 'MIN_TIME_NOT_PASSED',
        remainingSeconds: this.minTimePerAd - timeElapsed
      };
    }
  } else {
    // Check time since last completion
    const lastCompletion = this.completedProviders[this.completedProviders.length - 1];
    const timeSinceLastCompletion = Math.floor((Date.now() - lastCompletion.completedAt.getTime()) / 1000);
    if (timeSinceLastCompletion < this.minTimePerAd) {
      return {
        allowed: false,
        error: 'MIN_TIME_NOT_PASSED',
        remainingSeconds: this.minTimePerAd - timeSinceLastCompletion
      };
    }
  }
  
  return { allowed: true };
};

/**
 * Atomically mark a provider as completed
 * Returns the updated session or null if conditions not met
 */
PeeredAdSessionSchema.statics.completeProvider = async function(sessionId, userId, providerId) {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  // Atomic update: only if session is pending, provider not already completed
  const session = await this.findOneAndUpdate(
    {
      sessionId,
      user: userId,
      status: 'pending',
      createdAt: { $gte: tenMinutesAgo },
      providers: providerId,
      'completedProviders.providerId': { $ne: providerId }
    },
    {
      $push: {
        completedProviders: {
          providerId,
          completedAt: now
        }
      }
    },
    { new: true }
  );
  
  if (!session) {
    // Session not found or conditions not met - determine why
    const existingSession = await this.findOne({ sessionId, user: userId });
    
    if (!existingSession) {
      return { success: false, error: 'SESSION_NOT_FOUND' };
    }
    
    if (existingSession.status !== 'pending') {
      return { success: false, error: 'SESSION_ALREADY_COMPLETED' };
    }
    
    if (existingSession.completedProviders.some(cp => cp.providerId === providerId)) {
      return { success: false, error: 'PROVIDER_ALREADY_COMPLETED' };
    }
    
    if (!existingSession.providers.includes(providerId)) {
      return { success: false, error: 'PROVIDER_NOT_IN_GROUP' };
    }
    
    // Session expired
    return { success: false, error: 'SESSION_EXPIRED' };
  }
  
  // Check if all providers are now completed
  const allCompleted = session.providers.every(
    p => session.completedProviders.some(cp => cp.providerId === p)
  );
  
  return { 
    success: true, 
    session,
    allCompleted,
    completedCount: session.completedProviders.length,
    totalCount: session.providers.length
  };
};

/**
 * Mark session as fully completed
 */
PeeredAdSessionSchema.statics.markCompleted = async function(sessionId, userId) {
  return await this.findOneAndUpdate(
    {
      sessionId,
      user: userId,
      status: 'pending'
    },
    {
      $set: {
        status: 'completed',
        completedAt: new Date()
      }
    },
    { new: true }
  );
};

/**
 * Create a new peered session, invalidating any previous pending sessions
 */
PeeredAdSessionSchema.statics.createSession = async function(
  userId,
  groupIndex,
  providers,
  providersConfig,
  combinedReward,
  minTimePerAd,
  ipAddress,
  userAgent
) {
  // Invalidate any previous pending peered sessions for this user
  await this.updateMany(
    { user: userId, status: 'pending' },
    { $set: { status: 'expired' } }
  );
  
  // Generate cryptographically random session ID
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  const session = new this({
    sessionId,
    user: userId,
    groupIndex,
    providers,
    providersConfig,
    completedProviders: [],
    combinedReward,
    minTimePerAd,
    createdAt: new Date(),
    ipAddress,
    userAgent,
    status: 'pending'
  });
  
  // Generate and store signature
  session.signature = session.generateSignature();
  
  await session.save();
  
  return session;
};

module.exports = mongoose.model('PeeredAdSession', PeeredAdSessionSchema);
