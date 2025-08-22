# 项目重构说明

## 新的项目结构

```
lopgameboxServer/
├── app.ts                          # 新的主入口文件
├── index.ts                        # 旧的入口文件（可以删除）
├── package.json
├── tsconfig.json
├── src/
│   ├── config/
│   │   └── env.ts                  # 环境配置
│   ├── controllers/
│   │   ├── authController.ts       # 认证控制器
│   │   ├── versionController.ts    # 版本控制器
│   │   ├── backupController.ts     # 备份控制器
│   │   └── generalController.ts    # 通用控制器
│   ├── routes/
│   │   ├── index.ts               # 路由总入口
│   │   ├── auth.ts                # 认证路由
│   │   ├── version.ts             # 版本路由
│   │   ├── backup.ts              # 备份路由
│   │   └── general.ts             # 通用路由
│   └── services/
│       └── database.ts            # 数据库服务
├── MiddleWare/
│   └── authMiddleware.ts          # 认证中间件
├── types/
│   ├── user.d.ts                  # 用户类型定义
│   └── version.ts                 # 版本类型定义
└── data/
    ├── server.db                  # 数据库文件
    └── backups/                   # 备份目录
```

## 重构优势

### 1. **模块化设计**
- 每个功能模块都有独立的控制器和路由
- 代码职责分离，易于维护

### 2. **可扩展性**
- 添加新功能只需要创建新的控制器和路由
- 不会影响现有代码

### 3. **代码组织**
- 配置统一管理
- 数据库服务单例模式
- 路由模块化

### 4. **类型安全**
- 保持了原有的 TypeScript 类型支持
- 修复了类型导入问题

## 使用方法

### 启动服务器
```bash
bun run app.ts
```

### 添加新的 API 接口

1. **创建控制器**（如 `src/controllers/newController.ts`）：
```typescript
import type { Request, Response } from "express";

export class NewController {
  static async someMethod(req: Request, res: Response) {
    // 业务逻辑
  }
}
```

2. **创建路由**（如 `src/routes/new.ts`）：
```typescript
import { Router } from "express";
import { NewController } from "../controllers/newController";

const newRoutes = Router();
newRoutes.get("/new-endpoint", NewController.someMethod);

export default newRoutes;
```

3. **在路由索引中注册**（`src/routes/index.ts`）：
```typescript
import newRoutes from "./new";
// ...
routes.use("/", newRoutes);
```

## 迁移说明

所有现有的 API 端点功能完全保持不变，只是代码组织方式改变了：

- `/register` - 用户注册
- `/login` - 用户登录  
- `/` - 测试接口（需认证）
- `/check-update` - 检查更新
- `/versions` - 版本管理
- `/backup` - 云备份

旧的 `index.ts` 文件可以保留作为参考，新的入口文件是 `app.ts`。
