// middleware/upload.js
const multer = require('multer');

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG, PNG, and WebP images are allowed.'));
    }

    return callback(null, true);
  },
});

function handleSingleImageUpload(fieldName, req, res, next) {
  return upload.single(fieldName)(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image must be 5 MB or smaller.' });
    }

    return res.status(400).json({ error: err.message || 'Invalid image upload.' });
  });
}

function singleImageUpload(fieldNameOrReq, res, next) {
  if (typeof fieldNameOrReq === 'string') {
    return (req, response, callback) => handleSingleImageUpload(fieldNameOrReq, req, response, callback);
  }

  return handleSingleImageUpload('qr_image', fieldNameOrReq, res, next);
}

module.exports = { singleImageUpload };