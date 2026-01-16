require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

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
    ? (process.env.FRONTEND_URL || 'http://192.168.4.18') 
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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: false, // Set to false for HTTP (set to true only if using HTTPS)
    sameSite: 'lax' // Changed from 'strict' to 'lax' for better compatibility
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);

// ============ EMAIL SETUP ============
let transporter = null;

// Initialize email transporter if SMTP is configured
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      logger.error('Email transporter error:', error);
    } else {
      logger.info('Email transporter ready');
    }
  });
} else {
  logger.warn('SMTP not configured - email notifications disabled');
}

// Function to send incident notification email
const sendIncidentEmail = async (incidentData) => {
  if (!transporter || !process.env.ADMIN_EMAIL) {
    logger.warn('Email not configured, skipping notification');
    return;
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `🚨 New Incident Reported: ${incidentData.restroomName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🚨 New Incident Reported</h2>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Incident Details</h3>
            <p><strong>Restroom:</strong> ${incidentData.restroomName}</p>
            <p><strong>Reported by:</strong> ${incidentData.custodianName}</p>
            <p><strong>Severity:</strong> ${incidentData.severity || 'medium'}</p>
            <p><strong>Time:</strong> ${new Date(incidentData.timestamp).toLocaleString()}</p>
            <p><strong>Last checked:</strong> ${incidentData.lastChecked || 'Never'}</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0;">Description</h3>
            <p style="white-space: pre-wrap;">${incidentData.description}</p>
          </div>
          
          <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
            Please log in to the Restroom Management System to resolve this incident.
          </p>
        </div>
      `,
      text: `
New Incident Reported

Restroom: ${incidentData.restroomName}
Reported by: ${incidentData.custodianName}
Severity: ${incidentData.severity || 'medium'}
Time: ${new Date(incidentData.timestamp).toLocaleString()}
Last checked: ${incidentData.lastChecked || 'Never'}

Description:
${incidentData.description}
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Incident notification email sent: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending incident email:', error);
    // Don't throw - we don't want email failures to prevent incident reporting
  }
};

// ============ MIDDLEWARE ============

// Check if user is admin (middleware)
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check admin status
app.get('/api/admin/status', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    logger.error('ADMIN_PASSWORD not set in environment variables');
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  if (password === adminPassword) {
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

// Get all restrooms
app.get('/api/restrooms', (req, res) => {
  try {
    const restrooms = db.prepare('SELECT * FROM restrooms ORDER BY name').all();
    res.json(restrooms);
  } catch (error) {
    logger.error('Error fetching restrooms:', error);
    res.status(500).json({ error: 'Failed to fetch restrooms' });
  }
});

// Get all custodians
app.get('/api/custodians', (req, res) => {
  try {
    const custodians = db.prepare('SELECT id, name, gender FROM custodians ORDER BY name').all();
    res.json(custodians);
  } catch (error) {
    logger.error('Error fetching custodians:', error);
    res.status(500).json({ error: 'Failed to fetch custodians' });
  }
});

// Get all checks
app.get('/api/checks', (req, res) => {
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

// Log a check
app.post('/api/checks', (req, res) => {
  try {
    const { custodianId, restroomId, timestamp, notes } = req.body;

    // Validate input
    if (!custodianId || !restroomId || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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

// Get all incidents
app.get('/api/incidents', (req, res) => {
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

// Report incident
app.post('/api/incidents', (req, res) => {
  try {
    const { custodianId, restroomId, description, severity, timestamp } = req.body;

    // Validate input
    if (!custodianId || !restroomId || !description || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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

    // Get custodian and restroom names for email
    const custodian = db.prepare('SELECT name FROM custodians WHERE id = ?').get(custodianId);
    const restroom = db.prepare('SELECT name FROM restrooms WHERE id = ?').get(restroomId);

    // Send email notification (async, don't wait for it)
    sendIncidentEmail({
      restroomName: restroom?.name || restroomId,
      custodianName: custodian?.name || custodianId,
      description: description,
      severity: severity || 'medium',
      timestamp: timestamp,
      lastChecked: lastCheck?.timestamp ? new Date(lastCheck.timestamp).toLocaleString() : 'Never'
    }).catch(err => logger.error('Failed to send incident email:', err));

    res.status(201).json({ success: true, id });
  } catch (error) {
    logger.error('Error reporting incident:', error);
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

// Resolve incident (admin only)
app.post('/api/incidents/resolve', isAdmin, (req, res) => {
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

