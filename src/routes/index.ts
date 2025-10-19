import { Router } from "express";
import authRoutes from "./auth";
import versionRoutes from "./version";
import backupRoutes from "./backup";
import userRoutes from "./user";
import scrapeRoutes from "./scrape";
import uploadRoutes from "./upload";
import imageRoutes from "./image";

const routes = Router();

// 挂载各个路由模块
routes.use("/", authRoutes); // 认证相关路由
routes.use("/", versionRoutes); // 版本相关路由
routes.use("/", backupRoutes); // 备份相关路由
routes.use("/", userRoutes); // 用户管理路由
routes.use("/", scrapeRoutes); // 网页抓取路由
routes.use("/", uploadRoutes); // 文件上传路由
routes.use("/", imageRoutes); // 图片管理路由

export default routes;
