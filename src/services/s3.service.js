const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');
const path = require('path');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

const DEFAULT_MAX_SIZE = 500 * 1024 * 1024; // 500 MB

async function uploadToS3({ buffer, mimetype, originalname, folder = 'uploads', maxSize = DEFAULT_MAX_SIZE }) {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw Object.assign(new Error(`Unsupported file type: ${mimetype}`), { statusCode: 400 });
  }

  if (buffer.length > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    throw Object.assign(new Error(`File exceeds ${mb} MB limit`), { statusCode: 400 });
  }

  const ext = path.extname(originalname).toLowerCase() || '';
  const key = `${folder}/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { url, key };
}

module.exports = { uploadToS3 };
