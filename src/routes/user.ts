import { Router } from "express";
import { UserController } from "../controllers/userController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";
import { adminMiddleware } from "../../MiddleWare/adminMiddleware";

const userRoutes = Router();

// 获取用户列表 (需要登录 + 管理员权限)
userRoutes.get("/users", authMiddleware, adminMiddleware, UserController.getUserList);

// 获取单个用户信息 (需要登录 + 管理员权限)
userRoutes.get("/users/:id", authMiddleware, adminMiddleware, UserController.getUserById);

export default userRoutes;
