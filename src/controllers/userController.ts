import type { Request, Response } from "express";
import { db } from "../services/database";
import type { UserRow } from "../types/user";

export class UserController {
  // 获取用户列表 (仅管理员)
  static getUserList(req: Request, res: Response) {
    try {
      // 检查当前用户是否为管理员
      const currentUser = (req as any).user;
      
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可以访问" });
      }

      // 查询所有用户 (不返回密码)
      const users = db
        .prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC")
        .all() as Omit<UserRow, 'password'>[];

      // 统计信息
      const totalUsers = users.length;
      const adminCount = users.filter(user => user.role === 'admin').length;
      const userCount = users.filter(user => user.role === 'user').length;

      return res.json({
        message: "获取用户列表成功",
        data: {
          users,
          statistics: {
            total: totalUsers,
            admins: adminCount,
            regularUsers: userCount
          }
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "获取用户列表失败", detail: errorMsg });
    }
  }

  // 获取单个用户信息 (仅管理员)
  static getUserById(req: Request, res: Response) {
    try {
      // 检查当前用户是否为管理员
      const currentUser = (req as any).user;
      
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可以访问" });
      }

      const userId = Number(req.params.id);
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: "无效的用户ID" });
      }

      // 查询指定用户 (不返回密码)
      const user = db
        .prepare("SELECT id, username, role, created_at FROM users WHERE id = ?")
        .get(userId) as Omit<UserRow, 'password'> | undefined;

      if (!user) {
        return res.status(404).json({ error: "用户不存在" });
      }

      return res.json({
        message: "获取用户信息成功",
        user
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "获取用户信息失败", detail: errorMsg });
    }
  }
}
