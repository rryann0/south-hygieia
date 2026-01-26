require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure required directories exist
const ensureDirectories = () => {
  const dirs = ['logs', 'data'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  });
};
ensureDirectories();

// ============ LOGGING SETUP ============
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new winston.transports.Console({ 
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ============ DATABASE SETUP ============
const db = new Database(process.env.DB_PATH || 'cleanliness.db');
db.pragma('journal_mode = WAL');

try {
  db.prepare('SELECT 1').get();
  logger.info('Database connection verified');
} catch (err) {
  logger.error('Database connection failed:', err);
  logger.error('Error code:', err.code);
  logger.error('Error message:', err.message);
  logger.error('Error errno:', err.errno);
  process.exit(1);
}

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS restrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    building TEXT,
    floor INTEGER
  );

  CREATE TABLE IF NOT EXISTS custodians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT
  );

  CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY,
    custodianId TEXT NOT NULL,
    restroomId TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (custodianId) REFERENCES custodians(id),
    FOREIGN KEY (restroomId) REFERENCES restrooms(id)
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    custodianId TEXT NOT NULL,
    restroomId TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    timestamp TEXT NOT NULL,
    pending INTEGER DEFAULT 1,
    resolvedAt TEXT,
    lastCheckedAt TEXT,
    FOREIGN KEY (custodianId) REFERENCES custodians(id),
    FOREIGN KEY (restroomId) REFERENCES restrooms(id)
  );

  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// Seed initial data
const seedData = () => {
  const restrooms = [
    // Boys' restrooms
    { id: 'boys-locker-room', name: "Boys' Locker Room", building: 'Athletics', floor: 1 },
    { id: 'g-wing', name: 'G Wing', building: 'G Wing', floor: 1 },
    { id: 'd-wing', name: 'D Wing', building: 'D Wing', floor: 1 },
    { id: 'l-wing', name: 'L Wing', building: 'L Wing', floor: 1 },
    { id: 'n-wing', name: 'N Wing', building: 'N Wing', floor: 1 },
    // Girls' restrooms
    { id: 'girls-locker-room', name: "Girls' Locker Room", building: 'Athletics', floor: 1 },
    { id: 'h-wing', name: 'H Wing', building: 'H Wing', floor: 1 },
    { id: 'j-wing', name: 'J Wing', building: 'J Wing', floor: 1 },
    { id: 'c-wing', name: 'C Wing', building: 'C Wing', floor: 1 },
    { id: 'e-wing', name: 'E Wing', building: 'E Wing', floor: 1 },
    { id: 'm-wing', name: 'M Wing', building: 'M Wing', floor: 1 }
  ];

  const custodians = [
    { id: 'shantelle', name: 'Shantelle', gender: 'female' },
    { id: 'jalessa', name: 'Jalessa', gender: 'female' },
    { id: 'joel', name: 'Joel', gender: 'male' },
    { id: 'javon', name: 'Javon', gender: 'male' },
    { id: 'rey', name: 'Rey', gender: 'male' }
  ];

  const insertRestroom = db.prepare('INSERT OR IGNORE INTO restrooms (id, name, building, floor) VALUES (?, ?, ?, ?)');
  const insertCustodian = db.prepare('INSERT OR IGNORE INTO custodians (id, name, gender) VALUES (?, ?, ?)');

  restrooms.forEach(r => insertRestroom.run(r.id, r.name, r.building, r.floor));
  custodians.forEach(c => insertCustodian.run(c.id, c.name, c.gender));

  logger.info('Database seeded with initial data');
};

seedData();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || 'https://shs-hygieia.tusd.org') 
    : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Session management
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
  }),
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: null, // Session cookie (expires when browser closes)
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true for HTTPS, false for HTTP
    sameSite: 'lax' // Changed from 'strict' to 'lax' for better compatibility
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);

// Check if user is authenticated (middleware)
const isAuthenticated = (req, res, next) => {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Check if user is admin (middleware)
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// ============ API ROUTES ============

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User login (staff access to the app)
app.post('/api/auth/login', (req, res) => {
  const raw = req.body?.password;
  const password = (typeof raw === 'string' ? raw : '').trim();
  const userPassword = (process.env.USER_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();

  if (!userPassword) {
    logger.error('USER_PASSWORD not set in environment variables');
    return res.status(500).json({ error: 'User password not configured' });
  }

  if (password && password === userPassword) {
    req.session.isAuthenticated = true;
    logger.info('User login successful');
    res.json({ success: true, message: 'Login successful' });
  } else {
    logger.warn('Failed user login attempt');
    res.status(401).json({ error: 'Invalid password' });
  }
});

// User logout
app.post('/api/auth/logout', (req, res) => {
  req.session.isAuthenticated = false;
  req.session.isAdmin = false; // Also log out admin
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
    } else {
      logger.info('User logged out and session destroyed');
    }
  });
  res.clearCookie('connect.sid'); // Clear the session cookie
  res.json({ success: true, message: 'Logged out' });
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  // Explicitly check session - if session doesn't exist or isn't authenticated, return false
  const isAuthenticated = req.session && req.session.isAuthenticated === true;
  const isAdmin = req.session && req.session.isAdmin === true;
  
  res.json({ 
    isAuthenticated: isAuthenticated,
    isAdmin: isAdmin 
  });
});

