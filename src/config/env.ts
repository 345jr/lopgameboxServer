import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
  JWT_SECRET: (process.env.JWT_SECRET as jwt.Secret) || "default_secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || "default_admin_secret",
  DB_PATH: "./data/server.db",
  BACKUPS_DIR: "./data/backups",
  // Cloudflare R2 配置
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "",
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "", 
};
