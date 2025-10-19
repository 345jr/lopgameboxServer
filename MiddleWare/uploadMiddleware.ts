import multer from "multer";

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

// 配置 multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// 单文件上传中间件
export const uploadSingleImage = upload.single('image');

// 多文件上传中间件 (最多 100 个)
export const uploadMultipleImages = upload.array('images', 100);

// 原有的原始数据上传中间件
export const uploadRawData = multer().none();

