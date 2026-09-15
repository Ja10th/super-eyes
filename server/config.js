// Centralized configuration management for the platform
import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server configuration
  server: {
    port: Number(process.env.PORT || 3001),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || '',
    ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false },
    poolMax: Number(process.env.DB_POOL_MAX || 5),
  },
  
  // OAuth/Security configuration
  security: {
    tokenEncryptionKey: process.env.OAUTH_TOKEN_ENCRYPTION_KEY || '',
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'],
    https: process.env.HTTPS === 'true' || process.env.Vercel,
  },
  
  // Google OAuth configuration
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://super-eyes.vercel.app/oauth/callback',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  },
  
  // Cloudinary configuration
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'super-eyes',
    isConfigured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_API_KEY && 
      process.env.CLOUDINARY_API_SECRET
    ),
  },
  
  // R2 configuration
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''),
    isConfigured: Boolean(
      process.env.R2_ACCOUNT_ID && 
      process.env.R2_ACCESS_KEY_ID && 
      process.env.R2_SECRET_ACCESS_KEY && 
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
    ),
  },
  
  // Queue/Scheduler configuration
  queue: {
    disableWorker: process.env.DISABLE_QUEUE_WORKER === 'true',
    schedulerOnly: process.env.SCHEDULER_ONLY === 'true',
    workerOnly: process.env.WORKER_ONLY === 'true',
    postingHours: process.env.DAILY_POSTING_HOURS 
      ? process.env.DAILY_POSTING_HOURS.split(',').map(h => h.trim()).filter(h => /^\d{2}:\d{2}$/.test(h))
      : ['08:00', '18:00'],
    scheduleDaysAhead: Math.max(0, Number(process.env.DAILY_SCHEDULE_DAYS_AHEAD || 1)),
  },
  
  // Rendering configuration
  rendering: {
    profile: process.env.RENDER_PROFILE || 'standard',
    freeProfile: process.env.RENDER_PROFILE === 'free',
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW || 60000), // 1 minute
    maxRequests: Number(process.env.RATE_LIMIT_MAX || 100),
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
  },
  
  // Paths
  paths: {
    jobs: process.env.JOBS_PATH || './jobs.json',
    rendered: process.env.RENDERED_PATH || './rendered',
    uploads: process.env.UPLOADS_PATH || './uploads',
  },
};

// Validation helper
export function validateConfig() {
  const errors = [];
  
  // Only require encryption key in production if there are actual OAuth credentials
  if (config.server.nodeEnv === 'production' && config.security.tokenEncryptionKey && !config.google.clientId) {
    errors.push('OAUTH_TOKEN_ENCRYPTION_KEY is set but no Google OAuth credentials found');
  }
  
  if (config.server.nodeEnv === 'production' && !config.database.url) {
    errors.push('DATABASE_URL is required in production');
  }
  
  if (!config.cloudinary.isConfigured && !config.r2.isConfigured) {
    console.warn('[config] No Cloudinary or R2 storage configured. Files will be temporary.');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}

export default config;