const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateUser } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const FaucetPayPayment = require('../models/FaucetPayPayment');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const { sendMessage } = require('../utils/telegramBot');
const { getCurrencySettings, getPayoutAmount } = require('../utils/currency');

// FaucetPay API Base URL
const FAUCETPAY_API_URL = 'https://faucetpay.io/api/v1';

// Supported currencies with their minimum amounts (in satoshi/smallest unit)
const SUPPORTED_CURRENCIES = {
  'BTC': { name: 'Bitcoin', minAmount: 1 },
  'ETH': { name: 'Ethereum', minAmount: 1 },
  'DOGE': { name: 'Dogecoin', minAmount: 1 },
  'LTC': { name: 'Litecoin', minAmount: 1 },
  'BCH': { name: 'Bitcoin Cash', minAmount: 1 },
  'DASH': { name: 'Dash', minAmount: 1 },
  'DGB': { name: 'DigiByte', minAmount: 1 },
  'TRX': { name: 'Tron', minAmount: 1 },
  'USDT': { name: 'Tether', minAmount: 1 },
  'FEY': { name: 'Feyorra', minAmount: 1 },
  'ZEC': { name: 'Zcash', minAmount: 1 },
  'BNB': { name: 'Binance Coin', minAmount: 1 },
  'SOL': { name: 'Solana', minAmount: 1 },
  'XRP': { name: 'Ripple', minAmount: 1 },
  'POL': { name: 'Polygon', minAmount: 1 },
  'ADA': { name: 'Cardano', minAmount: 1 },
  'TON': { name: 'Toncoin', minAmount: 1 },
  'XLM': { name: 'Stellar', minAmount: 1 },
  'USDC': { name: 'USD Coin', minAmount: 1 },
  'XMR': { name: 'Monero', minAmount: 1 },
  'TARA': { name: 'Taraxa', minAmount: 1 },
  'TRUMP': { name: 'Trump', minAmount: 1 },
  'PEPE': { name: 'Pepe', minAmount: 1 },
  'FLT': { name: 'Fluent', minAmount: 1 }
};

// Helper function to get FaucetPay settings
async function getFaucetPaySettings() {
  const settings = await Settings.find({
    key: { $regex: /^faucetpay_/ }
  });
  
  const settingsObj = {};
  settings.forEach(s => {
    const key = s.key.replace('faucetpay_', '');
    settingsObj[key] = s.value;
  });
  
  return {
    enabled: settingsObj.enabled === true,
    apiKey: settingsObj.api_key || '',
    currency: settingsObj.currency || 'TRX',
    minWithdrawal: parseFloat(settingsObj.min_withdrawal) || 1,
    maxWithdrawal: parseFloat(settingsObj.max_withdrawal) || 1000,
    fee: parseFloat(settingsObj.fee) || 0,
    feeType: settingsObj.fee_type || 'percentage',
    processingTime: settingsObj.processing_time || 'Instant',
    dailyLimit: parseInt(settingsObj.daily_limit) || 0,
    referToAccountBalance: settingsObj.refer_to_account_balance === true
  };
}

// Check if user can withdraw via FaucetPay
async function canWithdraw(userId, amount, fpSettings) {
  // Check daily limit
  if (fpSettings.dailyLimit > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPayments = await FaucetPayPayment.countDocuments({
      user: userId,
      status: 'success',
      createdAt: { $gte: today }
    });
    
    if (todayPayments >= fpSettings.dailyLimit) {
      return { allowed: false, reason: 'Daily withdrawal limit reached' };
    }
  }
  
  // Check pending payment
  const pendingPayment = await FaucetPayPayment.findOne({
    user: userId,
    status: 'pending'
  });
  
  if (pendingPayment) {
    return { allowed: false, reason: 'You have a pending FaucetPay withdrawal' };
  }
  
  return { allowed: true };
}

// Calculate fee
function calculateFee(amount, fpSettings) {
  if (fpSettings.feeType === 'percentage') {
    return (amount * fpSettings.fee) / 100;
  }
  return fpSettings.fee;
}

