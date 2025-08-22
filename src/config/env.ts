import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
  JWT_SECRET: (process.env.JWT_SECRET as jwt.Secret) || "default_secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || "default_admin_secret",
  DB_PATH: "./data/server.db",
  BACKUPS_DIR: "./data/backups"
};
