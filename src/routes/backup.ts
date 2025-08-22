import { Router } from "express";
import { BackupController } from "../controllers/backupController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";

const backupRoutes = Router();

// 云备份接口 (需要认证)
backupRoutes.post("/backup", authMiddleware, BackupController.cloudBackup);

export default backupRoutes;
