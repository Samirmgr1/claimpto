const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');
const Earning = require('../models/Earning');

// Get available tasks (excludes completed tasks)
router.get('/available', authenticateUser, async (req, res) => {
  try {
    // Find tasks that are active (support both isActive and status fields)
    // Also filter out tasks that have reached maxCompletions
    const tasks = await Task.find({ 
      $or: [
        { isActive: true },
        { status: 'active' }
      ]
    });
    
    // Get user's submissions
    const submissions = await TaskSubmission.find({
      user: req.user._id
    });

    // Filter out tasks that are already approved (completed)
    const completedTaskIds = submissions
      .filter(s => s.status === 'approved')
      .map(s => s.task.toString());
    
    // Build task list excluding completed ones and those at max completions
    const tasksWithStatus = tasks
      .filter(task => {
        // Exclude if user already completed this task
        if (completedTaskIds.includes(task._id.toString())) return false;
        
        // Exclude if max completions reached (0 = unlimited)
        if (task.maxCompletions > 0 && task.completionCount >= task.maxCompletions) return false;
        
        return true;
      })
      .map(task => {
        const submission = submissions.find(s => s.task.toString() === task._id.toString());
        return {
          ...task.toObject(),
          submitted: !!submission && submission.status !== 'rejected',
          submissionStatus: submission?.status === 'rejected' ? null : submission?.status || null,
          minVisitDuration: task.minVisitDuration || 0,
          maxCompletions: task.maxCompletions || 0,
          completionCount: task.completionCount || 0,
          remainingSlots: task.maxCompletions > 0 ? Math.max(0, task.maxCompletions - (task.completionCount || 0)) : null
        };
      });

    res.json({ tasks: tasksWithStatus });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start task visit tracking (called when user clicks task link)
router.post('/start-visit', authenticateUser, async (req, res) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    const task = await Task.findById(taskId);
    if (!task || !task.isActive) {
      return res.status(404).json({ message: 'Task not found or inactive' });
    }

    // Store visit start time in a temporary record or session
    // We'll use a simple in-memory approach with the submission
    res.json({ 
      message: 'Visit started',
      taskId: task._id,
      minDuration: task.minVisitDuration || 0,
      startTime: Date.now()
    });
  } catch (error) {
    console.error('Start visit error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit task completion (protected by Turnstile)
router.post('/submit', authenticateUser, verifyTurnstile, async (req, res) => {
  try {
    const { taskId, proof, visitStartTime, visitDuration, puzzleData } = req.body;

    if (!taskId) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    const task = await Task.findById(taskId);
    if (!task || !task.isActive) {
      return res.status(404).json({ message: 'Task not found or inactive' });
    }

    // Check if max completions reached
    if (task.maxCompletions > 0 && task.completionCount >= task.maxCompletions) {
      return res.status(400).json({ message: 'This task has reached its maximum completions' });
    }

    // Default minimum visit duration if task doesn't specify one
    const DEFAULT_MIN_DURATION = 10;
    const requiredDuration = task.minVisitDuration > 0 ? task.minVisitDuration : DEFAULT_MIN_DURATION;
    
    // Verify minimum visit duration
    const actualDuration = visitDuration || 0;
    if (actualDuration < requiredDuration) {
      return res.status(400).json({ 
        message: `Please spend at least ${requiredDuration} seconds on the task before submitting`,
        requiredDuration: requiredDuration,
        actualDuration: actualDuration
      });
    }

    // Verify puzzle was solved (basic server-side validation)
    if (puzzleData) {
      const { num1, num2, operation, userAnswer } = puzzleData;
      let correctAnswer;
      
      switch (operation) {
        case '+':
          correctAnswer = num1 + num2;
          break;
        case '-':
          correctAnswer = num1 - num2;
          break;
        case '×':
        case '*':
          correctAnswer = num1 * num2;
          break;
        default:
          correctAnswer = num1 + num2;
      }
      
      if (parseInt(userAnswer) !== correctAnswer) {
        return res.status(400).json({ message: 'Puzzle verification failed. Please try again.' });
      }
    }

    // Check if already submitted (pending or approved)
    const existingSubmission = await TaskSubmission.findOne({
      user: req.user._id,
      task: taskId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingSubmission) {
      return res.status(400).json({ message: 'Task already submitted' });
    }

    // Determine if task should be auto-approved (no proof required)
    const shouldAutoApprove = !task.requiresProof;

    // Create submission
    const submission = new TaskSubmission({
      user: req.user._id,
      task: taskId,
      proof: proof || '',
      visitStartTime: visitStartTime ? new Date(visitStartTime) : null,
      visitDuration: visitDuration || 0,
      status: shouldAutoApprove ? 'approved' : 'pending',
      reviewedAt: shouldAutoApprove ? new Date() : null
    });
    await submission.save();

    // If auto-approved, credit the reward immediately
    if (shouldAutoApprove) {
      // Update user balance
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { 
          $inc: { 
            balance: task.reward,
            totalEarnings: task.reward
          }
        },
        { new: true }
      );

      // Create earning record
      const earning = new Earning({
        user: req.user._id,
        amount: task.reward,
        type: 'task',
        description: `Task completed: ${task.title}`,
        taskId: taskId
      });
      await earning.save();

      // Update task completion count
      await Task.findByIdAndUpdate(taskId, { $inc: { completionCount: 1 } });

      res.json({
        message: 'Task completed successfully! Reward credited.',
        submission: {
          id: submission._id,
          status: submission.status,
          submittedAt: submission.submittedAt
        },
        autoApproved: true,
        reward: task.reward,
        newBalance: user.balance
      });
    } else {
      res.json({
        message: 'Task submitted successfully',
        submission: {
          id: submission._id,
          status: submission.status,
          submittedAt: submission.submittedAt
        },
        autoApproved: false
      });
    }
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's task submissions
router.get('/submissions', authenticateUser, async (req, res) => {
  try {
    const submissions = await TaskSubmission.find({ user: req.user._id })
      .sort({ submittedAt: -1 })
      .populate('task', 'title description reward type')
      .populate('reviewedBy', 'username');

    res.json({ submissions });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
