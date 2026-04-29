const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['join_channel', 'visit_website', 'watch_video', 'social', 'survey', 'download', 'signup', 'other'],
    default: 'other'
  },
  reward: {
    type: Number,
    required: true,
    min: 0
  },
  link: {
    type: String,
    default: ''
  },
  url: {
    type: String,
    default: ''
  },
  channelUsername: {
    type: String,
    default: ''
  },
  // Minimum visit duration in seconds (0 = no requirement)
  minVisitDuration: {
    type: Number,
    default: 0,
    min: 0
  },
  // Maximum number of completions allowed (0 = unlimited)
  maxCompletions: {
    type: Number,
    default: 0,
    min: 0
  },
  // Current completion count
  completionCount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  requiresProof: {
    type: Boolean,
    default: true
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

module.exports = mongoose.model('Task', taskSchema);
