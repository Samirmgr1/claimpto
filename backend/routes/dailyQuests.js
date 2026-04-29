const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { 
  ACTION_TYPES, 
  issueActionToken, 
  consumeActionToken 
} = require('../middleware/actionToken');
const User = require('../models/User');
const Earning = require('../models/Earning');
const Settings = require('../models/Settings');
const DailyQuestTemplate = require('../models/DailyQuestTemplate');
const UserDailyQuest = require('../models/UserDailyQuest');
const UserQuestStreak = require('../models/UserQuestStreak');
const { awardReferralCommission } = require('../middleware/referralReward');

// ============================================
// LICENSE INTEGRATION (distributed enforcement)
// ============================================
const { getLicenseConstants } = require('../utils/licenseValidator');

function applyLicenseMultiplier(amount) {
  const constants = getLicenseConstants();
  if (!constants) return 0;
  return amount * constants.payoutMultiplier;
}

// ============================================
// DAILY QUESTS SETTINGS CACHE
// ============================================
const QUEST_SETTINGS_CACHE = {
  data: null,
  lastFetch: 0,
  ttl: 30 * 1000 // 30 seconds
};

const QUEST_SETTINGS_KEYS = [
  'daily_quests_enabled',
  'daily_quest_streak_bonus_7d',
  'daily_quest_streak_bonus_14d',
  'daily_quest_streak_bonus_30d'
];

async function getCachedQuestSettings() {
  const now = Date.now();
  if (QUEST_SETTINGS_CACHE.data && (now - QUEST_SETTINGS_CACHE.lastFetch) < QUEST_SETTINGS_CACHE.ttl) {
    return QUEST_SETTINGS_CACHE.data;
  }
  
  const settings = await Settings.find({ key: { $in: QUEST_SETTINGS_KEYS } }).lean();
  const settingsObj = {};
  settings.forEach(s => { settingsObj[s.key] = s.value; });
  
  const result = {
    enabled: settingsObj.daily_quests_enabled !== false,
    streakBonus7d: parseFloat(settingsObj.daily_quest_streak_bonus_7d || 0.5),
    streakBonus14d: parseFloat(settingsObj.daily_quest_streak_bonus_14d || 1.5),
    streakBonus30d: parseFloat(settingsObj.daily_quest_streak_bonus_30d || 5.0)
  };
  
  QUEST_SETTINGS_CACHE.data = result;
  QUEST_SETTINGS_CACHE.lastFetch = now;
  return result;
}

// Cache invalidation (called by admin settings update)
function invalidateQuestSettingsCache() {
  QUEST_SETTINGS_CACHE.data = null;
  QUEST_SETTINGS_CACHE.lastFetch = 0;
}

// ============================================
// HELPERS
// ============================================

/**
 * Get today's UTC date string
 */
function getTodayUTC() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

/**
 * Get yesterday's UTC date string
 */
function getYesterdayUTC() {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().split('T')[0];
}

/**
 * Get milliseconds until midnight UTC (for countdown timer)
 */
function getMsUntilReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

/**
 * Initialize today's quests for a user from active templates
 * Returns the user's quests for today
 */
async function initializeDailyQuests(userId) {
  const today = getTodayUTC();
  
  // Get active templates
  const templates = await DailyQuestTemplate.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  
  if (templates.length === 0) return [];
  
  // Check which quests already exist for today
  const existingQuests = await UserDailyQuest.find({ userId, date: today }).lean();
  const existingTemplateIds = new Set(existingQuests.map(q => q.templateId.toString()));
  
  // Create missing quests
  const newQuests = [];
  for (const template of templates) {
    if (!existingTemplateIds.has(template._id.toString())) {
      newQuests.push({
        userId,
        templateId: template._id,
        date: today,
        questType: template.questType,
        title: template.title,
        description: template.description,
        icon: template.icon,
        targetCount: template.targetCount,
        reward: template.reward,
        progress: 0,
        completed: false,
        claimed: false
      });
    }
  }
  
  if (newQuests.length > 0) {
    try {
      await UserDailyQuest.insertMany(newQuests, { ordered: false });
    } catch (err) {
      // Ignore duplicate key errors (race condition safe)
      if (err.code !== 11000) throw err;
    }
  }
  
  // Return all of today's quests
  return UserDailyQuest.find({ userId, date: today }).sort({ createdAt: 1 }).lean();
}

/**
 * Progress a quest for a user (called from other routes)
 * This is the main integration point.
 * 
 * @param {ObjectId} userId - User ID
 * @param {string} questType - One of the quest type enums
 * @param {number} incrementBy - Amount to increment (default 1)
 */
