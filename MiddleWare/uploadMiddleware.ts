import multer from "multer";
import { uploadConfigManager } from "../src/config/uploadConfig";

// 使用内存存储，文件将被存储在 Buffer 中
const storage = multer.memoryStorage();

// 允许的图片类型
const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

/**
 * 创建动态 multer 配置
 * 每次请求时都会获取最新的配置
 */
function createUploadMiddleware() {
  return multer({
    storage: storage,
    limits: {
      fileSize: uploadConfigManager.getMaxFileSize(),
    },
    fileFilter: (req: any, file: any, cb: any) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    }
  });
}

// 单文件上传中间件（动态获取配置）
export const uploadSingleImage = (req: any, res: any, next: any) => {
  const upload = createUploadMiddleware();
  upload.single('image')(req, res, next);
};

// 多文件上传中间件（动态获取配置）
export const uploadMultipleImages = (req: any, res: any, next: any) => {
  const upload = createUploadMiddleware();
  const maxCount = uploadConfigManager.getMaxBatchCount();
  upload.array('images', maxCount)(req, res, next);
};

// 原有的原始数据上传中间件
export const uploadRawData = multer().none();

