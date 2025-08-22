FROM oven/bun:latest

# 工作目录
WORKDIR /app

# 复制 package.json 和 bun.lock 以便构建依赖
# 注意：如果没有 bun.lock，COPY 也不会失败（使用通配符 bun.lock*）
COPY package.json bun.lock* ./

# 安装生产依赖（简单模式，减小镜像层数）
RUN bun install --production

# 复制项目所有文件到镜像（包括源代码和 data 目录等）
COPY . .

# 设置默认端口（容器内部监听端口，宿主机访问需使用 -p 映射）
ENV PORT=3000
EXPOSE 3000

# 默认启动命令：直接用 bun 运行 TypeScript 入口文件
CMD ["bun", "run", "index.ts"]
