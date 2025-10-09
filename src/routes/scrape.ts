import { Router } from "express";
import { getMetadata } from "../controllers/scrapeController";

const router = Router();

/**
 * POST /scrape/metadata
 * 获取网页元数据
 * 请求体: { url: string }
 */
router.post("/metadata", getMetadata);

export default router;
