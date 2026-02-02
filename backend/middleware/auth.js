const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

// User authentication middleware
exports.authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('Auth failed: No token provided for', req.method, req.path);
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      console.log('Auth failed: User not found for token userId:', decoded.userId);
      return res.status(401).json({ message: 'User not found' });
    }
    
    if (user.status === 'banned' || user.status === 'suspended') {
      console.log('Auth failed: User status is', user.status, 'for userId:', decoded.userId);
      return res.status(401).json({ message: 'User account is ' + user.status });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('Auth error:', error.message, 'for', req.method, req.path);
    res.status(401).json({ message: 'Token is not valid: ' + error.message });
  }
};

// Admin authentication middleware
exports.authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId);
    
    if (!admin) {
      return res.status(401).json({ message: 'Admin not authorized' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Admin role check middleware
exports.requireAdmin = (req, res, next) => {
  if (req.admin && req.admin.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};
