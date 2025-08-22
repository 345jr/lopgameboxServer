import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../services/database";
import { config } from "../config/env";
import type { UserRow } from "../../types/user";

export class AuthController {
  // 注册
  static async register(req: Request, res: Response) {
    const { username, password, adminSecretKey } = req.body;
    
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

      // 确定用户角色
      let role: 'user' | 'admin' = 'user';
      if (adminSecretKey) {
        if (adminSecretKey === config.ADMIN_SECRET_KEY) {
          role = 'admin';
        } else {
          return res.status(400).json({ error: "管理员注册密钥不正确" });
        }
      }

      // 加密密码
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 插入新用户
      db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(
        username,
        hashedPassword,
        role
      );

      // 自动登录，生成 token
      const user = db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username) as UserRow;

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        config.JWT_SECRET as string,
        { expiresIn: config.JWT_EXPIRES_IN as string } as jwt.SignOptions
      );

      return res.json({
        message: `注册成功，您的角色是: ${role === 'admin' ? '管理员' : '普通用户'}`,
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "注册失败", detail: errorMsg });
    }
  }

  // 登录
  static async login(req: Request, res: Response) {
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
        { id: user.id, username: user.username, role: user.role },
        config.JWT_SECRET as string,
        { expiresIn: config.JWT_EXPIRES_IN as string } as jwt.SignOptions
      );

      return res.json({
        message: "登录成功",
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "登录失败", detail: errorMsg });
    }
  }

  // 获取当前用户信息
  static getCurrentUser(req: Request, res: Response) {
    try {
      // 从中间件中获取用户信息 (authMiddleware 会将用户信息添加到 req.user)
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ error: "未找到用户信息" });
      }

      return res.json({
        message: "获取用户信息成功",
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "获取用户信息失败", detail: errorMsg });
    }
  }
}
