import { Router } from "express";
import { GeneralController } from "../controllers/generalController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";

const generalRoutes = Router();

// 测试接口 (需要认证)
generalRoutes.get("/", authMiddleware, GeneralController.test);

export default generalRoutes;