async function progressQuest(userId, questType, incrementBy = 1) {
  try {
    const settings = await getCachedQuestSettings();
    if (!settings.enabled) return;
    
    const today = getTodayUTC();
    
    // Find uncompleted quests of this type for today
    const quests = await UserDailyQuest.find({
      userId,
      date: today,
      questType,
      completed: false
    });
    
    for (const quest of quests) {
      const newProgress = Math.min(quest.progress + incrementBy, quest.targetCount);
      const isCompleted = newProgress >= quest.targetCount;
      
      await UserDailyQuest.findByIdAndUpdate(quest._id, {
        $set: {
          progress: newProgress,
          completed: isCompleted,
          ...(isCompleted ? { completedAt: new Date() } : {})
        }
      });
    }
  } catch (error) {
    // Non-blocking: quest progress failure shouldn't break main flow
    console.error('Quest progress error:', error);
  }
}

/**
 * Check and update streak after all quests are claimed
 */
async function updateStreak(userId) {
  try {
    const today = getTodayUTC();
    const yesterday = getYesterdayUTC();
    
    // Check if ALL of today's quests are claimed
    const todayQuests = await UserDailyQuest.find({ userId, date: today }).lean();
    if (todayQuests.length === 0) return null;
    
    const allClaimed = todayQuests.every(q => q.claimed);
    if (!allClaimed) return null;
    
    // Get or create streak record
    let streak = await UserQuestStreak.findOne({ userId });
    if (!streak) {
      streak = new UserQuestStreak({ userId, currentStreak: 0, longestStreak: 0 });
    }
    
    // Already processed today
    if (streak.lastCompletedDate === today) return streak;
    
    // Check if streak continues (yesterday was the last completed date)
    if (streak.lastCompletedDate === yesterday) {
      streak.currentStreak += 1;
    } else {
      // Streak broken - start fresh
      streak.currentStreak = 1;
    }
    
    streak.lastCompletedDate = today;
    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }
    
    await streak.save();
    return streak;
  } catch (error) {
    console.error('Streak update error:', error);
    return null;
  }
}

// ============================================
// STREAK MILESTONES
// ============================================
const STREAK_MILESTONES = [7, 14, 30];

