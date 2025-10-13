import { Router } from "express";
import { UserController } from "../controllers/userController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";
import { adminMiddleware } from "../../MiddleWare/adminMiddleware";

const userRoutes = Router();

// 获取用户列表 (需要登录 + 管理员权限)
userRoutes.get("/users", authMiddleware, adminMiddleware, UserController.getUserList);

// 获取单个用户信息 (需要登录 + 管理员权限)
userRoutes.get("/users/:id", authMiddleware, adminMiddleware, UserController.getUserById);

// 注销用户 (普通用户可以注销自己,管理员可以注销普通用户)
userRoutes.delete("/users/:id", authMiddleware, UserController.deleteUser);

// 重置用户密码 (所有用户只能重置自己的密码,需要提供旧密码)
userRoutes.put("/users/:id/reset-password", authMiddleware, UserController.resetPassword);

// 封禁用户 (需要登录 + 管理员权限)
userRoutes.put("/users/:id/ban", authMiddleware, adminMiddleware, UserController.banUser);

// 解封用户 (需要登录 + 管理员权限)
userRoutes.put("/users/:id/unban", authMiddleware, adminMiddleware, UserController.unbanUser);

export default userRoutes;
