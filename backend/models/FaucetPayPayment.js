const mongoose = require('mongoose');

const faucetPayPaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  withdrawal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal',
    default: null
  },
  // FaucetPay transaction details
  payoutId: {
    type: String,
    default: ''
  },
  payoutUserHash: {
    type: String,
    default: ''
  },
  // Amount details
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    uppercase: true
  },
  // User's FaucetPay linked email
  recipientAddress: {
    type: String,
    required: true
  },
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled'],
    default: 'pending'
  },
  // FaucetPay API response
  apiResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  errorMessage: {
    type: String,
    default: ''
  },
  // Fee charged
  fee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    default: 0
  },
  // Currency conversion tracking
  currencyMode: {
    type: String,
    enum: ['fiat', 'points'],
    default: 'fiat'
  },
  exchangeRate: {
    type: Number,
    default: 1 // Points per 1 USD
  },
  usdEquivalent: {
    type: Number,
    default: 0 // USD equivalent of the payout
  },
  // Crypto conversion tracking
  cryptoAmount: {
    type: Number,
    default: 0 // Actual crypto amount sent (e.g., 0.001 BTC)
  },
  coinExchangeRate: {
    type: Number,
    default: 0 // USD per 1 coin at time of transaction
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date,
    default: null
  }
});

// Index for efficient queries
faucetPayPaymentSchema.index({ user: 1, createdAt: -1 });
faucetPayPaymentSchema.index({ status: 1 });
faucetPayPaymentSchema.index({ payoutId: 1 });
faucetPayPaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FaucetPayPayment', faucetPayPaymentSchema);
