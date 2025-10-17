import type { Request, Response } from "express";
import { r2Service } from "../services/r2Service";
import { db } from "../services/database";
import logger from "../utils/logger";
import crypto from "crypto";
import path from "path";

export class UploadController {
  /**
   * 上传单个图片
   */
  static async uploadImage(req: Request, res: Response) {
    try {
      // 检查 R2 是否配置
      if (!r2Service.isConfigured()) {
        return res.status(500).json({ 
          error: "文件上传服务未配置",
          detail: "请配置 R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY 和 R2_BUCKET_NAME 环境变量"
        });
      }

      // 检查是否有文件
      if (!req.file) {
        return res.status(400).json({ error: "未上传文件" });
      }

      const file = req.file;

      // 验证文件类型(只允许图片)
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          error: "不支持的文件类型",
          detail: "只支持 JPG, PNG, GIF, WebP, SVG 格式的图片"
        });
      }

      // 验证文件大小 (最大 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return res.status(400).json({ 
          error: "文件过大",
          detail: "文件大小不能超过 10MB"
        });
      }

      // 生成唯一文件名
      const fileExtension = path.extname(file.originalname);
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const fileName = `images/${timestamp}-${randomString}${fileExtension}`;

      // 上传到 R2
      const fileUrl = await r2Service.uploadFile(
        file.buffer,
        fileName,
        file.mimetype
      );

      const currentUser = (req as any).user;
      
      // 获取可选的 tag 参数
      const tag = req.body.tag || null;

      // 保存图片信息到数据库
      const result = db.prepare(`
        INSERT INTO images (user_id, file_name, original_name, file_url, file_size, mime_type, tag)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        currentUser.id,
        fileName,
        file.originalname,
        fileUrl,
        file.size,
        file.mimetype,
        tag
      );

      logger.info(`用户 ${currentUser?.username || '未知'} 上传图片: ${fileName}`);

      return res.json({
        message: "图片上传成功",
        data: {
          id: result.lastInsertRowid,
          fileName,
          originalName: file.originalname,
          fileUrl,
          size: file.size,
          mimeType: file.mimetype,
          tag,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`图片上传失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "图片上传失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 上传多个图片
   */
  static async uploadMultipleImages(req: Request, res: Response) {
    try {
      // 检查 R2 是否配置
      if (!r2Service.isConfigured()) {
        return res.status(500).json({ 
          error: "文件上传服务未配置",
          detail: "请配置 R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY 和 R2_BUCKET_NAME 环境变量"
        });
      }

      // 检查是否有文件
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "未上传文件" });
      }

      // 限制最多上传 10 个文件
      if (files.length > 10) {
        return res.status(400).json({ 
          error: "文件数量过多",
          detail: "一次最多上传 10 个文件"
        });
      }

      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ];

      const maxSize = 10 * 1024 * 1024; // 10MB

      const uploadResults = [];
      const uploadErrors = [];

      // 并发上传所有文件
      for (const file of files) {
        try {
          // 验证文件类型
          if (!allowedMimeTypes.includes(file.mimetype)) {
            uploadErrors.push({
              originalName: file.originalname,
              error: "不支持的文件类型"
            });
            continue;
          }

          // 验证文件大小
          if (file.size > maxSize) {
            uploadErrors.push({
              originalName: file.originalname,
              error: "文件过大(超过10MB)"
            });
            continue;
          }

          // 生成唯一文件名
          const fileExtension = path.extname(file.originalname);
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(8).toString('hex');
          const fileName = `images/${timestamp}-${randomString}${fileExtension}`;

          // 上传到 R2
          const fileUrl = await r2Service.uploadFile(
            file.buffer,
            fileName,
            file.mimetype
          );

          uploadResults.push({
            fileName,
            originalName: file.originalname,
            fileUrl,
            size: file.size,
            mimeType: file.mimetype
          });
        } catch (err) {
          uploadErrors.push({
            originalName: file.originalname,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      const currentUser = (req as any).user;
      logger.info(`用户 ${currentUser?.username || '未知'} 批量上传图片: 成功 ${uploadResults.length} 个, 失败 ${uploadErrors.length} 个`);

      return res.json({
        message: `成功上传 ${uploadResults.length} 个文件${uploadErrors.length > 0 ? `, ${uploadErrors.length} 个失败` : ''}`,
        data: {
          success: uploadResults,
          errors: uploadErrors,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`批量上传失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "批量上传失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 删除图片
   */
  static async deleteImage(req: Request, res: Response) {
    try {
      // 检查 R2 是否配置
      if (!r2Service.isConfigured()) {
        return res.status(500).json({ 
          error: "文件上传服务未配置"
        });
      }

      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).json({ error: "缺少文件名参数" });
      }

      // 检查文件是否存在
      const exists = await r2Service.fileExists(fileName);
      if (!exists) {
        return res.status(404).json({ error: "文件不存在" });
      }

      // 删除文件
      await r2Service.deleteFile(fileName);

      const currentUser = (req as any).user;
      logger.info(`用户 ${currentUser?.username || '未知'} 删除图片: ${fileName}`);

      return res.json({
        message: "图片删除成功",
        data: {
          fileName,
          deletedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`图片删除失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "图片删除失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 生成预签名上传 URL
   */
  static async generateUploadUrl(req: Request, res: Response) {
    try {
      // 检查 R2 是否配置
      if (!r2Service.isConfigured()) {
        return res.status(500).json({ 
          error: "文件上传服务未配置"
        });
      }

      const { fileName, expiresIn } = req.body;

      if (!fileName) {
        return res.status(400).json({ error: "缺少文件名参数" });
      }

      const expires = expiresIn || 3600; // 默认 1 小时

      // 生成预签名 URL
      const uploadUrl = await r2Service.generatePresignedUploadUrl(fileName, expires);

      return res.json({
        message: "生成上传URL成功",
        data: {
          uploadUrl,
          fileName,
          expiresIn: expires,
          expiresAt: new Date(Date.now() + expires * 1000).toISOString()
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`生成上传URL失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "生成上传URL失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 获取 R2 服务状态
   */
  static getServiceStatus(req: Request, res: Response) {
    const isConfigured = r2Service.isConfigured();

    return res.json({
      message: "获取服务状态成功",
      data: {
        configured: isConfigured,
        status: isConfigured ? "可用" : "未配置",
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        maxFileSize: "10MB",
        maxBatchUpload: 10
      }
    });
  }
}
