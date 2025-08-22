import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { config } from "../config/env";

export class BackupController {
  // 云备份
  static cloudBackup(req: Request, res: Response) {
    const { userId, filename, file } = req.body as {
      userId?: string | number;
      filename?: string;
      file?: string; // base64
    };

    if (!file) {
      return res.status(400).json({ error: "缺少文件数据" });
    }

    try {
      // 确定存储目录
      const uid = userId ?? (req as any).user?.id ?? "anonymous";
      const backupsDir = path.join(process.cwd(), config.BACKUPS_DIR, String(uid));
      fs.mkdirSync(backupsDir, { recursive: true });

      // 生成文件名
      const safeName =
        (filename && String(filename).replace(/[^a-zA-Z0-9._-]/g, "_")) ||
        "backup.db";
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const outPath = path.join(backupsDir, `${ts}_${safeName}`);

      const buffer = Buffer.from(file, "base64");
      fs.writeFileSync(outPath, buffer);

      return res.status(201).json({ 
        message: "备份保存成功", 
        path: outPath.replace(process.cwd(), "") // 返回相对路径
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "备份失败", detail: errorMsg });
    }
  }
}
