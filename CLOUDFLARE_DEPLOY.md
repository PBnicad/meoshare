# Cloudflare Workers 部署指南

本文档介绍如何将 MeoShare 部署到 Cloudflare Workers。

## 前置要求

1. 安装 [Bun](https://bun.sh/)
2. 安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
   ```bash
   bun install -g wrangler
   ```
3. 登录 Cloudflare
   ```bash
   wrangler login
   ```

## 部署步骤

### 1. 创建 Cloudflare 资源

#### 1.1 创建 D1 数据库

```bash
wrangler d1 create meoshare-db
```

记下返回的 `database_id`，更新 `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "meoshare-db"
database_id = "<你的-database-id>"  # 替换这里
```

#### 1.2 创建 R2 存储桶

```bash
wrangler r2 bucket create meoshare-files
```

#### 1.3 应用数据库迁移

```bash
# 开发环境（本地测试）
wrangler d1 execute meoshare-db --local --file=./src/db/migrations/0001_init.sql

# 生产环境
wrangler d1 execute meoshare-db --file=./src/db/migrations/0001_init.sql
```

### 2. 配置 GitHub OAuth

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写应用信息：
   - **Application name**: MeoShare
   - **Homepage URL**: `https://your-worker.workers.dev`
   - **Authorization callback URL**: `https://your-worker.workers.dev/api/auth/callback/github`
4. 点击 "Register application"
5. 记下 **Client ID**
6. 生成并记下 **Client Secret**（只显示一次）

### 3. 配置环境变量和密钥

#### 3.1 更新 wrangler.toml

```toml
[vars]
APP_URL = "https://your-worker.workers.dev"  # 替换为你的 Worker URL
```

#### 3.2 设置 GitHub OAuth 密钥

```bash
wrangler secret put GITHUB_CLIENT_ID
# 输入你的 GitHub Client ID

wrangler secret put GITHUB_CLIENT_SECRET
# 输入你的 GitHub Client Secret
```

### 4. 构建前端

```bash
bun run build
```

### 5. 部署到 Cloudflare Workers

```bash
bun run deploy
```

部署成功后，你会看到类似这样的输出：

```
✨ Success! Uploaded <your-worker-name>
   https://your-worker.workers.dev
```

## 部署后配置

### 更新 GitHub OAuth 回调 URL

部署成功后，记得回到 GitHub OAuth App 设置，将回调 URL更新为实际的 Worker URL：

```
https://your-worker.workers.dev/api/auth/callback/github
```

## 本地开发

### 启动本地开发服务器

```bash
# 终端 1: 启动 Worker（端口 8787）
bun run dev:worker

# 终端 2: 启动 Vite 前端（端口 3000）
bun run dev:frontend
```

访问 http://localhost:3000

### 本地环境变量

创建 `.dev.vars` 文件（已在 .gitignore 中）：

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
APP_URL=http://localhost:8787
```

## 常见问题

### Q: 如何查看 Worker 日志？

```bash
wrangler tail <worker-name>
```

### Q: 如何更新已部署的 Worker？

```bash
bun run build
bun run deploy
```

### Q: 如何删除过期文件？

Worker 配置了 Cron Trigger（每小时执行一次），会自动清理过期文件。

### Q: 如何备份数据？

#### 备份 D1 数据库

```bash
# 导出数据
wrangler d1 export meoshare-db --output=backup.sql

# 导入数据
wrangler d1 execute meoshare-db --file=./backup.sql
```

#### 备份 R2 存储桶

使用 [rclone](https://rclone.org/) 或其他工具同步 R2 存储桶。

## 成本估算

Cloudflare Workers 免费套餐：
- ✅ 100,000 次请求/天
- ✅ 10 ms CPU 时间/请求
- ✅ D1 数据库：5,000,000 次读取/天
- ✅ R2 存储：10 GB
- ✅ R2 Class A 操作：1,000,000 次/月

对于个人使用或小团队，免费套餐足够使用。

## 生产环境建议

1. **配置自定义域名**
   ```bash
   wrangler custom-domains add <your-domain.com>
   ```

2. **启用 Cloudflare Analytics**
   - 在 Cloudflare Dashboard 中为你的 Worker 启用 Analytics

3. **监控 Cron Triggers**
   ```bash
   wrangler schedules list
   ```

4. **设置速率限制**（可选）
   - 使用 Cloudflare Workers KV 存储请求计数
   - 在代码中实现速率限制逻辑

## 更新部署

每次修改代码后，重新运行：

```bash
bun run build
bun run deploy
```

## 回滚部署

如果部署出现问题，可以使用 `wrangler versions` 回滚：

```bash
# 列出版本
wrangler versions list

# 回滚到特定版本
wrangler versions rollback <version-id>
```

## 资源链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [R2 存储文档](https://developers.cloudflare.com/r2/)
