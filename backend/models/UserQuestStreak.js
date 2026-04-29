const mongoose = require('mongoose');

/**
 * UserQuestStreak - Tracks daily quest completion streaks
 * 
 * A user gets a streak day when ALL daily quests for that day are completed and claimed.
 */
const userQuestStreakSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Current consecutive days streak
  currentStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // All-time longest streak
  longestStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Last date (UTC string) when all quests were completed
  lastCompletedDate: {
    type: String,
    default: null
  },
  
  // Track which streak milestones have been claimed (7, 14, 30, etc.)
  claimedMilestones: [{
    type: Number
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('UserQuestStreak', userQuestStreakSchema);

