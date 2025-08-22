import type { Request, Response } from "express";
import { db } from "../services/database";
import type { VersionRow } from "../../types/version";

export class VersionController {
  // 检查更新
  static checkUpdate(req: Request, res: Response) {
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: "缺少版本号" });
    }

    try {
      // 直接从数据库按发布时间获取最新版本
      const latest = db
        .prepare(
          "SELECT * FROM versions ORDER BY datetime(release_date) DESC LIMIT 1"
        )
        .get() as VersionRow | undefined;

      if (!latest) {
        return res.status(404).json({ error: "未找到版本信息" });
      }

      if (version === latest.version) {
        return res.json({
          update: false,
          message: "已是最新版本",
          latest: latest.version,
        });
      }

      return res.json({
        update: true,
        latest: latest.version,
        release_date: latest.release_date,
        notes: latest.notes || "",
        message: `有新版本: ${latest.version}`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "检查更新失败", detail: errorMsg });
    }
  }

  // 添加新版本
  static addVersion(req: Request, res: Response) {
    const { version, release_date, notes } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: "缺少版本号" });
    }

    try {
      const info = db
        .prepare(
          "INSERT INTO versions (version, release_date, notes) VALUES (?, ?, ?)"
        )
        .run(version, release_date || new Date().toISOString(), notes || null);

      const id = Number((info as any).lastInsertRowid);
      const inserted = db
        .prepare("SELECT * FROM versions WHERE id = ?")
        .get(id) as VersionRow | undefined;

      return res.status(201).json({ message: "添加成功", version: inserted });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (typeof errorMsg === "string" && /UNIQUE/.test(errorMsg)) {
        return res.status(409).json({ error: "版本号已存在" });
      }
      return res.status(500).json({ error: "添加版本失败", detail: errorMsg });
    }
  }

  // 删除版本(按 id)
  static deleteVersionById(req: Request, res: Response) {
    const id = Number(req.params.id);
    
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "无效的 id" });
    }

    try {
      const info = db.prepare("DELETE FROM versions WHERE id = ?").run(id);
      if ((info as any).changes === 0) {
        return res.status(404).json({ error: "未找到该版本" });
      }
      return res.json({ message: "删除成功", id });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "删除失败", detail: errorMsg });
    }
  }

  // 删除版本(按版本号)
  static deleteVersionByName(req: Request, res: Response) {
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: "缺少 version 字段" });
    }

    try {
      const info = db
        .prepare("DELETE FROM versions WHERE version = ?")
        .run(version);

      if ((info as any).changes === 0) {
        return res.status(404).json({ error: "未找到该版本" });
      }
      return res.json({ message: "删除成功", version });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "删除失败", detail: errorMsg });
    }
  }

  // 根据版本号查询版本信息 (无需认证)
  static getVersionByNumber(req: Request, res: Response) {
    const { version } = req.params;
    
    if (!version) {
      return res.status(400).json({ error: "缺少版本号参数" });
    }

    try {
      const versionInfo = db
        .prepare("SELECT * FROM versions WHERE version = ?")
        .get(version) as VersionRow | undefined;

      if (!versionInfo) {
        return res.status(404).json({ error: "未找到该版本信息" });
      }

      return res.json({
        message: "查询版本信息成功",
        version: versionInfo
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "查询版本信息失败", detail: errorMsg });
    }
  }
}
