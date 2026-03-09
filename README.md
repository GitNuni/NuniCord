# NuniCord

> **Self-hosted Discord alternative** — deploy in one command.

NuniCord is a full-featured, production-ready chat platform with real-time messaging, voice/video, file sharing, web push notifications, and an admin dashboard. Runs entirely on your own infrastructure.

```bash
git clone https://github.com/your-org/nunicord.git && cd nunicord
cp .env.example .env  # Set JWT_SECRET and POSTGRES_PASSWORD
docker compose up -d
```

Then watch logs for the setup URL: `docker compose logs app | grep SETUP`

---

## Features

- 💬 **Real-time messaging** — Socket.io, message editing, reactions, replies, threads
- 🎙 **Voice & Video** — WebRTC channels with screen sharing, mute/deafen controls
- 📁 **File uploads** — images, videos, documents with inline previews
- 🔔 **Push notifications** — Web Push API (VAPID) for iOS & Android PWA
- 📱 **PWA** — installable on iOS and Android, works offline
- 🤖 **Bots & Webhooks** — REST API + Socket.io events for automation
- 🛡 **Roles & Permissions** — granular channel-level permission system
- 🔗 **Invite links** — configurable expiry & usage limits
- 🔍 **Full-text search** — powered by PostgreSQL
- 🎨 **Discord-like UI** — three-panel layout, dark theme
- ⚙️ **Admin dashboard** — user management, server stats, instance settings
- 🌐 **Multi or single-server mode** — configure via `NUNICORD_MODE`

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Tailwind CSS |
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Voice | WebRTC + coturn TURN/STUN |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Push | Web Push API (VAPID) |
| Storage | Local volume or S3-compatible |
| Proxy | Caddy 2 (optional, auto-HTTPS) |

## Documentation

- [Full Self-Hosting Guide](docs/SELF_HOSTING.md)
- [API Reference & Bot Development](docs/README.md)

## License

MIT
