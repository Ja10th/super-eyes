import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';

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

export async function uploadFileToObjectStorage(filePath, key, contentType) {
  if (!client || !bucket || !publicBaseUrl) return null;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: contentType,
  }));

  return `${publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
