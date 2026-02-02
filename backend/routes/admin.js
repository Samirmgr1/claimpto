const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const Withdrawal = require('../models/Withdrawal');
const Earning = require('../models/Earning');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const AdSession = require('../models/AdSession');
const BroadcastLog = require('../models/BroadcastLog');
const { authenticateAdmin, requireAdmin } = require('../middleware/auth');
const { requireValidLicense, requireFreshLicense } = require('../middleware/license');
const { revalidateLicense, isLicenseValid, getLicenseState } = require('../utils/licenseValidator');
const { sendMessage, sendBroadcast, getEstimatedBroadcastTime } = require('../utils/telegramBot');

// Import earnings router to access cache invalidation
let earningsRouter = null;
let adsRouter = null;
let turnstileMiddleware = null;
let currencyUtils = null;
try {
  earningsRouter = require('./earnings');
  adsRouter = require('./ads');
  turnstileMiddleware = require('../middleware/turnstile');
  currencyUtils = require('../utils/currency');
} catch (e) {
  console.warn('Could not import routers for cache invalidation');
}

// ============================================
// LICENSE ENFORCEMENT FOR ADMIN ROUTES
// ============================================
// SECURITY: All admin routes are protected by license validation.
// Login requires fresh validation, other routes use cached state.
// DO NOT REMOVE OR BYPASS THESE CHECKS.
// ============================================

// Check if admin collection is empty (for initial setup)
router.get('/check-empty', async (req, res) => {
  try {
    const adminCount = await Admin.countDocuments();
    res.json({ isEmpty: adminCount === 0 });
  } catch (error) {
    console.error('Error checking admin collection:', error);
    res.status(500).json({ message: 'Server error', isEmpty: false });
  }
});

// Create initial admin user (only works if no admins exist)
router.post('/init-admin', async (req, res) => {
  try {
    // Check if any admin already exists
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(400).json({ 
        message: 'Admin user already exists. Cannot create initial admin.' 
      });
    }

    // Generate random password
    const generatePassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const username = 'admin';
    const password = generatePassword();

    // Create admin user
    const admin = new Admin({
      username,
      password,
      role: 'admin'
    });

    await admin.save();

    console.log('[ADMIN-INIT] Initial admin user created successfully');

    res.json({
      success: true,
      message: 'Admin user created successfully',
      credentials: {
        username,
        password
      }
    });
  } catch (error) {
    console.error('Error creating initial admin:', error);
    res.status(500).json({ message: 'Failed to create admin user' });
  }
});

