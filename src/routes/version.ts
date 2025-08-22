import { Router } from "express";
import { VersionController } from "../controllers/versionController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";
import { adminMiddleware } from "../../MiddleWare/adminMiddleware";


const versionRoutes = Router();

// 检查更新 (无需认证)
versionRoutes.post("/check-update", VersionController.checkUpdate);

// 根据版本号查询版本信息 (无需认证)
versionRoutes.get("/version/:version", VersionController.getVersionByNumber);

// 添加新版本 (需要认证+管理员权限)
versionRoutes.post("/versions", authMiddleware, adminMiddleware, VersionController.addVersion);

// 删除版本(按 id) (需要认证+管理员权限)
versionRoutes.delete("/versions/:id", authMiddleware, adminMiddleware, VersionController.deleteVersionById);

// 删除版本(按版本号) (需要认证+管理员权限)
versionRoutes.delete("/versions", authMiddleware, adminMiddleware, VersionController.deleteVersionByName);

export default versionRoutes;
