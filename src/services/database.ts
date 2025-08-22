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
    this.db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    // 版本信息表
    this.db.exec(`CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      release_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )`);
  }

  public getDatabase(): Database {
    return this.db;
  }
}

export const dbService = DatabaseService.getInstance();
export const db = dbService.getDatabase();
