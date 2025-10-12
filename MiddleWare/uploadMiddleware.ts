import express from "express";

// 文件上传中间件：处理原始数据
export const uploadMiddleware = express.raw({ 
  type: '*/*', 
  limit: '50mb' // 设置文件大小限制
});