# NuniCord — Self-Hosted Discord Alternative

NuniCord is a full-featured, production-ready, self-hosted chat platform deployable with a single `docker compose up` command. It supports real-time messaging, voice/video via WebRTC, web push notifications, bots, webhooks, and an admin dashboard.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [First-Time Setup](#first-time-setup)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Bot Development](#bot-development)
- [Self-Hosting Guide](#self-hosting-guide)
- [Development](#development)

---

## Features

| Feature | Status |
|---------|--------|
| Real-time messaging (Socket.io) | ✅ |
| Server/channel structure | ✅ |
| Text, voice, forum channels | ✅ |
| Direct messages & group DMs | ✅ |
| File & image uploads | ✅ |
| Message reactions | ✅ |
| Reply threads | ✅ |
| Markdown formatting | ✅ |
| Link previews | ✅ |
| Pinned messages | ✅ |
| Full-text message search | ✅ |
| Read state tracking | ✅ |
| User presence/status | ✅ |
| WebRTC voice channels | ✅ |
| Screen sharing | ✅ |
| Roles & permissions | ✅ |
| Invite links | ✅ |
| Webhooks | ✅ |
| Bot accounts | ✅ |
| Web Push notifications (PWA) | ✅ |
| PWA (installable, iOS & Android) | ✅ |
| Admin dashboard | ✅ |
| Multi-server mode | ✅ |
| Single-server mode | ✅ |
| Local file storage | ✅ |
| S3/MinIO storage | ✅ |
| Emoji reactions | ✅ |
| OAuth (Google, GitHub) | ✅ |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose v2+
- 2GB+ RAM
- Ports 3001 (app), 3478 (TURN) open

### 1. Clone and configure

```bash
git clone https://github.com/your-org/nunicord.git
cd nunicord
cp .env.example .env
```

### 2. Set required secrets

Edit `.env` and fill in:

```env
# REQUIRED: Generate a secure random secret
JWT_SECRET=$(openssl rand -hex 64)

# REQUIRED: Change from default
POSTGRES_PASSWORD=your_strong_password_here

# For push notifications (optional but recommended)
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### 3. Start NuniCord

```bash
# Basic (app + postgres + redis)
docker compose up -d

# With TURN server for voice
docker compose --profile full up -d

# With Caddy HTTPS proxy
DOMAIN=chat.yourdomain.com docker compose --profile caddy up -d
```

### 4. Complete setup

Watch the logs for the setup URL:

```bash
docker compose logs app | grep "SETUP"
```

Open the URL in your browser to create the admin account.

---

## Configuration

All configuration is done via environment variables in `.env`. See `.env.example` for all available options.

### Key Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Secret for signing JWTs (64+ random chars) |
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL password |
| `NUNICORD_MODE` | | `multi` (default) or `single` |
| `DOMAIN` | With Caddy | Your domain name |
| `MAX_FILE_SIZE_MB` | | Max upload size (default: 100) |
| `VAPID_PUBLIC_KEY` | For push | VAPID public key |
| `VAPID_PRIVATE_KEY` | For push | VAPID private key |
| `TURN_SECRET` | For voice | TURN server secret |
| `AWS_S3_BUCKET` | For S3 | S3 bucket name |

### Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### Single-Server Mode

Set `NUNICORD_MODE=single` to disable multi-server functionality. Users join a single default server automatically.

---

## First-Time Setup

On first launch with no admin user, NuniCord prints a setup URL to the logs:

```
============================================================
NUNICORD FIRST-TIME SETUP
No admin user found. Complete setup at:
  http://localhost:3001/setup?token=<token>
============================================================
```

Open this URL to create the initial admin account. The token is single-use.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  caddy   │  │   app    │  │postgres  │  │ redis  │ │
│  │  :80/443 │→ │  :3001   │→ │  :5432   │  │ :6379  │ │
│  └──────────┘  └────┬─────┘  └──────────┘  └────────┘ │
│                     │                                    │
│  ┌──────────┐        │                                  │
│  │  coturn  │←───────┤ WebRTC signaling                 │
│  │:3478/5349│        │                                  │
│  └──────────┘        ↓                                  │
│               ┌──────────────┐                          │
│               │   /uploads   │ (volume)                 │
│               └──────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + Tailwind CSS |
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Voice/Video | WebRTC + coturn |
| Database | PostgreSQL 16 |
| Cache/PubSub | Redis 7 |
| Push Notifications | Web Push API (VAPID) |
| File Storage | Local volume or S3-compatible |
| Reverse Proxy | Caddy 2 (optional) |
| PWA | Service Worker + Web App Manifest |

---

## API Reference

### Authentication

```http
POST /api/auth/register
Content-Type: application/json

{ "username": "alice", "password": "securepassword", "email": "alice@example.com" }
```

```http
POST /api/auth/login
Content-Type: application/json

{ "login": "alice", "password": "securepassword" }
```

Returns:
```json
{ "token": "eyJ...", "user": { "id": "...", "username": "alice", ... } }
```

Include the token in all subsequent requests:
```http
Authorization: Bearer eyJ...
```

### Servers

```http
GET    /api/servers              # List my servers
POST   /api/servers              # Create server
GET    /api/servers/:id          # Get server details
PATCH  /api/servers/:id          # Update server
DELETE /api/servers/:id          # Delete server
POST   /api/servers/join/:code   # Join via invite code
GET    /api/servers/:id/members  # List members
POST   /api/servers/:id/invites  # Create invite
GET    /api/servers/:id/invites  # List invites
GET    /api/servers/:id/roles    # List roles
POST   /api/servers/:id/roles    # Create role
```

### Channels

```http
POST   /api/channels             # Create channel
GET    /api/channels/:id         # Get channel
PATCH  /api/channels/:id         # Update channel
DELETE /api/channels/:id         # Delete channel
GET    /api/channels/:id/messages # Get messages
GET    /api/channels/:id/pins    # Get pinned messages
PUT    /api/channels/:id/pins/:messageId # Pin message
DELETE /api/channels/:id/pins/:messageId # Unpin message
PUT    /api/channels/:id/read    # Mark as read
GET    /api/channels/:id/search?q=query # Search messages
POST   /api/channels/dm          # Create/get DM channel
GET    /api/channels/dms/list    # List DM channels
```

### Messages

```http
POST   /api/messages             # Send message
GET    /api/messages/:id         # Get message
PATCH  /api/messages/:id         # Edit message
DELETE /api/messages/:id         # Delete message
PUT    /api/messages/:id/reactions/:emoji  # Add reaction
DELETE /api/messages/:id/reactions/:emoji # Remove reaction
```

### Webhooks

```http
GET    /api/webhooks/channel/:channelId  # List webhooks
POST   /api/webhooks/channel/:channelId  # Create webhook
POST   /api/webhooks/:id/:token          # Execute webhook (public)
DELETE /api/webhooks/:id                 # Delete webhook
```

### Uploads

```http
POST /api/uploads/attachments    # Upload file attachments (multipart)
POST /api/uploads/avatar         # Upload user avatar
POST /api/uploads/server-icon/:id # Upload server icon
```

### Admin

```http
GET    /api/admin/stats          # Instance statistics
GET    /api/admin/users          # List users
PATCH  /api/admin/users/:id      # Update user
POST   /api/admin/users/:id/ban  # Ban user
POST   /api/admin/users/:id/unban # Unban user
DELETE /api/admin/users/:id      # Delete user
GET    /api/admin/servers        # List servers
DELETE /api/admin/servers/:id    # Delete server
GET    /api/admin/settings       # Get settings
PATCH  /api/admin/settings       # Update settings
POST   /api/admin/bots           # Create bot account
```

---

## Bot Development

### Creating a Bot

1. Log into the admin panel at `/admin`
2. Go to Users → Create Bot
3. Save the bot token

### Using the Bot

```javascript
const { io } = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const BOT_TOKEN = 'your_bot_token_here';

// REST API
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { Authorization: `Bot ${BOT_TOKEN}` }
});

// Connect to Socket.io
const socket = io(BASE_URL, {
  auth: { token: BOT_TOKEN }
});

socket.on('connect', () => {
  console.log('Bot connected!');
});

socket.on('MESSAGE_CREATE', async (message) => {
  // Respond to !ping
  if (message.content === '!ping') {
    await api.post('/messages', {
      channel_id: message.channel_id,
      content: 'Pong! 🏓'
    });
  }
});
```

### Sending Messages via Webhook

```bash
curl -X POST http://localhost:3001/api/webhooks/WEBHOOK_ID/TOKEN \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from webhook!", "username": "My Bot"}'
```

---

## Self-Hosting Guide

### Production Deployment

1. **Get a domain** and point DNS to your server
2. **Open firewall ports**: 80, 443, 3478 (UDP/TCP for TURN)
3. **Set environment variables** (see `.env.example`)
4. **Deploy with Caddy** for automatic HTTPS:

```bash
DOMAIN=chat.yourdomain.com \
CADDY_EMAIL=admin@yourdomain.com \
docker compose --profile full --profile caddy up -d
```

### Backup & Restore

```bash
# Backup database
docker compose exec postgres pg_dump -U nunicord nunicord > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T postgres psql -U nunicord nunicord < backup.sql

# Backup uploads
docker run --rm -v nunicord_uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

### Updates

```bash
git pull
docker compose build
docker compose up -d
```

### Scaling

For high-traffic deployments, you can run multiple app instances behind a load balancer. Redis pub/sub ensures Socket.io events are broadcast across all instances.

```yaml
app:
  deploy:
    replicas: 3
```

### S3/MinIO Storage

For scalable file storage with multiple app instances, use S3-compatible storage:

```bash
# Start MinIO
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=password \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

Then set in `.env`:
```env
AWS_S3_BUCKET=nunicord-uploads
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=password
S3_ENDPOINT=http://minio:9000
```

---

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

### Setup

```bash
# Backend
cd server
npm install
cp ../.env.example .env
# Edit .env with local database settings
node src/index.js

# Frontend (separate terminal)
cd client
npm install
npm start
```

### Environment (local dev)

```env
PORT=3001
POSTGRES_HOST=localhost
POSTGRES_DB=nunicord
POSTGRES_USER=nunicord
POSTGRES_PASSWORD=nunicord
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_secret_not_for_production
```

### Project Structure

```
NuniCord/
├── client/                    # React frontend
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js             # Service worker
│   └── src/
│       ├── components/        # React components
│       │   ├── auth/          # Login, register
│       │   ├── chat/          # Messages, input
│       │   ├── layout/        # Sidebar, panels
│       │   ├── voice/         # Voice/video UI
│       │   ├── server/        # Server management
│       │   ├── channel/       # Channel management
│       │   ├── settings/      # User settings
│       │   └── common/        # Shared components
│       ├── pages/             # Route pages
│       ├── services/          # API client, Socket.io, SW
│       └── store/             # Zustand state management
│
├── server/                    # Express backend
│   └── src/
│       ├── api/routes/        # REST API endpoints
│       ├── db/                # Database & schema
│       ├── socket/            # Socket.io handlers
│       ├── services/          # Business logic
│       └── utils/             # Helpers, permissions
│
├── docker/
│   ├── Dockerfile.app         # App Docker image
│   ├── Caddyfile              # Caddy reverse proxy config
│   └── coturn.conf            # TURN server config
│
├── docker-compose.yml         # All services pre-wired
├── .env.example               # Configuration template
└── docs/README.md             # This file
```

---

## License

MIT License — Free to use, modify, and self-host.
