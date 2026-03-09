# Self-Hosting Guide

## Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 1GB | 4GB+ |
| Storage | 10GB | 50GB+ |
| Bandwidth | 10 Mbps | 100 Mbps+ |
| OS | Any Docker host | Ubuntu 22.04 LTS |

## Quick Install (Ubuntu/Debian)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Clone NuniCord
git clone https://github.com/your-org/nunicord.git /opt/nunicord
cd /opt/nunicord

# Configure
cp .env.example .env
nano .env  # Set your secrets

# Start
docker compose up -d
```

## Reverse Proxy Setup

### With Caddy (Recommended - Auto HTTPS)

```bash
# Update .env
DOMAIN=chat.yourdomain.com
CADDY_EMAIL=admin@yourdomain.com
TRUST_PROXY=true

# Start with Caddy
docker compose --profile caddy up -d
```

### With nginx

```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chat.yourdomain.com;

    ssl_certificate /etc/ssl/your.crt;
    ssl_certificate_key /etc/ssl/your.key;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

## TURN Server for Voice

For voice/video to work across NAT (most home users), you need a TURN server.
The bundled coturn container handles this automatically when using `--profile full`.

For best results, the TURN server should be on a public IP address.

```bash
# Start with TURN
TURN_SECRET=$(openssl rand -hex 32) \
docker compose --profile full up -d
```

## iOS & Android PWA

NuniCord works as a native-like app on mobile:

1. **iOS (Safari)**: Open NuniCord URL → Share → "Add to Home Screen"
2. **Android (Chrome)**: Open URL → Menu → "Add to Home Screen" or "Install App"

For push notifications to work on iOS, you need:
- HTTPS (required by iOS)
- VAPID keys configured
- iOS 16.4+ (Safari)

## Monitoring

### Logs
```bash
# All services
docker compose logs -f

# Just app
docker compose logs -f app

# With timestamps
docker compose logs -f --timestamps app
```

### Resource Usage
```bash
docker stats
```

### Health Check
```bash
curl http://localhost:3001/health
```

## Maintenance

### Database Optimization
```bash
# Run VACUUM ANALYZE periodically
docker compose exec postgres psql -U nunicord -c "VACUUM ANALYZE;"
```

### Prune Old Data
```bash
# Delete messages older than 1 year from inactive channels
docker compose exec postgres psql -U nunicord -c "
  DELETE FROM messages WHERE created_at < NOW() - INTERVAL '1 year'
  AND channel_id IN (SELECT id FROM channels WHERE last_message_id IS NULL);
"
```

### Update NuniCord
```bash
cd /opt/nunicord
git pull origin main
docker compose build app
docker compose up -d app
```

## Troubleshooting

### App won't start
```bash
docker compose logs app
# Check for DB connection errors, missing env vars
```

### Voice not working
- Ensure ports 3478 (UDP & TCP) are open
- Set `TURN_HOST` to your server's public IP
- Try `docker compose --profile full up -d` to start coturn

### Push notifications not working
- Ensure VAPID keys are set
- Must use HTTPS
- Check browser notification permissions

### Can't connect from outside
- Check firewall: `sudo ufw allow 3001` or `sudo ufw allow 443`
- Verify `CORS_ORIGIN` includes your domain
- If behind NAT, forward ports 3001 and 3478
