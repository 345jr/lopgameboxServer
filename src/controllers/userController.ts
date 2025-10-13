import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../services/database";
import type { UserRow } from "../types/user";
import logger from "../utils/logger";

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
        .prepare("SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC")
        .all() as Omit<UserRow, 'password'>[];

      // 统计信息
      const totalUsers = users.length;
      const adminCount = users.filter(user => user.role === 'admin').length;
      const userCount = users.filter(user => user.role === 'user').length;
      const bannedCount = users.filter(user => user.status === 'banned').length;

      return res.json({
        message: "获取用户列表成功",
        data: {
          users,
          statistics: {
            total: totalUsers,
            admins: adminCount,
            regularUsers: userCount,
            banned: bannedCount
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
        .prepare("SELECT id, username, role, status, created_at FROM users WHERE id = ?")
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

  // 注销用户 (普通用户可以注销自己,管理员可以注销任意普通用户)
  static deleteUser(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const userId = Number(req.params.id);
      
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: "无效的用户ID" });
      }

      // 检查用户是否存在
      const user = db
        .prepare("SELECT id, username, role FROM users WHERE id = ?")
        .get(userId) as Pick<UserRow, 'id' | 'username' | 'role'> | undefined;

      if (!user) {
        return res.status(404).json({ error: "用户不存在" });
      }

      // 权限检查
      if (currentUser.role === 'user') {
        // 普通用户只能注销自己
        if (user.id !== currentUser.id) {
          return res.status(403).json({ error: "权限不足，您只能注销自己的账号" });
        }
      } else if (currentUser.role === 'admin') {
        // 管理员不能注销其他管理员
        if (user.role === 'admin' && user.id !== currentUser.id) {
          return res.status(403).json({ error: "管理员不能注销其他管理员账号" });
        }
        // 管理员不能注销自己(如果想注销自己,应该以普通用户身份操作)
        if (user.id === currentUser.id) {
          return res.status(400).json({ error: "如需注销自己的账号,请确认操作" });
        }
      }

      // 删除用户
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);

      const logMsg = currentUser.id === userId 
        ? `用户自行注销: 用户="${user.username}" (ID=${userId})`
        : `管理员注销用户: 被注销用户="${user.username}" (ID=${userId}), 操作管理员="${currentUser.username}" (ID=${currentUser.id})`;
      
      logger.info(logMsg);

      return res.json({
        message: "用户注销成功",
        deletedUser: {
          id: user.id,
          username: user.username
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`注销用户失败: ${errorMsg}`);
      return res.status(500).json({ error: "注销用户失败", detail: errorMsg });
    }
  }

  // 重置用户密码 (所有用户只能重置自己的密码)
  static async resetPassword(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const userId = Number(req.params.id);
      const { oldPassword, newPassword } = req.body;

      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: "无效的用户ID" });
      }

      // 用户只能重置自己的密码
      if (userId !== currentUser.id) {
        return res.status(403).json({ error: "您只能重置自己的密码" });
      }

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: "旧密码和新密码不能为空" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "新密码长度至少为6位" });
      }

      // 检查用户是否存在并获取密码
      const user = db
        .prepare("SELECT id, username, password, role FROM users WHERE id = ?")
        .get(userId) as Pick<UserRow, 'id' | 'username' | 'password' | 'role'> | undefined;

      if (!user) {
        return res.status(404).json({ error: "用户不存在" });
      }

      // 验证旧密码
      const match = await bcrypt.compare(oldPassword, user.password);
      if (!match) {
        return res.status(401).json({ error: "旧密码错误" });
      }

      // 加密新密码
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // 更新密码
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);

      logger.info(`密码重置成功: 用户="${user.username}" (ID=${userId})`);

      return res.json({
        message: "密码重置成功",
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`重置密码失败: ${errorMsg}`);
      return res.status(500).json({ error: "重置密码失败", detail: errorMsg });
    }
  }

  // 封禁用户 (仅管理员)
  static banUser(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可以操作" });
      }

      const userId = Number(req.params.id);
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: "无效的用户ID" });
      }

      // 检查用户是否存在
      const user = db
        .prepare("SELECT id, username, role, status FROM users WHERE id = ?")
        .get(userId) as Pick<UserRow, 'id' | 'username' | 'role' | 'status'> | undefined;

      if (!user) {
        return res.status(404).json({ error: "用户不存在" });
      }

      // 不能封禁管理员
      if (user.role === 'admin') {
        return res.status(403).json({ error: "不能封禁管理员账号" });
      }

      // 不能封禁自己
      if (user.id === currentUser.id) {
        return res.status(400).json({ error: "不能封禁自己的账号" });
      }

      // 检查是否已经被封禁
      if (user.status === 'banned') {
        return res.status(400).json({ error: "该用户已被封禁" });
      }

      // 封禁用户
      db.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(userId);

      logger.info(`用户封禁成功: 被封禁用户="${user.username}" (ID=${userId}), 操作管理员="${currentUser.username}" (ID=${currentUser.id})`);

      return res.json({
        message: "用户封禁成功",
        user: {
          id: user.id,
          username: user.username,
          status: 'banned'
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`封禁用户失败: ${errorMsg}`);
      return res.status(500).json({ error: "封禁用户失败", detail: errorMsg });
    }
  }

  // 解封用户 (仅管理员)
  static unbanUser(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可以操作" });
      }

      const userId = Number(req.params.id);
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: "无效的用户ID" });
      }

      // 检查用户是否存在
      const user = db
        .prepare("SELECT id, username, status FROM users WHERE id = ?")
        .get(userId) as Pick<UserRow, 'id' | 'username' | 'status'> | undefined;

      if (!user) {
        return res.status(404).json({ error: "用户不存在" });
      }

      // 检查是否已经是正常状态
      if (user.status === 'active') {
        return res.status(400).json({ error: "该用户未被封禁" });
      }

      // 解封用户
      db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(userId);

      logger.info(`用户解封成功: 解封用户="${user.username}" (ID=${userId}), 操作管理员="${currentUser.username}" (ID=${currentUser.id})`);

      return res.json({
        message: "用户解封成功",
        user: {
          id: user.id,
          username: user.username,
          status: 'active'
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`解封用户失败: ${errorMsg}`);
      return res.status(500).json({ error: "解封用户失败", detail: errorMsg });
    }
  }
}
