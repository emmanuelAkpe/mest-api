import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_VARS = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'BCRYPT_SALT_ROUNDS',
  'CORS_ORIGIN',
] as const;

function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

validateEnv();

export const env = {
  NODE_ENV: process.env.NODE_ENV as string,
  PORT: parseInt(process.env.PORT as string, 10),
  MONGODB_URI: process.env.MONGODB_URI as string,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN as string,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN as string,
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS as string, 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN as string,
  isProduction: process.env.NODE_ENV === 'production',
};
