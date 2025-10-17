import { Router } from "express";
import { UploadController } from "../controllers/uploadController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";
import { uploadSingleImage, uploadMultipleImages } from "../../MiddleWare/uploadMiddleware";

const uploadRoutes = Router();

// 获取上传服务状态 (公开接口)
uploadRoutes.get("/upload/status", UploadController.getServiceStatus);

// 上传单个图片 (需要登录)
uploadRoutes.post("/upload/image", authMiddleware, uploadSingleImage, UploadController.uploadImage);

// 上传多个图片 (需要登录)
uploadRoutes.post("/upload/images", authMiddleware, uploadMultipleImages, UploadController.uploadMultipleImages);

// 删除图片 (需要登录)
uploadRoutes.delete("/upload/image", authMiddleware, UploadController.deleteImage);

// 生成预签名上传 URL (需要登录)
uploadRoutes.post("/upload/presigned-url", authMiddleware, UploadController.generateUploadUrl);

export default uploadRoutes;
