-- NuniCord Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  display_name VARCHAR(64),
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  pronouns VARCHAR(64),
  status VARCHAR(16) DEFAULT 'offline' CHECK (status IN ('online','idle','dnd','invisible','offline')),
  custom_status TEXT,
  is_bot BOOLEAN DEFAULT FALSE,
  bot_token VARCHAR(255) UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(64),
  oauth_provider VARCHAR(32),
  oauth_id VARCHAR(255),
  push_subscription JSONB,
  notification_settings JSONB DEFAULT '{}',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_bot_token ON users(bot_token) WHERE bot_token IS NOT NULL;

-- Servers (Guilds)
CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code VARCHAR(16) UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  verification_level INTEGER DEFAULT 0,
  default_notification_level VARCHAR(16) DEFAULT 'mentions',
  system_channel_id UUID,
  rules_channel_id UUID,
  member_count INTEGER DEFAULT 0,
  max_members INTEGER DEFAULT 500000,
  features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_invite ON servers(invite_code);

-- Invites
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(16) UNIQUE NOT NULL,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id UUID,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_uses INTEGER DEFAULT 0,
  uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_server ON invites(server_id);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#99AAB5',
  hoist BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  permissions BIGINT DEFAULT 0,
  mentionable BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_server ON roles(server_id);

-- Server Members
CREATE TABLE IF NOT EXISTS server_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(32),
  avatar_url TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  deaf BOOLEAN DEFAULT FALSE,
  mute BOOLEAN DEFAULT FALSE,
  pending BOOLEAN DEFAULT FALSE,
  communication_disabled_until TIMESTAMPTZ,
  UNIQUE(server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_server ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON server_members(user_id);

-- Member Roles
CREATE TABLE IF NOT EXISTS member_roles (
  member_id UUID NOT NULL REFERENCES server_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, role_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER DEFAULT 0,
  collapsed BOOLEAN DEFAULT FALSE,
  permission_overwrites JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_server ON categories(server_id);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(16) DEFAULT 'text' CHECK (type IN ('text','voice','thread','forum','dm','group_dm')),
  topic TEXT,
  position INTEGER DEFAULT 0,
  nsfw BOOLEAN DEFAULT FALSE,
  slowmode_delay INTEGER DEFAULT 0,
  permission_overwrites JSONB DEFAULT '[]',
  parent_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  last_message_id UUID,
  last_pin_timestamp TIMESTAMPTZ,
  rtc_region VARCHAR(64),
  user_limit INTEGER DEFAULT 0,
  bitrate INTEGER DEFAULT 64000,
  video_quality_mode INTEGER DEFAULT 1,
  thread_metadata JSONB,
  dm_participants UUID[],
  webhook_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content TEXT,
  type VARCHAR(32) DEFAULT 'default',
  pinned BOOLEAN DEFAULT FALSE,
  tts BOOLEAN DEFAULT FALSE,
  mention_everyone BOOLEAN DEFAULT FALSE,
  mentions UUID[] DEFAULT '{}',
  mention_roles UUID[] DEFAULT '{}',
  mention_channels UUID[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  embeds JSONB DEFAULT '[]',
  reactions JSONB DEFAULT '[]',
  edited_at TIMESTAMPTZ,
  edit_history JSONB DEFAULT '[]',
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  webhook_id UUID,
  application_id UUID,
  flags INTEGER DEFAULT 0,
  nonce VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages USING gin(to_tsvector('english', content)) WHERE content IS NOT NULL;

-- Reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

-- Pinned Messages
CREATE TABLE IF NOT EXISTS pinned_messages (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, message_id)
);

-- Read States
CREATE TABLE IF NOT EXISTS read_states (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  mention_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_read_states_user ON read_states(user_id);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  avatar_url TEXT,
  token VARCHAR(255) UNIQUE NOT NULL,
  type INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_channel ON webhooks(channel_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_token ON webhooks(token);

-- Voice States
CREATE TABLE IF NOT EXISTS voice_states (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  session_id VARCHAR(64),
  mute BOOLEAN DEFAULT FALSE,
  deaf BOOLEAN DEFAULT FALSE,
  self_mute BOOLEAN DEFAULT FALSE,
  self_deaf BOOLEAN DEFAULT FALSE,
  self_video BOOLEAN DEFAULT FALSE,
  self_stream BOOLEAN DEFAULT FALSE,
  suppress BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_states_channel ON voice_states(channel_id);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type INTEGER NOT NULL,
  target_id UUID,
  target_type VARCHAR(32),
  changes JSONB DEFAULT '[]',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_server ON audit_log(server_id, created_at DESC);

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- Channel Notification Settings
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  level VARCHAR(16) DEFAULT 'default' CHECK (level IN ('all','mentions','none','default')),
  muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMPTZ,
  UNIQUE (user_id, channel_id, server_id)
);

-- Forum Posts (extends messages for forum channels)
CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  tags JSONB DEFAULT '[]',
  pinned BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  last_reply_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_channel ON forum_posts(channel_id);

-- Instance Settings
CREATE TABLE IF NOT EXISTS instance_settings (
  key VARCHAR(128) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default instance settings
INSERT INTO instance_settings (key, value) VALUES
  ('registration_open', 'true'),
  ('max_file_size_mb', '100'),
  ('max_servers_per_user', '100'),
  ('require_email_verification', 'false'),
  ('smtp_config', '{}'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS servers_updated_at ON servers;
CREATE TRIGGER servers_updated_at BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS channels_updated_at ON channels;
CREATE TRIGGER channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Member count triggers
CREATE OR REPLACE FUNCTION update_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE servers SET member_count = member_count + 1 WHERE id = NEW.server_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE servers SET member_count = member_count - 1 WHERE id = OLD.server_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS server_member_count_insert ON server_members;
CREATE TRIGGER server_member_count_insert AFTER INSERT ON server_members FOR EACH ROW EXECUTE FUNCTION update_member_count();
DROP TRIGGER IF EXISTS server_member_count_delete ON server_members;
CREATE TRIGGER server_member_count_delete AFTER DELETE ON server_members FOR EACH ROW EXECUTE FUNCTION update_member_count();
