import { Router } from "express";
import { GeneralController } from "../controllers/generalController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";

const generalRoutes = Router();

// 健康检查接口 (无需认证)
generalRoutes.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 测试接口 (需要认证)
generalRoutes.get("/", authMiddleware, GeneralController.test);

export default generalRoutes;
