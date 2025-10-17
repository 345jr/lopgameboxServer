import type { Request, Response } from "express";
import { db } from "../services/database";
import type { ImageRow, CreateImageData } from "../types/image";
import logger from "../utils/logger";

export class ImageController {
  /**
   * 保存图片信息到数据库
   */
  static saveImage(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const { fileName, originalName, fileUrl, size, mimeType, tag } = req.body;

      // 验证必需字段
      if (!fileName || !originalName || !fileUrl || !size || !mimeType) {
        return res.status(400).json({ 
          error: "缺少必需字段",
          detail: "需要 fileName, originalName, fileUrl, size, mimeType"
        });
      }

      // 插入图片记录
      const result = db.prepare(`
        INSERT INTO images (user_id, file_name, original_name, file_url, file_size, mime_type, tag)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        currentUser.id,
        fileName,
        originalName,
        fileUrl,
        size,
        mimeType,
        tag || null
      );

      // 获取刚插入的记录
      const image = db.prepare("SELECT * FROM images WHERE id = ?").get(result.lastInsertRowid) as ImageRow;

      logger.info(`用户 ${currentUser.username} 保存图片: ${fileName}`);

      return res.json({
        message: "图片信息保存成功",
        data: image
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`保存图片信息失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "保存图片信息失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 获取当前用户的所有图片
   */
  static getMyImages(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const { tag, page = 1, limit = 20 } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      let query = "SELECT * FROM images WHERE user_id = ?";
      const params: any[] = [currentUser.id];

      // 如果指定了 tag，添加筛选条件
      if (tag) {
        query += " AND tag = ?";
        params.push(tag);
      }

      // 添加排序和分页
      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(Number(limit), offset);

      const images = db.prepare(query).all(...params) as ImageRow[];

      // 获取总数
      let countQuery = "SELECT COUNT(*) as total FROM images WHERE user_id = ?";
      const countParams: any[] = [currentUser.id];
      if (tag) {
        countQuery += " AND tag = ?";
        countParams.push(tag);
      }
      const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

      return res.json({
        message: "获取图片列表成功",
        data: {
          images,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`获取图片列表失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "获取图片列表失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 获取单个图片信息
   */
  static getImageById(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const imageId = Number(req.params.id);

      if (!imageId || Number.isNaN(imageId)) {
        return res.status(400).json({ error: "无效的图片ID" });
      }

      const image = db.prepare("SELECT * FROM images WHERE id = ?").get(imageId) as ImageRow | undefined;

      if (!image) {
        return res.status(404).json({ error: "图片不存在" });
      }

      // 检查权限：只能查看自己的图片，除非是管理员
      if (image.user_id !== currentUser.id && currentUser.role !== 'admin') {
        return res.status(403).json({ error: "无权访问此图片" });
      }

      return res.json({
        message: "获取图片信息成功",
        data: image
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`获取图片信息失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "获取图片信息失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 更新图片信息（仅支持更新 tag）
   */
  static updateImage(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const imageId = Number(req.params.id);
      const { tag } = req.body;

      if (!imageId || Number.isNaN(imageId)) {
        return res.status(400).json({ error: "无效的图片ID" });
      }

      const image = db.prepare("SELECT * FROM images WHERE id = ?").get(imageId) as ImageRow | undefined;

      if (!image) {
        return res.status(404).json({ error: "图片不存在" });
      }

      // 检查权限：只能更新自己的图片
      if (image.user_id !== currentUser.id && currentUser.role !== 'admin') {
        return res.status(403).json({ error: "无权修改此图片" });
      }

      // 更新 tag
      db.prepare("UPDATE images SET tag = ? WHERE id = ?").run(tag || null, imageId);

      const updatedImage = db.prepare("SELECT * FROM images WHERE id = ?").get(imageId) as ImageRow;

      logger.info(`用户 ${currentUser.username} 更新图片 ${imageId} 的标签为: ${tag || '无'}`);

      return res.json({
        message: "图片信息更新成功",
        data: updatedImage
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`更新图片信息失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "更新图片信息失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 删除图片记录
   */
  static deleteImage(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const imageId = Number(req.params.id);

      if (!imageId || Number.isNaN(imageId)) {
        return res.status(400).json({ error: "无效的图片ID" });
      }

      const image = db.prepare("SELECT * FROM images WHERE id = ?").get(imageId) as ImageRow | undefined;

      if (!image) {
        return res.status(404).json({ error: "图片不存在" });
      }

      // 检查权限：只能删除自己的图片，除非是管理员
      if (image.user_id !== currentUser.id && currentUser.role !== 'admin') {
        return res.status(403).json({ error: "无权删除此图片" });
      }

      // 删除数据库记录
      db.prepare("DELETE FROM images WHERE id = ?").run(imageId);

      logger.info(`用户 ${currentUser.username} 删除图片记录: ${image.file_name}`);

      return res.json({
        message: "图片记录删除成功",
        data: {
          id: imageId,
          fileName: image.file_name
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`删除图片记录失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "删除图片记录失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 获取所有图片（管理员）
   */
  static getAllImages(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;

      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: "权限不足，仅管理员可访问" });
      }

      const { tag, userId, page = 1, limit = 20 } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      let query = "SELECT images.*, users.username FROM images LEFT JOIN users ON images.user_id = users.id WHERE 1=1";
      const params: any[] = [];

      // 筛选条件
      if (tag) {
        query += " AND images.tag = ?";
        params.push(tag);
      }

      if (userId) {
        query += " AND images.user_id = ?";
        params.push(Number(userId));
      }

      // 添加排序和分页
      query += " ORDER BY images.created_at DESC LIMIT ? OFFSET ?";
      params.push(Number(limit), offset);

      const images = db.prepare(query).all(...params) as (ImageRow & { username: string })[];

      // 获取总数
      let countQuery = "SELECT COUNT(*) as total FROM images WHERE 1=1";
      const countParams: any[] = [];
      if (tag) {
        countQuery += " AND tag = ?";
        countParams.push(tag);
      }
      if (userId) {
        countQuery += " AND user_id = ?";
        countParams.push(Number(userId));
      }
      const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

      return res.json({
        message: "获取所有图片成功",
        data: {
          images,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`获取所有图片失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "获取所有图片失败", 
        detail: errorMsg 
      });
    }
  }

  /**
   * 获取用户的标签列表
   */
  static getMyTags(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;

      const tags = db.prepare(`
        SELECT DISTINCT tag, COUNT(*) as count 
        FROM images 
        WHERE user_id = ? AND tag IS NOT NULL 
        GROUP BY tag 
        ORDER BY count DESC
      `).all(currentUser.id) as { tag: string; count: number }[];

      return res.json({
        message: "获取标签列表成功",
        data: tags
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`获取标签列表失败: ${errorMsg}`);
      return res.status(500).json({ 
        error: "获取标签列表失败", 
        detail: errorMsg 
      });
    }
  }
}
