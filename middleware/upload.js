const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'receipts');

fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['application/pdf', '.pdf'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_EXT.get(file.mimetype) || path.extname(file.originalname).toLowerCase() || '.bin';
    const name = `receipt_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXT.has(file.mimetype)) return cb(null, true);
    return cb(new ApiError(400, 'Receipt must be a JPG, PNG, WebP, GIF or PDF file.'));
  },
});

module.exports = { upload, uploadDir };
