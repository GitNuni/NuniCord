const { Pool } = require('pg');
const redis = require('redis');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let pool;
let redisClient;

async function initDatabase() {
  pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'nunicord',
    user: process.env.POSTGRES_USER || 'nunicord',
    password: process.env.POSTGRES_PASSWORD || 'nunicord',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    logger.error('PostgreSQL pool error:', err);
  });

  // Run schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  logger.info('Database schema initialized');

  return pool;
}

async function initRedis() {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    },
  });

  redisClient.on('error', (err) => logger.error('Redis error:', err));
  redisClient.on('connect', () => logger.info('Redis connected'));

  await redisClient.connect();
  return redisClient;
}

function getPool() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

function getRedis() {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
}

async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    logger.warn('Slow query detected', { text, duration, rows: res.rowCount });
  }
  return res;
}

async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  initDatabase,
  initRedis,
  getPool,
  getRedis,
  query,
  transaction,
};
