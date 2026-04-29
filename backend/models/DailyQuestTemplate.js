const mongoose = require('mongoose');

const dailyQuestTemplateSchema = new mongoose.Schema({
  // Quest identification
  questType: {
    type: String,
    required: true,
    enum: [
      'faucet_claims',      // Claim faucet X times
      'ad_watches',         // Watch X ads
      'task_completions',   // Complete X tasks
      'earn_coins',         // Earn X coins total
      'make_withdrawal',    // Make a withdrawal
      'refer_friend',       // Refer a new user
      'daily_login'         // Log in today
    ]
  },
  
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    default: '',
    trim: true
  },
  
  // Emoji icon for display
  icon: {
    type: String,
    default: '⭐'
  },
  
  // How many times the action must be performed
  targetCount: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  
  // Reward for completing the quest
  reward: {
    type: Number,
    required: true,
    min: 0,
    default: 0.1
  },
  
  // Whether this quest is active
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Display ordering
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for fetching active templates
dailyQuestTemplateSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('DailyQuestTemplate', dailyQuestTemplateSchema);

