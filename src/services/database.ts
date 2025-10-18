import { Database } from "bun:sqlite";
import { config } from "../config/env";

class DatabaseService {
  private static instance: DatabaseService;
  private db: Database;

  private constructor() {
    this.db = new Database(config.DB_PATH, { create: true });
    this.initializeTables();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initializeTables(): void {
    // 用户表
    this.db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'banned')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    // 版本信息表
    this.db.run(`CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      release_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )`);
    // 图片信息表
    this.db.run(`CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      tag TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    // 创建索引以提高查询性能
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_images_tag ON images(tag)`);
  }

  public getDatabase(): Database {
    return this.db;
  }
}

export const dbService = DatabaseService.getInstance();
export const db = dbService.getDatabase();
