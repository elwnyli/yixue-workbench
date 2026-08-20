# 译学工作台 DeepSeek 安全代理

这个服务把 GitHub Pages 前端与 DeepSeek API 隔开。浏览器只保存代理地址；`DEEPSEEK_API_KEY` 只存在于 Railway、Render 或其他服务端的私密环境变量中。

## Railway 部署

1. 从当前 GitHub 仓库创建一个 Railway Service。
2. 将 Service 的 Root Directory 设置为 `/proxy`。
3. Railway 会使用 `proxy/Dockerfile` 构建。
4. 在 Variables 中新增 `DEEPSEEK_API_KEY`，值由你在 DeepSeek 开放平台复制并直接粘贴到 Railway；不要发到聊天或提交到 GitHub。
5. 建议保留：

   ```text
   ALLOWED_ORIGINS=https://elwnyli.github.io,https://raw.githack.com
   RATE_LIMIT_PER_MINUTE=30
   MAX_BODY_BYTES=900000
   ```

6. 生成 Railway Public Domain。工作台中的代理端点填写：

   ```text
   https://你的域名.up.railway.app/api/deepseek
   ```

健康检查地址为 `/health`。它只显示代理是否已经配置 Key，不会显示 Key 内容。

## 本地验证

不要把真实 Key 写进 `.env.example` 或仓库文件。可在临时终端环境中运行：

```bash
cd proxy
DEEPSEEK_API_KEY='只在当前终端临时设置' npm start
```

随后访问 `http://127.0.0.1:8787/health`。生产环境应使用 HTTPS。

## 支持的动作

- `test`
- `translate-and-review`
- `review`
- `review-segment`
- `translate-segments`
- `lookup-term`

代理限制允许模型、网页来源、请求大小和每分钟频率。术语查询没有接入外部检索时强制返回空来源数组，避免模型生成的解释冒充权威来源。
