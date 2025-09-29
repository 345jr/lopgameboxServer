import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { config } from "../config/env";

export class BackupController {
  // 文件上传接口
  static uploadFile(req: Request, res: Response) {
    try {
      // 从请求头获取文件名
      const filename = req.get('X-Filename');
      
      if (!filename) {
        return res.status(400).json({ error: "缺少X-Filename请求头" });
      }

      // 检查请求体是否包含文件数据
      if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: "缺少文件数据" });
      }

      // 获取用户ID
      const uid = (req as any).user?.id ?? "anonymous";
      
      // 确定存储目录
      const uploadsDir = path.join(process.cwd(), config.BACKUPS_DIR, String(uid));
      fs.mkdirSync(uploadsDir, { recursive: true });

      // 安全处理文件名，移除危险字符
      const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      
      // 生成带时间戳的文件名，避免冲突
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const finalFilename = `${timestamp}_${safeName}`;
      const filePath = path.join(uploadsDir, finalFilename);

      // 写入文件（支持二进制数据）
      let fileBuffer: Buffer;
      
      if (Buffer.isBuffer(req.body)) {
        fileBuffer = req.body;
      } else if (typeof req.body === 'string') {
        // 尝试解析base64数据
        try {
          fileBuffer = Buffer.from(req.body, 'base64');
        } catch {
          // 如果不是base64，直接作为字符串处理
          fileBuffer = Buffer.from(req.body, 'utf8');
        }
      } else {
        fileBuffer = Buffer.from(JSON.stringify(req.body), 'utf8');
      }

      fs.writeFileSync(filePath, fileBuffer);

      return res.status(201).json({
        message: "文件上传成功",
        originalFilename: filename,
        savedFilename: finalFilename,
        size: fileBuffer.length,
        path: filePath.replace(process.cwd(), ""), // 返回相对路径
        uploadTime: new Date().toISOString()
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('文件上传失败:', errorMsg);
      return res.status(500).json({ 
        error: "文件上传失败", 
        detail: errorMsg 
      });
    }
  }

  // 云备份
  // static cloudBackup(req: Request, res: Response) {
  //   const { userId, filename, file } = req.body as {
  //     userId?: string | number;
  //     filename?: string;
  //     file?: string; // base64
  //   };

  //   if (!file) {
  //     return res.status(400).json({ error: "缺少文件数据" });
  //   }

  //   try {
  //     // 确定存储目录
  //     const uid = userId ?? (req as any).user?.id ?? "anonymous";
  //     const backupsDir = path.join(process.cwd(), config.BACKUPS_DIR, String(uid));
  //     fs.mkdirSync(backupsDir, { recursive: true });

  //     // 生成文件名
  //     const safeName =
  //       (filename && String(filename).replace(/[^a-zA-Z0-9._-]/g, "_")) ||
  //       "backup.db";
  //     const ts = new Date().toISOString().replace(/[:.]/g, "-");
  //     const outPath = path.join(backupsDir, `${ts}_${safeName}`);

  //     const buffer = Buffer.from(file, "base64");
  //     fs.writeFileSync(outPath, buffer);

  //     return res.status(201).json({ 
  //       message: "备份保存成功", 
  //       path: outPath.replace(process.cwd(), "") // 返回相对路径
  //     });
  //   } catch (err) {
  //     const errorMsg = err instanceof Error ? err.message : String(err);
  //     return res.status(500).json({ error: "备份失败", detail: errorMsg });
  //   }
  // }
}
