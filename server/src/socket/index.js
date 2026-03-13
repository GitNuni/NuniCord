const jwt = require('jsonwebtoken');
const { query, getRedis } = require('../db');
const { getFullMessage } = require('../api/routes/messages');
const { sendPushNotification } = require('../api/routes/notifications');
const logger = require('../utils/logger');

module.exports = function setupSocket(io) {
  const REDIS_CHANNEL = 'nunicord:events';

  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.slice(7);
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, username, display_name, avatar_url, status, is_admin FROM users WHERE id = $1 AND is_banned = FALSE',
        [decoded.userId]
      );

      if (!result.rows[0]) return next(new Error('User not found'));
      socket.user = result.rows[0];
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Redis pub/sub for horizontal scaling
  let redisSubscriber;
  async function setupRedisSubscriber() {
    try {
      const redis = getRedis();
      redisSubscriber = redis.duplicate();
      await redisSubscriber.connect();
      await redisSubscriber.subscribe(REDIS_CHANNEL, (message) => {
        try {
          const event = JSON.parse(message);
          // Broadcast to appropriate rooms
          if (event.room) {
            io.to(event.room).emit(event.type, event.data);
          } else {
            io.emit(event.type, event.data);
          }
        } catch (err) {
          logger.error('Redis subscriber error:', err);
        }
      });
    } catch (err) {
      logger.warn('Redis pub/sub not available, using local events only');
    }
  }

  setupRedisSubscriber();

  function publishEvent(type, data, room) {
    if (room) {
      io.to(room).emit(type, data);
    } else {
      io.emit(type, data);
    }
  }

  // Track user presence in Redis
  async function setUserPresence(userId, socketId, data) {
    try {
      const redis = getRedis();
      await redis.setEx(`presence:${userId}`, 300, JSON.stringify({ socketId, ...data }));
    } catch {}
  }

  async function removeUserPresence(userId) {
    try {
      const redis = getRedis();
      await redis.del(`presence:${userId}`);
    } catch {}
  }

  io.on('connection', async (socket) => {
    const user = socket.user;
    logger.debug(`Socket connected: ${user.username} (${socket.id})`);

    // Update user status to online
    await query("UPDATE users SET status = CASE WHEN status = 'offline' THEN 'online' ELSE status END, last_seen = NOW() WHERE id = $1", [user.id]);
    await setUserPresence(user.id, socket.id, { status: 'online' });

    // Join user's servers
    const servers = await query(
      'SELECT server_id FROM server_members WHERE user_id = $1',
      [user.id]
    );

    for (const row of servers.rows) {
      socket.join(`server:${row.server_id}`);
    }

    // Join personal room
    socket.join(`user:${user.id}`);

    // Notify servers user is online
    for (const row of servers.rows) {
      publishEvent('PRESENCE_UPDATE', {
        user_id: user.id,
        status: user.status === 'offline' ? 'online' : user.status,
        server_id: row.server_id,
      }, `server:${row.server_id}`);
    }

    // === MESSAGING EVENTS ===

    socket.on('MESSAGE_CREATE', async (data) => {
      try {
        const { channel_id, content, reply_to_id, nonce, attachments = [], embeds = [] } = data;

        // Verify channel access
        const channel = await query('SELECT * FROM channels WHERE id = $1', [channel_id]);
        if (!channel.rows[0]) return;

        if (!content && attachments.length === 0) return;

        const mentions = [];
        const mentionRegex = /<@!?([a-f0-9-]{36})>/g;
        let match;
        if (content) {
          while ((match = mentionRegex.exec(content)) !== null) mentions.push(match[1]);
        }
        const mentionEveryone = content?.includes('@everyone') || content?.includes('@here');

        const result = await query(
          `INSERT INTO messages (channel_id, author_id, content, reply_to_id, attachments, embeds, mentions, mention_everyone, nonce)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [channel_id, user.id, content || null, reply_to_id || null,
           JSON.stringify(attachments), JSON.stringify(embeds), mentions, mentionEveryone, nonce || null]
        );

        await query('UPDATE channels SET last_message_id = $1, updated_at = NOW() WHERE id = $2', [
          result.rows[0].id, channel_id
        ]);

        const fullMessage = await getFullMessage(result.rows[0].id, user.id);

        // Determine room
        const room = channel.rows[0].server_id
          ? `server:${channel.rows[0].server_id}`
          : `channel:${channel_id}`;

        publishEvent('MESSAGE_CREATE', fullMessage, room);

        // Send push notifications for mentions
        if (mentions.length > 0 || mentionEveryone) {
          await sendMentionNotifications(fullMessage, channel.rows[0], mentions, mentionEveryone);
        }

        // Update read states for others
        if (channel.rows[0].server_id) {
          await updateUnreadCounts(channel_id, user.id, mentions, mentionEveryone);
        }
      } catch (err) {
        logger.error('MESSAGE_CREATE socket error:', err);
        socket.emit('ERROR', { message: 'Failed to send message' });
      }
    });

    socket.on('MESSAGE_UPDATE', async (data) => {
      try {
        const { message_id, content } = data;
        const msg = await query('SELECT * FROM messages WHERE id = $1 AND author_id = $2', [message_id, user.id]);
        if (!msg.rows[0]) return;

        const editHistory = [...(msg.rows[0].edit_history || []), {
          content: msg.rows[0].content,
          edited_at: msg.rows[0].edited_at || msg.rows[0].created_at,
        }];

        const result = await query(
          'UPDATE messages SET content = $1, edited_at = NOW(), edit_history = $2 WHERE id = $3 RETURNING *',
          [content, JSON.stringify(editHistory), message_id]
        );

        const fullMessage = await getFullMessage(result.rows[0].id, user.id);
        const channel = await query('SELECT server_id FROM channels WHERE id = $1', [result.rows[0].channel_id]);
        const room = channel.rows[0]?.server_id
          ? `server:${channel.rows[0].server_id}`
          : `channel:${result.rows[0].channel_id}`;

        publishEvent('MESSAGE_UPDATE', fullMessage, room);
      } catch (err) {
        logger.error('MESSAGE_UPDATE socket error:', err);
      }
    });

    socket.on('MESSAGE_DELETE', async (data) => {
      try {
        const { message_id } = data;
        const msg = await query(
          'SELECT m.*, c.server_id FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = $1',
          [message_id]
        );
        if (!msg.rows[0]) return;

        if (msg.rows[0].author_id !== user.id && !user.is_admin) return;

        await query('DELETE FROM messages WHERE id = $1', [message_id]);

        const room = msg.rows[0].server_id
          ? `server:${msg.rows[0].server_id}`
          : `channel:${msg.rows[0].channel_id}`;

        publishEvent('MESSAGE_DELETE', {
          id: message_id,
          channel_id: msg.rows[0].channel_id,
          server_id: msg.rows[0].server_id,
        }, room);
      } catch (err) {
        logger.error('MESSAGE_DELETE socket error:', err);
      }
    });

    socket.on('REACTION_ADD', async (data) => {
      try {
        const { message_id, emoji } = data;
        await query(
          'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [message_id, user.id, emoji]
        );
        const msg = await query(
          'SELECT m.channel_id, c.server_id FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = $1',
          [message_id]
        );
        if (!msg.rows[0]) return;

        const room = msg.rows[0].server_id
          ? `server:${msg.rows[0].server_id}`
          : `channel:${msg.rows[0].channel_id}`;

        publishEvent('REACTION_ADD', {
          message_id, emoji,
          user_id: user.id,
          channel_id: msg.rows[0].channel_id,
        }, room);
      } catch (err) {
        logger.error('REACTION_ADD socket error:', err);
      }
    });

    socket.on('REACTION_REMOVE', async (data) => {
      try {
        const { message_id, emoji } = data;
        await query(
          'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [message_id, user.id, emoji]
        );
        const msg = await query(
          'SELECT m.channel_id, c.server_id FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = $1',
          [message_id]
        );
        if (!msg.rows[0]) return;

        const room = msg.rows[0].server_id
          ? `server:${msg.rows[0].server_id}`
          : `channel:${msg.rows[0].channel_id}`;

        publishEvent('REACTION_REMOVE', {
          message_id, emoji,
          user_id: user.id,
          channel_id: msg.rows[0].channel_id,
        }, room);
      } catch (err) {
        logger.error('REACTION_REMOVE socket error:', err);
      }
    });

    socket.on('TYPING_START', async (data) => {
      const { channel_id } = data;
      const channel = await query('SELECT server_id FROM channels WHERE id = $1', [channel_id]);
      const room = channel.rows[0]?.server_id
        ? `server:${channel.rows[0].server_id}`
        : `channel:${channel_id}`;

      socket.to(room).emit('TYPING_START', {
        channel_id,
        user_id: user.id,
        username: user.display_name || user.username,
      });
    });

    socket.on('TYPING_STOP', async (data) => {
      const { channel_id } = data;
      const channel = await query('SELECT server_id FROM channels WHERE id = $1', [channel_id]);
      const room = channel.rows[0]?.server_id
        ? `server:${channel.rows[0].server_id}`
        : `channel:${channel_id}`;

      socket.to(room).emit('TYPING_STOP', {
        channel_id,
        user_id: user.id,
      });
    });

    // === CHANNEL EVENTS ===
    socket.on('CHANNEL_JOIN', (data) => {
      socket.join(`channel:${data.channel_id}`);
    });

    socket.on('CHANNEL_LEAVE', (data) => {
      socket.leave(`channel:${data.channel_id}`);
    });

    // === VOICE EVENTS ===
    socket.on('VOICE_JOIN', async (data) => {
      try {
        const { channel_id, server_id } = data;

        // Update voice state
        await query(
          `INSERT INTO voice_states (user_id, channel_id, server_id, session_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, server_id) DO UPDATE SET
             channel_id = $2, session_id = $4`,
          [user.id, channel_id, server_id, socket.id]
        );

        socket.join(`voice:${channel_id}`);

        // Get existing voice members
        const members = await query(
          `SELECT vs.*, u.username, u.display_name, u.avatar_url
           FROM voice_states vs
           JOIN users u ON u.id = vs.user_id
           WHERE vs.channel_id = $1`,
          [channel_id]
        );

        // Notify others
        publishEvent('VOICE_STATE_UPDATE', {
          user_id: user.id,
          channel_id,
          server_id,
          username: user.display_name || user.username,
          avatar_url: user.avatar_url,
          self_mute: false,
          self_deaf: false,
          self_video: false,
        }, `server:${server_id}`);

        // Send existing members to joining user
        socket.emit('VOICE_MEMBERS', { channel_id, members: members.rows });
      } catch (err) {
        logger.error('VOICE_JOIN error:', err);
      }
    });

    socket.on('VOICE_LEAVE', async (data) => {
      try {
        const { channel_id, server_id } = data;
        await query('DELETE FROM voice_states WHERE user_id = $1 AND server_id = $2', [user.id, server_id]);
        socket.leave(`voice:${channel_id}`);

        publishEvent('VOICE_STATE_UPDATE', {
          user_id: user.id,
          channel_id: null,
          server_id,
        }, `server:${server_id}`);
      } catch (err) {
        logger.error('VOICE_LEAVE error:', err);
      }
    });

    socket.on('VOICE_STATE_UPDATE', async (data) => {
      try {
        const { self_mute, self_deaf, self_video, self_stream, channel_id, server_id } = data;
        await query(
          `UPDATE voice_states SET self_mute = $1, self_deaf = $2, self_video = $3, self_stream = $4
           WHERE user_id = $5 AND server_id = $6`,
          [self_mute, self_deaf, self_video, self_stream, user.id, server_id]
        );

        publishEvent('VOICE_STATE_UPDATE', {
          user_id: user.id,
          channel_id,
          server_id,
          username: user.display_name || user.username,
          avatar_url: user.avatar_url,
          self_mute,
          self_deaf,
          self_video,
          self_stream,
        }, `server:${server_id}`);
      } catch (err) {
        logger.error('VOICE_STATE_UPDATE error:', err);
      }
    });

    // === WebRTC Signaling ===
    socket.on('RTC_OFFER', (data) => {
      const { target_user_id, offer, channel_id } = data;
      io.to(`user:${target_user_id}`).emit('RTC_OFFER', {
        from_user_id: user.id,
        offer,
        channel_id,
      });
    });

    socket.on('RTC_ANSWER', (data) => {
      const { target_user_id, answer, channel_id } = data;
      io.to(`user:${target_user_id}`).emit('RTC_ANSWER', {
        from_user_id: user.id,
        answer,
        channel_id,
      });
    });

    socket.on('RTC_ICE_CANDIDATE', (data) => {
      const { target_user_id, candidate, channel_id } = data;
      io.to(`user:${target_user_id}`).emit('RTC_ICE_CANDIDATE', {
        from_user_id: user.id,
        candidate,
        channel_id,
      });
    });

    socket.on('SPEAKING', (data) => {
      const { is_speaking } = data;
      // Broadcast to all users in the same voice channels
      socket.rooms.forEach(room => {
        if (room.startsWith('voice:')) {
          socket.to(room).emit('SPEAKING', { user_id: user.id, is_speaking });
        }
      });
    });

    socket.on('SCREEN_SHARE_START', (data) => {
      const { channel_id } = data;
      socket.to(`voice:${channel_id}`).emit('SCREEN_SHARE_START', {
        user_id: user.id,
        channel_id,
      });
    });

    socket.on('SCREEN_SHARE_STOP', (data) => {
      const { channel_id } = data;
      socket.to(`voice:${channel_id}`).emit('SCREEN_SHARE_STOP', {
        user_id: user.id,
        channel_id,
      });
    });

    // === PRESENCE ===
    socket.on('STATUS_UPDATE', async (data) => {
      const { status, custom_status } = data;
      const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
      if (!validStatuses.includes(status)) return;

      await query(
        'UPDATE users SET status = $1, custom_status = $2 WHERE id = $3',
        [status, custom_status || null, user.id]
      );

      const effectiveStatus = status === 'invisible' ? 'offline' : status;

      for (const row of servers.rows) {
        publishEvent('PRESENCE_UPDATE', {
          user_id: user.id,
          status: effectiveStatus,
          custom_status,
        }, `server:${row.server_id}`);
      }
    });

    // === SOUNDBOARD ===
    socket.on('SOUNDBOARD_PLAY', (data) => {
      const { channel_id, sound_id } = data;
      if (!channel_id || !sound_id) return;
      // Broadcast to everyone in the voice channel (including sender)
      io.to(`voice:${channel_id}`).emit('SOUNDBOARD_PLAY', {
        sound_id,
        channel_id,
        user_id: user.id,
        username: user.display_name || user.username,
      });
    });

    // === SERVER EVENTS (for bots) ===
    socket.on('SERVER_JOIN', (data) => {
      socket.join(`server:${data.server_id}`);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      logger.debug(`Socket disconnected: ${user.username}`);

      // Check if user has other connections
      const sockets = await io.fetchSockets();
      const hasOtherSockets = sockets.some(s => s.user?.id === user.id && s.id !== socket.id);

      if (!hasOtherSockets) {
        await query("UPDATE users SET status = 'offline', last_seen = NOW() WHERE id = $1", [user.id]);
        await removeUserPresence(user.id);

        // Clean up voice states
        const voiceState = await query('SELECT * FROM voice_states WHERE user_id = $1', [user.id]);
        if (voiceState.rows[0]) {
          const vs = voiceState.rows[0];
          await query('DELETE FROM voice_states WHERE user_id = $1', [user.id]);

          for (const row of servers.rows) {
            publishEvent('VOICE_STATE_UPDATE', {
              user_id: user.id,
              channel_id: null,
              server_id: vs.server_id,
            }, `server:${vs.server_id}`);
          }
        }

        for (const row of servers.rows) {
          publishEvent('PRESENCE_UPDATE', {
            user_id: user.id,
            status: 'offline',
          }, `server:${row.server_id}`);
        }
      }
    });
  });
};

async function sendMentionNotifications(message, channel, mentions, mentionEveryone) {
  try {
    let targets = [];

    if (mentionEveryone && channel.server_id) {
      const members = await query(
        'SELECT user_id FROM server_members WHERE server_id = $1 AND user_id != $2',
        [channel.server_id, message.author.id]
      );
      targets = members.rows.map(r => r.user_id);
    } else {
      targets = mentions.filter(id => id !== message.author.id);
    }

    for (const userId of targets.slice(0, 50)) {
      await sendPushNotification(userId, {
        title: `${message.author.display_name || message.author.username} mentioned you`,
        body: message.content?.slice(0, 200) || 'New mention',
        icon: message.author.avatar_url || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: `mention-${message.id}`,
        data: {
          channel_id: message.channel_id,
          message_id: message.id,
          server_id: channel.server_id,
        },
      });
    }
  } catch (err) {
    // Non-critical
  }
}

async function updateUnreadCounts(channelId, authorId, mentions, mentionEveryone) {
  try {
    // Get all members who can see this channel
    const channel = await query('SELECT server_id FROM channels WHERE id = $1', [channelId]);
    if (!channel.rows[0]?.server_id) return;

    const members = await query(
      'SELECT user_id FROM server_members WHERE server_id = $1 AND user_id != $2',
      [channel.rows[0].server_id, authorId]
    );

    for (const member of members.rows) {
      const isMentioned = mentionEveryone || mentions.includes(member.user_id);
      await query(
        `INSERT INTO read_states (user_id, channel_id, mention_count)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, channel_id) DO UPDATE SET
           mention_count = read_states.mention_count + EXCLUDED.mention_count`,
        [member.user_id, channelId, isMentioned ? 1 : 0]
      );
    }
  } catch {}
}
