import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudApiKey = process.env.CLOUDINARY_API_KEY;
const cloudApiSecret = process.env.CLOUDINARY_API_SECRET;
const cloudFolder = process.env.CLOUDINARY_FOLDER || 'super-eyes';
const cloudinaryConfigured = Boolean(cloudName && cloudApiKey && cloudApiSecret);

if (cloudinaryConfigured) {
  cloudinary.config({ cloud_name: cloudName, api_key: cloudApiKey, api_secret: cloudApiSecret, secure: true });
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBaseUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const client = accountId && accessKeyId && secretAccessKey && bucket
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

export const isObjectStorageConfigured = Boolean(client && publicBaseUrl);

if (!cloudinaryConfigured && !isObjectStorageConfigured) {
  console.warn('[storage] no Cloudinary or R2 credentials configured; rendered files will be temporary');
}

export async function uploadFileToObjectStorage(filePath, key, contentType) {
  if (cloudinaryConfigured) {
    const publicId = `${cloudFolder}/${key.replace(/^\/+|\/+$/g, '').replace(/\.[^.]+$/, '')}`;
    const uploadOptions = {
      public_id: publicId,
      resource_type: contentType.startsWith('video/') ? 'video' : 'image',
      overwrite: true,
      invalidate: true,
    };
    const result = contentType.startsWith('video/')
      ? await cloudinary.uploader.upload_large(filePath, uploadOptions)
      : await cloudinary.uploader.upload(filePath, uploadOptions);
    return result.secure_url;
  }

  if (!client || !bucket || !publicBaseUrl) return null;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: contentType,
  }));

  return `${publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
