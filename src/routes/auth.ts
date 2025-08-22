import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";

const authRoutes = Router();

// 注册接口
authRoutes.post("/register", AuthController.register);

// 登录接口
authRoutes.post("/login", AuthController.login);

// 获取当前用户信息接口 (需要认证)
authRoutes.get("/me", authMiddleware, AuthController.getCurrentUser);

export default authRoutes;
