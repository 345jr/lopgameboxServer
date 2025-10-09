FROM oven/bun:latest

# 工作目录
WORKDIR /app

# 安装 Puppeteer 运行所需依赖和 Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    libglib2.0-0 \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxcomposite1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 复制 package.json 和 bun.lock 以便构建依赖
COPY package.json bun.lock* ./

# 安装依赖（生产环境）
RUN bun install --production

# 复制项目文件
COPY . .

# 创建数据目录
RUN mkdir -p /app/data/backups

# 环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["bun", "run", "app.ts"]
