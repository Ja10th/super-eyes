import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import config from './config.js';

if (config.cloudinary.isConfigured) {
  cloudinary.config({ 
    cloud_name: config.cloudinary.cloudName, 
    api_key: config.cloudinary.apiKey, 
    api_secret: config.cloudinary.apiSecret, 
    secure: true 
  });
}

const client = config.r2.isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { 
        accessKeyId: config.r2.accessKeyId, 
        secretAccessKey: config.r2.secretAccessKey 
      },
    })
  : null;

export const isObjectStorageConfigured = Boolean(client && config.r2.publicUrl);

if (!config.cloudinary.isConfigured && !isObjectStorageConfigured) {
  console.warn('[storage] no Cloudinary or R2 credentials configured; rendered files will be temporary');
}

export async function uploadFileToObjectStorage(filePath, key, contentType) {
  if (config.cloudinary.isConfigured) {
    const publicId = `${config.cloudinary.folder}/${key.replace(/^\/+|\/+$/g, '').replace(/\.[^.]+$/, '')}`;
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

  if (!client || !config.r2.bucket || !config.r2.publicUrl) return null;

  await client.send(new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: contentType,
  }));

  return `${config.r2.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
