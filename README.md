# 🎯 Kanban Board - L2CS

Project management kanban board with Google Drive integration.

## Features

- 🎯 **Two Boards**: Current Session Projects & Sales Cycle
- 📋 **Drag & Drop**: Move cards between columns (To Do, In Progress, Done)
- 📤 **Google Drive Upload**: Attach files directly to Drive
- 🔐 **Password Protected**: Secure access with session-based auth
- 💾 **Persistent Database**: SQLite storage for all data
- 📱 **Mobile Responsive**: Works great on all devices
- 🔄 **Real-time Updates**: Refresh button to sync latest changes

## Tech Stack

- **Backend**: Node.js, Express, SQLite
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Storage**: better-sqlite3, Google Drive API
- **Deployment**: Railway

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Run locally:
   ```bash
   npm start
   ```

4. Access: http://localhost:3000

## Environment Variables

- `KANBAN_PASSWORD` - Login password
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_DRIVE_CREDENTIALS` - Service account JSON (optional)
- `GOOGLE_DRIVE_FOLDER_ID` - Target folder ID (optional)

## Google Drive Setup (Optional)

1. Create a Google Cloud project
2. Enable Google Drive API
3. Create service account and download JSON key
4. Share target folder with service account email
5. Set credentials in environment variable

## Deployment

Deploy to Railway:
1. Connect GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

## Usage

### Login
- Enter password to access the board

### Boards
- **Current Session Projects**: Day-to-day work and tasks
- **Sales Cycle**: Leads, prospects, and deals

### Cards
- Click **+** to add new cards
- Drag cards between columns
- Delete cards when complete

### File Upload
- Click **📤 Upload** button
- Select file (uploads to Google Drive if configured)
- View recent uploads at bottom of page

## Security

- Password-protected access
- Session-based authentication (24-hour sessions)
- SQLite database (file-based, persistent)
- Google Drive files set to "anyone with link" access

## License

Proprietary - Level 2 Compliance Solutions

## Author

Steve Ventes / L2CS 🛡️
# Force rebuild Mon Feb  9 07:57:00 PM EST 2026
