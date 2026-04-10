const { uploadToS3 } = require('../services/s3.service');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');

async function upload(req, res, next) {
  try {
    if (!req.file) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'No file provided.' });
      return;
    }

    const folder = req.query.folder || 'uploads';
    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      folder,
    });

    sendSuccess(res, 200, { data: { url, key } });
  } catch (err) {
    if (err.statusCode === 400) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: err.message });
      return;
    }
    next(err);
  }
}

module.exports = { upload };
