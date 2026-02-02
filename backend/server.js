const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

// ============================================
// LICENSE ENFORCEMENT - STARTUP VALIDATION
// ============================================
// SECURITY: License validation MUST complete before app initializes.
// This is a FAIL-CLOSED system - no license = no application.
// DO NOT REMOVE OR BYPASS THIS BLOCK.
// ============================================

const { validateOnStartup } = require('./utils/licenseValidator');

// Async IIFE to handle startup validation
(async () => {
  const licenseValid = await validateOnStartup();
  
  if (!licenseValid) {
    console.error('');
    console.error('████████████████████████████████████████████████████████████');
    console.error('█                                                          █');
    console.error('█   APPLICATION TERMINATED: INVALID LICENSE                █');
    console.error('█                                                          █');
    console.error('█   The application cannot start without a valid license.  █');
    console.error('█   Please ensure license.json contains a valid license    █');
    console.error('█   key and the license server is accessible.              █');
    console.error('█                                                          █');
    console.error('████████████████████████████████████████████████████████████');
    console.error('');
    process.exit(1);
  }
  
  // License valid - continue with application startup
  startApplication();
})();

function startApplication() {

const app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      'https://minifaucet.vercel.app',
      'https://minifaucet.onrender.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow all in development, tighten in production if needed
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);

// Request logging middleware for debugging
app.use('/api/', (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(body) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    if (res.statusCode >= 400) {
      console.log('  Error response:', typeof body === 'string' ? body.substring(0, 200) : body);
    }
    return originalSend.call(this, body);
  };
  
  next();
});

// Rate limiting disabled for admin dashboard and telegram mini app
// Uncomment below to re-enable if needed
/*
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: (req) => {
    return req.path === '/api/health' || req.path.startsWith('/api/admin');
  }
});
app.use('/api/', limiter);
*/

// Routes
// Database connection check middleware
const checkDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('Database not connected. ReadyState:', mongoose.connection.readyState);
    return res.status(503).json({ 
      message: 'Service temporarily unavailable. Please try again in a moment.',
      error: 'Database connection unavailable'
    });
  }
  next();
};

// Apply database check to all API routes except health
app.use('/api/auth', checkDatabaseConnection, require('./routes/auth'));
app.use('/api/user', checkDatabaseConnection, require('./routes/user'));
app.use('/api/earnings', checkDatabaseConnection, require('./routes/earnings'));
app.use('/api/tasks', checkDatabaseConnection, require('./routes/tasks'));
app.use('/api/withdrawals', checkDatabaseConnection, require('./routes/withdrawals'));
app.use('/api/referrals', checkDatabaseConnection, require('./routes/referrals'));
app.use('/api/admin', checkDatabaseConnection, require('./routes/admin'));
app.use('/api/settings', checkDatabaseConnection, require('./routes/settings'));
app.use('/api/notifications', checkDatabaseConnection, require('./routes/notifications'));
app.use('/api/license', require('./routes/license'));
app.use('/api/ads', checkDatabaseConnection, require('./routes/ads'));
app.use('/api/faucetpay', checkDatabaseConnection, require('./routes/faucetpay'));

// Health check with detailed status
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  // Check Telegram bot if token is configured
  let telegramStatus = { configured: false };
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const { getBotInfo } = require('./utils/telegramBot');
      const botInfo = await getBotInfo();
      telegramStatus = {
        configured: true,
        connected: botInfo.ok,
        username: botInfo.data?.username || null
      };
    } catch (e) {
      telegramStatus = { configured: true, connected: false, error: e.message };
    }
  }

  res.json({ 
    status: dbState === 1 ? 'OK' : 'DEGRADED',
    message: 'Server is running',
    database: {
      status: dbStates[dbState] || 'unknown',
      connected: dbState === 1
    },
    telegram: telegramStatus,
    timestamp: new Date().toISOString()
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// MongoDB Connection with reconnection logic
const connectMongoDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram_earning_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50,
      retryWrites: true,
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Retry connection after 5 seconds
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectMongoDB, 5000);
  }
};

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

connectMongoDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

} // End of startApplication function