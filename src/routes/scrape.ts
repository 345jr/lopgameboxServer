import { Router } from "express";
import { getMetadata } from "../controllers/scrapeController";

const router = Router();

router.post("/metadata", getMetadata);

export default router;