function getAvailableMilestone(streak) {
  if (!streak) return null;
  for (const milestone of STREAK_MILESTONES) {
    if (streak.currentStreak >= milestone && !streak.claimedMilestones?.includes(milestone)) {
      return milestone;
    }
  }
  return null;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /daily-quests
 * Returns today's quests for the user, plus streak info
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const settings = await getCachedQuestSettings();
    
    if (!settings.enabled) {
      return res.json({
        enabled: false,
        quests: [],
        streak: { currentStreak: 0, longestStreak: 0 },
        resetIn: getMsUntilReset()
      });
    }
    
    const userId = req.user._id;
    
    // Initialize and get today's quests
    const quests = await initializeDailyQuests(userId);
    
    // Get streak info
    let streak = await UserQuestStreak.findOne({ userId }).lean();
    if (!streak) {
      streak = { currentStreak: 0, longestStreak: 0, claimedMilestones: [] };
    }
    
    // Check if streak is stale (missed yesterday)
    const yesterday = getYesterdayUTC();
    const today = getTodayUTC();
    if (streak.lastCompletedDate && streak.lastCompletedDate !== today && streak.lastCompletedDate !== yesterday) {
      // Streak is broken
      streak.currentStreak = 0;
    }
    
    // Calculate summary
    const totalQuests = quests.length;
    const completedQuests = quests.filter(q => q.completed).length;
    const claimedQuests = quests.filter(q => q.claimed).length;
    const allCompleted = totalQuests > 0 && completedQuests === totalQuests;
    const allClaimed = totalQuests > 0 && claimedQuests === totalQuests;
    
    // Check for available streak milestone
    const availableMilestone = allClaimed ? getAvailableMilestone(streak) : null;
    
    // Milestone bonuses
    const milestones = STREAK_MILESTONES.map(m => ({
      days: m,
      reward: m === 7 ? settings.streakBonus7d : m === 14 ? settings.streakBonus14d : settings.streakBonus30d,
      claimed: streak.claimedMilestones?.includes(m) || false,
      available: streak.currentStreak >= m && !streak.claimedMilestones?.includes(m)
    }));
    
    res.json({
      enabled: true,
      quests,
      streak: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastCompletedDate: streak.lastCompletedDate
      },
      summary: {
        total: totalQuests,
        completed: completedQuests,
        claimed: claimedQuests,
        allCompleted,
        allClaimed
      },
      milestones,
      availableMilestone,
      resetIn: getMsUntilReset(),
      date: getTodayUTC()
    });
  } catch (error) {
    console.error('Get daily quests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /daily-quests/:questId/claim/start
 * Issue action token for claiming a completed quest
 */
router.post('/:questId/claim/start', authenticateUser, async (req, res) => {
  try {
    const { questId } = req.params;
    const userId = req.user._id;
    
    const quest = await UserDailyQuest.findOne({
      _id: questId,
      userId,
      completed: true,
      claimed: false
    });
    
    if (!quest) {
      return res.status(400).json({ message: 'Quest not found, not completed, or already claimed' });
    }
    
    const token = await issueActionToken(
      userId,
      ACTION_TYPES.DAILY_QUEST_CLAIM,
      { questId: questId },
      req
    );
    
    res.json({
      token: token.tokenId,
      expiresAt: token.expiresAt,
      minTimeSeconds: token.minTimeSeconds
    });
  } catch (error) {
    console.error('Quest claim start error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /daily-quests/:questId/claim
 * Consume action token and credit quest reward
 */
router.post('/:questId/claim', authenticateUser, async (req, res) => {
  try {
    const { questId } = req.params;
    const { actionToken } = req.body;
    const userId = req.user._id;
    
    // Consume action token atomically
    const tokenResult = await consumeActionToken(
      actionToken,
      userId,
      ACTION_TYPES.DAILY_QUEST_CLAIM,
      { questId },
      req
    );
    
    if (!tokenResult.success) {
      const statusCode = tokenResult.error === 'TOKEN_MIN_TIME_NOT_PASSED' ? 429 : 403;
      return res.status(statusCode).json({
        message: tokenResult.error === 'TOKEN_MIN_TIME_NOT_PASSED' 
          ? `Please wait ${Math.ceil(tokenResult.remainingSeconds)} more seconds`
          : 'Invalid or expired session. Please try again.',
        error: tokenResult.error
      });
    }
    
    // Atomically mark quest as claimed (prevents double-claim)
    const quest = await UserDailyQuest.findOneAndUpdate(
      {
        _id: questId,
        userId,
        completed: true,
        claimed: false
      },
      {
        $set: { claimed: true, claimedAt: new Date() }
      },
      { new: true }
    );
    
    if (!quest) {
      return res.status(400).json({ message: 'Quest already claimed or not completed' });
    }
    
    // Apply license multiplier to reward
    const reward = applyLicenseMultiplier(quest.reward);
    
    // Credit reward atomically
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: reward, totalEarnings: reward } },
      { new: true }
    );
    
    // Create earning record (async, non-blocking)
    const earning = new Earning({
      user: userId,
      type: 'daily_quest',
      amount: reward,
      description: `Daily Quest: ${quest.title}`
    });
    earning.save().catch(err => console.error('Quest earning save error:', err));
    
    // Award referral commission (async, non-blocking)
    awardReferralCommission(userId, reward, 'daily_quest').catch(err =>
      console.error('Quest referral commission error:', err)
    );
    
    // Check and update streak
    const streak = await updateStreak(userId);
    
    res.json({
      message: 'Quest reward claimed!',
      reward,
      balance: updatedUser.balance,
      streak: streak ? {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak
      } : null
    });
  } catch (error) {
    console.error('Quest claim error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /daily-quests/streak-bonus/claim
 * Claim a streak milestone bonus
 */
router.post('/streak-bonus/claim', authenticateUser, async (req, res) => {
  try {
    const { milestone } = req.body;
    const userId = req.user._id;
    
    if (!STREAK_MILESTONES.includes(milestone)) {
      return res.status(400).json({ message: 'Invalid milestone' });
    }
    
    const streak = await UserQuestStreak.findOne({ userId });
    if (!streak || streak.currentStreak < milestone) {
      return res.status(400).json({ message: 'Streak milestone not reached' });
    }
    
    if (streak.claimedMilestones?.includes(milestone)) {
      return res.status(400).json({ message: 'Milestone already claimed' });
    }
    
    const settings = await getCachedQuestSettings();
    let bonusAmount = 0;
    if (milestone === 7) bonusAmount = settings.streakBonus7d;
    else if (milestone === 14) bonusAmount = settings.streakBonus14d;
    else if (milestone === 30) bonusAmount = settings.streakBonus30d;
    
    const reward = applyLicenseMultiplier(bonusAmount);
    
    // Mark milestone as claimed
    await UserQuestStreak.findByIdAndUpdate(streak._id, {
      $addToSet: { claimedMilestones: milestone }
    });
    
    // Credit reward
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: reward, totalEarnings: reward } },
      { new: true }
    );
    
    // Earning record
    const earning = new Earning({
      user: userId,
      type: 'daily_quest',
      amount: reward,
      description: `${milestone}-day streak bonus! 🔥`
    });
    earning.save().catch(err => console.error('Streak bonus earning save error:', err));
    
    // Referral commission
    awardReferralCommission(userId, reward, 'daily_quest').catch(err =>
      console.error('Streak bonus referral error:', err)
    );
    
    res.json({
      message: `🔥 ${milestone}-day streak bonus claimed!`,
      reward,
      balance: updatedUser.balance,
      milestone
    });
  } catch (error) {
    console.error('Streak bonus claim error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export router and helper for use in other routes
module.exports = router;
module.exports.progressQuest = progressQuest;
module.exports.invalidateQuestSettingsCache = invalidateQuestSettingsCache;

