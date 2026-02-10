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
  const seedData = [
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 1', day: 1, title: 'HubSpot CRM Organization & Planning', desc: 'Dedicate time to organizing HubSpot and mapping out the 60-day campaign. Import or input any existing contacts. Create custom properties to track "Lead – Downloaded Checklist" and "Qualified – Scheduled Call".', priority: 'high' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 1', day: 2, title: 'Lead Magnet Content Outline & Initial Writing', desc: 'Begin creating the lead magnet, a "CMMC Level 2 Readiness Checklist" tailored for small DoD contractors. Outline key sections and write introduction and first few checklist items (aim for ~2–3 pages).', priority: 'high' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 1', day: 3, title: 'Finish Lead Magnet Draft & Network Outreach', desc: 'Complete the writing of your CMMC readiness checklist with actionable items. Conduct personal outreach to 5-10 network contacts with customized emails/LinkedIn messages introducing Level 2 Compliance Solutions.', priority: 'high' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 1', day: 4, title: 'Design Lead Magnet PDF & Prospect List Building', desc: 'Polish the lead magnet using Canva to create a clean, branded PDF. In parallel, start building a LinkedIn prospect list targeting owners, CEOs, IT Directors at manufacturing firms <200 employees that contract with DoD.', priority: 'high' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 1', day: 5, title: 'HubSpot Landing Page & Email Sequence Setup (Part 1)', desc: 'Build a landing page for the CMMC checklist in HubSpot Marketing Hub. Write compelling copy, add form (name, email, company, CUI question), and create automated Email #1 to deliver checklist immediately.', priority: 'high' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 1', day: 6, title: 'Email Sequence Setup (Part 2) & Workflow Automation', desc: 'Create nurture email sequence with Email #2 (5-7 days after download, free resource) and Email #3 (two weeks after, direct CTA to book call). Set up HubSpot workflow with automated delays between emails.', priority: 'high' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 1', day: 7, title: 'Optimize LinkedIn Profile & Facebook Setup', desc: 'Revamp LinkedIn profile with value-packed headline, client-focused About section, and updated Experience. Create LinkedIn company page. Join 3-5 relevant Facebook groups for target audience (manufacturing, government contractors).', priority: 'high' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 2', day: 8, title: '🚀 Launch the Lead Magnet Campaign', desc: 'Go-live day! Publish LinkedIn post announcing the free checklist with pain point messaging. Share on Facebook. Send to email list. Start sending ~5 LinkedIn connection requests with personalized notes. Monitor engagement.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 2', day: 9, title: 'Begin LinkedIn Outreach & Group Engagement', desc: 'Send 5-10 new LinkedIn connection requests. Thank-you message to accepted connections offering checklist. Introduce yourself in Facebook groups. Respond to any questions from group members.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 2', day: 10, title: 'Content Creation and CRM Maintenance', desc: 'Draft LinkedIn post on "3 Common Myths about CMMC for Small Contractors" or similar educational topic. Repurpose for Facebook. Review HubSpot for new leads, tag properly with lifecycle stage, create follow-up tasks.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 2', day: 11, title: 'LinkedIn Post #2 and Continued Outreach', desc: 'Publish educational LinkedIn post (morning weekday). Engage with comments for 30-60 min. Comment on 5-10 posts from others in your network. Send another batch of ~10 connection requests. Follow up with accepted connections.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 2', day: 12, title: 'Follow-Up and Lead Nurture', desc: 'Identify and prioritize hot leads. Send personal emails/LinkedIn messages to warm prospects. Quick follow-up call to checklist downloaders. Ensure no lead is left unattended. Be quick to respond (within 5 min of inquiry).', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 2', day: 13, title: 'Mid-Campaign Review & Adjustment', desc: 'Review HubSpot landing page analytics (visits vs submissions, email open/click rates). Assess LinkedIn acceptance rate and engagement. Adjust outreach cadence based on early results. Identify top-performing channels.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 2', day: 14, title: 'LinkedIn Engagement and Email Sequence Monitoring', desc: 'Share industry news/article with commentary. Comment thoughtfully on 5-10 posts. Prepare batch of connection requests. Monitor email sequence performance. Reach out again to initial network contacts (follow-up reminder).', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 3', day: 15, title: 'Personal Follow-Ups to Hot Leads', desc: 'Identify hottest prospects (replies showing interest, clicked scheduling link, engaged with content). Reach out directly to book calls. Use personalized approach. Aim to convert interested leads into discovery call bookings.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 3', day: 16, title: 'Thought Leadership Content & Profile Boost', desc: 'Create long-form LinkedIn Article or detailed post on CMMC compliance topic. Publish and promote. This establishes authority and provides nurture content for researching leads.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 3', day: 17, title: 'Midweek Outreach Sprint', desc: 'Concentrated outreach day. Send another batch of ~10 connection invites with varied personalized notes. Vary your message to avoid looking copy-pasted. Check for new accepted connections and respond promptly.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 3', day: 18, title: 'Leverage Testimonials & Social Proof', desc: 'Gather testimonials, endorsements, or success stories from past clients/colleagues. Prepare a 1-page case study or success story document. Incorporate into your outreach and LinkedIn profile.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 3', day: 19, title: 'Facebook Group Content & Outreach Cadence Review', desc: 'Make valuable post in one of your Facebook groups. Share mini checklist or practical tips. Review overall outreach cadence – are you hitting your daily/weekly targets? Adjust as needed. Keep CRM updated.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 3', day: 20, title: 'Pipeline Review & Offer Refinement', desc: '1/3 through plan. How many discovery calls booked? Evaluate your pitch – is it resonating? Refine offer if needed. Are email opens/replies strong? Adjust subject lines or messaging based on what\'s working.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 3', day: 21, title: 'Email Sequence CTA & Weekend Prep', desc: 'Earliest leads from Day 8 will receive Email #3 (direct CTA to book call). Be prepared to respond if anyone replies. Follow up personally on any inquiries. Prepare for discovery calls next week.', priority: 'medium' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 4', day: 22, title: 'Follow-Up on Completed Calls & Proposals', desc: 'For any discovery calls already completed, send prompt follow-up email reiterating key points. Send initial proposal or quote if applicable. For calls pending, confirm attendance and agenda 24h before.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 4', day: 23, title: 'Host a Live Q&A or Webinar Planning', desc: 'Plan a live Q&A or webinar to establish authority and capture more leads. Email interested prospects inviting them. Promote on LinkedIn/Facebook. Prepare 3-5 key questions to answer or topics to cover.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 4', day: 24, title: 'Industry Networking & Referral Building', desc: 'Reach out to complementary service providers (IT security, accounting, etc.) who could refer business. Build referral relationships. Mention your CMMC services in professional networks.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 4', day: 25, title: 'Evaluate Facebook vs LinkedIn Effectiveness', desc: 'Compare effectiveness of two channels: LinkedIn – connections grown, leads, calls from interactions? Facebook – engagement, group membership requests, group activity ROI? Likely LinkedIn is stronger for B2B. Adjust allocation.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 4', day: 26, title: 'New Lead Magnet or Content Piece', desc: 'Introduce a second lead magnet or valuable content to capture those who didn\'t respond to checklist. Perhaps a "CMMC Assessment Scorecard" or "30-Minute Implementation Roadmap". Promote across channels.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 4', day: 27, title: 'Final Month Strategy Brainstorm', desc: 'Reflect on 4 weeks of work. Which tactics generated most calls? LinkedIn DMs? Content posts? Email follow-ups? Group engagement? Plan how to scale successes and minimize low-ROI activities in final month.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 4', day: 28, title: 'Monthly Metrics Review & Celebration', desc: 'Four weeks down! Review total leads, source breakdown, call bookings, proposal rate. Compare to goal. Celebrate wins. Document learnings. Plan optimizations for Month 2.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 5', day: 29, title: 'Scale LinkedIn Outreach', desc: 'If LinkedIn performing well, increase daily connection requests (e.g., 10→15/day). Monitor for rate-limit warnings. Continue personalized messaging. Follow up with existing connections.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 5', day: 30, title: 'Mid-Plan Strategy Refinement & Re-engagement', desc: 'Day 30 – Halfway point. Re-engage cold leads with "last attempt" email. Identify inactive contacts in HubSpot and reach out with new angle or value proposition. Refine core messaging based on wins so far.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 5', day: 31, title: 'Offer Limited-Time Consultations', desc: 'Create sense of urgency. Offer limited number of free or discounted consultations/assessments, framed as month 2 special offer. Email to all leads and promote on social. Drive inbound call bookings.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 5', day: 32, title: 'Leverage Success Stories and Case Studies', desc: 'Prepare 1-page case study or success story from any client win. Highlight challenge, solution, results. Share in emails, LinkedIn, and with prospects. Build trust currency.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 5', day: 33, title: 'Educational Webinar/Workshop', desc: 'Host planned webinar or live workshop. Engage attendees, answer questions, gather email addresses. Record for later sharing. Follow up with attendees post-event with offer or resources.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 5', day: 34, title: 'Final Outreach Blitz', desc: 'Major outreach push to capture remaining prospects. Send to any high-priority companies/individuals not yet contacted. Last batch of connection requests. Push to maximize pipeline before final stretch.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 5', day: 35, title: 'Client Conversion Focus', desc: 'Focus on moving leads to closure. Follow up on all open proposals with call. Address objections. Schedule next steps. Aim to convert hot leads to paying clients before end of 60 days.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 6', day: 36, title: 'Optimize Email and Message Templates', desc: 'Analyze email open/reply rates, LinkedIn message response rates. Optimize best-performing templates. Adjust subject lines, CTAs, tone. Update templates based on learnings.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 6', day: 37, title: 'Personal Touches for Prospects', desc: 'Stand out with personalized touches: Record short personalized video message for hot prospect using Vidyard/Loom. Send handwritten note or surprise gift to top leads. Human connection drives conversion.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 6', day: 38, title: 'Pipeline Closure Push', desc: 'All final proposals should be on the table. Push for signatures on any outstanding deals. Address final objections. Prepare contracts. Target last deals to close before day 60 milestone.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 6', day: 39, title: 'Celebrate Wins & Gather Testimonials', desc: 'Celebrate any new clients or deals signed. Request testimonials/referrals from satisfied prospects (even if they didn\'t convert). Use for future marketing.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 6', day: 40, title: 'Document Systems & Processes', desc: 'Document what worked: outreach templates, email sequences, LinkedIn approach, etc. Create playbook for replication. Systematize successful tactics for scaling in next phase.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 6', day: 41, title: 'Plan Next 60 Days', desc: 'Based on Month 1 results, plan Month 2 improvements. What tactics will you double down on? What will you discontinue? What new channels or approaches will you test? Set metrics/goals for next phase.', priority: 'low' },
    { board: 'Marketing & Sales 60-Day Plan', column: 'Week 6', day: 42, title: 'Reflect & Optimize', desc: 'Final reflection on 60-day journey. Document all learnings, ROI by channel, lessons for future campaigns. Celebrate team or personal effort. Reset for next growth phase. Maintain momentum with clients acquired.', priority: 'low' },
  ];

  const stmt = db.prepare(`
    INSERT INTO cards (board, column_name, title, description, priority, position)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  seedData.forEach((item, idx) => {
    stmt.run(item.board, item.column, item.title, item.desc, item.priority, item.day);
  });

  console.log(`✅ Seeded ${seedData.length} cards into database`);
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
