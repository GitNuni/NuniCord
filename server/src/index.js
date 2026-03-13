require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const { initDatabase, initRedis } = require('./db');
const logger = require('./utils/logger');
const setupSocket = require('./socket');

// Routes
const authRoutes = require('./api/routes/auth');
const serverRoutes = require('./api/routes/servers');
const channelRoutes = require('./api/routes/channels');
const messageRoutes = require('./api/routes/messages');
const uploadRoutes = require('./api/routes/uploads');
const webhookRoutes = require('./api/routes/webhooks');
const adminRoutes = require('./api/routes/admin');
const notificationRoutes = require('./api/routes/notifications');
const userRoutes = require('./api/routes/users');
const setupRoutes = require('./api/routes/setup');
const oauthRoutes = require('./api/routes/oauth');
const bugRoutes = require('./api/routes/bugs');

const app = express();
const server = http.createServer(app);

// Trust proxy for reverse proxy setups
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts' },
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve uploaded files
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';
app.use('/files', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  immutable: true,
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', setupRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/ai', require('./api/routes/ai'));
app.use('/api/bugs', bugRoutes);
app.use('/api/sounds', require('./api/routes/sounds'));

// Passport (OAuth)
const passport = require('passport');
app.use(passport.initialize());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'NuniCord API',
    version: '1.0.0',
    mode: process.env.NUNICORD_MODE || 'multi',
  });
});

// Serve React frontend in production
const clientBuild = path.join(__dirname, '../../client/build');
if (require('fs').existsSync(clientBuild)) {
  app.use(express.static(clientBuild, { maxAge: '1d' }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// Setup Socket.io
const io = new SocketIOServer(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e7, // 10MB
});

setupSocket(io);

// Make io available to routes
app.set('io', io);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT || '3001');

async function start() {
  try {
    logger.info('Starting NuniCord server...');

    // Initialize database
    await initDatabase();
    logger.info('Database connected');

    // Initialize Redis (optional, graceful fallback)
    try {
      await initRedis();
      logger.info('Redis connected');
    } catch (err) {
      logger.warn('Redis not available, running without pub/sub:', err.message);
    }

    // Check if we need to print setup token
    const { query } = require('./db');
    const adminCount = await query('SELECT COUNT(*) FROM users WHERE is_admin = TRUE');
    if (adminCount.rows[0].count === '0') {
      const setupToken = crypto.randomBytes(32).toString('hex');
      // Store temporarily in DB
      await query(
        `INSERT INTO instance_settings (key, value) VALUES ('setup_token', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [JSON.stringify(setupToken)]
      );
      logger.info('='.repeat(60));
      logger.info('NUNICORD FIRST-TIME SETUP');
      logger.info('No admin user found. Complete setup at:');
      logger.info(`  http://localhost:${PORT}/setup?token=${setupToken}`);
      logger.info('='.repeat(60));
    }

    // Auto-generate VAPID keys if not set
    if (!process.env.VAPID_PUBLIC_KEY) {
      const webpush = require('web-push');
      try {
        const stored = await query("SELECT value FROM instance_settings WHERE key = 'vapid_keys'");
        let keys;
        if (stored.rows[0]) {
          keys = JSON.parse(stored.rows[0].value);
        } else {
          keys = webpush.generateVAPIDKeys();
          await query(
            `INSERT INTO instance_settings (key, value) VALUES ('vapid_keys', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify(keys)]
          );
          logger.info('Generated VAPID keys for push notifications');
        }
        process.env.VAPID_PUBLIC_KEY = keys.publicKey;
        process.env.VAPID_PRIVATE_KEY = keys.privateKey;
        webpush.setVapidDetails(
          `mailto:${process.env.VAPID_EMAIL || 'admin@nunicord.local'}`,
          keys.publicKey, keys.privateKey
        );
      } catch (e) {
        logger.warn('Could not set up VAPID keys:', e.message);
      }
    }

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`NuniCord server running on port ${PORT}`);
      logger.info(`Mode: ${process.env.NUNICORD_MODE || 'multi'}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

start();
