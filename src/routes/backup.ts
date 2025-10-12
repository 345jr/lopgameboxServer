import { Router } from "express";
import { BackupController } from "../controllers/backupController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";
import { uploadMiddleware } from "../../MiddleWare/uploadMiddleware";
const backupRoutes = Router();

// 文件上传接口 (需要认证)
backupRoutes.post("/upload", uploadMiddleware, authMiddleware, BackupController.uploadFile);


export default backupRoutes;
