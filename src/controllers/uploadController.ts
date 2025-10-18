import type { Request, Response } from "express";
import { r2Service } from "../services/r2Service";
import { db } from "../services/database";
import logger from "../utils/logger";
import crypto from "crypto";
import path from "path";

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadValidationError {
  originalName: string;
  error: string;
}

export class UploadController {
  /**
   * 生成唯一文件名
   */
  private static generateFileName(originalName: string): string {
    const fileExtension = path.extname(originalName);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `images/${timestamp}-${randomString}${fileExtension}`;
  }

  /**
   * 验证文件
   */
  private static validateFile(file: Express.Multer.File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return "不支持的文件类型";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "文件过大(超过10MB)";
    }
    return null;
  }
   /**
   * 获取 R2 服务状态
   */
  static getServiceStatus = (req: Request, res: Response) => {
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
  /**
   * 检查 R2 配置
   */
  private static checkR2Config(res: Response): boolean {
    if (!r2Service.isConfigured()) {
      res.status(500).json({
        error: "文件上传服务未配置",
        detail: "请配置 R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY 和 R2_BUCKET_NAME 环境变量"
      });
      return false;
    }
    return true;
  }

  /**
   * 处理单个文件上传
   */
  private static async processFileUpload(
    file: Express.Multer.File,
    userId: number,
    tag?: string | null
  ): Promise<{ success: any; error: null } | { success: null; error: UploadValidationError }> {
    const validationError = this.validateFile(file);
    if (validationError) {
      return {
        success: null,
        error: {
          originalName: file.originalname,
          error: validationError
        }
      };
    }

    try {
      const fileName = this.generateFileName(file.originalname);
      const fileUrl = await r2Service.uploadFile(
        file.buffer,
        fileName,
        file.mimetype
      );

      // 保存图片信息到数据库
      const result = db.prepare(`
        INSERT INTO images (user_id, file_name, original_name, file_url, file_size, mime_type, tag)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        fileName,
        file.originalname,
        fileUrl,
        file.size,
        file.mimetype,
        tag || null
      );

      return {
        success: {
          id: result.lastInsertRowid,
          fileName,
          originalName: file.originalname,
          fileUrl,
          size: file.size,
          mimeType: file.mimetype,
          tag,
          uploadedAt: new Date().toISOString()
        },
        error: null
      };
    } catch (err) {
      return {
        success: null,
        error: {
          originalName: file.originalname,
          error: err instanceof Error ? err.message : String(err)
        }
      };
    }
  }

  /**
   * 上传单个图片
   */
  static uploadImage = async (req: Request, res: Response) => {
    try {
      if (!UploadController.checkR2Config(res)) return;

      if (!req.file) {
        return res.status(400).json({ error: "未上传文件" });
      }

      const currentUser = (req as any).user;
      const tag = req.body.tag || null;

      const result = await UploadController.processFileUpload(req.file, currentUser.id, tag);

      if (result.error) {
        logger.error(`图片上传失败: ${result.error.error}`);
        return res.status(400).json({
          error: "图片上传失败",
          detail: result.error.error
        });
      }

      logger.info(`用户 ${currentUser?.username || '未知'} 上传图片: ${result.success.fileName}`);

      return res.json({
        message: "图片上传成功",
        data: result.success
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
  static uploadMultipleImages = async (req: Request, res: Response) => {
    try {
      if (!UploadController.checkR2Config(res)) return;

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "未上传文件" });
      }

      if (files.length > 10) {
        return res.status(400).json({
          error: "文件数量过多",
          detail: "一次最多上传 10 个文件"
        });
      }

      const currentUser = (req as any).user;
      const uploadResults = [];
      const uploadErrors = [];

      // 上传所有文件
      for (const file of files) {
        const result = await UploadController.processFileUpload(file, currentUser.id);
        if (result.error) {
          uploadErrors.push(result.error);
        } else {
          uploadResults.push(result.success);
        }
      }

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
  static deleteImage = async (req: Request, res: Response) => {
    try {
      if (!UploadController.checkR2Config(res)) return;

      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).json({ error: "缺少文件名参数" });
      }

      const exists = await r2Service.fileExists(fileName);
      if (!exists) {
        return res.status(404).json({ error: "文件不存在" });
      }

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
   * 批量删除图片
   */
  static deleteMultipleImages = async (req: Request, res: Response) => {
    try {
      if (!UploadController.checkR2Config(res)) return;

      const { fileNames } = req.body;

      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        return res.status(400).json({ error: "缺少文件名参数或参数不是数组" });
      }

      if (fileNames.length > 100) {
        return res.status(400).json({
          error: "文件数量过多",
          detail: "一次最多删除 100 个文件"
        });
      }

      const deleteResults = [];
      const deleteErrors = [];

      // 逐个删除文件
      for (const fileName of fileNames) {
        try {
          const exists = await r2Service.fileExists(fileName);
          if (!exists) {
            deleteErrors.push({
              fileName,
              error: "文件不存在"
            });
            continue;
          }

          await r2Service.deleteFile(fileName);
          deleteResults.push({
            fileName,
            deletedAt: new Date().toISOString()
          });
        } catch (err) {
          deleteErrors.push({
            fileName,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      const currentUser = (req as any).user;
      logger.info(`用户 ${currentUser?.username || '未知'} 批量删除图片: 成功 ${deleteResults.length} 个, 失败 ${deleteErrors.length} 个`);

      return res.json({
        message: `成功删除 ${deleteResults.length} 个文件${deleteErrors.length > 0 ? `, ${deleteErrors.length} 个失败` : ''}`,
        data: {
          success: deleteResults,
          errors: deleteErrors,
          deletedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`批量删除失败: ${errorMsg}`);
      return res.status(500).json({
        error: "批量删除失败",
        detail: errorMsg
      });
    }
  }

  /**
   * 生成预签名上传 URL
   */
  static generateUploadUrl = async (req: Request, res: Response) => {
    try {
      if (!UploadController.checkR2Config(res)) return;

      const { fileName, expiresIn } = req.body;

      if (!fileName) {
        return res.status(400).json({ error: "缺少文件名参数" });
      }

      const expires = expiresIn || 3600;
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
}
