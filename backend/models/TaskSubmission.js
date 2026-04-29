const mongoose = require('mongoose');

const taskSubmissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  proof: {
    type: String,
    default: ''
  },
  // Track visit duration for verification
  visitStartTime: {
    type: Date,
    default: null
  },
  visitDuration: {
    type: Number,
    default: 0  // Duration in seconds
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
});

module.exports = mongoose.model('TaskSubmission', taskSubmissionSchema);
