const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'email', 'number', 'textarea'],
    default: 'text'
  },
  placeholder: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: true
  },
  validation: {
    type: String,
    default: ''
  }
}, { _id: false });

const withdrawalMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    default: ''
  },
  logo: {
    type: String,
    default: ''
  },
  currency: {
    type: String,
    default: 'USD'
  },
  minAmount: {
    type: Number,
    required: true,
    min: 0
  },
  maxAmount: {
    type: Number,
    required: true,
    min: 0
  },
  processingTime: {
    type: String,
    default: '24-48 hours'
  },
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  feeType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  customFields: [customFieldSchema],
  isEnabled: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate slug from name before saving
withdrawalMethodSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('WithdrawalMethod', withdrawalMethodSchema);
