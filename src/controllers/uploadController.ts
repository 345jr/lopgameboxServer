import type { Request, Response } from "express";
import { r2Service } from "../services/r2Service";
import { db } from "../services/database";
import logger from "../utils/logger";
import { uploadConfigManager } from "../config/uploadConfig";
import crypto from "crypto";
import path from "path";

// MIME 类型和大小限制已在 uploadMiddleware 中通过 multer 进行验证
// 无需在控制器中重复验证

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
   * 获取 R2 服务状态
   */
  static getServiceStatus = (req: Request, res: Response) => {
    const isConfigured = r2Service.isConfigured();
    const config = uploadConfigManager.getFormattedConfig();

    return res.json({
      message: "获取服务状态成功",
      data: {
        configured: isConfigured,
        status: isConfigured ? "可用" : "未配置",
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        maxFileSize: config.maxFileSize,
        maxBatchUpload: config.maxBatchCount
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

      // 从数据库中获取图片记录
      const image = db.prepare("SELECT * FROM images WHERE file_name = ?").get(fileName) as any;

      // 删除 R2 存储的文件
      await r2Service.deleteFile(fileName);

      // 删除数据库中的记录
      if (image) {
        db.prepare("DELETE FROM images WHERE file_name = ?").run(fileName);
      }

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

          // 删除 R2 存储的文件
          await r2Service.deleteFile(fileName);

          // 删除数据库中的记录
          db.prepare("DELETE FROM images WHERE file_name = ?").run(fileName);

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

  /**
   * 获取上传配置（管理员）
   */
  static getUploadConfig = (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;

      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可访问" });
      }

      const config = uploadConfigManager.getConfig();
      const formatted = uploadConfigManager.getFormattedConfig();

      return res.json({
        message: "获取上传配置成功",
        data: {
          current: formatted,
          bytes: config,
          limits: {
            maxFileSize: `${(config.maxFileSize / 1024 / 1024).toFixed(0)}MB`,
            maxBatchCount: config.maxBatchCount
          }
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`获取上传配置失败: ${errorMsg}`);
      return res.status(500).json({
        error: "获取上传配置失败",
        detail: errorMsg
      });
    }
  }

  /**
   * 更新上传配置（管理员）
   */
  static updateUploadConfig = (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;

      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可访问" });
      }

      const { maxFileSize, maxBatchCount } = req.body;

      // 验证至少提供一个参数
      if (maxFileSize === undefined && maxBatchCount === undefined) {
        return res.status(400).json({
          error: "缺少参数",
          detail: "至少需要提供 maxFileSize 或 maxBatchCount"
        });
      }

      // 构建更新对象
      const updateData: any = {};
      if (maxFileSize !== undefined) {
        updateData.maxFileSize = maxFileSize;
      }
      if (maxBatchCount !== undefined) {
        updateData.maxBatchCount = maxBatchCount;
      }

      // 更新配置
      const newConfig = uploadConfigManager.updateConfig(updateData);
      const formatted = uploadConfigManager.getFormattedConfig();

      logger.info(`管理员 ${currentUser.username} 更新了上传配置: ${JSON.stringify(updateData)}`);

      return res.json({
        message: "上传配置更新成功",
        data: {
          updated: formatted,
          bytes: newConfig
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`更新上传配置失败: ${errorMsg}`);
      return res.status(400).json({
        error: "更新上传配置失败",
        detail: errorMsg
      });
    }
  }

  /**
   * 重置上传配置到默认值（管理员）
   */
  static resetUploadConfig = (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;

      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可访问" });
      }

      const resetConfig = uploadConfigManager.resetConfig();
      const formatted = uploadConfigManager.getFormattedConfig();

      logger.info(`管理员 ${currentUser.username} 重置了上传配置`);

      return res.json({
        message: "上传配置已重置为默认值",
        data: {
          current: formatted,
          bytes: resetConfig
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`重置上传配置失败: ${errorMsg}`);
      return res.status(500).json({
        error: "重置上传配置失败",
        detail: errorMsg
      });
    }
  }
}
