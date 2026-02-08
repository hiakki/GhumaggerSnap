# GhumaggerSnap

A self-hosted trip photo & video sharing app for friends and family, built with **FastAPI** (Python) and **React**.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Authentication** — JWT-based login; role-based access (admin / editor / viewer)
- **Image Preview** — Full-screen image viewer with thumbnails
- **Video Preview** — In-browser video player with streaming (range request support)
- **Download** — Single file download or multi-select bulk download as ZIP
- **Upload** — Drag-and-drop or click-to-upload (admin/editor only)
- **Grid / List View** — Toggle between card grid and compact list
- **Search & Filter** — Search by filename, filter by type, sort by date/name/size
- **User Management** — Admin panel to create/delete users
- **Responsive** — Works on desktop, tablet, and mobile
- **Cross-platform** — Runs on Windows, Linux, and macOS

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Python 3.10+, FastAPI, SQLite, JWT  |
| Frontend | React 18, Vite, Tailwind CSS        |
| Storage  | Local filesystem                    |

## Quick Start

### Prerequisites

- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)

### One-command start

**Linux / macOS:**

```bash
chmod +x start.sh
./start.sh
```

**Windows:**

```
start.bat
```

This will:
1. Create a Python virtual environment and install backend dependencies
2. Install frontend npm packages
3. Start the backend on port **8000** and frontend on port **3000**

### Manual Start

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Linux/macOS
# venv\Scripts\activate.bat     # Windows
pip install -r requirements.txt
python main.py
```

**Frontend (separate terminal):**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### Login

You will be prompted for an admin **username** and **password** every time you start the app. These credentials are used to log in via the browser.

You can also pass them as environment variables to skip the prompt:

```bash
ADMIN_USER=myuser ADMIN_PASS=mypass MEDIA_DIR=/path/to/photos ./start.sh
```

## User Roles

| Role    | View | Download | Upload | Delete | Manage Users |
|---------|------|----------|--------|--------|-------------|
| Admin   | Yes  | Yes      | Yes    | Yes    | Yes         |
| Editor  | Yes  | Yes      | Yes    | Yes    | No          |
| Viewer  | Yes  | Yes      | No     | No     | No          |

## Keyboard Shortcuts

| Key            | Action              |
|----------------|---------------------|
| `Ctrl+A`       | Select all files    |
| `Escape`       | Clear selection     |
| `Shift+Click`  | Range select        |
| `Ctrl+Click`   | Toggle select       |
| `Left/Right`   | Navigate preview    |
| `Escape`       | Close preview       |

## Configuration

Set environment variables before starting:

| Variable             | Default                          | Description         |
|----------------------|----------------------------------|---------------------|
| `FILE_SHARE_SECRET`  | `change-me-in-production-please!`| JWT signing secret  |
| `TOKEN_EXPIRE_HOURS` | `72`                             | Token TTL in hours  |

## Production Build

```bash
# Build frontend
cd frontend && npm run build

# Run backend (serves frontend from dist/)
cd ../backend && python main.py
```

In production, only the backend (port 8000) needs to run — it serves the built frontend automatically.

## Project Structure

```
GhumaggerSnap/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── uploads/             # Stored files (auto-created)
│   └── thumbnails/          # Image thumbnails (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component + auth context
│   │   ├── api.js           # API client
│   │   └── components/
│   │       ├── Login.jsx    # Login page
│   │       ├── Dashboard.jsx# Main file browser
│   │       ├── FileCard.jsx # Grid/list file cards
│   │       └── FilePreview.jsx # Fullscreen preview modal
│   ├── package.json
│   └── vite.config.js
├── start.sh                 # Linux/macOS startup script
├── start.bat                # Windows startup script
└── README.md
```

## License

MIT
