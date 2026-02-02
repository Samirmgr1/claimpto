const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // Reference to WithdrawalMethod
  withdrawalMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WithdrawalMethod',
    default: null
  },
  // Legacy field for backward compatibility
  method: {
    type: String,
    default: ''
  },
  // Dynamic fields submitted by user
  submittedFields: {
    type: Map,
    of: String,
    default: {}
  },
  // Legacy address field
  address: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    default: ''
  },
  fee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    default: 0
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date,
    default: null
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  adminNote: {
    type: String,
    default: ''
  },
  // Currency conversion fields
  currencyMode: {
    type: String,
    enum: ['fiat', 'points'],
    default: 'fiat'
  },
  exchangeRate: {
    type: Number,
    default: 1 // Points per 1 USD
  },
  usdPayoutAmount: {
    type: Number,
    default: 0 // Actual USD amount to be paid out
  }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
