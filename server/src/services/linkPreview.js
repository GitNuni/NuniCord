const fetch = require('node-fetch');
const { parse } = require('node-html-parser');
const logger = require('../utils/logger');

const cache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

async function getLinkPreview(url) {
  // Check cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NuniCordBot/1.0 (+https://nunicord.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await response.text();
    const root = parse(html);

    const getOG = (prop) => root.querySelector(`meta[property="og:${prop}"]`)?.getAttribute('content');
    const getTwitter = (name) => root.querySelector(`meta[name="twitter:${name}"]`)?.getAttribute('content');
    const getMeta = (name) => root.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

    const title = getOG('title') || getTwitter('title') || root.querySelector('title')?.text || '';
    const description = getOG('description') || getTwitter('description') || getMeta('description') || '';
    const image = getOG('image') || getTwitter('image') || '';
    const siteName = getOG('site_name') || new URL(url).hostname;
    const type = getOG('type') || 'website';

    const preview = {
      url,
      title: title.trim().slice(0, 256),
      description: description.trim().slice(0, 512),
      image: image || null,
      site_name: siteName,
      type,
      color: null,
    };

    // Cache it
    cache.set(url, { data: preview, timestamp: Date.now() });

    // Cleanup old cache entries
    if (cache.size > 1000) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      cache.delete(oldest[0]);
    }

    return preview;
  } catch (err) {
    logger.debug(`Link preview failed for ${url}:`, err.message);
    return null;
  }
}

async function extractUrlsAndFetchPreviews(content) {
  if (!content) return [];

  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const urls = [...new Set(content.match(urlRegex) || [])].slice(0, 3);

  const previews = await Promise.allSettled(urls.map(getLinkPreview));
  return previews
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

module.exports = { getLinkPreview, extractUrlsAndFetchPreviews };
