const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const Notification = require('../models/Notification');

// Get user notifications
router.get('/', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    // Build query - must use $and to combine multiple $or conditions
    const baseConditions = [
      {
        $or: [
          { user: req.user._id },
          { isBroadcast: true }
        ]
      },
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    ];

    if (unreadOnly) {
      baseConditions.push({ isRead: false });
    }

    const query = { $and: baseConditions };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    
    // Count unread separately with proper query
    const unreadQuery = {
      $and: [
        {
          $or: [
            { user: req.user._id },
            { isBroadcast: true }
          ]
        },
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        },
        { isRead: false }
      ]
    };
    const unreadCount = await Notification.countDocuments(unreadQuery);

    res.json({
      notifications,
      unreadCount,
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

// Get unread count
router.get('/unread-count', authenticateUser, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      $and: [
        {
          $or: [
            { user: req.user._id },
            { isBroadcast: true }
          ]
        },
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        },
        { isRead: false }
      ]
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateUser, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { user: req.user._id },
          { isBroadcast: true }
        ]
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateUser, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        $or: [
          { user: req.user._id },
          { isBroadcast: true }
        ],
        isRead: false
      },
      { isRead: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
