const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// POST /ai/chat — admin-only Claude chat for feature requests
router.post('/chat', authenticate, requireAdmin, async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY in server environment.' });
  }

  try {
    // Use fetch to call Anthropic API directly (no SDK dependency needed)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: 'You are a helpful assistant for NuniCord, a self-hosted Discord alternative. The admin is using you to brainstorm and plan feature requests. Be concise and practical. When suggesting features, consider that this is a small self-hosted app built with React, Node.js, PostgreSQL, and Socket.IO.',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    res.json({ content: data.content[0]?.text || '' });
  } catch (err) {
    logger.error('AI chat error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

module.exports = router;
