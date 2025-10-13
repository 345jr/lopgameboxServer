import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../src/config/env";
import { db } from "../src/services/database";
import type { UserRow } from "../src/types/user";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登录或token缺失" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any;
    
    // 检查用户是否被封禁
    const user = db
      .prepare("SELECT id, username, role, status FROM users WHERE id = ?")
      .get(payload.id) as Pick<UserRow, 'id' | 'username' | 'role' | 'status'> | undefined;
    
    if (!user) {
      return res.status(401).json({ error: "用户不存在" });
    }
    
    if (user.status === 'banned') {
      return res.status(403).json({ error: "账号已被封禁,无法访问" });
    }
    
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "token无效或已过期" });
  }
}
