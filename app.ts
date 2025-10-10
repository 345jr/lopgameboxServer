import express from "express";
import cors from "cors";
import { config } from "./src/config/env";
import routes from "./src/routes";
import "./src/services/database"; // 初始化数据库

const app = express();

// CORS 配置
app.use(cors({
  origin: [
    // 生产环境域名
    'https://lopbox.lopop.top',
    'https://www.lopbox.lopop.top',
    // 开发环境本地地址
    'http://localhost:3000',    // React 默认端口
    'http://localhost:5173',    // Vite 默认端口
    'http://localhost:8080',    // Vue CLI 默认端口
    'http://localhost:4200',    // Angular 默认端口
    'http://127.0.0.1:5173',    // 本地 IP 形式
    'http://127.0.0.1:3000',
    // 如果需要允许所有来源，可以设置为 true，但不安全
  ],
  // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // allowedHeaders: ['','Content-Type', 'Authorization', 'X-Filename'],
  // credentials: true // 允许携带凭证（如果前端需要发送 cookies 或 authorization header）
}));

// 其他中间件
app.use(express.json());

// 路由
app.use("/", routes);

// 启动服务器
app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}...`);
});
