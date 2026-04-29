const mongoose = require('mongoose');

/**
 * UserDailyQuest - Tracks per-user daily quest progress
 * 
 * A new document is created for each user+template+date combination.
 * The 'date' field uses UTC date string (e.g., "2026-03-18") for easy grouping.
 */
const userDailyQuestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DailyQuestTemplate',
    required: true
  },
  
  // UTC date string "YYYY-MM-DD" for the quest day
  date: {
    type: String,
    required: true
  },
  
  // Snapshot from template at creation time
  questType: {
    type: String,
    required: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  description: {
    type: String,
    default: ''
  },
  
  icon: {
    type: String,
    default: '⭐'
  },
  
  targetCount: {
    type: Number,
    required: true,
    min: 1
  },
  
  reward: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Current progress count
  progress: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Whether targetCount has been reached
  completed: {
    type: Boolean,
    default: false
  },
  
  // Whether reward has been claimed
  claimed: {
    type: Boolean,
    default: false
  },
  
  completedAt: {
    type: Date,
    default: null
  },
  
  claimedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound unique index: one quest per user per template per day
userDailyQuestSchema.index({ userId: 1, templateId: 1, date: 1 }, { unique: true });
// Fast lookup for user's daily quests
userDailyQuestSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('UserDailyQuest', userDailyQuestSchema);

