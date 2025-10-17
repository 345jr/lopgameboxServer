import { Router } from "express";
import { ImageController } from "../controllers/imageController";
import { authMiddleware } from "../../MiddleWare/authMiddleware";
import { adminMiddleware } from "../../MiddleWare/adminMiddleware";

const imageRoutes = Router();

// 保存图片信息 (需要登录)
imageRoutes.post("/images", authMiddleware, ImageController.saveImage);

// 获取我的图片列表 (需要登录)
imageRoutes.get("/images/my", authMiddleware, ImageController.getMyImages);

// 获取我的标签列表 (需要登录)
imageRoutes.get("/images/my/tags", authMiddleware, ImageController.getMyTags);

// 获取单个图片信息 (需要登录)
imageRoutes.get("/images/:id", authMiddleware, ImageController.getImageById);

// 更新图片信息 (需要登录)
imageRoutes.put("/images/:id", authMiddleware, ImageController.updateImage);

// 删除图片记录 (需要登录)
imageRoutes.delete("/images/:id", authMiddleware, ImageController.deleteImage);

// 获取所有图片 (需要管理员权限)
imageRoutes.get("/images", authMiddleware, adminMiddleware, ImageController.getAllImages);

export default imageRoutes;