// Admin login - REQUIRES FRESH LICENSE VALIDATION
router.post('/login', async (req, res) => {
  try {
    const { username, password, twoFactorCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // ============================================
    // LICENSE CHECK BEFORE LOGIN
    // ============================================
    // Fresh validation is required for admin login.
    // This ensures the license is valid before granting admin access.
    // ============================================
    console.log('[ADMIN-LOGIN] Performing license validation before login...');
    
    const licenseResult = await revalidateLicense(req);
    
    if (!licenseResult.valid) {
      console.error('[ADMIN-LOGIN] ✗ License validation failed:', licenseResult.error);
      return res.status(403).json({
        message: 'License validation failed. Admin access denied.',
        error: licenseResult.error || 'LICENSE_INVALID',
        licenseError: true
      });
    }
    
    console.log('[ADMIN-LOGIN] ✓ License valid, proceeding with authentication');
    // ============================================

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ============================================
    // TWO-FACTOR AUTHENTICATION CHECK
    // ============================================
    if (admin.twoFactorEnabled) {
      // If 2FA is enabled but no code provided, return that 2FA is required
      if (!twoFactorCode) {
        return res.status(200).json({
          twoFactorRequired: true,
          message: 'Two-factor authentication code required'
        });
      }

      // Verify the 2FA code
      const { verifyTOTP } = require('../utils/twoFactor');
      const isValidCode = verifyTOTP(admin.twoFactorSecret, twoFactorCode);
      
      if (!isValidCode) {
        // Check if it's a backup code
        const backupCodeIndex = admin.twoFactorBackupCodes.indexOf(twoFactorCode);
        if (backupCodeIndex === -1) {
          return res.status(401).json({ 
            message: 'Invalid two-factor authentication code',
            twoFactorRequired: true
          });
        }
        
        // Remove used backup code
        admin.twoFactorBackupCodes.splice(backupCodeIndex, 1);
        console.log('[ADMIN-LOGIN] Backup code used, remaining:', admin.twoFactorBackupCodes.length);
      }
    }
    // ============================================

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        twoFactorEnabled: admin.twoFactorEnabled
      },
      license: {
        valid: true,
        offline: licenseResult.offline || false
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard stats - REQUIRES VALID LICENSE
router.get('/dashboard', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const bannedUsers = await User.countDocuments({ status: 'banned' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    
    const totalEarnings = await Earning.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawals = await Withdrawal.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    const pendingWithdrawalsAmount = await Withdrawal.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingTasks = await TaskSubmission.countDocuments({ status: 'pending' });

    // Daily active users (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyActiveUsers = await User.countDocuments({
      lastLogin: { $gte: oneDayAgo }
    });

    // Weekly new users
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyNewUsers = await User.countDocuments({
      createdAt: { $gte: oneWeekAgo }
    });

    // Today's earnings by type
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEarnings = await Earning.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Ad stats for today
    const todayAdStats = await AdSession.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: today } } },
      { $group: { _id: '$provider', total: { $sum: '$reward' }, count: { $sum: 1 } } }
    ]);

    // Referral stats
    const usersWithReferrals = await User.countDocuments({ referredBy: { $ne: null } });
    const totalReferralEarnings = await Earning.aggregate([
      { $match: { type: 'referral' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // FaucetPay stats
    let faucetPayStats = { total: 0, success: 0, failed: 0 };
    try {
      const FaucetPayPayment = require('../models/FaucetPayPayment');
      const fpStats = await FaucetPayPayment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
      ]);
      fpStats.forEach(s => {
        faucetPayStats.total += s.count;
        if (s._id === 'success') faucetPayStats.success = s.count;
        if (s._id === 'failed') faucetPayStats.failed = s.count;
      });
      
      // Today's FaucetPay payments
      const todayFpPayments = await FaucetPayPayment.aggregate([
        { $match: { createdAt: { $gte: today }, status: 'success' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } }
      ]);
      faucetPayStats.todayCount = todayFpPayments[0]?.count || 0;
      faucetPayStats.todayAmount = todayFpPayments[0]?.total || 0;
    } catch (e) {
      console.error('FaucetPay stats error:', e);
    }

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        bannedUsers,
        suspendedUsers,
        dailyActiveUsers,
        weeklyNewUsers,
        totalEarnings: totalEarnings[0]?.total || 0,
        totalWithdrawals: totalWithdrawals[0]?.total || 0,
        pendingWithdrawals,
        pendingWithdrawalsAmount: pendingWithdrawalsAmount[0]?.total || 0,
        pendingTasks,
        usersWithReferrals,
        totalReferralEarnings: totalReferralEarnings[0]?.total || 0,
        todayEarnings,
        todayAdStats,
        faucetPayStats
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get analytics data
router.get('/analytics', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Daily user registrations
    const dailyRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily earnings
    const dailyEarnings = await Earning.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Daily withdrawals
    const dailyWithdrawals = await Withdrawal.aggregate([
      { $match: { requestedAt: { $gte: startDate } } },
      {
        $group: {
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$requestedAt' } },
            status: '$status'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Daily ad views
    const dailyAds = await AdSession.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: startDate } } },
      {
        $group: {
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
            provider: '$provider'
          },
          total: { $sum: '$reward' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Top referrers
    const topReferrers = await User.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'referredBy',
          as: 'referrals'
        }
      },
      {
        $project: {
          username: 1,
          telegramId: 1,
          firstName: 1,
          lastName: 1,
          referralCount: { $size: '$referrals' },
          referralEarnings: 1
        }
      },
      { $match: { referralCount: { $gt: 0 } } },
      { $sort: { referralCount: -1 } },
      { $limit: 10 }
    ]);

    // Top earners
    const topEarners = await User.find()
      .select('username telegramId firstName lastName totalEarnings balance')
      .sort({ totalEarnings: -1 })
      .limit(10);

    res.json({
      dailyRegistrations,
      dailyEarnings,
      dailyWithdrawals,
      dailyAds,
      topReferrers,
      topEarners
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User Management
router.get('/users', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { telegramId: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && ['active', 'suspended', 'banned'].includes(status)) {
      query.status = status;
    }

    const users = await User.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/users/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('referredBy', 'username telegramId');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const referralCount = await User.countDocuments({ referredBy: user._id });
    const earnings = await Earning.find({ user: user._id }).sort({ createdAt: -1 }).limit(20);
    const withdrawals = await Withdrawal.find({ user: user._id }).sort({ requestedAt: -1 }).limit(20);
    const taskSubmissions = await TaskSubmission.find({ user: user._id })
      .populate('task', 'title reward')
      .sort({ submittedAt: -1 })
      .limit(20);
    const adSessions = await AdSession.find({ user: user._id, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(20);

    res.json({
      user,
      referralCount,
      recentEarnings: earnings,
      recentWithdrawals: withdrawals,
      recentTaskSubmissions: taskSubmissions,
      recentAdSessions: adSessions
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// COMPREHENSIVE USER DETAILS ENDPOINT
// ============================================
router.get('/users/:id/details', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('referredBy', 'username telegramId firstName lastName');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. PROFILE OVERVIEW
    const referralCount = await User.countDocuments({ referredBy: user._id });
    const referrals = await User.find({ referredBy: user._id })
      .select('username telegramId firstName lastName createdAt totalEarnings status')
      .sort({ createdAt: -1 })
      .limit(20);

    // 2. EARNINGS & ACTIVITY HISTORY
    const allEarnings = await Earning.find({ user: user._id })
      .populate('taskId', 'title')
      .populate('referralUserId', 'username telegramId firstName')
      .sort({ createdAt: -1 })
      .limit(100);

    const earningsSummary = await Earning.aggregate([
      { $match: { user: user._id } },
      { $group: { 
        _id: '$type', 
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    // Daily earnings for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyEarnings = await Earning.aggregate([
      { $match: { user: user._id, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: -1 } }
    ]);

    // 3. WITHDRAWAL SUMMARY
    const allWithdrawals = await Withdrawal.find({ user: user._id })
      .populate('withdrawalMethod', 'name type')
      .sort({ requestedAt: -1 })
      .limit(50);

    const withdrawalSummary = await Withdrawal.aggregate([
      { $match: { user: user._id } },
      { $group: {
        _id: '$status',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    const totalWithdrawn = await Withdrawal.aggregate([
      { $match: { user: user._id, status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } }}
    ]);

    // 4. DEVICE, IP & SECURITY INFORMATION
    // Get unique IPs from various sources
    const adSessionIPs = await AdSession.aggregate([
      { $match: { user: user._id, ipAddress: { $ne: '', $exists: true } } },
      { $group: {
        _id: '$ipAddress',
        count: { $sum: 1 },
        lastUsed: { $max: '$createdAt' },
        firstUsed: { $min: '$createdAt' }
      }},
      { $sort: { lastUsed: -1 } },
      { $limit: 20 }
    ]);

    // Get device/user agent information
    const deviceInfo = await AdSession.aggregate([
      { $match: { user: user._id, userAgent: { $ne: '', $exists: true } } },
      { $group: {
        _id: '$userAgent',
        count: { $sum: 1 },
        lastUsed: { $max: '$createdAt' },
        ips: { $addToSet: '$ipAddress' }
      }},
      { $sort: { lastUsed: -1 } },
      { $limit: 10 }
    ]);

    // Parse user agents to extract device info
    const devices = deviceInfo.map(d => {
      const ua = d._id || '';
      let deviceType = 'Unknown';
      let os = 'Unknown';
      let browser = 'Unknown';
      
      // Detect device type
      if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
        deviceType = 'Mobile';
      } else if (/tablet|ipad/i.test(ua)) {
        deviceType = 'Tablet';
      } else {
        deviceType = 'Desktop';
      }
      
      // Detect OS
      if (/windows/i.test(ua)) os = 'Windows';
      else if (/mac os x/i.test(ua)) os = 'macOS';
      else if (/linux/i.test(ua)) os = 'Linux';
      else if (/android/i.test(ua)) os = 'Android';
      else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
      
      // Detect browser
      if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
      else if (/firefox/i.test(ua)) browser = 'Firefox';
      else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
      else if (/edge/i.test(ua)) browser = 'Edge';
      else if (/opera|opr/i.test(ua)) browser = 'Opera';
      
      return {
        userAgent: ua.substring(0, 150),
        deviceType,
        os,
        browser,
        usageCount: d.count,
        lastUsed: d.lastUsed,
        uniqueIPs: d.ips?.length || 0
      };
    });

    // 5. METRICS, FLAGS & TRUST INDICATORS
    // Activity consistency - logins over last 30 days
    const loginDays = dailyEarnings.length;
    const activityConsistency = Math.round((loginDays / 30) * 100);

    // Check for duplicate IP usage
    const duplicateIPCheck = await AdSession.aggregate([
      { $match: { ipAddress: user.ipAddress, ipAddress: { $ne: '' } } },
      { $group: { _id: '$user' } },
      { $count: 'totalUsers' }
    ]);
    const usersWithSameIP = duplicateIPCheck[0]?.totalUsers || 1;

    // Earning patterns analysis
    const last7DaysEarnings = await Earning.aggregate([
      { $match: { 
        user: user._id, 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }},
      { $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Check for rapid earning patterns (possible automation)
    const rapidEarnings = await Earning.aggregate([
      { $match: { user: user._id } },
      { $sort: { createdAt: 1 } },
      { $group: {
        _id: null,
        earnings: { $push: { time: '$createdAt', amount: '$amount' } }
      }}
    ]);

    // Calculate suspicious activity indicators
    let suspiciousFlags = [];
    let trustScore = 100;

    // Flag: Multiple IPs
    if (adSessionIPs.length > 10) {
      suspiciousFlags.push({ flag: 'MULTIPLE_IPS', severity: 'medium', detail: `${adSessionIPs.length} different IPs used` });
      trustScore -= 10;
    }

    // Flag: Shared IP
    if (usersWithSameIP > 1) {
      suspiciousFlags.push({ flag: 'SHARED_IP', severity: 'high', detail: `${usersWithSameIP} accounts share this IP` });
      trustScore -= 20;
    }

    // Flag: Very high daily earnings
    const avgDailyEarning = dailyEarnings.reduce((sum, d) => sum + d.total, 0) / (dailyEarnings.length || 1);
    if (avgDailyEarning > 1) { // Threshold depends on your economy
      suspiciousFlags.push({ flag: 'HIGH_EARNINGS', severity: 'low', detail: `Avg daily: ${avgDailyEarning.toFixed(5)}` });
      trustScore -= 5;
    }

    // Flag: Inactive recently
    const daysSinceLastLogin = user.lastLogin 
      ? Math.floor((Date.now() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    if (daysSinceLastLogin > 30) {
      suspiciousFlags.push({ flag: 'INACTIVE', severity: 'info', detail: `${daysSinceLastLogin} days since last login` });
    }

    // Flag: No withdrawals despite high balance
    if (user.balance > 0.1 && allWithdrawals.length === 0) {
      suspiciousFlags.push({ flag: 'NO_WITHDRAWALS', severity: 'info', detail: 'Has balance but never withdrawn' });
    }

    // Flag: High rejection rate
    const rejectedWithdrawals = withdrawalSummary.find(w => w._id === 'rejected')?.count || 0;
    const totalWithdrawalRequests = allWithdrawals.length;
    if (totalWithdrawalRequests > 5 && (rejectedWithdrawals / totalWithdrawalRequests) > 0.3) {
      suspiciousFlags.push({ flag: 'HIGH_REJECTION_RATE', severity: 'medium', detail: `${Math.round((rejectedWithdrawals / totalWithdrawalRequests) * 100)}% rejection rate` });
      trustScore -= 15;
    }

    // Task submission analysis
    const taskStats = await TaskSubmission.aggregate([
      { $match: { user: user._id } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);
    
    const recentTasks = await TaskSubmission.find({ user: user._id })
      .populate('task', 'title reward type')
      .sort({ submittedAt: -1 })
      .limit(20);

    // Ad session statistics
    const adStats = await AdSession.aggregate([
      { $match: { user: user._id } },
      { $group: {
        _id: { provider: '$provider', status: '$status' },
        count: { $sum: 1 },
        totalReward: { $sum: '$reward' }
      }}
    ]);

    // Normalize trust score
    trustScore = Math.max(0, Math.min(100, trustScore));

    // Determine trust level
    let trustLevel = 'high';
    if (trustScore < 50) trustLevel = 'low';
    else if (trustScore < 75) trustLevel = 'medium';

    res.json({
      // 1. Profile Overview
      profile: {
        _id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        balance: user.balance,
        totalEarnings: user.totalEarnings,
        totalWithdrawals: user.totalWithdrawals,
        referralCode: user.referralCode,
        referralEarnings: user.referralEarnings,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        lastFaucetClaim: user.lastFaucetClaim,
        currentIP: user.ipAddress,
        currentUserAgent: user.userAgent,
        referredBy: user.referredBy
      },
      
      // 2. Referral Information
      referrals: {
        count: referralCount,
        totalEarnings: user.referralEarnings,
        list: referrals
      },

      // 3. Earnings & Activity
      earnings: {
        recent: allEarnings,
        summary: earningsSummary,
        dailyHistory: dailyEarnings,
        hourlyPattern: last7DaysEarnings
      },

      // 4. Withdrawals
      withdrawals: {
        history: allWithdrawals,
        summary: withdrawalSummary,
        totalWithdrawn: totalWithdrawn[0]?.total || 0
      },

      // 5. Device & Security Info
      security: {
        devices: devices,
        ipHistory: adSessionIPs,
        currentIP: user.ipAddress,
        uniqueIPCount: adSessionIPs.length,
        uniqueDeviceCount: devices.length
      },

      // 6. Task Activity
      tasks: {
        submissions: recentTasks,
        stats: taskStats
      },

      // 7. Ad Activity
      ads: {
        stats: adStats
      },

      // 8. Trust & Risk Indicators
      trustIndicators: {
        score: trustScore,
        level: trustLevel,
        flags: suspiciousFlags,
        metrics: {
          activityConsistency,
          daysSinceLastLogin,
          usersWithSameIP,
          avgDailyEarning: avgDailyEarning.toFixed(5)
        }
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/users/:id/status', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create notification for user
    const notification = new Notification({
      user: user._id,
      type: 'system',
      title: status === 'active' ? 'Account Activated' : `Account ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: status === 'active' 
        ? 'Your account has been activated. You can now use all features.'
        : `Your account has been ${status}. ${reason || 'Please contact support for more information.'}`,
      priority: 'high'
    });
    await notification.save();

    // Send Telegram notification
    if (user.telegramId) {
      let telegramMessage;
      if (status === 'active') {
        telegramMessage = `✅ <b>Account Activated!</b>\n\nYour account has been reactivated. You can now use all features of the app.\n\nWelcome back!`;
      } else if (status === 'suspended') {
        telegramMessage = `⚠️ <b>Account Suspended</b>\n\nYour account has been temporarily suspended.\n\n${reason ? `📝 Reason: ${reason}\n\n` : ''}Please contact support for more information.`;
      } else if (status === 'banned') {
        telegramMessage = `🚫 <b>Account Banned</b>\n\nYour account has been permanently banned.\n\n${reason ? `📝 Reason: ${reason}\n\n` : ''}If you believe this is a mistake, please contact support.`;
      }
      
      sendMessage(user.telegramId, telegramMessage).catch(err => {
        console.error('Failed to send status notification to Telegram:', err);
      });
    }

    res.json({ message: 'User status updated', user });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/users/:id/balance', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { amount, type, reason } = req.body;

    if (!amount || !type) {
      return res.status(400).json({ message: 'Amount and type are required' });
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
      return res.status(400).json({ message: 'Amount must be a valid positive number' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get currency name from settings
    const currencySetting = await Settings.findOne({ key: 'currency_name' });
    const currencyName = currencySetting?.value || 'coins';

    const previousBalance = user.balance;
    let changeAmount = parseFloat(amount);
    let changeType = '';

    if (type === 'add') {
      user.balance += changeAmount;
      user.totalEarnings += changeAmount;
      changeType = 'added';
    } else if (type === 'subtract') {
      changeAmount = Math.min(changeAmount, user.balance);
      user.balance = Math.max(0, user.balance - parseFloat(amount));
      changeType = 'deducted';
    } else if (type === 'set') {
      user.balance = Math.max(0, parseFloat(amount));
      changeType = 'set to';
      changeAmount = user.balance;
    } else {
      return res.status(400).json({ message: 'Invalid type. Use "add", "subtract", or "set"' });
    }

    await user.save();

    // Create earning record if adding
    if (type === 'add') {
      const earning = new Earning({
        user: user._id,
        type: 'manual',
        amount: parseFloat(amount),
        description: reason || 'Manual adjustment by admin'
      });
      await earning.save();
    }

    // Notify user (in-app)
    const notification = new Notification({
      user: user._id,
      type: 'reward',
      title: type === 'add' ? 'Balance Added!' : type === 'subtract' ? 'Balance Deducted' : 'Balance Updated',
      message: type === 'add' 
        ? `+${changeAmount.toFixed(2)} ${currencyName} has been added to your balance. ${reason || ''}`
        : type === 'subtract'
        ? `-${changeAmount.toFixed(2)} ${currencyName} has been deducted from your balance. ${reason || ''}`
        : `Your balance has been updated to ${user.balance.toFixed(2)} ${currencyName}. ${reason || ''}`,
      priority: 'normal'
    });
    await notification.save();

    // Send Telegram notification
    if (user.telegramId) {
      let telegramMessage;
      if (type === 'add') {
        telegramMessage = `💰 <b>Balance Added!</b>\n\n<b>+${changeAmount.toFixed(2)} ${currencyName}</b> has been added to your account.\n\n${reason ? `📝 Reason: ${reason}\n\n` : ''}💳 New Balance: <b>${user.balance.toFixed(2)} ${currencyName}</b>`;
      } else if (type === 'subtract') {
        telegramMessage = `💸 <b>Balance Deducted</b>\n\n<b>-${changeAmount.toFixed(2)} ${currencyName}</b> has been deducted from your account.\n\n${reason ? `📝 Reason: ${reason}\n\n` : ''}💳 New Balance: <b>${user.balance.toFixed(2)} ${currencyName}</b>`;
      } else {
        telegramMessage = `📊 <b>Balance Updated</b>\n\nYour balance has been updated.\n\n📈 Previous: ${previousBalance.toFixed(2)} ${currencyName}\n💳 Current: <b>${user.balance.toFixed(2)} ${currencyName}</b>\n\n${reason ? `📝 Reason: ${reason}` : ''}`;
      }
      
      sendMessage(user.telegramId, telegramMessage).catch(err => {
        console.error('Failed to send balance notification to Telegram:', err);
      });
    }

    res.json({ message: 'Balance updated successfully', balance: user.balance, previousBalance });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/users/:id/reset-cooldown', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { lastFaucetClaim: null },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Cooldown reset successfully' });
  } catch (error) {
    console.error('Reset cooldown error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Task Management
router.get('/tasks', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { dateFrom, dateTo, status: statusFilter } = req.query;
    
    // Build task query
    let taskQuery = {};
    if (statusFilter && statusFilter !== 'all') {
      taskQuery.status = statusFilter;
    }
    
    const tasks = await Task.find(taskQuery).sort({ createdAt: -1 });
    
    // Build date filter for submissions
    let dateFilter = {};
    if (dateFrom) {
      dateFilter.createdAt = { $gte: new Date(dateFrom) };
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.createdAt = { ...dateFilter.createdAt, $lte: endDate };
    }
    
    // Get submission counts for each task
    const tasksWithCounts = await Promise.all(tasks.map(async (task) => {
      const baseQuery = { task: task._id, ...dateFilter };
      
      const pendingCount = await TaskSubmission.countDocuments({ ...baseQuery, status: 'pending' });
      const approvedCount = await TaskSubmission.countDocuments({ ...baseQuery, status: 'approved' });
      const rejectedCount = await TaskSubmission.countDocuments({ ...baseQuery, status: 'rejected' });
      
      // Calculate remaining slots
      const remainingSlots = task.maxCompletions > 0 
        ? Math.max(0, task.maxCompletions - (task.completionCount || 0))
        : null; // null means unlimited
      
      // Get today's completions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCompletions = await TaskSubmission.countDocuments({ 
        task: task._id, 
        status: 'approved',
        createdAt: { $gte: today }
      });
      
      // Get this week's completions
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      const weeklyCompletions = await TaskSubmission.countDocuments({ 
        task: task._id, 
        status: 'approved',
        createdAt: { $gte: weekAgo }
      });
      
      return {
        ...task.toObject(),
        submissionCounts: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: pendingCount + approvedCount + rejectedCount
        },
        analytics: {
          totalCompletions: task.completionCount || 0,
          remainingSlots,
          todayCompletions,
          weeklyCompletions,
          isMaxedOut: task.maxCompletions > 0 && (task.completionCount || 0) >= task.maxCompletions
        }
      };
    }));

    res.json({ tasks: tasksWithCounts });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Task Analytics - detailed stats for a specific task
router.get('/tasks/:id/analytics', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);
    
    // Daily completions breakdown
    const dailyCompletions = await TaskSubmission.aggregate([
      { 
        $match: { 
          task: task._id, 
          status: 'approved',
          createdAt: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Recent submissions
    const recentSubmissions = await TaskSubmission.find({ task: task._id })
      .populate('user', 'username telegramId')
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Top completers for this task
    const topCompleters = await TaskSubmission.aggregate([
      { $match: { task: task._id, status: 'approved' } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Populate top completers
    const populatedTopCompleters = await User.populate(topCompleters, {
      path: '_id',
      select: 'username telegramId'
    });
    
    res.json({
      task: {
        ...task.toObject(),
        analytics: {
          totalCompletions: task.completionCount || 0,
          remainingSlots: task.maxCompletions > 0 
            ? Math.max(0, task.maxCompletions - (task.completionCount || 0))
            : null,
          totalRewardsGiven: (task.completionCount || 0) * task.reward
        }
      },
      dailyCompletions,
      recentSubmissions: recentSubmissions.map(s => ({
        _id: s._id,
        user: s.user?.username || s.user?.telegramId || 'Unknown',
        status: s.status,
        proof: s.proof,
        createdAt: s.createdAt
      })),
      topCompleters: populatedTopCompleters.map(t => ({
        user: t._id?.username || t._id?.telegramId || 'Unknown',
        completions: t.count
      }))
    });
  } catch (error) {
    console.error('Task analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/tasks', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { title, description, type, reward, link, url, channelUsername, isActive, status, requiresProof } = req.body;

    if (!title || reward === undefined) {
      return res.status(400).json({ message: 'Title and reward are required' });
    }

    const task = new Task({
      title,
      description: description || '',
      type: type || 'other',
      reward: parseFloat(reward),
      link: link || url || '',
      url: url || link || '',
      channelUsername: channelUsername || '',
      isActive: status ? status === 'active' : isActive !== false,
      status: status || (isActive !== false ? 'active' : 'inactive'),
      requiresProof: requiresProof !== false
    });
    await task.save();

    res.json({ message: 'Task created successfully', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT route for task update
router.put('/tasks/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { status, url, ...rest } = req.body;
    const updateData = {
      ...rest,
      updatedAt: new Date()
    };
    
    if (status !== undefined) {
      updateData.status = status;
      updateData.isActive = status === 'active';
    }
    if (url !== undefined) {
      updateData.url = url;
      updateData.link = url;
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/tasks/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/tasks/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Also delete related submissions
    await TaskSubmission.deleteMany({ task: req.params.id });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Task Submissions Management
router.get('/task-submissions', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = status === 'all' ? {} : { status };

    const submissions = await TaskSubmission.find(query)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username firstName lastName telegramId')
      .populate('task', 'title description reward type')
      .populate('reviewedBy', 'username');

    const total = await TaskSubmission.countDocuments(query);

    res.json({
      submissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get task submissions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/task-submissions/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const submission = await TaskSubmission.findById(req.params.id)
      .populate('task');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (submission.status !== 'pending') {
      return res.status(400).json({ message: 'Submission already reviewed' });
    }

    // Get currency name from settings
    const currencySetting = await Settings.findOne({ key: 'currency_name' });
    const currencyName = currencySetting?.value || 'coins';

    submission.status = status;
    submission.reviewedAt = new Date();
    submission.reviewedBy = req.admin._id;
    await submission.save();

    const user = await User.findById(submission.user);

    // If approved, credit reward
    if (status === 'approved') {
      user.balance += submission.task.reward;
      user.totalEarnings += submission.task.reward;
      await user.save();

      const earning = new Earning({
        user: user._id,
        type: 'task',
        amount: submission.task.reward,
        taskId: submission.task._id,
        description: `Task reward: ${submission.task.title}`
      });
      await earning.save();

      // Increment task completion count
      await Task.findByIdAndUpdate(submission.task._id, { $inc: { completionCount: 1 } });

      // Award referral commission
      const { awardReferralCommission } = require('../middleware/referralReward');
      await awardReferralCommission(user._id, submission.task.reward, 'task');
    }

    // Notify user
    const notification = new Notification({
      user: user._id,
      type: 'task',
      title: status === 'approved' ? 'Task Approved!' : 'Task Rejected',
      message: status === 'approved' 
        ? `Your submission for "${submission.task.title}" has been approved! You earned ${submission.task.reward} ${currencyName}.`
        : `Your submission for "${submission.task.title}" has been rejected. Please try again or contact support.`,
      priority: status === 'approved' ? 'normal' : 'high'
    });
    await notification.save();

    // Send Telegram notification
    if (user.telegramId) {
      const telegramMessage = status === 'approved'
        ? `✅ <b>Task Approved!</b>\n\nYour submission for "<b>${submission.task.title}</b>" has been approved!\n\n💰 <b>+${submission.task.reward} ${currencyName}</b> added to your balance.\n\nKeep completing tasks to earn more!`
        : `❌ <b>Task Rejected</b>\n\nYour submission for "<b>${submission.task.title}</b>" was rejected.\n\nPlease ensure you follow the task instructions carefully and try again.`;
      
      sendMessage(user.telegramId, telegramMessage).catch(err => {
        console.error('Failed to send task notification to Telegram:', err);
      });
    }

    res.json({ message: `Task submission ${status}`, submission });
  } catch (error) {
    console.error('Review task submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk approve/reject submissions
router.post('/task-submissions/bulk-action', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { submissionIds, status } = req.body;

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ message: 'Submission IDs array is required' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Get currency name from settings
    const currencySetting = await Settings.findOne({ key: 'currency_name' });
    const currencyName = currencySetting?.value || 'coins';

    let processed = 0;
    let failed = 0;

    for (const id of submissionIds) {
      try {
        const submission = await TaskSubmission.findById(id).populate('task');
        if (!submission || submission.status !== 'pending') {
          failed++;
          continue;
        }

        submission.status = status;
        submission.reviewedAt = new Date();
        submission.reviewedBy = req.admin._id;
        await submission.save();

        const user = await User.findById(submission.user);

        if (status === 'approved') {
          user.balance += submission.task.reward;
          user.totalEarnings += submission.task.reward;
          await user.save();

          const earning = new Earning({
            user: user._id,
            type: 'task',
            amount: submission.task.reward,
            taskId: submission.task._id,
            description: `Task reward: ${submission.task.title}`
          });
          await earning.save();

          const { awardReferralCommission } = require('../middleware/referralReward');
          await awardReferralCommission(user._id, submission.task.reward, 'task');
        }

        // Notify user
        const notification = new Notification({
          user: user._id,
          type: 'task',
          title: status === 'approved' ? 'Task Approved!' : 'Task Rejected',
          message: status === 'approved' 
            ? `Your submission for "${submission.task.title}" has been approved! You earned ${submission.task.reward} ${currencyName}.`
            : `Your submission for "${submission.task.title}" has been rejected.`,
          priority: status === 'approved' ? 'normal' : 'high'
        });
        await notification.save();

        // Send Telegram notification
        if (user.telegramId) {
          const telegramMessage = status === 'approved'
            ? `✅ <b>Task Approved!</b>\n\nYour submission for "<b>${submission.task.title}</b>" has been approved!\n\n💰 <b>+${submission.task.reward} ${currencyName}</b> added to your balance.`
            : `❌ <b>Task Rejected</b>\n\nYour submission for "<b>${submission.task.title}</b>" was rejected. Please try again.`;
          
          sendMessage(user.telegramId, telegramMessage).catch(err => {
            console.error('Failed to send bulk task notification:', err);
          });
        }

        processed++;
      } catch (error) {
        console.error('Bulk action error for submission:', id, error);
        failed++;
      }
    }

    res.json({ 
      message: `Bulk action completed`, 
      processed, 
      failed,
      total: submissionIds.length 
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Withdrawal Management
router.get('/withdrawals', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = status === 'all' ? {} : { status };

    const withdrawals = await Withdrawal.find(query)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username firstName lastName telegramId balance')
      .populate('processedBy', 'username');

    const total = await Withdrawal.countDocuments(query);

    // Get summary stats
    const pendingTotal = await Withdrawal.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    res.json({
      withdrawals,
      summary: {
        pendingCount: pendingTotal[0]?.count || 0,
        pendingAmount: pendingTotal[0]?.total || 0
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/withdrawals/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { status, transactionId, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Get currency name from settings
    const currencySetting = await Settings.findOne({ key: 'currency_name' });
    const currencyName = currencySetting?.value || 'coins';

    const withdrawal = await Withdrawal.findById(req.params.id)
      .populate('user');

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    const user = await User.findById(withdrawal.user._id);

    if (status === 'approved') {
      withdrawal.status = 'approved';
      withdrawal.transactionId = transactionId || '';
      user.totalWithdrawals += withdrawal.amount;
    } else {
      withdrawal.status = 'rejected';
      withdrawal.rejectionReason = rejectionReason || '';
      // Refund balance
      user.balance += withdrawal.amount;
    }

    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.admin._id;
    await withdrawal.save();
    await user.save();

    // Notify user
    const notification = new Notification({
      user: user._id,
      type: 'withdrawal',
      title: status === 'approved' ? 'Withdrawal Approved!' : 'Withdrawal Rejected',
      message: status === 'approved' 
        ? `Your withdrawal of ${withdrawal.amount} ${currencyName} has been approved!${transactionId ? ` Transaction ID: ${transactionId}` : ''}`
        : `Your withdrawal of ${withdrawal.amount} ${currencyName} has been rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''} The amount has been refunded to your balance.`,
      priority: 'high'
    });
    await notification.save();

    // Send Telegram notification
    if (user.telegramId) {
      const telegramMessage = status === 'approved'
        ? `💸 <b>Withdrawal Approved!</b>\n\nYour withdrawal of <b>${withdrawal.amount} ${currencyName}</b> has been processed successfully!\n\n${transactionId ? `📝 Transaction ID: <code>${transactionId}</code>` : 'Check your wallet for the funds.'}`
        : `⚠️ <b>Withdrawal Rejected</b>\n\nYour withdrawal request of <b>${withdrawal.amount} ${currencyName}</b> was rejected.\n\n${rejectionReason ? `📝 Reason: ${rejectionReason}\n\n` : ''}💰 The amount has been refunded to your balance.`;
      
      sendMessage(user.telegramId, telegramMessage).catch(err => {
        console.error('Failed to send withdrawal notification to Telegram:', err);
      });
    }

    res.json({ message: `Withdrawal ${status}`, withdrawal });
  } catch (error) {
    console.error('Process withdrawal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Settings Management
router.get('/settings', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const settings = await Settings.find();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    // Define all settings with defaults (using camelCase for frontend)
    const allSettings = {
      // App Settings
      appName: settingsObj.app_name || 'Telegram Earning App',
      currencySymbol: settingsObj.currency_symbol || '₮',
      currencyName: settingsObj.currency_name || 'Coins',
      maintenanceMode: settingsObj.maintenance_mode || false,
      debugMode: settingsObj.debug_mode || false,
      
      // Currency Configuration
      currencyMode: settingsObj.currency_mode || 'fiat', // 'fiat' or 'points'
      pointsExchangeRate: settingsObj.points_exchange_rate || 1000, // Points per 1 USD
      
      // Faucet Settings
      faucetEnabled: settingsObj.faucet_enabled !== false,
      faucetReward: settingsObj.faucet_reward || 0.1,
      faucetCooldown: settingsObj.faucet_cooldown || 60,
      
      // Referral Settings
      referralEnabled: settingsObj.referral_enabled !== false,
      referralCommission: settingsObj.referral_commission || 10,
      referralType: settingsObj.referral_type || 'percentage',
      welcomeBonus: settingsObj.welcome_bonus || 0,
      
      // Withdrawal Settings
      withdrawalsEnabled: settingsObj.withdrawals_enabled !== false && settingsObj.withdrawal_enabled !== false,
      minimumWithdrawal: settingsObj.min_withdrawal_amount || 1,
      maximumWithdrawal: settingsObj.max_withdrawal_amount || 1000,
      withdrawalFee: settingsObj.withdrawal_fee || 0,
      withdrawalMethods: settingsObj.withdrawal_methods || ['BTC', 'USDT'],
      customWithdrawalMethods: settingsObj.custom_withdrawal_methods || '',
      
      // Task Settings
      tasksEnabled: settingsObj.tasks_enabled !== false,
      
      // Ads Settings - Global
      adsEnabled: settingsObj.ads_enabled !== false,
      adReward: settingsObj.ad_reward || 0.1,
      adCooldown: settingsObj.ad_cooldown || 30,
      dailyAdLimit: settingsObj.daily_ad_limit || 50,
      
      // Adsgram Settings
      adsgramEnabled: settingsObj.adsgram_enabled || false,
      adsgramBlockId: settingsObj.adsgram_block_id || '',
      adsgramReward: settingsObj.adsgram_reward || 0.1,
      adsgramFaucetEnabled: settingsObj.adsgram_faucet_enabled || false,
      
      // Monetag Settings
      monetagEnabled: settingsObj.monetag_enabled || false,
      monetagZoneId: settingsObj.monetag_zone_id || '',
      monetagReward: settingsObj.monetag_reward || 0.1,
      monetagFaucetEnabled: settingsObj.monetag_faucet_enabled || false,
      
      // AdExtra Settings
      adextraEnabled: settingsObj.adextra_enabled || false,
      adextraPublisherId: settingsObj.adextra_publisher_id || '',
      adextraReward: settingsObj.adextra_reward || 0.1,
      adextraFaucetEnabled: settingsObj.adextra_faucet_enabled || false,
      
      // Adexora Settings
      adexoraEnabled: settingsObj.adexora_enabled || false,
      adexoraAppId: settingsObj.adexora_app_id || '',
      adexoraReward: settingsObj.adexora_reward || 0.1,
      adexoraFaucetEnabled: settingsObj.adexora_faucet_enabled || false,
      
      // Faucet Claim Provider Priority (max 3 providers in order)
      faucetClaimProviderPriority: settingsObj.faucet_claim_provider_priority || [],
      faucetClaimMaxProviders: 3, // Constant - max providers allowed
      
      // Ads Peering Configuration - Multiple peer groups
      adsPeeringEnabled: settingsObj.ads_peering_enabled || false,
      adsPeeringGroups: settingsObj.ads_peering_groups || [], // Array of arrays: [[providerA, providerB], [providerC, providerD]]
      
      // FaucetPay Settings
      faucetpayEnabled: settingsObj.faucetpay_enabled || false,
      faucetpayApiKey: settingsObj.faucetpay_api_key || '',
      faucetpayCurrency: settingsObj.faucetpay_currency || 'TRX',
      faucetpayMinWithdrawal: settingsObj.faucetpay_min_withdrawal || 1,
      faucetpayMaxWithdrawal: settingsObj.faucetpay_max_withdrawal || 1000,
      faucetpayFee: settingsObj.faucetpay_fee || 0,
      faucetpayFeeType: settingsObj.faucetpay_fee_type || 'percentage',
      faucetpayProcessingTime: settingsObj.faucetpay_processing_time || 'Instant',
      faucetpayDailyLimit: settingsObj.faucetpay_daily_limit || 0,
      faucetpayReferToAccountBalance: settingsObj.faucetpay_refer_to_account_balance || false,
      
      // Telegram Bot Settings
      telegramBotUsername: settingsObj.telegram_bot_username || '',
      telegramBotToken: settingsObj.telegram_bot_token || '',
      
      // Support Settings
      supportTelegramId: settingsObj.support_telegram_id || '',
      
      // Legal Settings
      privacyPolicy: settingsObj.privacy_policy || '',
      termsAndConditions: settingsObj.terms_and_conditions || '',
      
      // Social Media Links
      socialLinks: {
        telegram: settingsObj.social_telegram || '',
        twitter: settingsObj.social_twitter || '',
        youtube: settingsObj.social_youtube || '',
        discord: settingsObj.social_discord || '',
        instagram: settingsObj.social_instagram || ''
      },
      
      // Cloudflare Turnstile Settings (Security)
      turnstileEnabled: settingsObj.turnstile_enabled || false,
      turnstileSiteKey: settingsObj.turnstile_site_key || '',
      turnstileSecretKey: settingsObj.turnstile_secret_key || ''
    };

    res.json({ settings: allSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT route for bulk settings update (used by admin dashboard)
router.put('/settings', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Settings object is required' });
    }

    // Map frontend camelCase keys to backend snake_case keys
    const keyMapping = {
      appName: 'app_name',
      currencyName: 'currency_name',
      currencySymbol: 'currency_symbol',
      // Currency Configuration
      currencyMode: 'currency_mode',
      pointsExchangeRate: 'points_exchange_rate',
      supportTelegramId: 'support_telegram_id',
      maintenanceMode: 'maintenance_mode',
      debugMode: 'debug_mode',
      faucetEnabled: 'faucet_enabled',
      faucetReward: 'faucet_reward',
      faucetCooldown: 'faucet_cooldown',
      referralEnabled: 'referral_enabled',
      referralCommission: 'referral_commission',
      referralType: 'referral_type',
      welcomeBonus: 'welcome_bonus',
      withdrawalEnabled: 'withdrawal_enabled',
      withdrawalsEnabled: 'withdrawals_enabled',
      minimumWithdrawal: 'min_withdrawal_amount',
      maximumWithdrawal: 'max_withdrawal_amount',
      withdrawalFee: 'withdrawal_fee',
      withdrawalMethods: 'withdrawal_methods',
      customWithdrawalMethods: 'custom_withdrawal_methods',
      tasksEnabled: 'tasks_enabled',
      adsEnabled: 'ads_enabled',
      adReward: 'ad_reward',
      adCooldown: 'ad_cooldown',
      dailyAdLimit: 'daily_ad_limit',
      adsgramEnabled: 'adsgram_enabled',
      adsgramBlockId: 'adsgram_block_id',
      adsgramReward: 'adsgram_reward',
      adsgramFaucetEnabled: 'adsgram_faucet_enabled',
      monetagEnabled: 'monetag_enabled',
      monetagZoneId: 'monetag_zone_id',
      monetagReward: 'monetag_reward',
      monetagFaucetEnabled: 'monetag_faucet_enabled',
      adextraEnabled: 'adextra_enabled',
      adextraPublisherId: 'adextra_publisher_id',
      adextraReward: 'adextra_reward',
      adextraFaucetEnabled: 'adextra_faucet_enabled',
      adexoraEnabled: 'adexora_enabled',
      adexoraAppId: 'adexora_app_id',
      adexoraReward: 'adexora_reward',
      adexoraFaucetEnabled: 'adexora_faucet_enabled',
      // Faucet Claim Provider Priority
      faucetClaimProviderPriority: 'faucet_claim_provider_priority',
      // Ads Peering Configuration - Multiple groups
      adsPeeringEnabled: 'ads_peering_enabled',
      adsPeeringGroups: 'ads_peering_groups',
      telegramBotUsername: 'telegram_bot_username',
      telegramBotToken: 'telegram_bot_token',
      // FaucetPay Settings
      faucetpayEnabled: 'faucetpay_enabled',
      faucetpayApiKey: 'faucetpay_api_key',
      faucetpayCurrency: 'faucetpay_currency',
      faucetpayMinWithdrawal: 'faucetpay_min_withdrawal',
      faucetpayMaxWithdrawal: 'faucetpay_max_withdrawal',
      faucetpayFee: 'faucetpay_fee',
      faucetpayFeeType: 'faucetpay_fee_type',
      faucetpayProcessingTime: 'faucetpay_processing_time',
      faucetpayDailyLimit: 'faucetpay_daily_limit',
      faucetpayReferToAccountBalance: 'faucetpay_refer_to_account_balance',
      // Legal Settings
      privacyPolicy: 'privacy_policy',
      termsAndConditions: 'terms_and_conditions',
      // Social Media Links
      socialTelegram: 'social_telegram',
      socialTwitter: 'social_twitter',
      socialYoutube: 'social_youtube',
      socialDiscord: 'social_discord',
      socialInstagram: 'social_instagram',
      // Platform Access Control
      telegramWebEnabled: 'telegram_web_enabled',
      telegramDesktopEnabled: 'telegram_desktop_enabled',
      telegramMobileEnabled: 'telegram_mobile_enabled',
      adblockerEnforcementEnabled: 'adblocker_enforcement_enabled',
      // Cloudflare Turnstile Settings
      turnstileEnabled: 'turnstile_enabled',
      turnstileSiteKey: 'turnstile_site_key',
      turnstileSecretKey: 'turnstile_secret_key'
    };

    // Validate faucet claim provider priority (max 3 providers)
    const MAX_FAUCET_PROVIDERS = 3;
    if (settings.faucetClaimProviderPriority) {
      if (!Array.isArray(settings.faucetClaimProviderPriority)) {
        return res.status(400).json({ 
          message: 'faucetClaimProviderPriority must be an array' 
        });
      }
      if (settings.faucetClaimProviderPriority.length > MAX_FAUCET_PROVIDERS) {
        return res.status(400).json({ 
          message: `Maximum ${MAX_FAUCET_PROVIDERS} providers allowed for Faucet Claim. Currently trying to set ${settings.faucetClaimProviderPriority.length}.`
        });
      }
      // Validate provider IDs
      const validProviders = ['adsgram', 'monetag', 'adextra', 'adexora'];
      const invalidProviders = settings.faucetClaimProviderPriority.filter(p => !validProviders.includes(p));
      if (invalidProviders.length > 0) {
        return res.status(400).json({ 
          message: `Invalid provider IDs: ${invalidProviders.join(', ')}. Valid options: ${validProviders.join(', ')}`
        });
      }
    }

    // Count enabled faucet providers and validate max 3
    const faucetProviderKeys = ['adsgramFaucetEnabled', 'monetagFaucetEnabled', 'adextraFaucetEnabled', 'adexoraFaucetEnabled'];
    const enabledFaucetProviders = faucetProviderKeys.filter(key => settings[key] === true);
    if (enabledFaucetProviders.length > MAX_FAUCET_PROVIDERS) {
      return res.status(400).json({ 
        message: `Maximum ${MAX_FAUCET_PROVIDERS} ad providers can be enabled for Faucet Claim. You have ${enabledFaucetProviders.length} enabled.`,
        enabledProviders: enabledFaucetProviders
      });
    }

    // Validate ads peering configuration if provided
    const validAdProviders = ['adsgram', 'monetag', 'adextra', 'adexora'];
    if (settings.adsPeeringGroups !== undefined) {
      if (!Array.isArray(settings.adsPeeringGroups)) {
        return res.status(400).json({
          message: 'adsPeeringGroups must be an array of arrays'
        });
      }
      
      // Validate each group
      for (let i = 0; i < settings.adsPeeringGroups.length; i++) {
        const group = settings.adsPeeringGroups[i];
        if (!Array.isArray(group)) {
          return res.status(400).json({
            message: `Peer group ${i + 1} must be an array`
          });
        }
        
        // Each group must have at least 2 providers
        if (group.length < 2) {
          return res.status(400).json({
            message: `Peer group ${i + 1} must have at least 2 providers`
          });
        }
        
        // Validate provider IDs
        const invalidProviders = group.filter(p => !validAdProviders.includes(p));
        if (invalidProviders.length > 0) {
          return res.status(400).json({
            message: `Invalid provider IDs in peer group ${i + 1}: ${invalidProviders.join(', ')}`
          });
        }
      }
      
      // Check no provider is in multiple groups
      const allProviders = settings.adsPeeringGroups.flat();
      const seen = new Set();
      for (const p of allProviders) {
        if (seen.has(p)) {
          return res.status(400).json({
            message: `Provider "${p}" cannot be in multiple peer groups`
          });
        }
        seen.add(p);
      }
    }

    // Build bulk write operations for efficiency
    const bulkOps = [];
    const updated = [];
    
    for (const [frontendKey, value] of Object.entries(settings)) {
      // Use mapped key or original key
      const key = keyMapping[frontendKey] || frontendKey;
      
      bulkOps.push({
        updateOne: {
          filter: { key },
          update: { 
            $set: { 
              value, 
              updatedAt: new Date() 
            } 
          },
          upsert: true
        }
      });
      updated.push(key);
    }
    
    // Execute all operations in a single batch
    if (bulkOps.length > 0) {
      await Settings.bulkWrite(bulkOps, { ordered: false });
    }

    // Invalidate faucet cache when settings are updated
    // This ensures immediate reflection of changes in the Mini App
    if (earningsRouter && typeof earningsRouter.invalidateFaucetCache === 'function') {
      earningsRouter.invalidateFaucetCache();
      console.log('[ADMIN] Faucet cache invalidated after settings update');
    }
    
    // Invalidate ads cache when settings are updated
    if (adsRouter && typeof adsRouter.invalidateAdCache === 'function') {
      adsRouter.invalidateAdCache();
      console.log('[ADMIN] Ads cache invalidated after settings update');
    }
    
    // Invalidate Turnstile cache when settings are updated
    if (turnstileMiddleware && typeof turnstileMiddleware.invalidateTurnstileCache === 'function') {
      turnstileMiddleware.invalidateTurnstileCache();
      console.log('[ADMIN] Turnstile cache invalidated after settings update');
    }
    
    // Invalidate currency cache when settings are updated
    if (currencyUtils && typeof currencyUtils.clearCurrencyCache === 'function') {
      currencyUtils.clearCurrencyCache();
      console.log('[ADMIN] Currency cache invalidated after settings update');
    }

    res.json({ message: 'Settings updated successfully', updated });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/settings', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({ message: 'Key is required' });
    }

    let setting = await Settings.findOne({ key });
    if (setting) {
      setting.value = value;
      setting.updatedAt = new Date();
      await setting.save();
    } else {
      setting = new Settings({ key, value });
      await setting.save();
    }

    res.json({ message: 'Setting updated', setting });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk update settings
router.post('/settings/bulk', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Settings object is required' });
    }

    const updated = [];
    for (const [key, value] of Object.entries(settings)) {
      let setting = await Settings.findOne({ key });
      if (setting) {
        setting.value = value;
        setting.updatedAt = new Date();
        await setting.save();
      } else {
        setting = new Settings({ key, value });
        await setting.save();
      }
      updated.push(key);
    }

    res.json({ message: 'Settings updated', updated });
  } catch (error) {
    console.error('Bulk update settings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Notification Management
router.get('/notifications', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type || '';

    const query = { isBroadcast: true };
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Enhanced broadcast with analytics logging
router.post('/notifications/broadcast', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { title, message, type, priority, expiresAt, sendTelegram, excludeBlocked } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Save notification to database
    const notification = new Notification({
      title,
      message,
      type: type || 'announcement',
      priority: priority || 'normal',
      isBroadcast: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    await notification.save();

    let telegramResult = null;
    let broadcastLog = null;

    // Send via Telegram if requested
    if (sendTelegram !== false) {
      try {
        // Build user query - exclude inactive and optionally blocked users
        const userQuery = { 
          status: 'active',
          telegramId: { $exists: true, $ne: '' }
        };
        
        // If excludeBlocked is true, exclude users who blocked the bot previously
        if (excludeBlocked) {
          userQuery.telegramBlocked = { $ne: true };
        }
        
        // Get all eligible users
        const users = await User.find(userQuery).select('_id telegramId username');

        // Create broadcast log entry
        broadcastLog = new BroadcastLog({
          title,
          message,
          type: type || 'announcement',
          priority: priority || 'normal',
          status: 'in_progress',
          stats: {
            totalTargeted: users.length
          },
          initiatedBy: req.admin?._id,
          metadata: {
            channel: 'telegram',
            batchSize: users.length > 1000 ? 20 : 25,
            delayBetweenBatches: users.length > 1000 ? 1500 : 1100
          }
        });
        await broadcastLog.save();

        if (users.length > 0) {
          telegramResult = await sendBroadcast(users, title, message, {
            priority: priority || 'normal',
            batchSize: broadcastLog.metadata.batchSize,
            delay: broadcastLog.metadata.delayBetweenBatches
          });
          
          // Update broadcast log with results
          broadcastLog.updateStats(
            telegramResult.sent || 0,
            telegramResult.failed || 0,
            telegramResult.blocked || 0,
            telegramResult.skipped || 0
          );
          broadcastLog.complete();
          
          // Store blocked user IDs for reference
          if (telegramResult.blockedUserIds && telegramResult.blockedUserIds.length > 0) {
            broadcastLog.blockedUsers = telegramResult.blockedUserIds;
            
            // Mark users as blocked in database for future broadcasts
            await User.updateMany(
              { _id: { $in: telegramResult.blockedUserIds } },
              { $set: { telegramBlocked: true, telegramBlockedAt: new Date() } }
            );
          }
          
          // Store sample errors
          if (telegramResult.errors && telegramResult.errors.length > 0) {
            broadcastLog.errors = telegramResult.errors.slice(0, 20).map(e => ({
              telegramId: e.telegramId,
              userId: e.userId,
              error: e.error,
              errorCode: e.errorCode
            }));
          }
          
          await broadcastLog.save();
        } else {
          telegramResult = { ok: false, error: 'No eligible users to send to', sent: 0, total: 0 };
          broadcastLog.status = 'completed';
          broadcastLog.complete();
          await broadcastLog.save();
        }
      } catch (telegramError) {
        console.error('Telegram broadcast error:', telegramError);
        telegramResult = { ok: false, error: telegramError.message, sent: 0 };
        
        if (broadcastLog) {
          broadcastLog.status = 'failed';
          broadcastLog.errors.push({
            error: telegramError.message,
            timestamp: new Date()
          });
          await broadcastLog.save();
        }
      }
    }

    res.json({ 
      message: 'Broadcast notification sent', 
      notification,
      telegram: telegramResult,
      broadcastId: broadcastLog?.broadcastId
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get broadcast history with analytics
router.get('/broadcasts', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const [broadcasts, total] = await Promise.all([
      BroadcastLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BroadcastLog.countDocuments(query)
    ]);

    // Get aggregate stats
    const aggregateStats = await BroadcastLog.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalBroadcasts: { $sum: 1 },
          totalMessagesSent: { $sum: '$stats.totalSent' },
          totalMessagesFailed: { $sum: '$stats.totalFailed' },
          totalUsersBlocked: { $sum: '$stats.totalBlocked' },
          avgDeliveryRate: { $avg: '$stats.deliveryRate' }
        }
      }
    ]);

    res.json({
      broadcasts,
      stats: aggregateStats[0] || {
        totalBroadcasts: 0,
        totalMessagesSent: 0,
        totalMessagesFailed: 0,
        totalUsersBlocked: 0,
        avgDeliveryRate: 0
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get broadcasts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single broadcast details
router.get('/broadcasts/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const broadcast = await BroadcastLog.findOne({ 
      $or: [
        { _id: req.params.id },
        { broadcastId: req.params.id }
      ]
    }).populate('blockedUsers', 'username telegramId');

    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }

    res.json({ broadcast });
  } catch (error) {
    console.error('Get broadcast error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get broadcast estimate before sending
router.get('/broadcasts/estimate', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const excludeBlocked = req.query.excludeBlocked === 'true';
    
    const userQuery = { 
      status: 'active',
      telegramId: { $exists: true, $ne: '' }
    };
    
    if (excludeBlocked) {
      userQuery.telegramBlocked = { $ne: true };
    }
    
    const userCount = await User.countDocuments(userQuery);
    const blockedCount = await User.countDocuments({ telegramBlocked: true });
    const estimate = getEstimatedBroadcastTime(userCount);

    res.json({
      eligibleUsers: userCount,
      blockedUsers: blockedCount,
      estimate
    });
  } catch (error) {
    console.error('Get estimate error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear blocked status for users (admin can reset)
router.post('/broadcasts/reset-blocked', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const result = await User.updateMany(
      { telegramBlocked: true },
      { $unset: { telegramBlocked: 1, telegramBlockedAt: 1 } }
    );

    res.json({
      message: 'Blocked status reset for all users',
      usersAffected: result.modifiedCount
    });
  } catch (error) {
    console.error('Reset blocked error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/notifications/send', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { userId, title, message, type, priority, sendTelegram } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ message: 'User ID, title, and message are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const notification = new Notification({
      user: userId,
      title,
      message,
      type: type || 'system',
      priority: priority || 'normal'
    });
    await notification.save();

    let telegramResult = null;

    // Send via Telegram if requested and user has telegram ID
    if (sendTelegram !== false && user.telegramId) {
      try {
        const { sendNotification } = require('../utils/telegramBot');
        telegramResult = await sendNotification(user.telegramId, title, message, type);
      } catch (telegramError) {
        console.error('Telegram send error:', telegramError);
        telegramResult = { ok: false, error: telegramError.message };
      }
    }

    res.json({ message: 'Notification sent', notification, telegram: telegramResult });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/notifications/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin Management
router.get('/admins', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({ admins });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/admins', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const admin = new Admin({
      username,
      password,
      role: role || 'moderator'
    });
    await admin.save();

    res.json({ 
      message: 'Admin created', 
      admin: { 
        id: admin._id, 
        username: admin.username, 
        role: admin.role 
      } 
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/admins/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    if (req.admin._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json({ message: 'Admin deleted' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export data
router.get('/export/withdrawals', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const query = {};
    if (status !== 'all') {
      query.status = status;
    }
    if (startDate || endDate) {
      query.requestedAt = {};
      if (startDate) query.requestedAt.$gte = startDate;
      if (endDate) query.requestedAt.$lte = endDate;
    }

    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'username telegramId')
      .sort({ requestedAt: -1 });

    res.json({ withdrawals });
  } catch (error) {
    console.error('Export withdrawals error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// FAUCETPAY MANAGEMENT
// ============================================
const FaucetPayPayment = require('../models/FaucetPayPayment');

// Get FaucetPay payment history
router.get('/faucetpay/payments', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';
    const search = req.query.search || '';

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    let payments = await FaucetPayPayment.find(query)
      .populate('user', 'username telegramId firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      payments = payments.filter(p => 
        p.user?.username?.toLowerCase().includes(searchLower) ||
        p.user?.telegramId?.includes(search) ||
        p.recipientAddress?.toLowerCase().includes(searchLower) ||
        p.payoutId?.toLowerCase().includes(searchLower)
      );
    }

    const total = await FaucetPayPayment.countDocuments(query);

    // Calculate stats
    const stats = await FaucetPayPayment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    const statsObj = {
      total: 0,
      success: { count: 0, total: 0 },
      failed: { count: 0, total: 0 },
      pending: { count: 0, total: 0 }
    };
    stats.forEach(s => {
      statsObj[s._id] = { count: s.count, total: s.total };
      statsObj.total += s.count;
    });

    res.json({
      payments,
      stats: statsObj,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('FaucetPay payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get FaucetPay stats
router.get('/faucetpay/stats', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Overall stats
    const overallStats = await FaucetPayPayment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalFees: { $sum: '$fee' }
        }
      }
    ]);

    // Daily stats
    const dailyStats = await FaucetPayPayment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'success' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top withdrawers
    const topWithdrawers = await FaucetPayPayment.aggregate([
      { $match: { status: 'success' } },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $project: {
          count: 1,
          totalAmount: 1,
          user: { $arrayElemAt: ['$userInfo', 0] }
        }
      }
    ]);

    res.json({
      overallStats,
      dailyStats,
      topWithdrawers: topWithdrawers.map(t => ({
        username: t.user?.username || t.user?.telegramId || 'Unknown',
        telegramId: t.user?.telegramId,
        count: t.count,
        totalAmount: t.totalAmount
      }))
    });
  } catch (error) {
    console.error('FaucetPay stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test FaucetPay API connection
router.post('/faucetpay/test', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { apiKey, currency } = req.body;

    if (!apiKey) {
      return res.status(400).json({ message: 'API key is required' });
    }

    const axios = require('axios');
    const formData = new URLSearchParams();
    formData.append('api_key', apiKey);
    formData.append('currency', (currency || 'TRX').toLowerCase());

    const response = await axios.post('https://faucetpay.io/api/v1/balance', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    if (response.data.status === 200) {
      res.json({
        success: true,
        message: 'API connection successful',
        balance: response.data.balance,
        currency: response.data.currency
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.message || 'API test failed'
      });
    }
  } catch (error) {
    console.error('FaucetPay test error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to connect to FaucetPay'
    });
  }
});

// Get FaucetPay balance
router.get('/faucetpay/balance', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const apiKeySetting = await Settings.findOne({ key: 'faucetpay_api_key' });
    const currencySetting = await Settings.findOne({ key: 'faucetpay_currency' });

    if (!apiKeySetting?.value) {
      return res.status(400).json({ message: 'FaucetPay API key not configured' });
    }

    const axios = require('axios');
    const formData = new URLSearchParams();
    formData.append('api_key', apiKeySetting.value);
    formData.append('currency', (currencySetting?.value || 'TRX').toLowerCase());

    const response = await axios.post('https://faucetpay.io/api/v1/balance', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    if (response.data.status === 200) {
      res.json({
        success: true,
        balance: response.data.balance,
        currency: response.data.currency?.toUpperCase()
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.message || 'Failed to get balance'
      });
    }
  } catch (error) {
    console.error('FaucetPay balance error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get FaucetPay balance'
    });
  }
});

router.get('/export/users', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const users = await User.find()
      .select('telegramId username firstName lastName balance totalEarnings totalWithdrawals referralCode status createdAt')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// WITHDRAWAL METHODS MANAGEMENT
// ============================================
const WithdrawalMethod = require('../models/WithdrawalMethod');

// Get all withdrawal methods
router.get('/withdrawal-methods', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const methods = await WithdrawalMethod.find().sort({ sortOrder: 1, name: 1 });
    res.json({ methods });
  } catch (error) {
    console.error('Get withdrawal methods error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create withdrawal method
router.post('/withdrawal-methods', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { 
      name, description, logo, currency, 
      minAmount, maxAmount, processingTime, 
      fee, feeType, customFields, isEnabled, sortOrder 
    } = req.body;

    if (!name || minAmount === undefined || maxAmount === undefined) {
      return res.status(400).json({ message: 'Name, minimum amount, and maximum amount are required' });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    // Check if slug already exists
    const existingMethod = await WithdrawalMethod.findOne({ slug });
    if (existingMethod) {
      return res.status(400).json({ message: 'A withdrawal method with this name already exists' });
    }

    const method = new WithdrawalMethod({
      name,
      slug,
      description: description || '',
      logo: logo || '',
      currency: currency || 'USD',
      minAmount: parseFloat(minAmount),
      maxAmount: parseFloat(maxAmount),
      processingTime: processingTime || '24-48 hours',
      fee: parseFloat(fee) || 0,
      feeType: feeType || 'fixed',
      customFields: customFields || [],
      isEnabled: isEnabled !== false,
      sortOrder: sortOrder || 0
    });

    await method.save();
    res.status(201).json({ message: 'Withdrawal method created', method });
  } catch (error) {
    console.error('Create withdrawal method error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update withdrawal method
router.patch('/withdrawal-methods/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { 
      name, description, logo, currency, 
      minAmount, maxAmount, processingTime, 
      fee, feeType, customFields, isEnabled, sortOrder 
    } = req.body;

    const method = await WithdrawalMethod.findById(req.params.id);
    if (!method) {
      return res.status(404).json({ message: 'Withdrawal method not found' });
    }

    // Update fields
    if (name !== undefined) {
      method.name = name;
      method.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }
    if (description !== undefined) method.description = description;
    if (logo !== undefined) method.logo = logo;
    if (currency !== undefined) method.currency = currency;
    if (minAmount !== undefined) method.minAmount = parseFloat(minAmount);
    if (maxAmount !== undefined) method.maxAmount = parseFloat(maxAmount);
    if (processingTime !== undefined) method.processingTime = processingTime;
    if (fee !== undefined) method.fee = parseFloat(fee);
    if (feeType !== undefined) method.feeType = feeType;
    if (customFields !== undefined) method.customFields = customFields;
    if (isEnabled !== undefined) method.isEnabled = isEnabled;
    if (sortOrder !== undefined) method.sortOrder = sortOrder;

    await method.save();
    res.json({ message: 'Withdrawal method updated', method });
  } catch (error) {
    console.error('Update withdrawal method error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle withdrawal method status
router.patch('/withdrawal-methods/:id/toggle', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const method = await WithdrawalMethod.findById(req.params.id);
    if (!method) {
      return res.status(404).json({ message: 'Withdrawal method not found' });
    }

    method.isEnabled = !method.isEnabled;
    await method.save();
    
    res.json({ 
      message: `Withdrawal method ${method.isEnabled ? 'enabled' : 'disabled'}`, 
      method 
    });
  } catch (error) {
    console.error('Toggle withdrawal method error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete withdrawal method
router.delete('/withdrawal-methods/:id', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const method = await WithdrawalMethod.findByIdAndDelete(req.params.id);
    if (!method) {
      return res.status(404).json({ message: 'Withdrawal method not found' });
    }

    res.json({ message: 'Withdrawal method deleted' });
  } catch (error) {
    console.error('Delete withdrawal method error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// ADMIN PROFILE ROUTES
// ============================================

const { 
  generateSecret, 
  verifyTOTP, 
  generateBackupCodes, 
  generateOtpauthUrl 
} = require('../utils/twoFactor');

// Get current admin profile
router.get('/profile', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password -twoFactorSecret -twoFactorBackupCodes');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json({ 
      admin: {
        ...admin.toObject(),
        twoFactorEnabled: admin.twoFactorEnabled || false
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update admin profile (username, email, password)
router.put('/profile', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin._id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Track what was updated
    const updates = [];

    // Update username if provided
    if (username && username !== admin.username) {
      // Check if username already exists
      const existingAdmin = await Admin.findOne({ username, _id: { $ne: admin._id } });
      if (existingAdmin) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      admin.username = username;
      updates.push('username');
    }

    // Update email if provided
    if (email !== undefined) {
      admin.email = email || null;
      updates.push('email');
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }
      
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }
      
      admin.password = newPassword; // Will be hashed by pre-save hook
      updates.push('password');
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No changes to update' });
    }

    await admin.save();

    res.json({ 
      message: `Profile updated successfully (${updates.join(', ')})`,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        twoFactorEnabled: admin.twoFactorEnabled
      }
    });
  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// TWO-FACTOR AUTHENTICATION ROUTES
// ============================================

// Get 2FA status
router.get('/2fa/status', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('twoFactorEnabled twoFactorBackupCodes');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    res.json({
      enabled: admin.twoFactorEnabled,
      backupCodesRemaining: admin.twoFactorBackupCodes?.length || 0
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate 2FA setup (secret + QR code URL)
router.post('/2fa/setup', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    if (admin.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled. Disable it first to set up again.' });
    }
    
    // Generate new secret
    const secret = generateSecret();
    
    // Generate otpauth URL for QR code
    const otpauthUrl = generateOtpauthUrl(secret, admin.username);
    
    // Temporarily store the secret (not enabled yet)
    admin.twoFactorSecret = secret;
    await admin.save();
    
    res.json({
      secret,
      otpauthUrl,
      message: 'Scan the QR code with your authenticator app, then verify with a code to enable 2FA.'
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify and enable 2FA
router.post('/2fa/enable', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { code, password } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Verification code is required' });
    }
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required to enable 2FA' });
    }
    
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    if (!admin.twoFactorSecret) {
      return res.status(400).json({ message: 'Please run 2FA setup first' });
    }
    
    if (admin.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }
    
    // Verify the code
    const isValidCode = verifyTOTP(admin.twoFactorSecret, code);
    if (!isValidCode) {
      return res.status(400).json({ message: 'Invalid verification code. Make sure your authenticator app time is synced.' });
    }
    
    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    
    // Enable 2FA
    admin.twoFactorEnabled = true;
    admin.twoFactorBackupCodes = backupCodes;
    await admin.save();
    
    console.log(`[2FA] Enabled for admin: ${admin.username}`);
    
    res.json({
      message: '2FA has been enabled successfully!',
      backupCodes,
      warning: 'Save these backup codes in a safe place. Each code can only be used once.'
    });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Disable 2FA
router.post('/2fa/disable', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { password, code } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required to disable 2FA' });
    }
    
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    if (!admin.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }
    
    // If code is provided, verify it (optional extra security)
    if (code) {
      const isValidCode = verifyTOTP(admin.twoFactorSecret, code);
      const isBackupCode = admin.twoFactorBackupCodes.includes(code);
      
      if (!isValidCode && !isBackupCode) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }
    }
    
    // Disable 2FA
    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = null;
    admin.twoFactorBackupCodes = [];
    await admin.save();
    
    console.log(`[2FA] Disabled for admin: ${admin.username}`);
    
    res.json({
      message: '2FA has been disabled successfully.'
    });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Regenerate backup codes
router.post('/2fa/backup-codes', authenticateAdmin, requireValidLicense, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    if (!admin.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA must be enabled to regenerate backup codes' });
    }
    
    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);
    admin.twoFactorBackupCodes = backupCodes;
    await admin.save();
    
    console.log(`[2FA] Backup codes regenerated for admin: ${admin.username}`);
    
    res.json({
      message: 'Backup codes have been regenerated.',
      backupCodes,
      warning: 'Your old backup codes are now invalid. Save these new codes in a safe place.'
    });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
