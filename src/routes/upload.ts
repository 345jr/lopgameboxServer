import { Router } from "express";
import { UploadController } from "../controllers/uploadController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";
import { adminMiddleware } from "../../MiddleWare/adminMiddleware";
import {
  uploadSingleImage,
  uploadMultipleImages,
} from "../../MiddleWare/uploadMiddleware";

const uploadRoutes = Router();

// 获取上传服务状态 (公开接口)
uploadRoutes.get("/upload/status", UploadController.getServiceStatus);

// 上传单个图片 (需要登录)
uploadRoutes.post(
  "/upload/image",
  authMiddleware,
  uploadSingleImage,
  UploadController.uploadImage
);

// 上传多个图片 (需要登录)
uploadRoutes.post(
  "/upload/images",
  authMiddleware,
  uploadMultipleImages,
  UploadController.uploadMultipleImages
);

// 删除单个图片 (需要登录)
uploadRoutes.delete(
  "/upload/image",
  authMiddleware,
  UploadController.deleteImage
);

// 批量删除图片 (需要登录)
uploadRoutes.delete(
  "/upload/images",
  authMiddleware,
  UploadController.deleteMultipleImages
);

// 生成预签名上传 URL (需要登录)
uploadRoutes.post(
  "/upload/presigned-url",
  authMiddleware,
  UploadController.generateUploadUrl
);

// 获取上传配置 (需要管理员权限)
uploadRoutes.get(
  "/upload/config",
  authMiddleware,
  adminMiddleware,
  UploadController.getUploadConfig
);

// 更新上传配置 (需要管理员权限)
uploadRoutes.put(
  "/upload/config",
  authMiddleware,
  adminMiddleware,
  UploadController.updateUploadConfig
);

// 重置上传配置到默认值 (需要管理员权限)
uploadRoutes.post(
  "/upload/config/reset",
  authMiddleware,
  adminMiddleware,
  UploadController.resetUploadConfig
);

export default uploadRoutes;
