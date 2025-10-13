# lopgameboxServer 项目结构

```
lopgameboxServer/
├── app.ts                      # 应用入口文件
├── package.json                # 项目依赖配置
├── bun.lock                    # Bun 锁文件
├── tsconfig.json               # TypeScript 配置
├── Dockerfile                  # Docker 镜像配置
├── .dockerignore               # Docker 忽略文件
├── README.md                   # 项目说明
├── todo.md                     # 待办事项
│
├── data/                       # 数据目录
│   ├── server.db              # SQLite 数据库
│   ├── run.sql                # 数据库初始化脚本
│   └── backups/               # 数据库备份目录
│
├── MiddleWare/                 # 中间件目录
│   ├── authMiddleware.ts      # 认证中间件
│   └── adminMiddleware.ts     # 管理员中间件
│
├── src/                        # 源代码目录
│   ├── config/                # 配置目录
│   │   └── env.ts            # 环境变量配置
│   │
│   ├── controllers/           # 控制器目录
│   │   ├── authController.ts       # 认证控制器
│   │   ├── userController.ts       # 用户控制器
│   │   ├── versionController.ts    # 版本控制器
│   │   ├── backupController.ts     # 备份控制器
│   │   ├── generalController.ts    # 通用控制器
│   │   └── scrapeController.ts     # 爬虫控制器
│   │
│   ├── routes/                # 路由目录
│   │   ├── index.ts          # 路由入口
│   │   ├── auth.ts           # 认证路由
│   │   ├── user.ts           # 用户路由
│   │   ├── version.ts        # 版本路由
│   │   ├── backup.ts         # 备份路由
│   │   ├── general.ts        # 通用路由
│   │   └── scrape.ts         # 爬虫路由
│   │
│   └── services/              # 服务层目录
│       ├── database.ts        # 数据库服务
│       └── scrapeService.ts   # 爬虫服务（新，Puppeteer）
│
└── types/                      # 类型定义目录
    ├── user.d.ts              # 用户类型定义
    └── version.ts             # 版本类型定义
```

## 核心功能模块

### 1. 认证系统
- JWT 令牌认证
- 用户注册/登录
- 角色权限管理

### 2. 版本管理
- 版本 CRUD 操作
- 版本信息查询

### 3. 备份系统
- 数据库备份
- 备份文件管理

### 4. 网页元数据抓取（Puppeteer）
- 动态网页抓取
- 元数据智能提取
- 内存缓存机制

## 技术栈

- **运行时**: Bun
- **框架**: Express
- **数据库**: SQLite
- **认证**: JWT + bcrypt
- **爬虫**: Puppeteer
- **语言**: TypeScript

## 环境变量

```env
PORT=3000                                    # 服务端口
NODE_ENV=production                          # 运行环境
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium  # Chromium 路径（Docker）
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true        # 跳过 Chromium 下载
```

## 部署方式

### Docker 部署
```bash
# 构建镜像
docker build -t lopgameboxserver .

# 运行容器
docker run -d -p 3000:3000 --name lopbox lopgameboxserver
```

### 本地运行
```bash
# 安装依赖
bun install

# 启动服务
bun run dev
```
