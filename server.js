const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new Database(process.env.DB_PATH || 'kanban.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board TEXT NOT NULL,
    column_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    gdrive_id TEXT,
    gdrive_url TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial data if database is empty
const cardCount = db.prepare('SELECT COUNT(*) as count FROM cards').get().count;
if (cardCount === 0) {
  try {
    const seedDataPath = path.join(__dirname, 'seed-data.json');
    const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
    
    const stmt = db.prepare(`
      INSERT INTO cards (board, column_name, title, description, priority, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    seedData.forEach((item) => {
      stmt.run(item.board, item.column, item.title, item.desc, item.priority, item.day);
    });

    console.log(`✅ Seeded ${seedData.length} cards into database from seed-data.json`);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
}

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'kanban-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.json());
app.use(express.static('public'));

// File upload configuration
const upload = multer({ dest: 'uploads/' });

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Google Drive setup
let driveClient = null;
if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    driveClient = google.drive({ version: 'v3', auth });
    console.log('✅ Google Drive client initialized');
  } catch (error) {
    console.error('❌ Google Drive setup failed:', error.message);
  }
}

// Authentication endpoints
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.KANBAN_PASSWORD || 'changeme';
  
  if (password === correctPassword) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// Card endpoints
app.get('/api/cards/:board', requireAuth, (req, res) => {
  try {
    const cards = db.prepare('SELECT * FROM cards WHERE board = ? ORDER BY position ASC').all(req.params.board);
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cards', requireAuth, (req, res) => {
  try {
    const { board, column_name, title, description, priority } = req.body;
    const maxPos = db.prepare('SELECT MAX(position) as max FROM cards WHERE board = ? AND column_name = ?').get(board, column_name);
    const position = (maxPos?.max || 0) + 1;
    
    const result = db.prepare(
      'INSERT INTO cards (board, column_name, title, description, priority, position) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(board, column_name, title, description, priority, position);
    
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cards/:id', requireAuth, (req, res) => {
  try {
    const { column_name, position, title, description, priority } = req.body;
    
    db.prepare(
      'UPDATE cards SET column_name = ?, position = ?, title = ?, description = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(column_name, position, title, description, priority, req.params.id);
    
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cards/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload endpoint
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let gdriveId = null;
    let gdriveUrl = null;

    // Upload to Google Drive if configured
    if (driveClient) {
      try {
        const fileMetadata = {
          name: req.file.originalname,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root']
        };
        
        const media = {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(req.file.path)
        };

        const response = await driveClient.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, webViewLink'
        });

        gdriveId = response.data.id;
        gdriveUrl = response.data.webViewLink;

        // Make file accessible
        await driveClient.permissions.create({
          fileId: gdriveId,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });

        console.log(`✅ Uploaded to Google Drive: ${req.file.originalname}`);
      } catch (driveError) {
        console.error('Google Drive upload error:', driveError.message);
      }
    }

    // Clean up local file
    fs.unlinkSync(req.file.path);

    // Save to database
    const result = db.prepare(
      'INSERT INTO uploads (filename, gdrive_id, gdrive_url) VALUES (?, ?, ?)'
    ).run(req.file.originalname, gdriveId, gdriveUrl);

    res.json({
      success: true,
      filename: req.file.originalname,
      gdriveUrl: gdriveUrl,
      id: result.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uploads
app.get('/api/uploads', requireAuth, (req, res) => {
  try {
    const uploads = db.prepare('SELECT * FROM uploads ORDER BY uploaded_at DESC LIMIT 50').all();
    res.json(uploads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: db ? 'connected' : 'disconnected',
    gdrive: driveClient ? 'configured' : 'not configured'
  });
});

app.listen(PORT, () => {
  console.log(`🎯 Kanban Board running on port ${PORT}`);
  console.log(`📊 Database: ${db ? 'Ready' : 'Not connected'}`);
  console.log(`☁️  Google Drive: ${driveClient ? 'Configured' : 'Not configured'}`);
});
