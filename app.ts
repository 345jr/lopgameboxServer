import express from "express";
import { config } from "./src/config/env";
import routes from "./src/routes";
import "./src/services/database"; // 初始化数据库

const app = express();

// 中间件
app.use(express.json());

// 路由
app.use("/", routes);

// 启动服务器
app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}...`);
});
