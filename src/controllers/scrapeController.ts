import type { Request, Response } from 'express';
import scrapeService from '../services/scrapeService';

/**
 * 获取网页元数据控制器
 */
export const getMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, useCache = true } = req.body;

    // 验证URL参数
    if (!url) {
      res.status(400).json({
        success: false,
        message: '缺少必需参数: url'
      });
      return;
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'URL格式不正确'
      });
      return;
    }

    // 获取元数据
    const metadata = await scrapeService.getMetadata(url, useCache);

    res.status(200).json({
      success: true,
      message: '获取元数据成功',
      data: metadata
    });

  } catch (error) {
    console.error('获取元数据失败:', error);
    
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取元数据失败'
    });
  }
};