// Check admin status
app.get('/api/admin/status', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const raw = req.body?.password;
  const password = (typeof raw === 'string' ? raw : '').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();

  if (!adminPassword) {
    logger.error('ADMIN_PASSWORD not set in environment variables');
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  if (password && password === adminPassword) {
    req.session.isAdmin = true;
    logger.info('Admin login successful');
    res.json({ success: true, message: 'Admin access granted' });
  } else {
    logger.warn('Failed admin login attempt');
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  logger.info('Admin logged out');
  res.json({ success: true, message: 'Logged out' });
});

// Get all restrooms (require authentication)
app.get('/api/restrooms', isAuthenticated, (req, res) => {
  try {
    const restrooms = db.prepare('SELECT * FROM restrooms ORDER BY name').all();
    res.json(restrooms);
  } catch (error) {
    logger.error('Error fetching restrooms:', error);
    res.status(500).json({ error: 'Failed to fetch restrooms' });
  }
});

// Get all custodians (require authentication)
app.get('/api/custodians', isAuthenticated, (req, res) => {
  try {
    const custodians = db.prepare('SELECT id, name, gender FROM custodians ORDER BY name').all();
    res.json(custodians);
  } catch (error) {
    logger.error('Error fetching custodians:', error);
    res.status(500).json({ error: 'Failed to fetch custodians' });
  }
});

// Get all checks (require authentication)
app.get('/api/checks', isAuthenticated, (req, res) => {
  try {
    const checks = db.prepare(`
      SELECT c.*, cu.name as custodian, r.name as restroom
      FROM checks c
      JOIN custodians cu ON c.custodianId = cu.id
      JOIN restrooms r ON c.restroomId = r.id
      ORDER BY c.timestamp DESC
      LIMIT 100
    `).all();
    res.json(checks);
  } catch (error) {
    logger.error('Error fetching checks:', error);
    res.status(500).json({ error: 'Failed to fetch checks' });
  }
});

// Log a check (require authentication)
app.post('/api/checks', isAuthenticated, (req, res) => {
  try {
    const { custodianId, restroomId, notes } = req.body;

    // Validate input
    if (!custodianId || !restroomId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate timestamp server-side for consistency
    const timestamp = new Date().toISOString();

    // Check for active incident
    const activeIncident = db.prepare(
      'SELECT * FROM incidents WHERE restroomId = ? AND pending = 1'
    ).get(restroomId);

    if (activeIncident) {
      return res.status(403).json({ 
        error: 'Cannot log check - active incident on this restroom' 
      });
    }

    const id = `check-${Date.now()}`;
    db.prepare(`
      INSERT INTO checks (id, custodianId, restroomId, timestamp, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, custodianId, restroomId, timestamp, notes || '');

    logger.info(`Check logged: ${id} by ${custodianId} for ${restroomId}`);
    res.status(201).json({ success: true, id });
  } catch (error) {
    logger.error('Error logging check:', error);
    res.status(500).json({ error: 'Failed to log check' });
  }
});

// Get all incidents (require authentication)
app.get('/api/incidents', isAuthenticated, (req, res) => {
  try {
    const incidents = db.prepare(`
      SELECT i.*, cu.name as custodian, r.name as restroom
      FROM incidents i
      JOIN custodians cu ON i.custodianId = cu.id
      JOIN restrooms r ON i.restroomId = r.id
      ORDER BY i.timestamp DESC
    `).all();
    res.json(incidents);
  } catch (error) {
    logger.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Report incident (require authentication)
app.post('/api/incidents', isAuthenticated, (req, res) => {
  try {
    const { custodianId, restroomId, description, severity } = req.body;

    // Validate input
    if (!custodianId || !restroomId || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate timestamp server-side for consistency
    const timestamp = new Date().toISOString();

    // Get last check time
    const lastCheck = db.prepare(`
      SELECT timestamp FROM checks 
      WHERE restroomId = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `).get(restroomId);

    const id = `incident-${Date.now()}`;
    db.prepare(`
      INSERT INTO incidents (id, custodianId, restroomId, description, severity, timestamp, pending, lastCheckedAt)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, custodianId, restroomId, description, severity || 'medium', timestamp, lastCheck?.timestamp || null);

    logger.info(`Incident reported: ${id} for ${restroomId}`);

    // TODO: Send notifications (Twilio/Nodemailer/Web Push)

    res.status(201).json({ success: true, id });
  } catch (error) {
    logger.error('Error reporting incident:', error);
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

// Resolve incident (admin only)
app.post('/api/incidents/resolve', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { incidentId } = req.body;

    if (!incidentId) {
      return res.status(400).json({ error: 'Missing incident ID' });
    }

    db.prepare(`
      UPDATE incidents 
      SET pending = 0, resolvedAt = ? 
      WHERE id = ?
    `).run(new Date().toISOString(), incidentId);

    logger.info(`Incident resolved: ${incidentId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error resolving incident:', error);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
});

