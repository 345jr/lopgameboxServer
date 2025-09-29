import { Router } from "express";
import express from "express";
import { BackupController } from "../controllers/backupController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";

const backupRoutes = Router();

// 文件上传中间件：处理原始数据
const uploadMiddleware = express.raw({ 
  type: '*/*', 
  limit: '50mb' // 设置文件大小限制
});

// 文件上传接口 (需要认证)
backupRoutes.post("/upload", uploadMiddleware, authMiddleware, BackupController.uploadFile);


export default backupRoutes;
