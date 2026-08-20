# 译学工作台

面向翻译专业学习者的过程化翻译训练原型，将动态输入、独立初译、分角色反馈、翻译决策、表达积累、周期复习和学习反思连接为可追踪流程。

## 当前版本

- 译学晨读与来源记录
- 翻译任务、初译和修订版本
- 演示反馈引擎与安全反馈端点适配器
- 反馈采纳/拒绝及理由
- 表达手账和可调整复习间隔
- 学习过程时间线
- 完整工作台数据 JSON 导出
- 响应式桌面与移动界面

所有学习数据默认保存在浏览器 `localStorage` 中。该版本适合平台功能验证和演示，不用于直接证明学习效果。

## 本地运行

```bash
pnpm install
pnpm dev
```

构建检查：

```bash
pnpm build
pnpm preview
```

## GitHub Pages

当前仓库从 `main` 分支的 `/docs` 目录发布。更新线上版本前运行：

```bash
pnpm deploy:build
git add docs
git commit -m "Update GitHub Pages build"
git push
```

GitHub Pages 会在推送后发布新的静态文件。

## 接入真实 AI

公开网页中不能存放模型 API 密钥。设置页支持填写一个自有服务器端点，前端发送：

```json
{
  "task": {
    "sourceText": "...",
    "brief": "...",
    "audience": "...",
    "initialTranslation": "..."
  }
}
```

端点返回：

```json
{
  "feedback": [
    {
      "id": "optional-id",
      "role": "术语核验",
      "title": "反馈标题",
      "observation": "观察",
      "suggestion": "建议",
      "evidence": "依据",
      "status": "pending",
      "reason": "",
      "expression": "optional expression",
      "meaning": "可选释义"
    }
  ]
}
```

端点调用失败时，平台自动回退到演示反馈，不会中断学习流程。

## 数据与伦理

首版不包含账户、云端数据库或学生数据采集。在将平台用于正式课堂研究前，需要补充身份与权限管理、数据匿名化、知情同意、保留期限和所在机构要求的伦理审查或判定。
