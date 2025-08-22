import express from "express";
import { Database } from "bun:sqlite";

// Bun-only: 使用内建 sqlite
const db = new Database("./data/server.db", { create: true });
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import type { UserRow } from "./types/user";
import type { VersionRow } from "./types/version";
import fs from "fs";
import path from "path";
import { authMiddleware } from "./MiddleWare/authMiddleware";
import dotenv from "dotenv";
dotenv.config();

// 初始化 SQLite 数据库（Bun 内建 sqlite）
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 初始化 版本信息表
db.exec(`CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT UNIQUE NOT NULL,
  release_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
)`);

const app = express();
app.use(express.json());

// 环境变量
export const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
export const JWT_SECRET =
  (process.env.JWT_SECRET as jwt.Secret) || "default_secret";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// 注册接口
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "用户名和密码不能为空" });
  }
  try {
    // 检查用户名是否已存在
    const userExists = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username) as UserRow | undefined;
    if (userExists) {
      return res.status(409).json({ error: "用户名已存在" });
    }
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // 插入新用户
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(
      username,
      hashedPassword
    );
    // 自动登录，生成 token
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as UserRow;
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN as string } as jwt.SignOptions
    );
    return res.json({
      message: "注册成功",
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "注册失败", detail: errorMsg });
  }
});
// 登录接口
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "用户名和密码不能为空" });
  }
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as UserRow | undefined;
    if (!user) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    // 验证密码
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    // 登录成功，生成 token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN as string } as jwt.SignOptions
    );
    return res.json({
      message: "登录成功",
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "登录失败", detail: errorMsg });
  }
});
// 测试接口
app.get("/", authMiddleware, (req, res) => {
  res.send(
    "Hello World! 已登录，欢迎 " + ((req as any).user.username || "用户") + "！"
  );
});
// 检查更新
app.post("/check-update", (req, res) => {
  const { version } = req.body;
  if (!version) {
    return res.status(400).json({ error: "缺少版本号" });
  }
  try {
    // 直接从数据库按发布时间获取最新版本
    const latest = db
      .prepare(
        "SELECT * FROM versions ORDER BY datetime(release_date) DESC LIMIT 1"
      )
      .get() as VersionRow | undefined;
    if (!latest) {
      return res.status(404).json({ error: "未找到版本信息" });
    }
    if (version === latest.version) {
      return res.json({
        update: false,
        message: "已是最新版本",
        latest: latest.version,
      });
    }

    return res.json({
      update: true,
      latest: latest.version,
      release_date: latest.release_date,
      notes: latest.notes || "",
      message: `有新版本: ${latest.version}`,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "检查更新失败", detail: errorMsg });
  }
});
// 添加新版本
app.post("/versions", authMiddleware, (req, res) => {
  const { version, release_date, notes } = req.body;
  if (!version) {
    return res.status(400).json({ error: "缺少版本号" });
  }
  try {
    const info = db
      .prepare(
        "INSERT INTO versions (version, release_date, notes) VALUES (?, ?, ?)"
      )
      .run(version, release_date || new Date().toISOString(), notes || null);
    const id = Number((info as any).lastInsertRowid);
    const inserted = db
      .prepare("SELECT * FROM versions WHERE id = ?")
      .get(id) as VersionRow | undefined;
    return res.status(201).json({ message: "添加成功", version: inserted });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (typeof errorMsg === "string" && /UNIQUE/.test(errorMsg)) {
      return res.status(409).json({ error: "版本号已存在" });
    }
    return res.status(500).json({ error: "添加版本失败", detail: errorMsg });
  }
});

// 删除版本(按 id )
app.delete("/versions/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "无效的 id" });
  }
  try {
    const info = db.prepare("DELETE FROM versions WHERE id = ?").run(id);
    if ((info as any).changes === 0) {
      return res.status(404).json({ error: "未找到该版本" });
    }
    return res.json({ message: "删除成功", id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "删除失败", detail: errorMsg });
  }
});

// 删除版本(按 版本号 )
app.delete("/versions", authMiddleware, (req, res) => {
  const { version } = req.body;
  if (!version) {
    return res.status(400).json({ error: "缺少 version 字段" });
  }
  try {
    const info = db
      .prepare("DELETE FROM versions WHERE version = ?")
      .run(version);
    if ((info as any).changes === 0) {
      return res.status(404).json({ error: "未找到该版本" });
    }
    return res.json({ message: "删除成功", version });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "删除失败", detail: errorMsg });
  }
});
// 云备份接口
app.post("/backup", authMiddleware, (req, res) => {
  const { userId, filename, file } = req.body as {
    userId?: string | number;
    filename?: string;
    file?: string; // base64
  };
  if (!file) {
    return res.status(400).json({ error: "缺少文件数据" });
  }

  try {
    // 确定存储目录
    const uid = userId ?? (req as any).user?.id ?? "anonymous";
    const backupsDir = path.join(process.cwd(), "data", "backups", String(uid));
    fs.mkdirSync(backupsDir, { recursive: true });

    // 生成文件名
    const safeName =
      (filename && String(filename).replace(/[^a-zA-Z0-9._-]/g, "_")) ||
      "backup.db";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(backupsDir, `${ts}_${safeName}`);

    const buffer = Buffer.from(file, "base64");
    fs.writeFileSync(outPath, buffer);

    return res.status(201).json({ message: "备份保存成功", path: outPath });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "备份失败", detail: errorMsg });
  }
});

// 启动
app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
