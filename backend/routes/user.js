const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const User = require('../models/User');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');

// Get user dashboard data
router.get('/dashboard', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get recent earnings
    const recentEarnings = await Earning.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('taskId', 'title')
      .populate('referralUserId', 'username');

    // Get recent withdrawals
    const recentWithdrawals = await Withdrawal.find({ user: user._id })
      .sort({ requestedAt: -1 })
      .limit(10);

    res.json({
      user: {
        id: user._id,
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
        lastFaucetClaim: user.lastFaucetClaim,
        createdAt: user.createdAt
      },
      recentEarnings,
      recentWithdrawals
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Count referrals
    const referralCount = await User.countDocuments({ referredBy: user._id });
    
    res.json({
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        balance: user.balance,
        totalEarnings: user.totalEarnings,
        totalWithdrawals: user.totalWithdrawals,
        referralCode: user.referralCode,
        referralEarnings: user.referralEarnings,
        referralCount,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get earnings history
router.get('/earnings', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type;

    const query = { user: req.user._id };
    if (type && type !== 'all') {
      query.type = type;
    }

    const earnings = await Earning.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('taskId', 'title')
      .populate('referralUserId', 'username');

    const total = await Earning.countDocuments(query);

    // Calculate stats
    const allEarnings = await Earning.find({ user: req.user._id });
    const stats = {
      total: allEarnings.reduce((sum, e) => sum + e.amount, 0),
      faucet: allEarnings.filter(e => e.type === 'faucet').reduce((sum, e) => sum + e.amount, 0),
      task: allEarnings.filter(e => e.type === 'task').reduce((sum, e) => sum + e.amount, 0),
      referral: allEarnings.filter(e => e.type === 'referral').reduce((sum, e) => sum + e.amount, 0),
      ads: allEarnings.filter(e => e.type === 'ads').reduce((sum, e) => sum + e.amount, 0),
      bonus: allEarnings.filter(e => e.type === 'bonus').reduce((sum, e) => sum + e.amount, 0)
    };

    res.json({
      earnings,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Earnings history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get withdrawal history
router.get('/withdrawals', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const withdrawals = await Withdrawal.find({ user: req.user._id })
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Withdrawal.countDocuments({ user: req.user._id });

    res.json({
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Withdrawal history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
