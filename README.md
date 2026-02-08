# GhumaggerSnap

A self-hosted trip photo & video sharing app for friends and family, built with **FastAPI** (Python) and **React**.

Browse photos and videos from any directory — local disk, USB drive, or external hard drive — with a beautiful Google Drive-like UI. Share with friends over the internet via a single command.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Browse External Drives** — Point to any folder (USB, HDD, SSD) and browse it instantly
- **Folder Navigation** — Navigate directories with breadcrumbs, just like a file explorer
- **Image Preview** — Full-screen image viewer with thumbnails and arrow-key navigation
- **Video Preview** — In-browser video player with streaming and seeking support
- **Download** — Single file download or multi-select bulk download as ZIP
- **Grid / List View** — Toggle between card grid and compact list
- **Search & Filter** — Search by filename, filter by type, sort by date/name/size
- **Authentication** — JWT-based login with admin-set credentials at startup
- **User Management** — Admin panel to create/delete viewer accounts
- **Share over Internet** — Built-in tunnel support (Cloudflare, Serveo) to share with friends
- **Lazy Scanning** — Instant startup even with 500 GB+ of data
- **Cross-platform** — Runs on Windows, Linux, and macOS

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Python 3.10+, FastAPI, SQLite, JWT  |
| Frontend | React 18, Vite, Tailwind CSS        |
| Storage  | Local filesystem (read-only)        |

## Quick Start (Local)

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

The script will prompt you for:
1. **Media directory** — path to your photos/videos (e.g. `/Volumes/SanDisk/TripPhotos`)
2. **Admin username** and **password** — used to log in via the browser

You can skip prompts with env vars:

```bash
ADMIN_USER=akshay ADMIN_PASS=MySecret123 MEDIA_DIR=~/Pictures/Trips ./start.sh
```

## Share with Friends over the Internet

Want your friends to see the trip photos? Use the **share script** to expose the app via a public URL. No extra installs needed — it uses [localtunnel](https://github.com/localtunnel/localtunnel) via `npx` (bundled with Node.js).

**Linux / macOS:**

```bash
chmod +x share.sh
./share.sh
```

**Windows:**

```
share.bat
```

The script will:
1. Prompt for media directory and admin credentials
2. Ask for a **subdomain** (e.g. `ghumaggersnap`) so your URL stays the same
3. Build the frontend for production
4. Start the backend on port 8000
5. Open a public tunnel and give you a URL like **`https://ghumaggersnap.loca.lt`**

Send that URL to your friends — they log in with the credentials you set.

### Stable URL with Custom Subdomain

Pick a unique subdomain and you'll get the same URL every time:

```
https://your-chosen-name.loca.lt
```

If someone else is already using that subdomain, you'll get a random one instead. Choose something unique like `ghumagger-akshay-goa2024`.

### Skip Prompts with Environment Variables

```bash
ADMIN_USER=akshay ADMIN_PASS=Secret123 MEDIA_DIR=~/TripPhotos SUBDOMAIN=mygoa2024 ./share.sh
```

### Note for Friends

On their first visit, friends will see a localtunnel landing page — they just need to click **"Click to Continue"** and then the app loads normally.

## Login

You set the admin **username** and **password** every time you start the app. These are the credentials your friends use to log in.

You can also create additional viewer accounts from the admin panel (click your avatar > Manage Users).

## Keyboard Shortcuts

| Key            | Action              |
|----------------|---------------------|
| `Ctrl+A`       | Select all files    |
| `Escape`       | Clear selection     |
| `Shift+Click`  | Range select        |
| `Ctrl+Click`   | Toggle select       |
| `Backspace`    | Go to parent folder |
| `Left/Right`   | Navigate preview    |
| `Escape`       | Close preview       |

## Configuration

| Variable             | Default                          | Description                |
|----------------------|----------------------------------|----------------------------|
| `MEDIA_DIR`          | `backend/media/`                 | Path to photos/videos      |
| `ADMIN_USER`         | *(prompted)*                     | Admin login username       |
| `ADMIN_PASS`         | *(prompted)*                     | Admin login password       |
| `FILE_SHARE_SECRET`  | `change-me-in-production-please!`| JWT signing secret         |
| `TOKEN_EXPIRE_HOURS` | `72`                             | Token TTL in hours         |

## Project Structure

```
GhumaggerSnap/
├── backend/
│   ├── main.py              # FastAPI app (auth, filesystem browser, streaming)
│   ├── requirements.txt     # Python dependencies
│   └── thumbnails/          # Cached image thumbnails (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component + auth context
│   │   ├── api.js           # API client
│   │   └── components/
│   │       ├── Login.jsx    # Login page
│   │       ├── Dashboard.jsx# Main file browser + folder navigation
│   │       ├── FileCard.jsx # Grid/list file & folder cards
│   │       └── FilePreview.jsx # Fullscreen preview modal
│   ├── package.json
│   └── vite.config.js
├── start.sh                 # Local development (Linux/macOS)
├── start.bat                # Local development (Windows)
├── share.sh                 # Share over internet (Linux/macOS)
├── share.bat                # Share over internet (Windows)
└── README.md
```

## License

MIT
