# 本地测试指南

## 快速开始

### 1. 初始化本地数据库
```bash
wrangler d1 execute meoshare-db --local --file=./src/db/migrations/0001_init.sql
```

### 2. 配置环境变量

编辑 `.dev.vars` 文件，添加你的 GitHub OAuth 凭据：
```env
APP_URL=http://localhost:8788
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
BETTER_AUTH_SECRET=local_development_secret_at_least_32_characters_long
BETTER_AUTH_URL=http://localhost:8788
```

### 3. 启动开发服务器

**终端 1 - Worker (后端)**
```bash
bun run dev:worker
```
访问: http://localhost:8788

**终端 2 - Vite (前端热重载)**
```bash
bun run dev:frontend
```
访问: http://localhost:3000

### 4. 测试功能

#### 测试 API 端点
```bash
# 健康检查
curl http://localhost:8788/health

# 获取会话 (未登录应返回 401)
curl http://localhost:8788/api/user -v
```

#### 测试文件上传
1. 访问 http://localhost:3000
2. 点击 "GitHub 登录"
3. 上传文件

### 5. 查看本地数据库

```bash
# 查看所有表
wrangler d1 execute meoshare-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"

# 查看用户
wrangler d1 execute meoshare-db --local --command="SELECT * FROM user"

# 查看文件
wrangler d1 execute meoshare-db --local --command="SELECT * FROM files"
```

## 常见问题

### Q: 上传文件失败
A: 确保你已登录，并且本地 R2 模拟正常工作

### Q: GitHub OAuth 报错
A: 检查 `.dev.vars` 中的配置是否正确，确保回调 URL 匹配

### Q: 前端无法连接后端
A: 确保 Worker 正在运行在 `http://localhost:8788`

## 生产部署

### 1. 创建生产资源
```bash
# 创建 D1 数据库
wrangler d1 create meoshare-db
# 记下 database_id 并更新 wrangler.toml

# 创建 R2 存储桶
wrangler r2 bucket create meoshare-files

# 应用迁移
wrangler d1 execute meoshare-db --file=./src/db/migrations/0001_init.sql
```

### 2. 设置生产密钥
```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put BETTER_AUTH_SECRET
```

### 3. 构建并部署
```bash
bun run build:frontend
bun run deploy
```