// Get FaucetPay info for users
router.get('/info', authenticateUser, async (req, res) => {
  try {
    const fpSettings = await getFaucetPaySettings();
    
    if (!fpSettings.enabled) {
      return res.json({
        enabled: false,
        message: 'FaucetPay withdrawals are currently disabled'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    // Get currency settings
    const currencySettings = await getCurrencySettings();
    
    // Get today's withdrawals count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayWithdrawals = await FaucetPayPayment.countDocuments({
      user: user._id,
      status: 'success',
      createdAt: { $gte: today }
    });
    
    res.json({
      enabled: true,
      currency: fpSettings.currency,
      currencyName: SUPPORTED_CURRENCIES[fpSettings.currency]?.name || fpSettings.currency,
      minWithdrawal: fpSettings.minWithdrawal,
      maxWithdrawal: fpSettings.maxWithdrawal,
      fee: fpSettings.fee,
      feeType: fpSettings.feeType,
      processingTime: fpSettings.processingTime,
      dailyLimit: fpSettings.dailyLimit,
      todayWithdrawals,
      remainingToday: fpSettings.dailyLimit > 0 ? Math.max(0, fpSettings.dailyLimit - todayWithdrawals) : -1,
      userBalance: user.balance,
      // Currency configuration
      platformCurrencyMode: currencySettings.mode,
      platformCurrencyName: currencySettings.currencyName,
      platformCurrencySymbol: currencySettings.currencySymbol,
      exchangeRate: currencySettings.exchangeRate,
      supportedCurrencies: Object.keys(SUPPORTED_CURRENCIES).map(code => ({
        code,
        name: SUPPORTED_CURRENCIES[code].name
      }))
    });
  } catch (error) {
    console.error('FaucetPay info error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process instant FaucetPay withdrawal (protected by Turnstile)
router.post('/withdraw', authenticateUser, verifyTurnstile, async (req, res) => {
  try {
    const { amount, address } = req.body;
    
    if (!amount || !address) {
      return res.status(400).json({ message: 'Amount and FaucetPay email/address are required' });
    }
    
    const fpSettings = await getFaucetPaySettings();
    
    if (!fpSettings.enabled) {
      return res.status(403).json({ message: 'FaucetPay withdrawals are currently disabled' });
    }
    
    if (!fpSettings.apiKey) {
      return res.status(500).json({ message: 'FaucetPay is not configured properly' });
    }
    
    const user = await User.findById(req.user._id);
    
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }
    
    const withdrawAmount = parseFloat(amount);
    
    // Validate amount
    if (withdrawAmount < fpSettings.minWithdrawal) {
      return res.status(400).json({ 
        message: `Minimum withdrawal is ${fpSettings.minWithdrawal} ${fpSettings.currency}` 
      });
    }
    
    if (withdrawAmount > fpSettings.maxWithdrawal) {
      return res.status(400).json({ 
        message: `Maximum withdrawal is ${fpSettings.maxWithdrawal} ${fpSettings.currency}` 
      });
    }
    
    if (user.balance < withdrawAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    // Check withdrawal eligibility
    const canWithdrawResult = await canWithdraw(user._id, withdrawAmount, fpSettings);
    if (!canWithdrawResult.allowed) {
      return res.status(400).json({ message: canWithdrawResult.reason });
    }
    
    // Calculate fee
    const fee = calculateFee(withdrawAmount, fpSettings);
    const netAmount = withdrawAmount - fee;
    
    // Get currency settings for payout calculation
    const currencySettings = await getCurrencySettings();
    const payoutInfo = await getPayoutAmount(netAmount, currencySettings);
    
    // Create payment record
    const payment = new FaucetPayPayment({
      user: user._id,
      amount: withdrawAmount,
      currency: fpSettings.currency,
      recipientAddress: address.trim(),
      fee,
      netAmount,
      // Currency conversion tracking
      currencyMode: currencySettings.mode,
      exchangeRate: currencySettings.exchangeRate,
      usdEquivalent: payoutInfo.payoutAmount,
      status: 'pending'
    });
    await payment.save();
    
    // Deduct balance immediately
    user.balance -= withdrawAmount;
    await user.save();
    
    try {
      // Make FaucetPay API call
      const formData = new URLSearchParams();
      formData.append('api_key', fpSettings.apiKey);
      formData.append('amount', Math.round(netAmount * 100000000)); // Convert to satoshi
      formData.append('to', address.trim());
      formData.append('currency', fpSettings.currency.toLowerCase());
      
      if (fpSettings.referToAccountBalance) {
        formData.append('referral', 'true');
      }
      
      const apiResponse = await axios.post(`${FAUCETPAY_API_URL}/send`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });
      
      payment.apiResponse = apiResponse.data;
      
      if (apiResponse.data.status === 200) {
        // Success
        payment.status = 'success';
        payment.payoutId = apiResponse.data.payout_id || '';
        payment.payoutUserHash = apiResponse.data.payout_user_hash || '';
        payment.processedAt = new Date();
        await payment.save();
        
        // Update user stats
        user.totalWithdrawals = (user.totalWithdrawals || 0) + withdrawAmount;
        await user.save();
        
        // Create withdrawal record for history
        const withdrawal = new Withdrawal({
          user: user._id,
          amount: withdrawAmount,
          method: `FaucetPay (${fpSettings.currency})`,
          address: address.trim(),
          status: 'approved',
          fee,
          netAmount,
          transactionId: payment.payoutId,
          processedAt: new Date(),
          // Currency conversion fields
          currencyMode: currencySettings.mode,
          exchangeRate: currencySettings.exchangeRate,
          usdPayoutAmount: payoutInfo.payoutAmount
        });
        await withdrawal.save();
        
        payment.withdrawal = withdrawal._id;
        await payment.save();
        
        // Send notification
        const notification = new Notification({
          user: user._id,
          type: 'reward',
          title: 'Withdrawal Successful!',
          message: `Your withdrawal of ${netAmount} ${fpSettings.currency} has been sent to ${address}`,
          priority: 'high'
        });
        await notification.save();
        
        // Telegram notification
        if (user.telegramId) {
          const telegramMessage = `✅ <b>Withdrawal Successful!</b>\n\n💰 Amount: <b>${netAmount} ${fpSettings.currency}</b>\n📧 To: ${address}\n🆔 Payout ID: ${payment.payoutId}\n\nYour funds have been sent instantly via FaucetPay!`;
          sendMessage(user.telegramId, telegramMessage).catch(err => {
            console.error('Failed to send FaucetPay notification:', err);
          });
        }
        
        res.json({
          success: true,
          message: 'Withdrawal successful!',
          payment: {
            id: payment._id,
            amount: withdrawAmount,
            fee,
            netAmount,
            currency: fpSettings.currency,
            payoutId: payment.payoutId,
            status: 'success'
          }
        });
      } else {
        // API returned error
        payment.status = 'failed';
        payment.errorMessage = apiResponse.data.message || 'Unknown error from FaucetPay';
        await payment.save();
        
        // Refund balance
        user.balance += withdrawAmount;
        await user.save();
        
        // Telegram notification for failed withdrawal
        if (user.telegramId) {
          const telegramMessage = `❌ <b>Withdrawal Failed</b>\n\n💰 Amount: <b>${withdrawAmount} ${fpSettings.currency}</b>\n📧 To: ${address}\n\n⚠️ Reason: ${apiResponse.data.message || 'Unknown error'}\n\n💵 Your balance has been refunded. Please check your FaucetPay email/address and try again.`;
          sendMessage(user.telegramId, telegramMessage).catch(err => {
            console.error('Failed to send FaucetPay failure notification:', err);
          });
        }
        
        res.status(400).json({
          success: false,
          message: apiResponse.data.message || 'FaucetPay payment failed'
        });
      }
    } catch (apiError) {
      // API call failed
      payment.status = 'failed';
      payment.errorMessage = apiError.response?.data?.message || apiError.message || 'API request failed';
      payment.apiResponse = apiError.response?.data || {};
      await payment.save();
      
      // Refund balance
      user.balance += withdrawAmount;
      await user.save();
      
      // Telegram notification for API error
      if (user.telegramId) {
        const telegramMessage = `❌ <b>Withdrawal Failed</b>\n\n💰 Amount: <b>${withdrawAmount} ${fpSettings.currency}</b>\n\n⚠️ There was a technical issue processing your withdrawal.\n\n💵 Your balance has been refunded. Please try again later.`;
        sendMessage(user.telegramId, telegramMessage).catch(err => {
          console.error('Failed to send FaucetPay error notification:', err);
        });
      }
      
      console.error('FaucetPay API error:', apiError);
      
      res.status(500).json({
        success: false,
        message: 'Failed to process FaucetPay withdrawal. Please try again later.'
      });
    }
  } catch (error) {
    console.error('FaucetPay withdrawal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's FaucetPay payment history
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const payments = await FaucetPayPayment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await FaucetPayPayment.countDocuments({ user: req.user._id });
    
    res.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('FaucetPay history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Check FaucetPay balance (Admin use)
router.get('/balance', authenticateUser, async (req, res) => {
  try {
    const fpSettings = await getFaucetPaySettings();
    
    if (!fpSettings.apiKey) {
      return res.status(400).json({ message: 'FaucetPay API key not configured' });
    }
    
    const formData = new URLSearchParams();
    formData.append('api_key', fpSettings.apiKey);
    formData.append('currency', fpSettings.currency.toLowerCase());
    
    const response = await axios.post(`${FAUCETPAY_API_URL}/balance`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    
    if (response.data.status === 200) {
      res.json({
        success: true,
        balance: response.data.balance,
        currency: response.data.currency
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.message || 'Failed to get balance'
      });
    }
  } catch (error) {
    console.error('FaucetPay balance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
