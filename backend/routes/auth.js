const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateUser } = require('../middleware/auth');

// Telegram login/register
router.post('/telegram', async (req, res) => {
  try {
    const { id, username, first_name, last_name, referralCode } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'Telegram ID is required' });
    }

    // Log referral code for debugging
    if (referralCode) {
      console.log(`[Referral] User ${id} came with referral code: ${referralCode}`);
    }

    // Find or create user
    let user = await User.findOne({ telegramId: id.toString() });
    const isNewUser = !user;
    
    if (user) {
      // Update user info and last login
      user.username = username || user.username;
      user.firstName = first_name || user.firstName;
      user.lastName = last_name || user.lastName;
      user.lastLogin = new Date();
      user.ipAddress = req.ip;
      user.userAgent = req.get('user-agent') || '';
      await user.save();
    } else {
      // Create new user
      user = new User({
        telegramId: id.toString(),
        username: username || '',
        firstName: first_name || '',
        lastName: last_name || '',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || ''
      });
      await user.save();

      // Handle referral code for NEW users only
      const refCode = referralCode || req.query.ref;
      if (refCode) {
        try {
          const referrer = await User.findOne({ referralCode: refCode.toUpperCase() });
          if (referrer && referrer._id.toString() !== user._id.toString()) {
            user.referredBy = referrer._id;
            await user.save();
            console.log(`[Referral] SUCCESS: User ${user.telegramId} referred by ${referrer.telegramId} (code: ${refCode})`);
          } else if (!referrer) {
            console.log(`[Referral] FAILED: Referral code ${refCode} not found`);
          }
        } catch (error) {
          console.error('[Referral] Error processing referral:', error);
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
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
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify token
router.get('/verify', authenticateUser, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      telegramId: req.user.telegramId,
      username: req.user.username,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      balance: req.user.balance,
      totalEarnings: req.user.totalEarnings,
      totalWithdrawals: req.user.totalWithdrawals,
      referralCode: req.user.referralCode,
      status: req.user.status,
      createdAt: req.user.createdAt
    }
  });
});

module.exports = router;
