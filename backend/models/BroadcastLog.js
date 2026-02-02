const mongoose = require('mongoose');

const broadcastLogSchema = new mongoose.Schema({
  // Broadcast identification
  broadcastId: {
    type: String,
    required: true,
    unique: true,
    default: () => `BC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Message content
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['announcement', 'system', 'promotion', 'update', 'urgent'],
    default: 'announcement'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Delivery statistics
  stats: {
    totalTargeted: { type: Number, default: 0 },      // Total users targeted
    totalSent: { type: Number, default: 0 },          // Successfully sent
    totalFailed: { type: Number, default: 0 },        // Failed to send
    totalBlocked: { type: Number, default: 0 },       // Users who blocked the bot
    totalSkipped: { type: Number, default: 0 },       // Skipped (inactive/blocked)
    deliveryRate: { type: Number, default: 0 }        // Percentage success
  },
  
  // Timing information
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Errors encountered (sample for debugging)
  errors: [{
    telegramId: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    error: String,
    errorCode: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Blocked users detected during this broadcast
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Admin who initiated
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Additional metadata
  metadata: {
    channel: { type: String, default: 'telegram' },
    batchSize: { type: Number, default: 25 },
    delayBetweenBatches: { type: Number, default: 1000 },
    retryAttempts: { type: Number, default: 0 }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster queries
broadcastLogSchema.index({ createdAt: -1 });
broadcastLogSchema.index({ status: 1, createdAt: -1 });
broadcastLogSchema.index({ broadcastId: 1 });

// Virtual for formatted duration
broadcastLogSchema.virtual('formattedDuration').get(function() {
  if (!this.durationSeconds) return 'N/A';
  const minutes = Math.floor(this.durationSeconds / 60);
  const seconds = this.durationSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
});

// Method to update stats
broadcastLogSchema.methods.updateStats = function(sent, failed, blocked, skipped) {
  this.stats.totalSent = sent;
  this.stats.totalFailed = failed;
  this.stats.totalBlocked = blocked;
  this.stats.totalSkipped = skipped;
  
  const totalAttempted = sent + failed;
  this.stats.deliveryRate = totalAttempted > 0 
    ? Math.round((sent / totalAttempted) * 100) 
    : 0;
};

// Method to complete broadcast
broadcastLogSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.durationSeconds = Math.round((this.completedAt - this.startedAt) / 1000);
};

module.exports = mongoose.model('BroadcastLog', broadcastLogSchema);
