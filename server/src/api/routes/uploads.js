const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../db');
const { authenticate } = require('../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function getStorage() {
  if (process.env.S3_ENDPOINT || process.env.AWS_S3_BUCKET) {
    const { S3Client } = require('@aws-sdk/client-s3');
    const multerS3 = require('multer-s3');

    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: !!process.env.S3_ENDPOINT,
    });

    return multerS3({
      s3,
      bucket: process.env.AWS_S3_BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `uploads/${uuidv4()}${ext}`);
      },
    });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_DIR, new Date().getFullYear().toString(),
        (new Date().getMonth() + 1).toString().padStart(2, '0'));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

const upload = multer({
  storage: getStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/ogg', 'audio/wav',
      'application/pdf',
      'text/plain',
      'application/zip',
      'application/octet-stream',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// POST /uploads/attachments — upload file attachments
router.post('/attachments', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const attachments = req.files.map((file) => {
      let url;
      if (file.location) {
        // S3
        url = file.location;
      } else {
        // Local - construct URL
        const relativePath = file.path.replace(UPLOAD_DIR, '').replace(/\\/g, '/');
        url = `/files${relativePath}`;
      }

      return {
        id: uuidv4(),
        filename: file.originalname,
        size: file.size,
        content_type: file.mimetype,
        url,
        proxy_url: url,
        width: null,
        height: null,
      };
    });

    res.json({ attachments });
  } catch (err) {
    logger.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// POST /uploads/avatar — upload user avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let url;
    if (req.file.location) {
      url = req.file.location;
    } else {
      const relativePath = req.file.path.replace(UPLOAD_DIR, '').replace(/\\/g, '/');
      url = `/files${relativePath}`;
    }

    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url, req.user.id]);
    res.json({ avatar_url: url });
  } catch (err) {
    logger.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// POST /uploads/server-icon/:serverId
router.post('/server-icon/:serverId', authenticate, upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let url;
    if (req.file.location) {
      url = req.file.location;
    } else {
      const relativePath = req.file.path.replace(UPLOAD_DIR, '').replace(/\\/g, '/');
      url = `/files${relativePath}`;
    }

    await query('UPDATE servers SET icon_url = $1 WHERE id = $2 AND owner_id = $3', [
      url, req.params.serverId, req.user.id
    ]);
    res.json({ icon_url: url });
  } catch (err) {
    logger.error('Server icon upload error:', err);
    res.status(500).json({ error: 'Failed to upload server icon' });
  }
});

module.exports = router;
