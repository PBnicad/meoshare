# MeoShare

临时文件分享服务，基于 Cloudflare Workers + R2 + D1 构建。

## 功能特性

- 🔐 **GitHub OAuth 登录** - 使用 better-auth 实现
- 📁 **文件上传/下载** - 支持任意文件类型
- ⏰ **过期时间设置** - 1-30 天可选
- 📊 **文件管理** - 查看上传历史、下载统计
- 🗑️ **文件删除** - 可随时删除自己的文件
- 🔄 **自动清理** - Cron 定时清理过期文件
- 🎨 **现代 UI** - 基于 shadcn/ui + Tailwind CSS

## 技术栈

- **Runtime**: Bun
- **Backend**: Hono (Cloudflare Workers)
- **Frontend**: React + Vite
- **Database**: Cloudflare D1 (Drizzle ORM)
- **Storage**: Cloudflare R2
- **Auth**: better-auth (GitHub OAuth)
- **UI**: shadcn/ui + Tailwind CSS

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置 Cloudflare

#### 创建 D1 数据库

```bash
wrangler d1 create meoshare-db
```

记下返回的 `database_id`，更新 `wrangler.toml`。

#### 创建 R2 存储桶

```bash
wrangler r2 bucket create meoshare-files
```

#### 应用数据库迁移

```bash
# 本地开发
wrangler d1 execute meoshare-db --local --file=./src/db/migrations/0001_init.sql

# 生产环境
wrangler d1 execute meoshare-db --file=./src/db/migrations/0001_init.sql
```

### 3. 配置 GitHub OAuth

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 创建新的 OAuth App
3. 设置 Authorization callback URL: `https://your-worker.workers.dev/api/auth/callback/github`
4. 记下 Client ID 和 Client Secret

### 4. 配置环境变量

#### 更新 wrangler.toml

```toml
[vars]
APP_URL = "https://your-worker.workers.dev"

[[d1_databases]]
binding = "DB"
database_name = "meoshare-db"
database_id = "your-database-id"  # 替换为实际 ID
```

#### 设置密钥

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put BETTER_AUTH_SECRET
```

生成 `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 5. 本地开发

```bash
# 终端 1: 启动 Worker
bun run dev:worker

# 终端 2: 启动 Vite (开发 UI)
bun run dev:frontend
```

访问 http://localhost:3000

### 6. 部署

```bash
# 构建前端
bun run build:frontend

# 部署
bun run deploy
```

### 7. 配置 Cron (自动清理过期文件)

在 `wrangler.toml` 添加:

```toml
[triggers]
crons = ["0 * * * *"]  # 每小时执行一次
```

## 开发命令

```bash
# 开发
bun run dev:frontend  # 启动 Vite
bun run dev:worker    # 启动 Wrangler

# 构建
bun run build:frontend  # 构建前端

# 部署
bun run deploy

# 代码质量
bun run lint
bun run format
bun run format:check

# 测试
bun run test
```

## 项目结构

```
meoshare/
├── src/
│   ├── db/              # 数据库 schema 和迁移
│   ├── lib/             # 工具库 (auth.ts)
│   ├── routes/          # API 路由
│   ├── services/        # 业务逻辑 (R2, file)
│   ├── ui/              # React 前端
│   │   ├── components/  # UI 组件
│   │   ├── pages/       # 页面
│   │   ├── lib/         # 前端工具
│   │   └── styles/      # 样式
│   └── index.ts         # Worker 入口
├── public/              # 静态资源
├── wrangler.toml        # Cloudflare 配置
├── vite.config.ts       # Vite 配置
├── drizzle.config.ts    # Drizzle 配置
└── package.json
```

## API 端点

### 公开端点

- `GET /health` - 健康检查
- `GET /f/:id` - 文件下载页面
- `GET /api/file/:id` - 获取文件信息
- `GET /api/file/:id/download` - 下载文件

### 认证端点 (better-auth)

- `GET /api/auth/signin/github` - GitHub 登录
- `GET /api/auth/callback/github` - OAuth 回调
- `POST /api/auth/signout` - 退出登录
- `GET /api/auth/session` - 获取当前会话

### 用户端点 (需要登录)

- `GET /api/user` - 获取用户信息
- `GET /api/user/files` - 获取文件列表
- `POST /api/upload` - 上传文件
- `DELETE /api/file/:id` - 删除文件

## 许可证

MIT
